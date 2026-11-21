/**
 * Cryptographically secure randomness. Use these for ids, keys and anything
 * that decides value. `Math.random()` is only acceptable for cosmetic effects.
 */

const TWO_POW_26 = 67108864
const TWO_POW_53 = 9007199254740992

/** Uniform in [0, 1) with a full 53-bit mantissa. */
export function randomFloat(): number {
    const buf = new Uint32Array(2)
    crypto.getRandomValues(buf)
    return ((buf[0]! >>> 5) * TWO_POW_26 + (buf[1]! >>> 6)) / TWO_POW_53
}

/** Uniform integer in [min, max], inclusive of both ends. */
export function randomInt(min: number, max: number): number {
    return min + Math.floor(randomFloat() * (max - min + 1))
}

/** A random v4 UUID. */
export function randomId(): string {
    return crypto.randomUUID()
}

/** `bytes` random bytes as base64url (no padding). */
export function randomToken(bytes = 32): string {
    const buf = new Uint8Array(bytes)
    crypto.getRandomValues(buf)
    let binary = ''
    for (const b of buf) binary += String.fromCharCode(b)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
