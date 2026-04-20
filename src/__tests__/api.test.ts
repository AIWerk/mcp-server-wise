import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WiseApiError, wiseApi } from '../api.js';

type MockFetchOpts = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: unknown;
  contentType?: string;
};

function mockFetch(opts: MockFetchOpts = {}) {
  const body = opts.body ?? {};
  const contentType = opts.contentType ?? 'application/json';
  const headers = new Headers({ 'content-type': contentType });
  return vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    headers,
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.stubEnv('WISE_API_TOKEN', 'test-token');
  vi.stubEnv('WISE_API_BASE_URL', 'https://test.api.wise.com');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('WiseApiError', () => {
  it('carries status, statusText, body, message', () => {
    const err = new WiseApiError(404, 'Not Found', { error: 'missing' }, 'resource missing');
    expect(err.status).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.body).toEqual({ error: 'missing' });
    expect(err.message).toBe('resource missing');
    expect(err.name).toBe('WiseApiError');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('auth', () => {
  it('throws WiseApiError with 401 when WISE_API_TOKEN is missing', async () => {
    vi.stubEnv('WISE_API_TOKEN', '');
    await expect(wiseApi.get('/v2/profiles')).rejects.toThrow(/WISE_API_TOKEN/);
  });

  it('sends Authorization: Bearer <token>', async () => {
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    const call = fetchSpy.mock.calls[0];
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });
});

describe('base URL', () => {
  it('uses WISE_API_BASE_URL when set', async () => {
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://test.api.wise.com/v2/profiles');
  });

  it('defaults to production when env unset', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('WISE_API_TOKEN', 'test-token');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.wise.com/v2/profiles');
  });

  it('strips trailing slash from WISE_API_BASE_URL', async () => {
    vi.stubEnv('WISE_API_BASE_URL', 'https://test.api.wise.com/');
    const fetchSpy = mockFetch({ body: [] });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.get('/v2/profiles');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://test.api.wise.com/v2/profiles');
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
    vi.stubGlobal(
      'fetch',
      mockFetch({ body: 'ok', contentType: 'text/plain' }),
    );
    const result = await wiseApi.get('/v1/rates');
    expect(result).toBe('ok');
  });

  it('throws WiseApiError on 4xx with JSON error body', async () => {
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
    await expect(wiseApi.get('/v2/profiles')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('method verbs', () => {
  it('POST sends body as JSON with content-type', async () => {
    const fetchSpy = mockFetch({ body: { ok: true } });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.post('/v2/quotes', { source: 'EUR', target: 'USD' });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ source: 'EUR', target: 'USD' }));
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('DELETE has no body and no content-type', async () => {
    const fetchSpy = mockFetch({ body: {} });
    vi.stubGlobal('fetch', fetchSpy);
    await wiseApi.delete('/v2/accounts/999');
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});
