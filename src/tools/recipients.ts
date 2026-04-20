import * as z from 'zod';
import { wiseApi } from '../api.js';

export const listRecipientsInput = {
  profileId: z.number().int().positive().describe('Profile ID'),
  currency: z
    .string()
    .length(3)
    .optional()
    .describe('Optional ISO-4217 filter. Without it, all currencies are returned.'),
};

export async function listRecipients(args: { profileId: number; currency?: string }) {
  return wiseApi.get('/v2/accounts', {
    profileId: args.profileId,
    currency: args.currency?.toUpperCase(),
  });
}

export const getRecipientInput = {
  accountId: z.number().int().positive().describe('Recipient account ID (from list_recipients)'),
};

export async function getRecipient(args: { accountId: number }) {
  return wiseApi.get(`/v2/accounts/${args.accountId}`);
}

export const getAccountRequirementsInput = {
  source: z.string().length(3).describe('Source currency code (ISO-4217)'),
  target: z.string().length(3).describe('Target currency code (ISO-4217)'),
  sourceAmount: z
    .number()
    .positive()
    .describe('Source amount (influences which requirement fields are needed)'),
};

export async function getAccountRequirements(args: {
  source: string;
  target: string;
  sourceAmount: number;
}) {
  return wiseApi.get('/v1/account-requirements', {
    source: args.source.toUpperCase(),
    target: args.target.toUpperCase(),
    sourceAmount: args.sourceAmount,
  });
}
