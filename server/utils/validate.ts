import { createError, getQuery, readBody, type H3Event } from 'h3'
import type { z } from 'zod'

/** `['games', 0, 'stars', 2, 'key']` → `games[0].stars[2].key`. */
export function formatPath(path: readonly PropertyKey[]): string {
    return path.reduce<string>((out, part) => {
        if (typeof part === 'number') return `${out}[${part}]`
        return out ? `${out}.${String(part)}` : String(part)
    }, '')
}

// The reader of these messages is often a coding agent: name the field and what to fix.
function fail(error: z.ZodError): never {
    const issue = error.issues[0]
    const path = issue?.path.length ? `${formatPath(issue.path)}: ` : ''
    throw createError({ statusCode: 400, statusMessage: `${path}${issue?.message ?? 'Invalid input'}` })
}

/** Parse the JSON body with a zod schema; 400 with the first issue otherwise. */
export async function parseBody<T extends z.ZodType>(event: H3Event, schema: T): Promise<z.infer<T>> {
    const body = await readBody(event).catch(() => undefined)
    const result = schema.safeParse(body ?? {})
    if (!result.success) fail(result.error)
    return result.data
}

/** Parse the query string with a zod schema; 400 with the first issue otherwise. */
export function parseQuery<T extends z.ZodType>(event: H3Event, schema: T): z.infer<T> {
    const result = schema.safeParse(getQuery(event))
    if (!result.success) fail(result.error)
    return result.data
}
