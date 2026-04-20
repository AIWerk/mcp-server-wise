import * as z from 'zod';
import { wiseApi } from '../api.js';

export const listBalancesInput = {
  profileId: z.number().int().positive().describe('Profile ID (from list_profiles)'),
  types: z
    .string()
    .default('STANDARD')
    .describe('Comma-separated balance types: STANDARD (one per currency), SAVINGS (jars, multiple per currency). Default STANDARD.'),
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
