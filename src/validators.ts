import * as z from 'zod';

// ISO-8601 format regex. Accepts "Z", "+0000", "+00:00", "-HH:MM" offsets and
// optional fractional seconds. Format check only — isoDatetime() also verifies
// the year/month/day describe a real date (Feb 30 silently wraps to March in
// Date.parse, so format-alone would miss it).
const ISO8601_RE =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  // Date.UTC wraps invalid values (Feb 30 → Mar 2). Round-trip and compare.
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

export function isoDatetime() {
  return z.string().superRefine((v, ctx) => {
    const match = ISO8601_RE.exec(v);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'must be ISO-8601 datetime, e.g. 2026-04-01T00:00:00+0000 or 2026-04-01T00:00:00.000Z',
      });
      return;
    }
    const [, yStr, mStr, dStr] = match;
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!isRealCalendarDate(y, m, d)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `must represent a real calendar date (year=${y}, month=${m}, day=${d} does not exist)`,
      });
      return;
    }
    if (Number.isNaN(Date.parse(v))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'must be a parseable datetime',
      });
    }
  });
}

// ISO-4217 currency code: three ASCII letters. Accepts lower-case input and
// uppercases it for downstream use — Wise requires uppercase.
const CURRENCY_RE = /^[A-Za-z]{3}$/;

export function currencyCode() {
  return z
    .string()
    .refine((v) => CURRENCY_RE.test(v), {
      message: 'must be an ISO-4217 currency code (three ASCII letters, e.g. EUR, USD, GBP)',
    })
    .transform((v) => v.toUpperCase());
}
