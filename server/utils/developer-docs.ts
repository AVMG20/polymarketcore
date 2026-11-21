import { createError, type H3Event } from 'h3'
import { assetText, renderDeveloperGuide } from '#shared/developer-guide'
import { coreUrl } from '#server/utils/launch-token'
import { LIMITS } from '#server/utils/rate-limit'

/** /developers.md for this hub: shared/guide/developer-guide.md with the hub URL and limits filled in. */
export async function developerGuide(event: H3Event): Promise<string> {
    const template = assetText(await useStorage('assets:guide').getItemRaw('developer-guide.md'))
    if (template === null) throw createError({ statusCode: 500, statusMessage: 'Developer guide missing from server assets' })
    return renderDeveloperGuide(template, coreUrl(event), {
        verifiedApp: LIMITS.verifiedApp.limit,
        unverifiedApp: LIMITS.unverifiedApp.limit,
        developerToken: LIMITS.developerToken.limit
    })
}

/** The reference game's files, served at /developers/hello-game/<file>. */
export const HELLO_GAME_FILES: Record<string, string> = {
    'server.ts': 'text/plain; charset=utf-8',
    'index.html': 'text/plain; charset=utf-8',
    'README.md': 'text/markdown; charset=utf-8'
}

export async function helloGameFile(name: string): Promise<string> {
    if (!Object.hasOwn(HELLO_GAME_FILES, name)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    const text = assetText(await useStorage('assets:hello-game').getItemRaw(name))
    if (text === null) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    return text
}
