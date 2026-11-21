import { createAuthClient } from 'better-auth/vue'

/**
 * better-auth client for sign-in, sign-up, sign-out and social login. The hub
 * UI reads the player from `useMe()` (`/api/me`), not from the session atom.
 */
export const authClient = createAuthClient()
