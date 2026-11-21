import { defineEventHandler, setResponseHeader } from 'h3'
import { coreUrl } from '#server/utils/launch-token'
import { openApiSpec } from '#server/utils/openapi'

/** OpenAPI 3.1 for /api/v1 (public). */
export default defineEventHandler((event) => {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    return openApiSpec(coreUrl(event))
})
