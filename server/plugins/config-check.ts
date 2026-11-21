import { defineNitroPlugin } from 'nitropack/runtime'

/**
 * Production must know its public URL: it is the launch-token issuer every app
 * verifies against, and an https URL is what makes the session cookie Secure.
 * Without it the hub would sign tokens for http://localhost:3100.
 */
export default defineNitroPlugin(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!process.env.CORE_URL && !process.env.BETTER_AUTH_URL) {
        throw new Error('Set CORE_URL and BETTER_AUTH_URL to the hub\'s public https URL (see .env.example)')
    }
})
