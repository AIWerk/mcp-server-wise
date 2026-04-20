// Wise Personal API client — read-only.
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

export class WiseTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly method: string,
    public readonly path: string,
  ) {
    super(`Wise API ${method} ${path} timed out after ${timeoutMs}ms`);
    this.name = 'WiseTimeoutError';
  }
}

export class WiseNetworkError extends Error {
  constructor(
    public readonly method: string,
    public readonly path: string,
    public readonly cause: unknown,
  ) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause);
    super(`Wise API ${method} ${path} network error: ${causeMsg}`);
    this.name = 'WiseNetworkError';
  }
}

export class WiseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WiseConfigError';
  }
}

// Wise's own hosts. Anything else is rejected unless the user opts out via
// WISE_API_ALLOW_UNSAFE_BASE_URL=1 — see README "dangerous override" section.
const ALLOWED_HOSTS = new Set<string>([
  'api.wise.com',
  'api.sandbox.transferwise.tech',
]);

const DEFAULT_TIMEOUT_MS = 30_000;

function getApiToken(): string {
  const token = process.env.WISE_API_TOKEN;
  if (!token) {
    throw new WiseConfigError(
      'WISE_API_TOKEN environment variable is not set. Create one at https://wise.com/settings/api-tokens.',
    );
  }
  return token;
}

function getBaseUrl(): string {
  const raw = process.env.WISE_API_BASE_URL ?? 'https://api.wise.com';
  const cleaned = raw.replace(/\/$/, '');
  const unsafeOptIn = process.env.WISE_API_ALLOW_UNSAFE_BASE_URL === '1';

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new WiseConfigError(
      `WISE_API_BASE_URL is not a valid URL: ${raw}`,
    );
  }

  if (parsed.protocol !== 'https:' && !unsafeOptIn) {
    throw new WiseConfigError(
      `WISE_API_BASE_URL must use https:// (got ${parsed.protocol}). ` +
        `Set WISE_API_ALLOW_UNSAFE_BASE_URL=1 to override — see README "dangerous override".`,
    );
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname) && !unsafeOptIn) {
    throw new WiseConfigError(
      `WISE_API_BASE_URL host "${parsed.hostname}" is not on the allowlist ` +
        `(api.wise.com, api.sandbox.transferwise.tech). ` +
        `Set WISE_API_ALLOW_UNSAFE_BASE_URL=1 to override — see README "dangerous override".`,
    );
  }

  return cleaned;
}

function getTimeoutMs(): number {
  const raw = process.env.WISE_API_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return n;
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

async function requestGet<T>(path: string, query?: Query): Promise<T> {
  const token = getApiToken();
  const url = buildUrl(path, query);
  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' && err !== null && 'name' in err && (err as { name: string }).name === 'AbortError')
    ) {
      throw new WiseTimeoutError(timeoutMs, 'GET', path);
    }
    throw new WiseNetworkError('GET', path, err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? '';
    let errorBody: unknown;
    if (contentType.includes('application/json')) {
      try {
        errorBody = await res.json();
      } catch {
        try {
          errorBody = await res.text();
        } catch {
          errorBody = null;
        }
      }
    } else {
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
      `Wise API GET ${path} failed: ${res.status} ${res.statusText}`,
    );
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new WiseApiError(
        res.status,
        res.statusText,
        null,
        `Wise API GET ${path} returned ${res.status} ${res.statusText} with invalid JSON body`,
      );
    }
  }
  return (await res.text()) as unknown as T;
}

// Read-only API surface. Write verbs (POST/PUT/DELETE) will land in v0.2.0
// alongside idempotency + SCA state-machine design.
export const wiseApi = {
  get: <T = unknown>(path: string, query?: Query) => requestGet<T>(path, query),
};
