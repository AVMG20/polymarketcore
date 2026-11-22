/**
 * A game's `icon` is one of three things:
 * - `lucide:<name>` from GAME_ICON_NAMES (app/utils/game.ts maps them to components),
 * - an image URL,
 * - inline SVG markup (`<svg …>…</svg>`, at most MAX_SVG_ICON_LENGTH characters).
 * The hub only ever shows icons through <img> (inline SVG as a data URL), so
 * markup in an SVG can never run.
 */
export const GAME_ICON_NAMES = [
    'anchor',
    'atom',
    'axe',
    'bike',
    'biohazard',
    'bird',
    'blocks',
    'bomb',
    'bot',
    'brain',
    'bug',
    'building',
    'car',
    'castle',
    'cat',
    'cherry',
    'circle-dot',
    'club',
    'coins',
    'compass',
    'cpu',
    'crosshair',
    'crown',
    'diamond',
    'dices',
    'dog',
    'drum',
    'egg',
    'factory',
    'feather',
    'fish',
    'flag',
    'flame',
    'footprints',
    'gamepad',
    'gamepad-2',
    'gem',
    'ghost',
    'grid-3x3',
    'guitar',
    'hammer',
    'heart',
    'hourglass',
    'joystick',
    'key',
    'leaf',
    'lock',
    'map',
    'moon',
    'mountain',
    'music',
    'orbit',
    'palette',
    'pickaxe',
    'pizza',
    'plane',
    'puzzle',
    'rabbit',
    'rocket',
    'satellite',
    'shapes',
    'shell',
    'shield',
    'ship',
    'skull',
    'snowflake',
    'spade',
    'sparkles',
    'sprout',
    'star',
    'sun',
    'sword',
    'swords',
    'target',
    'tent',
    'timer',
    'tree-pine',
    'trophy',
    'turtle',
    'wand',
    'zap'
] as const

export type GameIconName = typeof GAME_ICON_NAMES[number]

export const MAX_SVG_ICON_LENGTH = 16_384

export function isInlineSvg(icon: string): boolean {
    const t = icon.trim()
    return t.startsWith('<svg') && t.endsWith('</svg>')
}

/** Why inline SVG is refused, or null. Scripts, handlers and embedded HTML are refused outright, even though <img> wouldn't run them. */
export function inlineSvgProblem(icon: string): string | null {
    if (icon.length > MAX_SVG_ICON_LENGTH) return `an SVG icon must be at most ${MAX_SVG_ICON_LENGTH} characters`
    if (!/^<svg[\s>]/.test(icon.trim()) || !/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(icon)) return 'an SVG icon must be an <svg> element with xmlns="http://www.w3.org/2000/svg"'
    if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:/i.test(icon)) return 'an SVG icon must not contain scripts, event handlers or foreignObject'
    return null
}

/** Inline SVG as an <img> source. */
export function svgDataUrl(icon: string): string {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.trim())}`
}
