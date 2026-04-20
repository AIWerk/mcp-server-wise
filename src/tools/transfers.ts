import * as z from 'zod';
import { wiseApi } from '../api.js';
import { currencyCode, isoDatetime } from '../validators.js';

// Known statuses as of Wise docs 2026-04. Upstream may add values — we accept
// the known list first, and fall back to z.string() so new statuses aren't
// blocked client-side. Caller gets the same transparency either way.
const KNOWN_TRANSFER_STATUSES = [
  'incoming_payment_waiting',
  'incoming_payment_initiated',
  'processing',
  'funds_converted',
  'outgoing_payment_sent',
  'bounced_back',
  'cancelled',
  'funds_refunded',
  'waiting_recipient_input_to_proceed',
] as const;

export const listTransfersInput = {
  profileId: z.number().int().positive().describe('Profile ID'),
  status: z
    .union([z.enum(KNOWN_TRANSFER_STATUSES), z.string()])
    .optional()
    .describe(
      `Filter by status. Known values: ${KNOWN_TRANSFER_STATUSES.join(', ')}. ` +
        `Forward-compat escape hatch: any other string is accepted and forwarded verbatim.`,
    ),
  createdDateStart: isoDatetime()
    .optional()
    .describe('ISO-8601 start timestamp, e.g. 2026-01-01T00:00:00.000Z'),
  createdDateEnd: isoDatetime().optional().describe('ISO-8601 end timestamp'),
  sourceCurrency: currencyCode().optional().describe('Filter by source currency (ISO-4217)'),
  targetCurrency: currencyCode().optional().describe('Filter by target currency'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Results per page (default 10, max 100)'),
  offset: z.number().int().min(0).default(0).describe('Pagination offset'),
};

export async function listTransfers(args: {
  profileId: number;
  status?: string;
  createdDateStart?: string;
  createdDateEnd?: string;
  sourceCurrency?: string;
  targetCurrency?: string;
  limit?: number;
  offset?: number;
}) {
  return wiseApi.get('/v1/transfers', {
    profile: args.profileId,
    status: args.status,
    createdDateStart: args.createdDateStart,
    createdDateEnd: args.createdDateEnd,
    sourceCurrency: args.sourceCurrency?.toUpperCase(),
    targetCurrency: args.targetCurrency?.toUpperCase(),
    limit: args.limit ?? 10,
    offset: args.offset ?? 0,
  });
}

export const getTransferInput = {
  transferId: z.number().int().positive().describe('Transfer ID (from list_transfers)'),
};

export async function getTransfer(args: { transferId: number }) {
  return wiseApi.get(`/v1/transfers/${args.transferId}`);
}
