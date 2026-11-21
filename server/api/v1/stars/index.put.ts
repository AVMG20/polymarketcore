import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireApp } from '#server/utils/apps'
import { setStars } from '#server/utils/stars'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.object({
    playerId: z.string({ error: 'playerId is required (the launch token sub)' }).min(1).max(100),
    game: z.string({ error: 'game is required (a slug from your manifest)' }).min(1).max(40),
    stars: z.number({ error: 'stars is required: an integer level from 0 to 10' }).int('stars must be an integer').min(0, 'stars must be 0 or more').max(10, 'stars must be 10 or less'),
    seq: z.number({ error: 'seq is required: a positive integer you increase with every change for this player and game' })
        .int('seq must be an integer')
        .positive('seq must be a positive integer')
        .max(Number.MAX_SAFE_INTEGER, 'seq must be at most 2^53 - 1 (a ms timestamp or a ledger row id fits)')
})

/** Set a player's star level in a game (contract §2). Only a higher seq applies. */
export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const body = await parseBody(event, bodySchema)
    return setStars({ appId: app.id, ...body })
})
