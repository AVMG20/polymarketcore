import { defineEventHandler } from 'h3'
import { requireApp } from '#server/utils/apps'
import { applyManifest, manifestSchema } from '#server/utils/manifest'
import { parseBody } from '#server/utils/validate'

export default defineEventHandler(async (event) => {
    const app = requireApp(event)
    const manifest = await parseBody(event, manifestSchema)
    return applyManifest(app.id, manifest)
})
