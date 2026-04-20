import * as z from 'zod';
import { wiseApi } from '../api.js';

const BALANCE_TYPES = ['STANDARD', 'SAVINGS'] as const;
const balanceTypesPattern = new RegExp(
  `^(${BALANCE_TYPES.join('|')})(,(${BALANCE_TYPES.join('|')}))*$`,
);

export const listBalancesInput = {
  profileId: z.number().int().positive().describe('Profile ID (from list_profiles)'),
  types: z
    .string()
    .default('STANDARD')
    .refine((v) => balanceTypesPattern.test(v), {
      message: `types must be comma-separated values from {${BALANCE_TYPES.join(', ')}}`,
    })
    .describe(
      'Comma-separated balance types. Known values: STANDARD (one per currency), SAVINGS (jars, multiple per currency). Default STANDARD.',
    ),
};

export async function listBalances(args: { profileId: number; types?: string }) {
  return wiseApi.get(`/v4/profiles/${args.profileId}/balances`, {
    types: args.types ?? 'STANDARD',
  });
}

export const getBalanceInput = {
  profileId: z.number().int().positive().describe('Profile ID'),
  balanceId: z.number().int().positive().describe('Balance ID (from list_balances)'),
};

export async function getBalance(args: { profileId: number; balanceId: number }) {
  return wiseApi.get(`/v4/profiles/${args.profileId}/balances/${args.balanceId}`);
}
