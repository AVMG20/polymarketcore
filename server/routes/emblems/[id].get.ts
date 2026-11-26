import { createError, defineEventHandler, getQuery, getRequestHeader, getRouterParam, setResponseHeader, setResponseStatus } from 'h3'
import { getPlayerEmblemSvg } from '#server/utils/emblem'

/**
 * Public SVG render of a player's drawn emblem: `/emblems/:id.svg?v=<hash>`.
 * Used as the player's `image` URL in launch tokens and `/api/v1/players/:id`
 * so connected game apps show emblems with a plain `<img>`.
 */
export default defineEventHandler(async (event) => {
    const raw = getRouterParam(event, 'id') ?? ''
    const userId = raw.endsWith('.svg') ? raw.slice(0, -4) : raw
    const result = await getPlayerEmblemSvg(userId)
    if (!result) {
        setResponseHeader(event, 'Cache-Control', 'no-store')
        throw createError({ statusCode: 404, statusMessage: 'Emblem not found' })
    }

    const etag = `"${result.version}"`
    const query = getQuery(event)
    const immutable = query.v === result.version

    setResponseHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    setResponseHeader(event, 'Content-Security-Policy', 'default-src \'none\'; style-src \'none\'; sandbox')
    setResponseHeader(event, 'Cross-Origin-Resource-Policy', 'cross-origin')
    setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
    setResponseHeader(event, 'ETag', etag)
    setResponseHeader(event, 'Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=60')

    if (getRequestHeader(event, 'if-none-match') === etag) {
        setResponseStatus(event, 304)
        return ''
    }
    return result.svg
})
