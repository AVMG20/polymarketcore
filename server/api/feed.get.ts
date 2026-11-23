import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireUser } from '#server/utils/auth'
import { getFeed } from '#server/utils/hub'
import { parseQuery } from '#server/utils/validate'
import type { FeedResponse } from '#shared/types/api'

const querySchema = z.object({ before: z.iso.datetime({ offset: true }).optional() })

export default defineEventHandler(async (event): Promise<FeedResponse> => {
    await requireUser(event)
    const { before } = parseQuery(event, querySchema)
    return { events: await getFeed({ before: before ? new Date(before) : undefined }) }
})
