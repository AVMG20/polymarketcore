import { defineEventHandler, setResponseHeader } from 'h3'
import { coreUrl } from '#server/utils/launch-token'

/** llms.txt: where an agent finds the docs. */
export default defineEventHandler((event) => {
    const hub = coreUrl(event)
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    return `# Polynux

> Play-money gaming hub. Connect your own game: players open it from the hub, it spends their gems and sets their star level (0-10).

## Docs

- [Developer guide](${hub}/developers.md): the full integration, curl sequence first, written for coding agents
- [OpenAPI 3.1](${hub}/api/v1/openapi.json): every /api/v1 endpoint (developer token and app key)
- [Reference game server](${hub}/developers/hello-game/server.ts): Bun + jose, no framework
- [Reference game page](${hub}/developers/hello-game/index.html)
- [JWKS](${hub}/.well-known/jwks.json): launch token keys
`
})
