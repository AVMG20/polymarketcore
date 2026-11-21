import {
    Anchor, Bird, Bomb, Brain, Cat, Castle, Car, Club, Coins, Compass, Crown, Diamond, Dices, Dog, Fish, Flag,
    Flame, Gamepad2, Gem, Ghost, Heart, Map as MapIcon, Mountain, Puzzle, Rocket, Shield, Skull, Sparkles, Spade,
    Star, Sword, Swords, Target, Trophy, Zap
} from 'lucide-vue-next'
import type { Component } from 'vue'

/** The few Lucide icons a manifest can name as `lucide:<name>`; anything else falls back to a gamepad. */
const ICONS: Record<string, Component> = {
    'anchor': Anchor, 'bird': Bird, 'bomb': Bomb, 'brain': Brain, 'car': Car, 'castle': Castle, 'cat': Cat,
    'club': Club, 'coins': Coins, 'compass': Compass, 'crown': Crown, 'diamond': Diamond, 'dices': Dices,
    'dog': Dog, 'fish': Fish, 'flag': Flag, 'flame': Flame, 'gamepad-2': Gamepad2, 'gamepad': Gamepad2,
    'gem': Gem, 'ghost': Ghost, 'heart': Heart, 'map': MapIcon, 'mountain': Mountain, 'puzzle': Puzzle,
    'rocket': Rocket, 'shield': Shield, 'skull': Skull, 'sparkles': Sparkles, 'spade': Spade, 'star': Star,
    'sword': Sword, 'swords': Swords, 'target': Target, 'trophy': Trophy, 'zap': Zap
}

/** `lucide:name` → component, a URL → `{ src }`, otherwise the gamepad fallback. */
export function resolveGameIcon(icon: string | null | undefined): { component: Component } | { src: string } {
    if (icon?.startsWith('lucide:')) return { component: ICONS[icon.slice(7)] ?? Gamepad2 }
    if (icon && /^(https?:\/\/|\/)/.test(icon)) return { src: icon }
    return { component: Gamepad2 }
}

/** A game's accent as a CSS colour: the declared one when it looks like a colour, else a stable hue from the slug. */
export function gameAccent(game: { slug?: string, game?: string, accent: string | null }): string {
    if (game.accent && /^(#[0-9a-f]{3,8}|(oklch|hsl|rgb)a?\(.+\))$/i.test(game.accent.trim())) return game.accent.trim()
    const key = game.slug ?? game.game ?? ''
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360
    return `oklch(0.68 0.16 ${h})`
}
