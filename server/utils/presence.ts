import { amsterdamDay } from '#shared/economy'
import { dbPlayStore, type PeakRow, type PlayStore, type SessionRow } from '#server/utils/play-stats'

/**
 * Who is playing what, right now: one entry per open /play page socket.
 * In memory (one container), so a restart starts from zero and the pages
 * reconnect and report again. A player counts once per game however many tabs
 * they have open; signed-out sockets only listen.
 *
 * Play sessions are per player and game, not per socket, so they can't be
 * inflated:
 * - every tab of the same game shares one session;
 * - a session closed less than RESUME_MS ago resumes on reopen, so refreshing
 *   (or a dropped socket reconnecting) is not a new open;
 * - a player's time counts in one game at a time (the one they focused last),
 *   and at most MAX_SESSION_MS per session;
 * - nothing is written per message: sessions and peaks are saved every
 *   FLUSH_MS and on shutdown, so a restart loses at most that much.
 */

const FLUSH_MS = 60_000
export const RESUME_MS = 10 * 60_000
export const MAX_SESSION_MS = 4 * 60 * 60_000
/** Messages a socket may send per RATE_WINDOW_MS; the rest are ignored. */
export const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000

/** The bit of a crossws peer this needs (tests pass a stub). */
export interface PresencePeer {
    id: string
    send(data: string): unknown
}

interface Session {
    id: string
    game: string
    userId: string
    startedAt: Date
    /** Counted milliseconds before `countingSince`. */
    activeMs: number
    /** When the current counted stretch began; null while not counting. */
    countingSince: number | null
    /** Sockets showing this game, and which of them are visible and focused. */
    peers: Set<string>
    activePeers: Set<string>
    /** Last time a socket here turned active: the newest wins the player's one counted game. */
    activeAt: number
    /** When the last socket left; null while open. */
    closedAt: number | null
    /** Changed since the last save. */
    dirty: boolean
}

interface Entry {
    peer: PresencePeer
    userId: string | null
    game: string | null
    active: boolean
    window: number
    messages: number
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/
const peers = new Map<string, Entry>()
/** `${userId}|${game}` → session, open or recently closed. */
const sessions = new Map<string, Session>()
let flush: ReturnType<typeof setTimeout> | null = null
let store: PlayStore = dbPlayStore
let saver: ReturnType<typeof setInterval> | null = null
/** `${game}|${day}` → the most active at once, and whether it rose since the last save. */
const peaks = new Map<string, { peak: number, dirty: boolean }>()

function countedMs(s: Session, now: number): number {
    return Math.min(MAX_SESSION_MS, s.activeMs + (s.countingSince === null ? 0 : now - s.countingSince))
}

function sessionRow(s: Session, now: number): SessionRow {
    return { id: s.id, game: s.game, userId: s.userId, startedAt: s.startedAt, endedAt: new Date(s.closedAt ?? now), activeSeconds: Math.floor(countedMs(s, now) / 1000) }
}

function saveRows(rows: SessionRow[]): Promise<void> | null {
    return rows.length ? store.saveSessions(rows).catch(err => console.error('[presence] saving play sessions failed', err)) : null
}

/**
 * Count time in at most one of the player's games: the active one they turned
 * to last. Called after anything that changes which of their sessions are active.
 */
function settleUser(userId: string, now: number) {
    let lead: Session | null = null
    const mine: Session[] = []
    for (const s of sessions.values()) {
        if (s.userId !== userId) continue
        mine.push(s)
        if (s.activePeers.size && (!lead || s.activeAt > lead.activeAt)) lead = s
    }
    for (const s of mine) {
        const counting = s === lead
        if (counting === (s.countingSince !== null)) continue
        if (counting) {
            s.countingSince = now
        } else {
            s.activeMs = countedMs(s, now)
            s.countingSince = null
        }
        s.dirty = true
    }
}

/** Raise today's peak for `game` to the players counting time there now. */
function notePeak(game: string) {
    let active = 0
    for (const s of sessions.values()) if (s.game === game && s.countingSince !== null) active++
    const key = `${game}|${amsterdamDay()}`
    const cur = peaks.get(key)
    if (!cur || active > cur.peak) peaks.set(key, { peak: active, dirty: active > 0 })
}

/** Save every changed or open session and any raised peak; forget sessions too old to resume. */
export async function presenceSave() {
    const now = Date.now()
    const rows: SessionRow[] = []
    for (const [key, s] of sessions) {
        if (s.dirty || s.closedAt === null) rows.push(sessionRow(s, now))
        s.dirty = false
        if (s.closedAt !== null && now - s.closedAt >= RESUME_MS) sessions.delete(key)
    }
    const today = amsterdamDay()
    const peakRows: PeakRow[] = []
    for (const [key, p] of peaks) {
        const [game, day] = key.split('|') as [string, string]
        if (p.dirty) peakRows.push({ game, day, peak: p.peak })
        p.dirty = false
        if (day < today) peaks.delete(key)
    }
    const peakSave = peakRows.length ? store.savePeaks(peakRows).catch(err => console.error('[presence] saving peaks failed', err)) : null
    await Promise.all([saveRows(rows), peakSave])
}

function ensureSaver() {
    if (saver) return
    saver = setInterval(presenceSave, FLUSH_MS)
    ;(saver as { unref?: () => void }).unref?.()
}

/** Take the entry out of its game's session; the session closes with its last socket. */
function leave(e: Entry, now: number) {
    if (!e.game || !e.userId) return
    const s = sessions.get(`${e.userId}|${e.game}`)
    if (!s) return
    s.peers.delete(e.peer.id)
    s.activePeers.delete(e.peer.id)
    if (!s.peers.size) {
        s.closedAt = now
        s.dirty = true
    }
    settleUser(e.userId, now)
}

/** Join the session for the entry's game: the open one, a resumable one, or a new one. */
function join(e: Entry, now: number) {
    if (!e.game || !e.userId) return
    const key = `${e.userId}|${e.game}`
    let s = sessions.get(key)
    if (s && s.closedAt !== null && now - s.closedAt >= RESUME_MS) {
        sessions.delete(key)
        if (s.dirty) void saveRows([sessionRow(s, now)])
        s = undefined
    }
    if (!s) {
        s = { id: crypto.randomUUID(), game: e.game, userId: e.userId, startedAt: new Date(now), activeMs: 0, countingSince: null, peers: new Set(), activePeers: new Set(), activeAt: 0, closedAt: null, dirty: true }
        sessions.set(key, s)
    }
    s.closedAt = null
    s.peers.add(e.peer.id)
    if (e.active) {
        s.activePeers.add(e.peer.id)
        s.activeAt = now
    }
    settleUser(e.userId, now)
    ensureSaver()
}

function setActive(e: Entry, active: boolean, now: number) {
    if (active === e.active) return
    e.active = active
    if (!e.game || !e.userId) return
    const s = sessions.get(`${e.userId}|${e.game}`)
    if (!s) return
    if (active) {
        s.activePeers.add(e.peer.id)
        s.activeAt = now
    } else {
        s.activePeers.delete(e.peer.id)
    }
    settleUser(e.userId, now)
}

export function presenceCounts(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const s of sessions.values()) if (s.peers.size) counts[s.game] = (counts[s.game] ?? 0) + 1
    return counts
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
                presenceClose(e.peer)
            }
        }
    }, 1000)
}

export function presenceOpen(peer: PresencePeer, userId: string | null) {
    peers.set(peer.id, { peer, userId, game: null, active: false, window: Date.now(), messages: 0 })
    peer.send(JSON.stringify({ counts: presenceCounts() }))
}

/**
 * `{ "play": "<slug>", "active": bool }` while a game is open (active: the page
 * is visible and focused; missing means active), `{ "play": null }` when it closes.
 */
export function presenceMessage(peer: PresencePeer, text: string) {
    const entry = peers.get(peer.id)
    if (!entry || !entry.userId || text.length > 200) return
    const now = Date.now()
    if (now - entry.window >= RATE_WINDOW_MS) {
        entry.window = now
        entry.messages = 0
    }
    if (++entry.messages > RATE_LIMIT) return
    let msg: { play?: unknown, active?: unknown }
    try {
        msg = JSON.parse(text) ?? {}
    } catch {
        return
    }
    const game = typeof msg.play === 'string' && SLUG.test(msg.play) ? msg.play : null
    const active = game !== null && msg.active !== false
    if (game !== entry.game) {
        leave(entry, now)
        entry.game = game
        entry.active = active
        join(entry, now)
        scheduleBroadcast()
    } else {
        setActive(entry, active, now)
    }
    if (game) notePeak(game)
}

export function presenceClose(peer: PresencePeer) {
    const entry = peers.get(peer.id)
    if (!entry) return
    leave(entry, Date.now())
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
    sessions.clear()
    peaks.clear()
    if (flush) clearTimeout(flush)
    flush = null
    if (saver) clearInterval(saver)
    saver = null
}
