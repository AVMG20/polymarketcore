import { defineEventHandler, setResponseHeader } from 'h3'
import { getJwks } from '#server/utils/launch-token'

export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    return getJwks()
})
