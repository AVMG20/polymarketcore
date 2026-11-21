import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PeakRow, SessionRow } from '#server/utils/play-stats'
import { presenceClose, presenceCounts, presenceMessage, presenceOpen, presenceSave, resetPresence, setPlayStore, type PresencePeer } from '#server/utils/presence'

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
        expect([...sessions.values()]).toMatchObject([{ game: 'casino', userId: 'erin', activeSeconds: 0 }])

        vi.advanceTimersByTime(30_000)
        presenceMessage(p, JSON.stringify({ play: 'casino', active: false }))
        vi.advanceTimersByTime(60_000) // hidden: not counted
        await presenceSave()
        presenceMessage(p, JSON.stringify({ play: 'casino', active: true }))
        vi.advanceTimersByTime(10_000)
        presenceClose(p)
        const [s] = [...sessions.values()]
        expect(s).toMatchObject({ game: 'casino', activeSeconds: 40 })
        expect(s!.endedAt.getTime() - s!.startedAt.getTime()).toBe(100_000)
    })

    it('starts a new session when the game changes, none signed out', () => {
        const p = peer()
        const anon = peer()
        presenceOpen(p, 'finn')
        presenceOpen(anon, null)
        presenceMessage(p, JSON.stringify({ play: 'casino' }))
        presenceMessage(p, JSON.stringify({ play: 'arcade' }))
        presenceMessage(anon, JSON.stringify({ play: 'casino' }))
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
