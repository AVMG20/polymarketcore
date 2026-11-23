import { APIError, betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createError, type H3Event } from 'h3'
import { db } from '#server/database/index'
import * as schema from '#server/database/schema'
import { AsyncLocalStorage } from 'node:async_hooks'
import { checkImageUrl } from '#shared/app-urls'
import { addDays, amsterdamDay } from '#shared/economy'
import { grantWelcome } from '#server/utils/welcome'
import { isEnvAdmin } from '#server/utils/admins'

export const NAME_MAX_LENGTH = 30

/** Avatar: an https image URL (http only on localhost), or empty to clear it. */
function assertValidImage(data: Record<string, unknown>) {
    if (!('image' in data) || data.image === undefined || data.image === null || data.image === '') return
    const check = checkImageUrl(data.image, 'image')
    if (!check.ok) throw new APIError('BAD_REQUEST', { message: check.error })
}

// Control characters and bidi overrides would let a name pose as someone else's.
const NAME_FORBIDDEN = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/u

/** A sign-up name without control characters, trimmed to NAME_MAX_LENGTH characters. */
export function fitName(name: string): string {
    const clean = name.replace(new RegExp(NAME_FORBIDDEN, 'gu'), '').trim()
    return Array.from(clean).slice(0, NAME_MAX_LENGTH).join('').trim()
}

function assertValidName(data: Record<string, unknown>) {
    if (!('name' in data) || data.name === undefined) return
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new APIError('BAD_REQUEST', { message: 'Name is required' })
    }
    if (NAME_FORBIDDEN.test(data.name)) {
        throw new APIError('BAD_REQUEST', { message: 'Name must not contain control characters' })
    }
    if (Array.from(data.name.trim()).length > NAME_MAX_LENGTH) {
        throw new APIError('BAD_REQUEST', { message: `Name must be ${NAME_MAX_LENGTH} characters or fewer` })
    }
}

// Unset: derived per request from Host / x-forwarded-* (trustedProxyHeaders below).
const BASE_URL = process.env.BETTER_AUTH_URL?.replace(/\/+$/, '') || undefined

/** Origins allowed to call the auth API: the hub itself plus TRUSTED_ORIGINS (comma-separated). */
function trustedOrigins(): string[] {
    const fromEnv = (process.env.TRUSTED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean)
    const dev = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3100', 'http://127.0.0.1:3100']
    return [...new Set([...(BASE_URL ? [BASE_URL] : []), ...(process.env.CORE_URL ? [process.env.CORE_URL] : []), ...fromEnv, ...dev])]
}

/**
 * There is no email provider: password reset links are only produced for an
 * admin (createPasswordResetLink), which runs requestPasswordReset inside this
 * capture. A public reset request outside it is refused (and logged).
 */
const resetCapture = new AsyncLocalStorage<{ token?: string }>()

const discordId = process.env.BETTER_AUTH_DISCORD_CLIENT_ID
const discordSecret = process.env.BETTER_AUTH_DISCORD_CLIENT_SECRET

/** Whether Discord login is configured (both env creds present). */
export const discordEnabled = Boolean(discordId && discordSecret)

export const auth = betterAuth({
    baseURL: BASE_URL,
    trustedOrigins: trustedOrigins(),
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    advanced: {
        // Behind a proxy, honour x-forwarded-proto/host. Cookies are Secure whenever the base URL is https.
        trustedProxyHeaders: true
    },
    // The public reset request would only fail (and tell whether the email exists): admins create links.
    disabledPaths: ['/request-password-reset'],
    emailAndPassword: {
        enabled: true,
        resetPasswordTokenExpiresIn: 60 * 60,
        // A reset is how a player takes back an account: sign every other session out.
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ token }) => {
            const capture = resetCapture.getStore()
            if (!capture) throw new Error('Password reset by email is not available: an admin creates reset links')
            capture.token = token
        }
    },
    socialProviders: discordEnabled
        ? { discord: { clientId: discordId!, clientSecret: discordSecret! } }
        : {},
    rateLimit: {
        window: 10,
        max: 100
    },
    user: {
        additionalFields: {
            gems: { type: 'number', required: false, defaultValue: 0, input: false },
            role: { type: 'string', required: false, defaultValue: 'player', input: false },
            claimedThrough: { type: 'string', required: false, input: false }
        }
    },
    databaseHooks: {
        user: {
            create: {
                before: async (data) => {
                    // Fit the name rather than refuse the sign-up: Discord names can be longer than ours.
                    if (typeof data.name === 'string') data.name = fitName(data.name)
                    assertValidName(data)
                    assertValidImage(data)
                    return {
                        data: {
                            ...data,
                            gems: 0,
                            role: 'player',
                            // Day one is claimable: claimed through yesterday.
                            claimedThrough: addDays(amsterdamDay(), -1)
                        }
                    }
                },
                // Runs after the sign-up transaction commits, so a pool connection sees the row.
                // A failure here is retried by /api/me (grantWelcome is claim-then-reward).
                after: async (created) => {
                    await grantWelcome(created.id).catch((err) => {
                        console.error('welcome grant failed, /api/me will retry', err)
                    })
                }
            },
            update: {
                before: async (data) => {
                    assertValidName(data)
                    assertValidImage(data)
                    if (typeof data.name === 'string') return { data: { ...data, name: data.name.trim() } }
                }
            }
        }
    }
})

export type SessionUser = typeof auth.$Infer.Session.user

/** Admin = role 'admin' or an email listed in ADMIN_EMAILS. */
export function isAdmin(u: { role?: string | null, email?: string | null }): boolean {
    return u.role === 'admin' || isEnvAdmin(u.email)
}

/** The effective role, with ADMIN_EMAILS applied. */
export function effectiveRole(u: { role?: string | null, email?: string | null }): 'player' | 'admin' {
    return isAdmin(u) ? 'admin' : 'player'
}

/** The signed-in user, or 401. */
export async function requireUser(event: H3Event): Promise<SessionUser> {
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session?.user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    return session.user
}

/** The signed-in admin, or 401/403. */
export async function requireAdmin(event: H3Event): Promise<SessionUser> {
    const u = await requireUser(event)
    if (!isAdmin(u)) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    return u
}

/** The signed-in viewer (id + admin), or 401. */
export async function requireViewer(event: H3Event): Promise<{ id: string, admin: boolean }> {
    const u = await requireUser(event)
    return { id: u.id, admin: isAdmin(u) }
}

/** The signed-in viewer (id + admin) for public endpoints that personalise, or null. */
export async function getViewer(event: H3Event): Promise<{ id: string, admin: boolean } | null> {
    const session = await auth.api.getSession({ headers: event.headers })
    if (!session?.user?.id) return null
    return { id: session.user.id, admin: isAdmin(session.user) }
}

/** The signed-in user id, or null for public endpoints that only personalise. */
export async function getSessionUserId(event: H3Event): Promise<string | null> {
    const session = await auth.api.getSession({ headers: event.headers })
    return session?.user?.id ?? null
}

/**
 * A one-time password reset link for a player, for admins (there is no email
 * provider). The link opens /reset-password and expires in an hour.
 */
export async function createPasswordResetLink(email: string, hubUrl: string): Promise<string> {
    const capture: { token?: string } = {}
    await resetCapture.run(capture, () => auth.api.requestPasswordReset({ body: { email } }))
    if (!capture.token) throw createError({ statusCode: 404, statusMessage: `No player with email ${email}` })
    return `${hubUrl}/reset-password?token=${encodeURIComponent(capture.token)}`
}
