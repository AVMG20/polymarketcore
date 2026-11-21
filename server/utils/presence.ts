/**
 * Who is playing what, right now: one entry per open /play page socket.
 * In memory (one container), so a restart starts from zero and the pages
 * reconnect and report again. A player counts once per game however many tabs
 * they have open; signed-out sockets only listen.
 */

/** The bit of a crossws peer this needs (tests pass a stub). */
export interface PresencePeer {
    id: string
    send(data: string): unknown
}

interface Entry {
    peer: PresencePeer
    userId: string | null
    game: string | null
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const peers = new Map<string, Entry>()
let flush: ReturnType<typeof setTimeout> | null = null

export function presenceCounts(): Record<string, number> {
    const players = new Map<string, Set<string>>()
    for (const e of peers.values()) {
        if (!e.game || !e.userId) continue
        let set = players.get(e.game)
        if (!set) players.set(e.game, (set = new Set()))
        set.add(e.userId)
    }
    return Object.fromEntries([...players].map(([game, set]) => [game, set.size]))
}

/** Batch changes: at most one broadcast a second, whatever the churn. */
function scheduleBroadcast() {
    if (flush) return
    flush = setTimeout(() => {
        flush = null
        const message = JSON.stringify({ counts: presenceCounts() })
        for (const e of peers.values()) {
            try {
                e.peer.send(message)
            } catch {
                peers.delete(e.peer.id)
            }
        }
    }, 1000)
}

export function presenceOpen(peer: PresencePeer, userId: string | null) {
    peers.set(peer.id, { peer, userId, game: null })
    peer.send(JSON.stringify({ counts: presenceCounts() }))
}

/** `{ "play": "<slug>" }` while a game is open, `{ "play": null }` when it closes. */
export function presenceMessage(peer: PresencePeer, text: string) {
    const entry = peers.get(peer.id)
    if (!entry || !entry.userId || text.length > 200) return
    let play: unknown
    try {
        play = (JSON.parse(text) as { play?: unknown }).play
    } catch {
        return
    }
    const game = typeof play === 'string' && SLUG.test(play) ? play : null
    if (game === entry.game) return
    entry.game = game
    scheduleBroadcast()
}

export function presenceClose(peer: PresencePeer) {
    const entry = peers.get(peer.id)
    peers.delete(peer.id)
    if (entry?.game) scheduleBroadcast()
}

/** Tests only. */
export function resetPresence() {
    peers.clear()
    if (flush) clearTimeout(flush)
    flush = null
}
