import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { requireApp } from '#server/utils/apps'
import { refundSpend } from '#server/utils/spends'
import { parseBody } from '#server/utils/validate'

const bodySchema = z.object({ spendId: z.string().min(1).max(100) })

export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const { spendId } = await parseBody(event, bodySchema)
    return refundSpend(app.id, spendId)
})
