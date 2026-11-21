import { afterEach, describe, expect, it, vi } from 'vitest'
import { presenceClose, presenceCounts, presenceMessage, presenceOpen, resetPresence, type PresencePeer } from '#server/utils/presence'

let n = 0
function peer(): PresencePeer & { sent: string[] } {
    const sent: string[] = []
    return { id: `p${++n}`, sent, send: (d: string) => sent.push(d) }
}

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
})
