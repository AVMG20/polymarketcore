import { defineEventHandler } from 'h3'
import { assertSameOriginWrite } from '#server/utils/csrf'

/** Refuses cookie-API writes from other sites (server/utils/csrf.ts). */
export default defineEventHandler((event) => {
    assertSameOriginWrite(event)
})
