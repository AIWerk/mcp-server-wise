import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { listProfiles, getProfile } from '../tools/profiles.js';
import { listBalances, getBalance } from '../tools/balances.js';
import { getExchangeRate, getExchangeRateHistory } from '../tools/rates.js';
import { listTransfers, getTransfer } from '../tools/transfers.js';
import {
  listRecipients,
  getRecipient,
  getAccountRequirements,
} from '../tools/recipients.js';

function mockFetch(body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function capturedUrl(spy: ReturnType<typeof mockFetch>): URL {
  const raw = spy.mock.calls[0][0] as string;
  return new URL(raw);
}

beforeEach(() => {
  vi.stubEnv('WISE_API_TOKEN', 'tkn');
  vi.stubEnv('WISE_API_BASE_URL', 'https://api.wise.com');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('profiles', () => {
  it('list_profiles → GET /v2/profiles', async () => {
    const spy = mockFetch([{ id: 1 }, { id: 2 }]);
    vi.stubGlobal('fetch', spy);
    await listProfiles({});
    expect(capturedUrl(spy).pathname).toBe('/v2/profiles');
  });

  it('get_profile(42) → GET /v2/profiles/42', async () => {
    const spy = mockFetch({ id: 42 });
    vi.stubGlobal('fetch', spy);
    await getProfile({ profileId: 42 });
    expect(capturedUrl(spy).pathname).toBe('/v2/profiles/42');
  });
});

describe('balances', () => {
  it('list_balances defaults to types=STANDARD', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listBalances({ profileId: 7 });
    const url = capturedUrl(spy);
    expect(url.pathname).toBe('/v4/profiles/7/balances');
    expect(url.searchParams.get('types')).toBe('STANDARD');
  });

  it('list_balances passes through types override', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listBalances({ profileId: 7, types: 'STANDARD,SAVINGS' });
    expect(capturedUrl(spy).searchParams.get('types')).toBe('STANDARD,SAVINGS');
  });

  it('get_balance', async () => {
    const spy = mockFetch({ id: 99 });
    vi.stubGlobal('fetch', spy);
    await getBalance({ profileId: 7, balanceId: 99 });
    expect(capturedUrl(spy).pathname).toBe('/v4/profiles/7/balances/99');
  });
});

describe('rates', () => {
  it('get_exchange_rate uppercases currencies', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await getExchangeRate({ source: 'eur', target: 'usd' });
    const url = capturedUrl(spy);
    expect(url.pathname).toBe('/v1/rates');
    expect(url.searchParams.get('source')).toBe('EUR');
    expect(url.searchParams.get('target')).toBe('USD');
  });

  it('get_exchange_rate_history sends from/to/group', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await getExchangeRateHistory({
      source: 'eur',
      target: 'gbp',
      from: '2026-04-01T00:00:00+0000',
      to: '2026-04-02T00:00:00+0000',
      group: 'hour',
    });
    const url = capturedUrl(spy);
    expect(url.searchParams.get('from')).toBe('2026-04-01T00:00:00+0000');
    expect(url.searchParams.get('to')).toBe('2026-04-02T00:00:00+0000');
    expect(url.searchParams.get('group')).toBe('hour');
  });

  it('get_exchange_rate_history defaults group=day', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await getExchangeRateHistory({
      source: 'EUR',
      target: 'USD',
      from: '2026-01-01T00:00:00+0000',
      to: '2026-02-01T00:00:00+0000',
    });
    expect(capturedUrl(spy).searchParams.get('group')).toBe('day');
  });
});

describe('transfers', () => {
  it('list_transfers sends profile and defaults', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listTransfers({ profileId: 7 });
    const url = capturedUrl(spy);
    expect(url.pathname).toBe('/v1/transfers');
    expect(url.searchParams.get('profile')).toBe('7');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.get('status')).toBeNull();
  });

  it('list_transfers forwards filters and uppercases currencies', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listTransfers({
      profileId: 7,
      status: 'processing',
      sourceCurrency: 'eur',
      targetCurrency: 'usd',
      limit: 50,
    });
    const url = capturedUrl(spy);
    expect(url.searchParams.get('status')).toBe('processing');
    expect(url.searchParams.get('sourceCurrency')).toBe('EUR');
    expect(url.searchParams.get('targetCurrency')).toBe('USD');
    expect(url.searchParams.get('limit')).toBe('50');
  });

  it('get_transfer', async () => {
    const spy = mockFetch({});
    vi.stubGlobal('fetch', spy);
    await getTransfer({ transferId: 555 });
    expect(capturedUrl(spy).pathname).toBe('/v1/transfers/555');
  });
});

describe('recipients', () => {
  it('list_recipients sends profileId query', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listRecipients({ profileId: 7 });
    const url = capturedUrl(spy);
    expect(url.pathname).toBe('/v2/accounts');
    expect(url.searchParams.get('profileId')).toBe('7');
    expect(url.searchParams.get('currency')).toBeNull();
  });

  it('list_recipients forwards currency filter', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await listRecipients({ profileId: 7, currency: 'eur' });
    expect(capturedUrl(spy).searchParams.get('currency')).toBe('EUR');
  });

  it('get_recipient', async () => {
    const spy = mockFetch({});
    vi.stubGlobal('fetch', spy);
    await getRecipient({ accountId: 123 });
    expect(capturedUrl(spy).pathname).toBe('/v2/accounts/123');
  });

  it('get_account_requirements sends source/target/sourceAmount', async () => {
    const spy = mockFetch([]);
    vi.stubGlobal('fetch', spy);
    await getAccountRequirements({ source: 'eur', target: 'usd', sourceAmount: 100 });
    const url = capturedUrl(spy);
    expect(url.pathname).toBe('/v1/account-requirements');
    expect(url.searchParams.get('source')).toBe('EUR');
    expect(url.searchParams.get('target')).toBe('USD');
    expect(url.searchParams.get('sourceAmount')).toBe('100');
  });
});
