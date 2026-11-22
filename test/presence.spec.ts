import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PeakRow, SessionRow } from '#server/utils/play-stats'
import { presenceClose, presenceCounts, presenceMessage, presenceOpen, MAX_SESSION_MS, presenceSave, RATE_LIMIT, resetPresence, RESUME_MS, setPlayStore, type PresencePeer } from '#server/utils/presence'

let n = 0
function peer(): PresencePeer & { sent: string[] } {
    const sent: string[] = []
    return { id: `p${++n}`, sent, send: (d: string) => sent.push(d) }
}

/** The latest write of each session, and every peak write. */
const sessions = new Map<string, SessionRow>()
const peaks: PeakRow[] = []
beforeEach(() => {
    sessions.clear()
    peaks.length = 0
    setPlayStore({
        saveSessions: async rows => void rows.forEach(r => sessions.set(r.id, r)),
        savePeaks: async rows => void peaks.push(...rows)
    })
})

afterEach(() => {
    resetPresence()
    vi.useRealTimers()
})

describe('presence', () => {
    it('counts each signed-in player once per game', () => {
        const [a1, a2, b, anon] = [peer(), peer(), peer(), peer()]
        presenceOpen(a1, 'alice')
        presenceOpen(a2, 'alice')
        presenceOpen(b, 'bob')
        presenceOpen(anon, null)
        presenceMessage(a1, JSON.stringify({ play: 'casino' }))
        presenceMessage(a2, JSON.stringify({ play: 'casino' }))
        presenceMessage(b, JSON.stringify({ play: 'casino' }))
        presenceMessage(anon, JSON.stringify({ play: 'casino' }))
        expect(presenceCounts()).toEqual({ casino: 2 })

        presenceMessage(b, JSON.stringify({ play: null }))
        presenceClose(a1)
        expect(presenceCounts()).toEqual({ casino: 1 })
        presenceClose(a2)
        expect(presenceCounts()).toEqual({})
    })

    it('ignores junk and bad slugs', () => {
        const p = peer()
        presenceOpen(p, 'carol')
        presenceMessage(p, 'not json')
        presenceMessage(p, JSON.stringify({ play: '../x' }))
        presenceMessage(p, JSON.stringify({ play: 'a'.repeat(300) }))
        expect(presenceCounts()).toEqual({})
    })

    it('sends counts on open and batches broadcasts', () => {
        vi.useFakeTimers()
        const watcher = peer()
        const p = peer()
        presenceOpen(watcher, null)
        presenceOpen(p, 'dave')
        expect(JSON.parse(watcher.sent[0]!)).toEqual({ counts: {} })
        presenceMessage(p, JSON.stringify({ play: 'arcade' }))
        presenceMessage(p, JSON.stringify({ play: 'casino' }))
        vi.advanceTimersByTime(1000)
        expect(watcher.sent.map(s => JSON.parse(s))).toEqual([{ counts: {} }, { counts: { casino: 1 } }])
    })

    it('saves each open game as a session with its active time', async () => {
        vi.useFakeTimers()
        const p = peer()
        presenceOpen(p, 'erin')
        presenceMessage(p, JSON.stringify({ play: 'casino', active: true }))
        expect(sessions.size).toBe(0) // nothing written per message
        await presenceSave()
        expect([...sessions.values()]).toMatchObject([{ game: 'casino', userId: 'erin', activeSeconds: 0 }])

        vi.advanceTimersByTime(30_000)
        presenceMessage(p, JSON.stringify({ play: 'casino', active: false }))
        vi.advanceTimersByTime(60_000) // hidden: not counted
        presenceMessage(p, JSON.stringify({ play: 'casino', active: true }))
        vi.advanceTimersByTime(10_000)
        presenceClose(p)
        await presenceSave()
        const [s] = [...sessions.values()]
        expect(s).toMatchObject({ game: 'casino', activeSeconds: 40 })
        expect(s!.endedAt.getTime() - s!.startedAt.getTime()).toBe(100_000)
    })

    it('resumes a session on refresh instead of opening a new one', async () => {
        vi.useFakeTimers()
        for (let i = 0; i < 20; i++) {
            const p = peer()
            presenceOpen(p, 'rita')
            presenceMessage(p, JSON.stringify({ play: 'casino' }))
            vi.advanceTimersByTime(5_000)
            presenceClose(p)
            vi.advanceTimersByTime(1_000)
        }
        await presenceSave()
        expect([...sessions.values()]).toMatchObject([{ game: 'casino', activeSeconds: 100 }])

        vi.advanceTimersByTime(RESUME_MS)
        const p = peer()
        presenceOpen(p, 'rita')
        presenceMessage(p, JSON.stringify({ play: 'casino' }))
        await presenceSave()
        expect(sessions.size).toBe(2)
    })

    it('shares one session between tabs and counts one game at a time', async () => {
        vi.useFakeTimers()
        const [a, b, c] = [peer(), peer(), peer()]
        for (const p of [a, b, c]) presenceOpen(p, 'sam')
        presenceMessage(a, JSON.stringify({ play: 'casino' }))
        presenceMessage(b, JSON.stringify({ play: 'casino' }))
        vi.advanceTimersByTime(10_000)
        presenceMessage(c, JSON.stringify({ play: 'arcade' })) // focused last: only this one counts
        vi.advanceTimersByTime(20_000)
        await presenceSave()
        const rows = [...sessions.values()]
        expect(rows).toHaveLength(2)
        expect(rows.find(r => r.game === 'casino')!.activeSeconds).toBe(10)
        expect(rows.find(r => r.game === 'arcade')!.activeSeconds).toBe(20)

        presenceClose(c) // back to the casino tabs
        vi.advanceTimersByTime(5_000)
        await presenceSave()
        expect([...sessions.values()].find(r => r.game === 'casino')!.activeSeconds).toBe(15)
    })

    it('caps a session and ignores message floods', async () => {
        vi.useFakeTimers()
        const p = peer()
        presenceOpen(p, 'tom')
        presenceMessage(p, JSON.stringify({ play: 'casino' }))
        vi.advanceTimersByTime(MAX_SESSION_MS + 60 * 60_000)
        for (let i = 0; i < RATE_LIMIT; i++) presenceMessage(p, JSON.stringify({ play: 'casino', active: i % 2 === 0 }))
        presenceMessage(p, JSON.stringify({ play: 'arcade' }))
        await presenceSave()
        expect([...sessions.values()]).toMatchObject([{ game: 'casino', activeSeconds: MAX_SESSION_MS / 1000 }])
    })

    it('starts a new session when the game changes, none signed out', async () => {
        const p = peer()
        const anon = peer()
        presenceOpen(p, 'finn')
        presenceOpen(anon, null)
        presenceMessage(p, JSON.stringify({ play: 'casino' }))
        presenceMessage(p, JSON.stringify({ play: 'arcade' }))
        presenceMessage(anon, JSON.stringify({ play: 'casino' }))
        await presenceSave()
        expect([...sessions.values()].map(s => s.game)).toEqual(['casino', 'arcade'])
    })

    it('keeps the most players active at once', async () => {
        const [a, b, c] = [peer(), peer(), peer()]
        presenceOpen(a, 'gail')
        presenceOpen(b, 'hank')
        presenceOpen(c, 'ivy')
        presenceMessage(a, JSON.stringify({ play: 'casino', active: true }))
        presenceMessage(b, JSON.stringify({ play: 'casino', active: true }))
        presenceMessage(c, JSON.stringify({ play: 'casino', active: false }))
        presenceClose(a)
        await presenceSave()
        expect(peaks).toMatchObject([{ game: 'casino', peak: 2 }])
        await presenceSave()
        expect(peaks).toHaveLength(1)
    })
})
