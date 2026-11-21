import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { createDeveloperToken } from '#server/utils/developer-tokens'
import { parseBody } from '#server/utils/validate'
import type { CreatedDeveloperToken } from '#shared/types/api'

const bodySchema = z.object({
    name: z.string({ error: 'name is required' }).trim().min(1, 'name must not be empty').max(60, 'name must be at most 60 characters')
})

/** Create a developer token. The secret is in this response only. */
export default defineEventHandler(async (event): Promise<CreatedDeveloperToken> => {
    const u = await requireUser(event)
    const { name } = await parseBody(event, bodySchema)
    return createDeveloperToken(u.id, name)
})
