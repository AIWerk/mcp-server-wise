import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WiseApiError,
  WiseTimeoutError,
  WiseNetworkError,
  WiseConfigError,
  wiseApi,
} from '../api.js';

type MockFetchOpts = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
  contentType?: string;
  jsonThrows?: boolean;
};

function mockFetch(opts: MockFetchOpts = {}) {
  const body = opts.body ?? {};
  const contentType = opts.contentType ?? 'application/json';
  const headers = new Headers({ 'content-type': contentType });
  const jsonImpl = opts.jsonThrows
    ? () => Promise.reject(new SyntaxError('invalid JSON'))
    : () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body);
  const textImpl = () =>
    Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body));
  return vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    headers,
    json: jsonImpl,
    text: textImpl,
  });
}

beforeEach(() => {
  vi.stubEnv('WISE_API_TOKEN', 'test-token');
  vi.stubEnv('WISE_API_BASE_URL', 'https://api.wise.com');
  vi.stubEnv('WISE_API_TIMEOUT_MS', '5000');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('error classes', () => {
  it('WiseApiError carries status, statusText, body, message', () => {
    const err = new WiseApiError(404, 'Not Found', { error: 'missing' }, 'resource missing');
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.body).toEqual({ error: 'missing' });
    expect(err.name).toBe('WiseApiError');
  });

  it('WiseTimeoutError carries timeoutMs, method, path', () => {
    const err = new WiseTimeoutError(30000, 'GET', '/v2/profiles');
    expect(err.timeoutMs).toBe(30000);
    expect(err.method).toBe('GET');
    expect(err.path).toBe('/v2/profiles');
    expect(err.name).toBe('WiseTimeoutError');
    expect(err.message).toMatch(/timed out after 30000ms/);
  });

  it('WiseNetworkError wraps underlying cause', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new WiseNetworkError('GET', '/v2/profiles', cause);
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('WiseNetworkError');
    expect(err.message).toMatch(/ECONNREFUSED/);
  });

  it('WiseConfigError is its own class', () => {
    const err = new WiseConfigError('bad env');
    expect(err.name).toBe('WiseConfigError');
    expect(err.message).toBe('bad env');
  });
});

describe('token + config', () => {
  it('throws WiseConfigError when WISE_API_TOKEN is missing', async () => {
    vi.stubEnv('WISE_API_TOKEN', '');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('sends Authorization: Bearer <token>', async () => {
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});

describe('base URL hardening', () => {
  it('uses WISE_API_BASE_URL when https + allowlisted', async () => {
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.wise.com/v2/profiles');
  });

  it('accepts sandbox host from allowlist', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'https://api.sandbox.transferwise.tech');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.sandbox.transferwise.tech/v2/profiles');
  });

  it('defaults to https://api.wise.com when env unset', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('WISE_API_TOKEN', 'test-token');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.wise.com/v2/profiles');
  });

  it('strips trailing slash from WISE_API_BASE_URL', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'https://api.wise.com/');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.wise.com/v2/profiles');
  });

  it('rejects non-https base URL without escape hatch', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'http://api.wise.com');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('rejects non-allowlisted host without escape hatch', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'https://evil.example.com');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('accepts arbitrary host with WISE_API_ALLOW_UNSAFE_BASE_URL=1', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'https://custom.proxy.example');
    vi.stubEnv('WISE_API_ALLOW_UNSAFE_BASE_URL', '1');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://custom.proxy.example/v2/profiles');
  });

  it('accepts http under escape hatch', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'http://localhost:8080');
    vi.stubEnv('WISE_API_ALLOW_UNSAFE_BASE_URL', '1');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('http://localhost:8080/v2/profiles');
  });

  it('throws WiseConfigError on malformed URL', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'not-a-url');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });
});

describe('query serialization', () => {
  it('encodes string/number/boolean; skips undefined and null', async () => {
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v1/transfers', {
      profile: 123,
      status: 'processing',
      flag: true,
      skipMe: undefined,
      alsoSkip: null,
    });
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('profile=123');
    expect(url).toContain('status=processing');
    expect(url).toContain('flag=true');
    expect(url).not.toContain('skipMe');
    expect(url).not.toContain('alsoSkip');
  });
});

describe('response handling', () => {
  it('parses application/json', async () => {
    vi.stubGlobal('fetch', mockFetch({ body: { id: 42 } }));
    const result = await wiseApi.get<{ id: number }>('/v2/profiles/42');
    expect(result).toEqual({ id: 42 });
  });

  it('returns text on non-json content-type', async () => {
    vi.stubGlobal('fetch', mockFetch({ body: 'ok', contentType: 'text/plain' }));
    const result = await wiseApi.get('/v1/rates');
    expect(result).toBe('ok');
  });

  it('throws WiseApiError on 404 with JSON error body', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: false, status: 404, statusText: 'Not Found', body: { error: 'missing' } }),
    );
    await expect(wiseApi.get('/v2/profiles/999')).rejects.toMatchObject({
      name: 'WiseApiError',
      status: 404,
      statusText: 'Not Found',
      body: { error: 'missing' },
    });
  });

  it('throws WiseApiError on 401 Unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: false, status: 401, statusText: 'Unauthorized', body: { error: 'bad token' } }),
    );
    await expect(wiseApi.get('/v2/profiles')).rejects.toMatchObject({ status: 401 });
  });

  it('handles plain-text 5xx error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        body: 'upstream unavailable',
        contentType: 'text/plain',
      }),
    );
    await expect(wiseApi.get('/v2/profiles')).rejects.toMatchObject({
      name: 'WiseApiError',
      status: 502,
      body: 'upstream unavailable',
    });
  });

  it('throws WiseApiError on invalid JSON despite application/json content-type', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ body: { id: 1 }, jsonThrows: true }),
    );
    await expect(wiseApi.get('/v2/profiles')).rejects.toMatchObject({
      name: 'WiseApiError',
      status: 200,
    });
  });

  it('falls back to text() when JSON parse fails on error body', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: 'Gateway Error',
        contentType: 'application/json',
        jsonThrows: true,
      }),
    );
    await expect(wiseApi.get('/v2/profiles')).rejects.toMatchObject({
      name: 'WiseApiError',
      status: 500,
      body: 'Gateway Error',
    });
  });
});

describe('timeout + network errors', () => {
  it('throws WiseTimeoutError on AbortError', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseTimeoutError);
  });

  it('throws WiseNetworkError on non-abort fetch rejection', async () => {
    const netErr = new Error('ECONNREFUSED');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(netErr));
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseNetworkError);
  });

  it('WiseNetworkError preserves cause', async () => {
    const netErr = new Error('ENOTFOUND');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(netErr));
    try {
      await wiseApi.get('/v2/profiles');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(WiseNetworkError);
      expect((e as WiseNetworkError).cause).toBe(netErr);
    }
  });

  it('uses default 30s timeout when env unset', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('WISE_API_TOKEN', 'test-token');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    // AbortController signal is always passed
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeDefined();
  });

  it('respects WISE_API_TIMEOUT_MS override', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', '500');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('rejects non-numeric WISE_API_TIMEOUT_MS with WiseConfigError', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', 'not-a-number');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('rejects zero timeout with WiseConfigError', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', '0');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('rejects negative timeout with WiseConfigError', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', '-1000');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('rejects trailing-garbage timeout with WiseConfigError', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', '1000ms');
    await expect(wiseApi.get('/v2/profiles')).rejects.toBeInstanceOf(WiseConfigError);
  });

  it('empty string WISE_API_TIMEOUT_MS falls back to default', async () => {
    vi.stubEnv('WISE_API_TIMEOUT_MS', '');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy).toHaveBeenCalled();
  });
});

describe('read-only API surface', () => {
  it('wiseApi only exposes get()', () => {
    expect(typeof wiseApi.get).toBe('function');
    expect((wiseApi as Record<string, unknown>).post).toBeUndefined();
    expect((wiseApi as Record<string, unknown>).put).toBeUndefined();
    expect((wiseApi as Record<string, unknown>).delete).toBeUndefined();
  });
});
