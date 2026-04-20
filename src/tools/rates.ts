import { wiseApi } from '../api.js';
import { z } from 'zod';
import { currencyCode, isoDatetime } from '../validators.js';

export const getExchangeRateInput = {
  source: currencyCode().describe('Source currency code, ISO-4217 (e.g. EUR, USD, GBP)'),
  target: currencyCode().describe('Target currency code, ISO-4217'),
};

export async function getExchangeRate(args: { source: string; target: string }) {
  // zod transform uppercases, but belt-and-braces for any direct callers.
  return wiseApi.get('/v1/rates', {
    source: args.source.toUpperCase(),
    target: args.target.toUpperCase(),
  });
}

export const getExchangeRateHistoryInput = {
  source: currencyCode().describe('Source currency code'),
  target: currencyCode().describe('Target currency code'),
  from: isoDatetime().describe('Start datetime (ISO-8601, e.g. 2026-04-01T00:00:00+0000)'),
  to: isoDatetime().describe('End datetime (ISO-8601)'),
  group: z
    .enum(['minute', 'hour', 'day'])
    .default('day')
    .describe('Aggregation granularity. Default day.'),
};

export async function getExchangeRateHistory(args: {
  source: string;
  target: string;
  from: string;
  to: string;
  group?: 'minute' | 'hour' | 'day';
}) {
  return wiseApi.get('/v1/rates', {
    source: args.source.toUpperCase(),
    target: args.target.toUpperCase(),
    from: args.from,
    to: args.to,
    group: args.group ?? 'day',
  });
}
