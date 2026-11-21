import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { createPasswordResetLink, requireAdmin } from '#server/utils/auth'
import { coreUrl } from '#server/utils/launch-token'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.object({ email: z.email('email must be an email address') })

/** A one-time password reset link for a player (no email provider): give it to them yourself. */
export default defineEventHandler(async (event): Promise<{ url: string, expiresInMinutes: number }> => {
    await requireAdmin(event)
    const { email } = await parseBody(event, bodySchema)
    return { url: await createPasswordResetLink(email, coreUrl(event)), expiresInMinutes: 60 }
})
