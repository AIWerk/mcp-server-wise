import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realpathSync, writeFileSync, symlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, toolError, isCliEntry } from '../server.js';
import {
  WiseApiError,
  WiseTimeoutError,
  WiseNetworkError,
  WiseConfigError,
} from '../api.js';

beforeEach(() => {
  vi.stubEnv('WISE_API_TOKEN', 'test-token');
  vi.stubEnv('WISE_API_BASE_URL', 'https://api.wise.com');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// ⚠️ BRITTLE — SDK INTERNAL FIELDS
// The MCP SDK does not expose a public "list registered tools" API on the
// server instance. These tests reach into private fields (_registeredTools
// et al.) purely to verify the server wiring without running a full client/
// server pair. On @modelcontextprotocol/sdk upgrades, the private field name
// may change; fix the lookup list below or migrate to an InMemoryTransport +
// client.listTools() setup if/when the SDK exposes a stable introspection API.
// See: https://github.com/modelcontextprotocol/typescript-sdk
type RegistryLike = {
  _registeredTools?: Record<string, unknown>;
  _registeredToolsByName?: Record<string, unknown>;
  registerTool?: unknown;
};

const KNOWN_PRIVATE_FIELDS = ['_registeredTools', '_registeredToolsByName', '_tools'] as const;

function toolRegistry(server: unknown): Record<string, unknown> {
  const s = server as unknown as RegistryLike & Record<string, unknown>;
  for (const key of KNOWN_PRIVATE_FIELDS) {
    const candidate = (s as unknown as Record<string, unknown>)[key];
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }
  }
  throw new Error(
    `could not locate tool registry on McpServer instance. Tried private fields: ${KNOWN_PRIVATE_FIELDS.join(', ')}. ` +
      `The @modelcontextprotocol/sdk internals may have changed — update KNOWN_PRIVATE_FIELDS or refactor these tests to use InMemoryTransport + client.listTools().`,
  );
}

function extractToolNames(server: unknown): string[] {
  return Object.keys(toolRegistry(server));
}

describe('createServer tool registration', () => {
  it('registers exactly 11 tools', () => {
    const server = createServer();
    const names = extractToolNames(server);
    expect(names.length).toBe(11);
  });

  it('registers expected tool names with wise_ prefix', () => {
    const server = createServer();
    const names = extractToolNames(server).sort();
    const expected = [
      'wise_get_account_requirements',
      'wise_get_balance',
      'wise_get_exchange_rate',
      'wise_get_exchange_rate_history',
      'wise_get_profile',
      'wise_get_recipient',
      'wise_get_transfer',
      'wise_list_balances',
      'wise_list_profiles',
      'wise_list_recipients',
      'wise_list_transfers',
    ];
    expect(names).toEqual(expected);
  });

  it('every tool is marked readOnlyHint: true', () => {
    const server = createServer();
    const entries = Object.entries(toolRegistry(server));
    expect(entries.length).toBe(11);
    for (const [name, entry] of entries) {
      const e = entry as { annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean } };
      expect(e.annotations?.readOnlyHint, `${name} readOnlyHint`).toBe(true);
      expect(e.annotations?.openWorldHint, `${name} openWorldHint`).toBe(true);
    }
  });
});

describe('toolError error-type routing', () => {
  it('WiseTimeoutError → timeout-tagged message', () => {
    const err = new WiseTimeoutError(30000, 'GET', '/v2/profiles');
    const out = toolError(err);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/^Timeout:/);
    expect(out.content[0].text).toMatch(/WISE_API_TIMEOUT_MS/);
  });

  it('WiseNetworkError → network-tagged message', () => {
    const err = new WiseNetworkError('GET', '/v2/profiles', new Error('ECONNREFUSED'));
    const out = toolError(err);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/^Network error:/);
  });

  it('WiseConfigError → config-tagged message', () => {
    const err = new WiseConfigError('WISE_API_TOKEN not set');
    const out = toolError(err);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/^Configuration error:/);
  });

  it('WiseApiError → HTTP-tagged message with status + body', () => {
    const err = new WiseApiError(404, 'Not Found', { detail: 'missing' }, 'boom');
    const out = toolError(err);
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toMatch(/404 Not Found/);
    expect(out.content[0].text).toMatch(/missing/);
  });

  it('WiseApiError with null body omits body section', () => {
    const err = new WiseApiError(500, 'Internal Server Error', null, 'boom');
    const out = toolError(err);
    expect(out.content[0].text).toMatch(/500 Internal Server Error$/);
  });

  it('plain Error → message passed through', () => {
    const out = toolError(new Error('unexpected'));
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe('unexpected');
  });

  it('non-Error value → String()-ed', () => {
    const out = toolError({ weird: true });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe('[object Object]');
  });
});

describe('isCliEntry', () => {
  let tmpDir: string;
  let moduleFile: string;
  let shimFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'wise-cli-test-'));
    moduleFile = join(tmpDir, 'server.js');
    shimFile = join(tmpDir, 'mcp-server-wise');
    writeFileSync(moduleFile, '// server module');
    symlinkSync(moduleFile, shimFile);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true when argv[1] matches the module URL directly', () => {
    const moduleUrl = `file://${realpathSync(moduleFile)}`;
    expect(isCliEntry(moduleUrl, moduleFile)).toBe(true);
  });

  it('returns true when argv[1] is a symlink pointing to the module', () => {
    const moduleUrl = `file://${realpathSync(moduleFile)}`;
    // Simulate npm bin shim: argv[1] is the symlink, module URL is the real path.
    expect(isCliEntry(moduleUrl, shimFile)).toBe(true);
  });

  it('returns false when argv[1] is a different file', () => {
    const otherFile = join(tmpDir, 'other.js');
    writeFileSync(otherFile, '// other');
    const moduleUrl = `file://${realpathSync(moduleFile)}`;
    expect(isCliEntry(moduleUrl, otherFile)).toBe(false);
  });

  it('returns false when argv[1] is undefined', () => {
    const moduleUrl = `file://${realpathSync(moduleFile)}`;
    expect(isCliEntry(moduleUrl, undefined)).toBe(false);
  });

  it('returns false when realpath resolution throws', () => {
    const moduleUrl = `file://${realpathSync(moduleFile)}`;
    const nonExistent = join(tmpDir, 'does-not-exist.js');
    expect(isCliEntry(moduleUrl, nonExistent)).toBe(false);
  });
});
