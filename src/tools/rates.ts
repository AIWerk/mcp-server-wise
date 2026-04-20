import * as z from 'zod';
import { wiseApi } from '../api.js';

// Accept standard ISO-8601 with optional fractional seconds and ±HH:MM or ±HHMM or Z offset.
// Wise examples: "2026-04-01T00:00:00+0000", "2026-04-01T00:00:00.000Z".
const ISO8601_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

const iso8601 = () =>
  z
    .string()
    .refine((v) => ISO8601_RE.test(v), {
      message: 'must be ISO-8601 datetime, e.g. 2026-04-01T00:00:00+0000 or 2026-04-01T00:00:00.000Z',
    });

export const getExchangeRateInput = {
  source: z.string().length(3).describe('Source currency code, ISO-4217 (e.g. EUR, USD, GBP)'),
  target: z.string().length(3).describe('Target currency code, ISO-4217'),
};

export async function getExchangeRate(args: { source: string; target: string }) {
  return wiseApi.get('/v1/rates', {
    source: args.source.toUpperCase(),
    target: args.target.toUpperCase(),
  });
}

export const getExchangeRateHistoryInput = {
  source: z.string().length(3).describe('Source currency code'),
  target: z.string().length(3).describe('Target currency code'),
  from: iso8601().describe('Start datetime (ISO-8601, e.g. 2026-04-01T00:00:00+0000)'),
  to: iso8601().describe('End datetime (ISO-8601)'),
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
