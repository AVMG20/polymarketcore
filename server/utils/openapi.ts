import { MAX_STARS_PER_GAME, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'
import { RESERVED_SLUGS } from '#server/utils/manifest'

/**
 * OpenAPI 3.1 for `/api/v1/**` (developer and app endpoints). Hand-written
 * next to the handlers; keep it in step when an endpoint changes.
 */

type Schema = Record<string, unknown>

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` })
const str = (extra: Schema = {}): Schema => ({ type: 'string', ...extra })
const int = (extra: Schema = {}): Schema => ({ type: 'integer', ...extra })
const obj = (properties: Record<string, Schema>, required: string[] = Object.keys(properties)): Schema =>
    ({ type: 'object', properties, required, additionalProperties: false })
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: 'null' }] })

const json = (schema: Schema, description = 'OK') => ({ description, content: { 'application/json': { schema } } })
const body = (schema: Schema) => ({ required: true, content: { 'application/json': { schema } } })
const errors = (...codes: number[]) => Object.fromEntries(codes.map(c => [String(c), { $ref: `#/components/responses/E${c}` }]))

const idParam = { name: 'id', in: 'path', required: true, schema: str({ pattern: '^[a-z0-9-]{2,40}$' }), description: 'App id' }
const playerParam = { name: 'playerId', in: 'path', required: true, schema: str(), description: 'Polynux player id (the launch token sub)' }

function op(summary: string, security: 'developerToken' | 'appKey', responses: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return { summary, security: [{ [security]: [] }], responses: { ...responses, ...errors(401, 429) }, ...extra }
}

export function openApiSpec(hubUrl: string) {
    return {
        openapi: '3.1.0',
        info: {
            title: 'Polynux API',
            version: '1',
            description: `Connect a game to the Polynux hub. Guide: ${hubUrl}/developers.md. Developer endpoints take a player's developer token (pnxd_…); app endpoints take the app API key (pnx_…). Errors are { statusCode, statusMessage } and statusMessage says what to fix.`
        },
        servers: [{ url: `${hubUrl}/api/v1` }],
        components: {
            securitySchemes: {
                developerToken: { type: 'http', scheme: 'bearer', description: 'pnxd_… from /settings/developer' },
                appKey: { type: 'http', scheme: 'bearer', description: 'pnx_… from POST /developer/apps or rotate-key' }
            },
            responses: Object.fromEntries([400, 401, 403, 404, 409, 429].map(c => [`E${c}`, json(ref('Error'), {
                400: 'Bad input, or not enough gems, or over the unverified daily spend cap',
                401: 'Missing, wrong or revoked credentials',
                403: 'Not your game/app/spend, or the player never connected to this app',
                404: 'Not found',
                409: 'Idempotency key reused with different params, or id taken',
                429: 'Rate limited; see the Retry-After header'
            }[c])])),
            schemas: {
                // Nitro adds fields (error, url, message); read statusMessage.
                Error: { ...obj({ statusCode: int(), statusMessage: str() }), additionalProperties: true },
                App: obj({
                    id: str(),
                    name: str(),
                    baseUrl: str({ format: 'uri' }),
                    returnUrlPrefixes: { type: 'array', items: str({ format: 'uri' }) },
                    status: str({ enum: ['active', 'disabled'] }),
                    verified: { type: 'boolean' },
                    verifiedAt: nullable(str({ format: 'date-time' })),
                    owner: nullable(obj({ id: str(), name: str(), image: nullable(str()) })),
                    createdAt: str({ format: 'date-time' }),
                    games: int(),
                    lastSeenAt: nullable(str({ format: 'date-time' }))
                }),
                AppWithKey: obj({ app: ref('App'), apiKey: str({ description: 'Shown once' }) }),
                AppInput: obj({
                    id: str({ pattern: '^[a-z0-9-]{2,40}$' }),
                    name: str({ maxLength: 60 }),
                    baseUrl: str({ description: 'https (http only for localhost), no query or fragment' }),
                    returnUrlPrefixes: { type: 'array', items: str(), minItems: 1, maxItems: 20, description: 'Default ["{baseUrl}/"]; same origin as baseUrl' }
                }, ['id', 'name', 'baseUrl']),
                Star: obj({ key: str({ pattern: '^[a-z0-9-]{1,40}$' }), name: str({ maxLength: 60 }), description: nullable(str({ maxLength: 300 })) }, ['key', 'name']),
                Game: obj({
                    slug: str({ pattern: '^[a-z0-9-]{2,40}$', not: { enum: RESERVED_SLUGS }, description: 'Globally unique; the first app to claim it owns it' }),
                    name: str({ maxLength: 60 }),
                    tagline: nullable(str({ maxLength: 120 })),
                    description: nullable(str({ description: 'Markdown' })),
                    playPath: str({ pattern: '^/[^#\\s\\\\]*$', maxLength: 500, default: '/', description: 'Appended to baseUrl; no # (the hub adds #pnx=<token>)' }),
                    icon: nullable(str({ description: 'https image URL or lucide:name' })),
                    cover: nullable(str({ description: 'https image URL' })),
                    accent: nullable(str({ pattern: '^#[0-9a-fA-F]{6}$' })),
                    visibility: str({ enum: ['draft', 'public'], description: 'Default draft for unverified apps, public for verified' }),
                    stars: { type: 'array', items: ref('Star'), maxItems: MAX_STARS_PER_GAME, description: 'Entry n names level n; the count is the max level' }
                }, ['slug', 'name']),
                DeveloperGame: obj({
                    slug: str(), name: str(), tagline: nullable(str()), playPath: str(), retired: { type: 'boolean' },
                    playUrl: str({ format: 'uri' }), visibility: str({ enum: ['draft', 'public'] }), counts: { type: 'boolean' },
                    stars: { type: 'array', items: obj({ key: str(), position: int(), name: str(), description: nullable(str()), bounty: int(), retired: { type: 'boolean' }, holders: int() }) }
                }),
                Player: obj({ id: str(), name: str(), image: nullable(str()), gems: int(), stars: int(), title: str() }),
                SetStarsResult: obj({ applied: { type: 'boolean' }, stars: int(), best: int(), bounty: int(), total: int(), title: str() })
            }
        },
        paths: {
            '/developer/apps': {
                get: op('List your apps', 'developerToken', { 200: json(obj({ apps: { type: 'array', items: ref('App') } })) }),
                post: op('Register an app (max 5 active per player)', 'developerToken', { 201: json(ref('AppWithKey')), ...errors(400, 409) }, { requestBody: body(ref('AppInput')) })
            },
            '/developer/apps/{id}': {
                parameters: [idParam],
                get: op('One of your apps', 'developerToken', { 200: json(obj({ app: ref('App') })), ...errors(404) }),
                patch: op('Change name or URLs', 'developerToken', { 200: json(obj({ app: ref('App') })), ...errors(400, 404) }, {
                    requestBody: body(obj({ name: str(), baseUrl: str(), returnUrlPrefixes: { type: 'array', items: str() } }, []))
                }),
                delete: op('Disable the app (never deleted)', 'developerToken', { 200: json(obj({ app: ref('App') })), ...errors(404) })
            },
            '/developer/apps/{id}/rotate-key': {
                parameters: [idParam],
                post: op('New app API key; the old one stops at once', 'developerToken', { 200: json(ref('AppWithKey')), ...errors(404) })
            },
            '/developer/apps/{id}/games': {
                parameters: [idParam],
                get: op('Your games and star levels as the hub sees them', 'developerToken', {
                    200: json(obj({ app: ref('App'), games: { type: 'array', items: ref('DeveloperGame') } })), ...errors(404)
                })
            },
            '/developer/apps/{id}/test-launch': {
                parameters: [idParam],
                post: op('A launch token for yourself as the test player (records a connection)', 'developerToken', {
                    200: json(obj({ token: str(), url: str({ format: 'uri' }), playerId: str(), expiresIn: int() })), ...errors(400, 404)
                }, { requestBody: { required: false, content: { 'application/json': { schema: obj({ game: str() }, []) } } } })
            },
            '/manifest': {
                put: op('Declare games and star levels (call on boot)', 'appKey', {
                    200: json(obj({ games: { type: 'array', items: obj({ slug: str(), stars: int(), visibility: str({ enum: ['draft', 'public'] }) }) } })), ...errors(400, 403)
                }, { requestBody: body(obj({ games: { type: 'array', items: ref('Game'), maxItems: 100 } })) })
            },
            '/players/{playerId}': {
                parameters: [playerParam],
                get: op('A connected player', 'appKey', { 200: json(ref('Player')), ...errors(403, 404) })
            },
            '/gems/spend': {
                post: op(`Spend a player's gems (unverified apps: max ${UNVERIFIED_DAILY_SPEND_CAP} per player per day)`, 'appKey', {
                    200: json(obj({ spendId: str(), gems: int({ description: 'Balance after' }) })), ...errors(400, 403, 404, 409)
                }, {
                    requestBody: body(obj({
                        playerId: str(),
                        amount: int({ minimum: 1, maximum: 100000 }),
                        game: str(),
                        reason: nullable(str({ maxLength: 200 })),
                        idempotencyKey: str({ minLength: 8, maxLength: 100, description: 'Once per purchase; reuse on retry' })
                    }, ['playerId', 'amount', 'game', 'idempotencyKey']))
                })
            },
            '/gems/refund': {
                post: op('Refund your own spend, within 24 h, once', 'appKey', { 200: json(obj({ gems: int() })), ...errors(400, 403, 404) }, {
                    requestBody: body(obj({ spendId: str() }))
                })
            },
            '/stars': {
                put: op('Set a player\'s star level in a game (only a higher seq applies)', 'appKey', {
                    200: json(ref('SetStarsResult')), ...errors(400, 403, 404)
                }, {
                    requestBody: body(obj({
                        playerId: str(),
                        game: str(),
                        stars: int({ minimum: 0, maximum: MAX_STARS_PER_GAME, description: 'At most the number of stars the game declares' }),
                        seq: int({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER, description: 'Strictly increasing per player and game' })
                    }))
                })
            },
            '/stars/{playerId}': {
                parameters: [playerParam, { name: 'game', in: 'query', required: false, schema: str() }],
                get: op('A player\'s current level per game (your games only)', 'appKey', {
                    200: json(obj({ stars: { type: 'array', items: obj({ game: str(), stars: int(), best: int(), seq: int(), updatedAt: str({ format: 'date-time' }) }) } })),
                    ...errors(403)
                })
            },
            '/ping': {
                get: op('Heartbeat (any call marks the app as seen)', 'appKey', { 200: json(obj({ ok: { type: 'boolean' }, app: str(), verified: { type: 'boolean' }, time: str({ format: 'date-time' }) })) })
            }
        }
    }
}
