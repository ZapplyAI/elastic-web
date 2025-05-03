import type { UserProfile } from '~/types/user';

const API_BASE_URL = 'https://copilot-api-staging-739610349551.europe-west2.run.app/api';

/**
 * Fetches the user profile from the API.
 *
 * @param token The authentication token (JWT).
 * @returns A promise that resolves to the UserProfile or null if an error occurs.
 */
export async function fetchUserProfile(token: string): Promise<UserProfile | null> {
  const url = `${API_BASE_URL}/auth/me`;
  console.log(`[API Client] Fetching user profile from ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[API Client] Error fetching profile: ${response.status} ${response.statusText}`);

      try {
        // Attempt to read error body for more details
        const errorBody = await response.json();
        console.error('[API Client] Error body:', errorBody);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        console.error('[API Client] Could not parse error body.');
      }

      return null;
    }

    const userProfile: UserProfile = await response.json();
    console.log('[API Client] User profile fetched successfully:', userProfile);

    return userProfile;
  } catch (error) {
    console.error('[API Client] Network or other error fetching profile:', error);
    return null;
  }
}
