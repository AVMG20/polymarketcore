import { CalendarDays, Gift, RotateCcw, ShoppingBag, Star, Wrench } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { GemHistoryKind } from '#shared/types/api'

/** Label, icon and icon tile tone of each kind of gem move. */
export const GEM_KINDS: Record<GemHistoryKind, { label: string, icon: Component, tone: string }> = {
    welcome: { label: 'Welcome gift', icon: Gift, tone: 'bg-gem/15 text-gem' },
    daily: { label: 'Daily gems', icon: CalendarDays, tone: 'bg-gem/15 text-gem' },
    admin: { label: 'Adjustment', icon: Wrench, tone: 'bg-muted text-muted-foreground' },
    spend: { label: 'Spent', icon: ShoppingBag, tone: 'bg-muted text-muted-foreground' },
    refund: { label: 'Refund', icon: RotateCcw, tone: 'bg-success/15 text-success' },
    bounty: { label: 'Star bounty', icon: Star, tone: 'bg-star/20 text-star' }
}

const dateTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateTimeYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** "21 Nov, 14:05" in Amsterdam time (the economy's clock; the same on server and client). Adds the year when it isn't this year's. */
export function formatMoveTime(iso: string, now: Date = new Date()): string {
    const d = new Date(iso)
    return (d.getFullYear() === now.getFullYear() ? dateTime : dateTimeYear).format(d)
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** 'YYYY-MM-DD' → "21 Nov". */
export function formatDay(day: string): string {
    return dayFormat.format(new Date(`${day}T12:00:00Z`))
}
