/**
 * Rotate the launch-token signing key: `bun scripts/rotate-signing-key.ts`.
 * The new key signs from now on (every process picks it up within a minute);
 * the old one stays published in /.well-known/jwks.json for 10 minutes.
 */
import { db } from '#server/database/index'
import { rotateSigningKey } from '#server/utils/launch-token'

const { kid, retired } = await rotateSigningKey()
console.log(`new kid: ${kid}`)
console.log(`retired: ${retired.join(', ') || '(none)'}`)
await db.$client.end()
