/**
 * Prestige rings: a tier 0-4 worn as a rotating ring around the player's
 * avatar and a roman-numeral badge next to their name. Display only.
 *
 * Colours are raw CSS on purpose: the ring is a conic gradient and the badge a
 * linear one, and a class string built in a .ts file isn't picked up by
 * Tailwind's scanner.
 */

export interface PrestigeTier {
    /** 1-4. Level 0 has no tier. */
    level: number
    name: string
    roman: string
    /** Conic gradient painted as the rotating ring around the avatar. */
    ring: string
    /** Linear gradient for the name badge. */
    badge: string
    /** Solid colour for the glow. */
    accent: string
    /** Seconds per full turn of the ring: higher tiers spin faster. */
    spinSeconds: number
}

export const PRESTIGE_MAX_LEVEL = 4

export const PRESTIGE_TIERS: PrestigeTier[] = [
    {
        level: 1,
        name: 'Ascendant',
        roman: 'I',
        ring: 'conic-gradient(from 0deg, #78350f, #f59e0b, #fde68a, #f59e0b, #78350f)',
        badge: 'linear-gradient(135deg, #b45309, #fbbf24)',
        accent: '#f59e0b',
        spinSeconds: 12
    },
    {
        level: 2,
        name: 'Luminary',
        roman: 'II',
        ring: 'conic-gradient(from 0deg, #164e63, #06b6d4, #a5f3fc, #06b6d4, #164e63)',
        badge: 'linear-gradient(135deg, #0e7490, #22d3ee)',
        accent: '#22d3ee',
        spinSeconds: 9
    },
    {
        level: 3,
        name: 'Sovereign',
        roman: 'III',
        ring: 'conic-gradient(from 0deg, #4c1d95, #a855f7, #f5d0fe, #a855f7, #4c1d95)',
        badge: 'linear-gradient(135deg, #7e22ce, #d946ef)',
        accent: '#c084fc',
        spinSeconds: 7
    },
    {
        level: 4,
        name: 'Eternal',
        roman: 'IV',
        ring: 'conic-gradient(from 0deg, #f59e0b, #fde68a, #ffffff, #f0abfc, #a855f7, #38bdf8, #f59e0b)',
        badge: 'linear-gradient(135deg, #f59e0b, #f0abfc, #38bdf8)',
        accent: '#fbbf24',
        spinSeconds: 5
    }
]

/** The tier a player wears, or null at level 0. */
export function prestigeTier(level: number | null | undefined): PrestigeTier | null {
    return PRESTIGE_TIERS.find(tier => tier.level === level) ?? null
}
