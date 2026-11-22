import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'

/** Emails in ADMIN_EMAILS are always admins; the role can't take that away. */
export const adminEmails = () => (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

export function isEnvAdmin(email: string | null | undefined): boolean {
    return !!email && adminEmails().includes(email.toLowerCase())
}

/**
 * An admin makes another player an admin or a player again. Not yourself (so
 * the last admin can't lock everyone out), and not an ADMIN_EMAILS admin.
 */
export async function setPlayerAdmin(actorId: string, userId: string, admin: boolean): Promise<void> {
    if (actorId === userId) throw createError({ statusCode: 400, statusMessage: 'You can\'t change your own role' })
    const [target] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId))
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
    if (!admin && isEnvAdmin(target.email)) throw createError({ statusCode: 400, statusMessage: 'Set in ADMIN_EMAILS' })
    await db.update(user).set({ role: admin ? 'admin' : 'player' }).where(eq(user.id, userId))
}
