import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '#server/utils/auth'
import { revokeDeveloperToken } from '#server/utils/developer-tokens'

export default defineEventHandler(async (event): Promise<{ revoked: true }> => {
    const u = await requireUser(event)
    await revokeDeveloperToken(u.id, getRouterParam(event, 'id') ?? '')
    return { revoked: true }
})
