import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireApp } from '#server/utils/apps'
import { spendGems } from '#server/utils/spends'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.object({
    playerId: z.string().min(1).max(100),
    amount: z.number().int().min(1).max(100_000),
    game: z.string().min(1).max(40),
    reason: z.string().max(200).nullish().transform(v => v ?? null),
    idempotencyKey: z.string().min(8).max(100)
})

export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const body = await parseBody(event, bodySchema)
    const { spendId, gems } = await spendGems({ appId: app.id, ...body })
    return { spendId, gems }
})
