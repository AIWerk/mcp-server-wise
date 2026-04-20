import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { isoDatetime, currencyCode } from '../validators.js';

describe('isoDatetime', () => {
  const schema = isoDatetime();

  it('accepts Z-suffixed datetime with ms', () => {
    expect(schema.safeParse('2026-04-01T00:00:00.000Z').success).toBe(true);
  });

  it('accepts +0000 offset', () => {
    expect(schema.safeParse('2026-04-01T00:00:00+0000').success).toBe(true);
  });

  it('accepts +01:00 offset', () => {
    expect(schema.safeParse('2026-04-01T12:30:45+01:00').success).toBe(true);
  });

  it('rejects plain date (no time)', () => {
    expect(schema.safeParse('2026-04-01').success).toBe(false);
  });

  it('rejects non-ISO-format junk', () => {
    expect(schema.safeParse('yesterday').success).toBe(false);
  });

  it('rejects missing timezone', () => {
    expect(schema.safeParse('2026-04-01T00:00:00').success).toBe(false);
  });

  it('rejects formally-valid-but-impossible dates (Feb 30)', () => {
    const result = schema.safeParse('2026-02-30T00:00:00Z');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(' | ');
      expect(messages).toMatch(/real calendar date/);
    }
  });

  it('rejects month 13', () => {
    expect(schema.safeParse('2026-13-01T00:00:00Z').success).toBe(false);
  });

  it('rejects day 32', () => {
    expect(schema.safeParse('2026-04-32T00:00:00Z').success).toBe(false);
  });

  it('accepts leap-year Feb 29', () => {
    expect(schema.safeParse('2024-02-29T00:00:00Z').success).toBe(true);
  });

  it('rejects non-leap-year Feb 29', () => {
    expect(schema.safeParse('2026-02-29T00:00:00Z').success).toBe(false);
  });
});

describe('currencyCode', () => {
  const schema = currencyCode();

  it('accepts uppercase ISO-4217', () => {
    const result = schema.safeParse('EUR');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('EUR');
  });

  it('accepts lowercase and uppercases it', () => {
    const result = schema.safeParse('eur');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('EUR');
  });

  it('accepts mixed case', () => {
    const result = schema.safeParse('EuR');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('EUR');
  });

  it('rejects digits', () => {
    expect(schema.safeParse('123').success).toBe(false);
  });

  it('rejects special characters (the "1$%" family)', () => {
    expect(schema.safeParse('1$%').success).toBe(false);
    expect(schema.safeParse('$$$').success).toBe(false);
    expect(schema.safeParse('E€R').success).toBe(false);
  });

  it('rejects too-short code', () => {
    expect(schema.safeParse('EU').success).toBe(false);
  });

  it('rejects too-long code', () => {
    expect(schema.safeParse('EURO').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(schema.safeParse('').success).toBe(false);
  });

  it('rejects whitespace-padded code (no trim)', () => {
    expect(schema.safeParse(' EUR').success).toBe(false);
  });
});

describe('isoDatetime + z.object integration', () => {
  const schema = z.object({
    from: isoDatetime(),
    to: isoDatetime(),
  });

  it('rejects object when one field is Feb 30', () => {
    const result = schema.safeParse({
      from: '2026-02-30T00:00:00Z',
      to: '2026-04-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});
