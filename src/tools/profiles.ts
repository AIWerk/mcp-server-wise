import * as z from 'zod';
import { wiseApi } from '../api.js';

export const listProfilesInput = {};

export async function listProfiles(_args: Record<string, never>) {
  return wiseApi.get('/v2/profiles');
}

export const getProfileInput = {
  profileId: z.number().int().positive().describe('Profile ID (from list_profiles)'),
};

export async function getProfile(args: { profileId: number }) {
  return wiseApi.get(`/v2/profiles/${args.profileId}`);
}
