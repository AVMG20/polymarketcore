import { defineEventHandler, getRouterParam } from 'h3'
import { z } from 'zod'
import { setPlayerAdmin } from '#server/utils/admins'
import { requireAdmin } from '#server/utils/auth'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.object({ admin: z.boolean() })

/** Make a player an admin, or a player again. */
export default defineEventHandler(async (event): Promise<{ admin: boolean }> => {
    const actor = await requireAdmin(event)
    const { admin } = await parseBody(event, bodySchema)
    await setPlayerAdmin(actor.id, getRouterParam(event, 'id') ?? '', admin)
    return { admin }
})
