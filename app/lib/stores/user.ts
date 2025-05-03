import { atom } from 'nanostores';
import type { UserProfile } from '~/types/user';

// Atom to hold the current user's profile data
export const userProfileStore = atom<UserProfile | null>(null);

// Action to update the user profile store
export function setUserProfile(profile: UserProfile | null) {
  userProfileStore.set(profile);
  console.log('[Nano Store] User profile updated:', profile);
}
