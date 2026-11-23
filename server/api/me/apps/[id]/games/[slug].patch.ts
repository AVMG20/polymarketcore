import { defineEventHandler, getRouterParam } from 'h3'
import { updateOwnedGame } from '#server/utils/app-registry'
import { requireUser } from '#server/utils/auth'
import { updateOwnedGameSchema } from '#server/utils/manifest'
import { parseBody } from '#server/utils/validate'
import type { OwnedGame } from '#shared/types/api'

/** The owner updates one of their app's games (visibility, name, tagline, description, icon, cover, accent, playPath). */
export default defineEventHandler(async (event): Promise<{ game: OwnedGame }> => {
    const user = await requireUser(event)
    const id = getRouterParam(event, 'id') ?? ''
    const slug = getRouterParam(event, 'slug') ?? ''
    const body = await parseBody(event, updateOwnedGameSchema)
    const game = await updateOwnedGame(user.id, id, slug, body)
    return { game }
})
