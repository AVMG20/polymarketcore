import { describe, expect, it } from 'vitest'
import {
    EMBLEM_MAX_ELEMENTS,
    EMBLEM_MAX_POINTS_PER_STROKE,
    EMBLEM_MAX_SERIALIZED_LENGTH,
    emptyEmblem,
    parseEmblem,
    serializeEmblem,
    type EmblemData
} from '#shared/emblem'
import { PRESTIGE_TIERS, prestigeTier } from '#shared/prestige'

const shape = (over: Record<string, unknown> = {}) => ({ kind: 'shape', shape: 'star', color: '#ff0000', x: 50, y: 50, size: 30, rotation: 0, ...over })
const stroke = (over: Record<string, unknown> = {}) => ({ kind: 'stroke', color: '#ffffff', width: 6, points: [[10, 10], [20, 30]], ...over })
const emblem = (elements: unknown[], over: Record<string, unknown> = {}) => ({ version: 1, background: '#312e81', elements, ...over })

describe('emblem validation', () => {
    it('accepts strokes and shapes, as an object or a string', () => {
        const data = emblem([stroke(), shape(), shape({ shape: 'circle' }), shape({ shape: 'square', rotation: 45 }), shape({ shape: 'triangle' })])
        expect(parseEmblem(data)).toEqual(data)
        expect(parseEmblem(JSON.stringify(data))).toEqual(data)
        expect(serializeEmblem(data)).toBe(JSON.stringify(data))
        expect(serializeEmblem(emptyEmblem())).toBe(JSON.stringify(emptyEmblem()))
    })

    it('refuses anything that is not an emblem', () => {
        for (const bad of [null, undefined, '', 'not json', 42, [], {}, emblem([], { version: 2 }), emblem([], { background: 'red' }), emblem([], { elements: 'x' })]) {
            expect(parseEmblem(bad)).toBeNull()
        }
    })

    it('checks every element', () => {
        const bad = [
            stroke({ color: '#fff' }),
            stroke({ width: 0 }),
            stroke({ width: 19 }),
            stroke({ points: [] }),
            stroke({ points: [[101, 0]] }),
            stroke({ points: [[1, 2, 3]] }),
            stroke({ points: Array.from({ length: EMBLEM_MAX_POINTS_PER_STROKE + 1 }, () => [1, 1]) }),
            shape({ shape: 'hexagon' }),
            shape({ size: 3 }),
            shape({ size: 81 }),
            shape({ x: -1 }),
            shape({ rotation: 181 }),
            shape({ x: Number.NaN }),
            { kind: 'text', color: '#ffffff' }
        ]
        for (const element of bad) expect(serializeEmblem(emblem([element]))).toBeNull()
        expect(serializeEmblem(emblem([stroke({ points: Array.from({ length: EMBLEM_MAX_POINTS_PER_STROKE }, () => [1, 1]) })]))).not.toBeNull()
    })

    it('caps the element count and the serialized size', () => {
        expect(serializeEmblem(emblem(Array.from({ length: EMBLEM_MAX_ELEMENTS }, () => shape())))).not.toBeNull()
        expect(serializeEmblem(emblem(Array.from({ length: EMBLEM_MAX_ELEMENTS + 1 }, () => shape())))).toBeNull()
        const longStrokes = Array.from({ length: 30 }, () => stroke({ points: Array.from({ length: EMBLEM_MAX_POINTS_PER_STROKE }, () => [12.34, 56.78]) }))
        const data = emblem(longStrokes) as EmblemData
        expect(JSON.stringify(data).length).toBeGreaterThan(EMBLEM_MAX_SERIALIZED_LENGTH)
        expect(serializeEmblem(data)).toBeNull()
        expect(parseEmblem(JSON.stringify(data))).toBeNull()
    })
})

describe('prestige tiers', () => {
    it('maps levels 1-4 to tiers and everything else to none', () => {
        expect(PRESTIGE_TIERS.map(t => t.roman)).toEqual(['I', 'II', 'III', 'IV'])
        expect(prestigeTier(3)?.name).toBe('Sovereign')
        for (const level of [0, 5, -1, null, undefined]) expect(prestigeTier(level)).toBeNull()
    })
})
