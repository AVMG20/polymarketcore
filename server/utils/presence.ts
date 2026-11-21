import { amsterdamDay } from '#shared/economy'
import { dbPlayStore, type PeakRow, type PlayStore, type SessionRow } from '#server/utils/play-stats'

/**
 * Who is playing what, right now: one entry per open /play page socket.
 * In memory (one container), so a restart starts from zero and the pages
 * reconnect and report again. A player counts once per game however many tabs
 * they have open; signed-out sockets only listen.
 *
 * Each open game is also a play session: its active time (page visible and
 * focused) is saved on close and every FLUSH_MS, so a restart loses at most
 * that much. The most players active at once is kept per game and day.
 */

const FLUSH_MS = 60_000

/** The bit of a crossws peer this needs (tests pass a stub). */
export interface PresencePeer {
    id: string
    send(data: string): unknown
}

interface Session {
    id: string
    startedAt: Date
    /** Active milliseconds before `activeSince`. */
    activeMs: number
    /** When the current active stretch began, null while hidden or unfocused. */
    activeSince: number | null
}

interface Entry {
    peer: PresencePeer
    userId: string | null
    game: string | null
    session: Session | null
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const peers = new Map<string, Entry>()
let flush: ReturnType<typeof setTimeout> | null = null
let store: PlayStore = dbPlayStore
let saver: ReturnType<typeof setInterval> | null = null
/** `${game}|${day}` → the most active at once, and whether it rose since the last save. */
const peaks = new Map<string, { peak: number, dirty: boolean }>()

function sessionRow(e: Entry, now: number): SessionRow {
    const s = e.session!
    const ms = s.activeMs + (s.activeSince === null ? 0 : now - s.activeSince)
    return { id: s.id, game: e.game!, userId: e.userId!, startedAt: s.startedAt, endedAt: new Date(now), activeSeconds: Math.floor(ms / 1000) }
}

function save(rows: SessionRow[]): Promise<void> {
    return store.saveSessions(rows).catch(err => console.error('[presence] saving play sessions failed', err))
}

/** Raise today's peak for `game` to the players active there now. */
function notePeak(game: string) {
    const active = new Set<string>()
    for (const e of peers.values()) if (e.game === game && e.session?.activeSince != null && e.userId) active.add(e.userId)
    const key = `${game}|${amsterdamDay()}`
    const cur = peaks.get(key)
    if (!cur || active.size > cur.peak) peaks.set(key, { peak: active.size, dirty: active.size > 0 })
}

/** Save every open session and any raised peak. */
export async function presenceSave() {
    const now = Date.now()
    const sessions = save([...peers.values()].filter(e => e.session).map(e => sessionRow(e, now)))
    const today = amsterdamDay()
    const rows: PeakRow[] = []
    for (const [key, p] of peaks) {
        const [game, day] = key.split('|') as [string, string]
        if (p.dirty) rows.push({ game, day, peak: p.peak })
        p.dirty = false
        if (day < today) peaks.delete(key)
    }
    const peakSave = rows.length ? store.savePeaks(rows).catch(err => console.error('[presence] saving peaks failed', err)) : null
    await Promise.all([sessions, peakSave])
}

function ensureSaver() {
    if (saver) return
    saver = setInterval(presenceSave, FLUSH_MS)
    ;(saver as { unref?: () => void }).unref?.()
}

/** End the entry's session (saved), then start one for `game` if there is one. */
function switchGame(e: Entry, game: string | null, active: boolean) {
    const now = Date.now()
    if (e.session) save([sessionRow(e, now)])
    e.game = game
    e.session = game && e.userId
        ? { id: crypto.randomUUID(), startedAt: new Date(now), activeMs: 0, activeSince: active ? now : null }
        : null
    if (e.session) {
        save([sessionRow(e, now)])
        ensureSaver()
    }
}

function setActive(e: Entry, active: boolean) {
    const s = e.session
    if (!s || active === (s.activeSince !== null)) return
    const now = Date.now()
    if (active) {
        s.activeSince = now
    } else {
        s.activeMs += now - s.activeSince!
        s.activeSince = null
    }
}

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
    peers.set(peer.id, { peer, userId, game: null, session: null })
    peer.send(JSON.stringify({ counts: presenceCounts() }))
}

/**
 * `{ "play": "<slug>", "active": bool }` while a game is open (active: the page
 * is visible and focused; missing means active), `{ "play": null }` when it closes.
 */
export function presenceMessage(peer: PresencePeer, text: string) {
    const entry = peers.get(peer.id)
    if (!entry || !entry.userId || text.length > 200) return
    let msg: { play?: unknown, active?: unknown }
    try {
        msg = JSON.parse(text) ?? {}
    } catch {
        return
    }
    const game = typeof msg.play === 'string' && SLUG.test(msg.play) ? msg.play : null
    const active = msg.active !== false
    if (game !== entry.game) {
        switchGame(entry, game, active)
        scheduleBroadcast()
    } else {
        setActive(entry, active)
    }
    if (game) notePeak(game)
}

export function presenceClose(peer: PresencePeer) {
    const entry = peers.get(peer.id)
    if (!entry) return
    if (entry.session) save([sessionRow(entry, Date.now())])
    peers.delete(peer.id)
    if (entry.game) scheduleBroadcast()
}

/** Tests only: where sessions and peaks go. */
export function setPlayStore(next: PlayStore) {
    store = next
}

/** Tests only. */
export function resetPresence() {
    peers.clear()
    peaks.clear()
    if (flush) clearTimeout(flush)
    flush = null
    if (saver) clearInterval(saver)
    saver = null
}
