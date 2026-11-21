import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { saveEmblem } from '#server/utils/emblem'
import { parseBody } from '#server/utils/validate'
import type { SaveEmblemResponse } from '#shared/types/api'

// saveEmblem checks the emblem itself (shared/emblem.ts) and that the field is there.
const bodySchema = z.object({ emblem: z.unknown().optional() })

/** Save the viewer's emblem (`{ emblem }`), or clear it (`{ emblem: null }`). */
export default defineEventHandler(async (event): Promise<SaveEmblemResponse> => {
    const u = await requireUser(event)
    const { emblem } = await parseBody(event, bodySchema)
    return saveEmblem(u.id, emblem)
})
