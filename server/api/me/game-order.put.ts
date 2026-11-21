import { createError, defineEventHandler } from 'h3'
import { getViewer } from '#server/utils/auth'
import { gameOrderSchema, saveGameOrder } from '#server/utils/game-order'
import { parseBody } from '#server/utils/validate'
import type { GameOrderResponse } from '#shared/types/api'

/** Save the viewer's order of the games list (`{ order: [slug, …] }`; `[]` clears it). */
export default defineEventHandler(async (event): Promise<GameOrderResponse> => {
    const viewer = await getViewer(event)
    if (!viewer) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    const { order } = await parseBody(event, gameOrderSchema)
    return { order: await saveGameOrder(viewer, order) }
})
