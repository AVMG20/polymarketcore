import { defineEventHandler, getRouterParam, setResponseHeader } from 'h3'
import { HELLO_GAME_FILES, helloGameFile } from '#server/utils/developer-docs'

/** The reference game's source, raw, so agents can fetch and copy it. */
export default defineEventHandler(async (event) => {
    const name = getRouterParam(event, 'file') ?? ''
    const text = await helloGameFile(name)
    setResponseHeader(event, 'Content-Type', HELLO_GAME_FILES[name]!)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
    return text
})
