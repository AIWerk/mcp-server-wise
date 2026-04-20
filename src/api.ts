// Wise Personal API client.
// Personal-token auth only. For Platform/OAuth, this client is not appropriate.

export class WiseApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'WiseApiError';
  }
}

function getApiToken(): string {
  const token = process.env.WISE_API_TOKEN;
  if (!token) {
    throw new WiseApiError(
      401,
      'Unauthorized',
      null,
      'WISE_API_TOKEN environment variable is not set. Create one at https://wise.com/settings/api-tokens.',
    );
  }
  return token;
}

function getBaseUrl(): string {
  return (process.env.WISE_API_BASE_URL ?? 'https://api.wise.com').replace(/\/$/, '');
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${getBaseUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: { query?: Query; body?: unknown } = {},
): Promise<T> {
  const token = getApiToken();
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      try {
        errorBody = await res.text();
      } catch {
        errorBody = null;
      }
    }
    throw new WiseApiError(
      res.status,
      res.statusText,
      errorBody,
      `Wise API ${method} ${path} failed: ${res.status} ${res.statusText}`,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const wiseApi = {
  get: <T = unknown>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};
