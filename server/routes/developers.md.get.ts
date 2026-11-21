import { defineEventHandler, setResponseHeader } from 'h3'
import { developerGuide } from '#server/utils/developer-docs'

/** The developer guide as Markdown, for coding agents (the /developers page shows the same text). */
export default defineEventHandler(async (event) => {
    setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
    return developerGuide(event)
})
