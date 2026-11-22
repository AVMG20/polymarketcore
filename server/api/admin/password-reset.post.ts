import { eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { user } from '#server/database/schema'
import { createPasswordResetLink, requireAdmin } from '#server/utils/auth'
import { coreUrl } from '#server/utils/launch-token'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.union([
    z.object({ email: z.email('email must be an email address') }),
    z.object({ playerId: z.string().min(1).max(100) })
])

/**
 * A one-time password reset link for a player (no email provider): give it to
 * them yourself. By email (typed in), or by id from the player list, which
 * only shows masked emails.
 */
export default defineEventHandler(async (event): Promise<{ url: string, expiresInMinutes: number }> => {
    await requireAdmin(event)
    const body = await parseBody(event, bodySchema)
    let email = 'email' in body ? body.email : null
    if (!email && 'playerId' in body) {
        const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, body.playerId))
        if (!row) throw createError({ statusCode: 404, statusMessage: 'Player not found' })
        email = row.email
    }
    return { url: await createPasswordResetLink(email!, coreUrl(event)), expiresInMinutes: 60 }
})
