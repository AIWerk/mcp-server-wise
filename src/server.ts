#!/usr/bin/env node
// Wise (TransferWise) Personal API MCP server — 10 read-only tools.

import { readFileSync, realpathSync } from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { WiseApiError } from './api.js';
import { listProfiles, getProfile, listProfilesInput, getProfileInput } from './tools/profiles.js';
import {
  listBalances,
  getBalance,
  listBalancesInput,
  getBalanceInput,
} from './tools/balances.js';
import {
  getExchangeRate,
  getExchangeRateHistory,
  getExchangeRateInput,
  getExchangeRateHistoryInput,
} from './tools/rates.js';
import {
  listTransfers,
  getTransfer,
  listTransfersInput,
  getTransferInput,
} from './tools/transfers.js';
import {
  listRecipients,
  getRecipient,
  getAccountRequirements,
  listRecipientsInput,
  getRecipientInput,
  getAccountRequirementsInput,
} from './tools/recipients.js';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as {
      version: string;
    };
    return pkg.version;
  }
}

const VERSION = readPackageVersion();

function toolSuccess(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(error: unknown) {
  let message: string;
  if (error instanceof WiseApiError) {
    message = `Wise API error ${error.status} ${error.statusText}: ${JSON.stringify(error.body)}`;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

function wrap<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  return async (args: TArgs) => {
    try {
      const data = await fn(args);
      return toolSuccess(data);
    } catch (err) {
      return toolError(err);
    }
  };
}

export function createServer() {
  const server = new McpServer({
    name: '@aiwerk/mcp-server-wise',
    version: VERSION,
  });

  // ---- Profiles ----
  server.registerTool(
    'wise_list_profiles',
    {
      description:
        'List all profiles (PERSONAL and BUSINESS) accessible with the token. ALWAYS call this first — most other tools need a profileId.',
      inputSchema: listProfilesInput,
      annotations: { title: 'List Profiles', readOnlyHint: true, openWorldHint: true },
    },
    wrap(listProfiles),
  );

  server.registerTool(
    'wise_get_profile',
    {
      description: 'Get a profile by ID (name, type, address, KYC status).',
      inputSchema: getProfileInput,
      annotations: { title: 'Get Profile', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getProfile),
  );

  // ---- Balances ----
  server.registerTool(
    'wise_list_balances',
    {
      description:
        'List balance accounts for a profile. STANDARD = one per currency (the multi-currency account). SAVINGS = jars (user-named buckets). Default returns only STANDARD.',
      inputSchema: listBalancesInput,
      annotations: { title: 'List Balances', readOnlyHint: true, openWorldHint: true },
    },
    wrap(listBalances),
  );

  server.registerTool(
    'wise_get_balance',
    {
      description: 'Get a specific balance by ID (available amount, reserved amount, last updated).',
      inputSchema: getBalanceInput,
      annotations: { title: 'Get Balance', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getBalance),
  );

  // ---- Rates ----
  server.registerTool(
    'wise_get_exchange_rate',
    {
      description: 'Get the current mid-market exchange rate between two currencies.',
      inputSchema: getExchangeRateInput,
      annotations: { title: 'Get Exchange Rate', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getExchangeRate),
  );

  server.registerTool(
    'wise_get_exchange_rate_history',
    {
      description:
        'Get historical mid-market exchange rates between two currencies. group: day/hour/minute granularity.',
      inputSchema: getExchangeRateHistoryInput,
      annotations: { title: 'Get Exchange Rate History', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getExchangeRateHistory),
  );

  // ---- Transfers ----
  server.registerTool(
    'wise_list_transfers',
    {
      description:
        'List transfers for a profile with optional filters. Use status to narrow: incoming_payment_waiting, processing, funds_converted, outgoing_payment_sent, bounced_back, cancelled, funds_refunded.',
      inputSchema: listTransfersInput,
      annotations: { title: 'List Transfers', readOnlyHint: true, openWorldHint: true },
    },
    wrap(listTransfers),
  );

  server.registerTool(
    'wise_get_transfer',
    {
      description: 'Get a specific transfer by ID (status, amounts, recipient, quote, timestamps).',
      inputSchema: getTransferInput,
      annotations: { title: 'Get Transfer', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getTransfer),
  );

  // ---- Recipients ----
  server.registerTool(
    'wise_list_recipients',
    {
      description:
        'List recipient accounts for a profile. Filter by currency if you only want e.g. EUR beneficiaries.',
      inputSchema: listRecipientsInput,
      annotations: { title: 'List Recipients', readOnlyHint: true, openWorldHint: true },
    },
    wrap(listRecipients),
  );

  server.registerTool(
    'wise_get_recipient',
    {
      description:
        'Get a recipient account by ID (bank details, account holder, currency).',
      inputSchema: getRecipientInput,
      annotations: { title: 'Get Recipient', readOnlyHint: true, openWorldHint: true },
    },
    wrap(getRecipient),
  );

  server.registerTool(
    'wise_get_account_requirements',
    {
      description:
        'Get the required bank-account fields for creating a recipient in a given source→target currency + amount. Fields differ by country: USD routing number, EUR IBAN, GBP sort code, etc.',
      inputSchema: getAccountRequirementsInput,
      annotations: {
        title: 'Get Account Requirements',
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    wrap(getAccountRequirements),
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run main when invoked as a CLI. Comparing import.meta.url to process.argv[1]
// directly fails when npm creates a bin shim — the shim's path differs from
// the real module path. Resolve symlinks on both sides before comparing so
// `npx @aiwerk/mcp-server-wise` works the same as `node dist/src/server.js`.
function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  main().catch((err) => {
    console.error('[mcp-server-wise] fatal:', err);
    process.exit(1);
  });
}
