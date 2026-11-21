<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { GameActivity } from '#shared/types/api'

/**
 * A game's last 30 days of play: four totals, then time played per day as
 * bars (one series, so no legend). Hover, tap or arrow keys show a day's
 * numbers; a hidden table carries every value for screen readers.
 */
const props = defineProps<{ activity: GameActivity }>()

const root = ref<HTMLElement | null>(null)
const { width } = useElementSize(root)

const HEIGHT = 96
const TOP = 6
const BOTTOM = 18
const LEFT = 30
const plotH = HEIGHT - TOP - BOTTOM
const base = TOP + plotH

const days = computed(() => props.activity.days)
const n = computed(() => days.value.length)
const plotW = computed(() => Math.max(0, width.value - LEFT))
const band = computed(() => (n.value ? plotW.value / n.value : 0))
const barW = computed(() => Math.max(1, Math.min(14, band.value - 2)))
const cx = (i: number) => LEFT + band.value * (i + 0.5)

/** Axis top in minutes: a round number at or above the busiest day. */
const maxMin = computed(() => {
    const top = Math.max(...days.value.map(d => d.seconds / 60), 0)
    if (top <= 5) return 5
    const p = 10 ** Math.floor(Math.log10(top))
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(f => f * p >= top)! * p
})
const y = (seconds: number) => base - (seconds / 60 / maxMin.value) * plotH

function bar(i: number, seconds: number): string {
    if (seconds <= 0) return ''
    const w = barW.value
    const x0 = cx(i) - w / 2
    const end = Math.min(y(seconds), base - 1.5)
    const r = Math.min(3, w / 2, base - end)
    return `M${x0},${base}V${end + r}Q${x0},${end} ${x0 + r},${end}H${x0 + w - r}Q${x0 + w},${end} ${x0 + w},${end + r}V${base}Z`
}
const bars = computed(() => days.value.map((d, i) => bar(i, d.seconds)))

const axisLabel = (min: number) => (min >= 60 ? `${formatNumber(Math.round(min / 6) / 10)}h` : `${min}m`)

const active = ref<number | null>(null)
const current = computed(() => (active.value === null ? null : days.value[active.value] ?? null))

function pick(e: PointerEvent) {
    const x = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left
    if (!band.value) return
    active.value = Math.min(n.value - 1, Math.max(0, Math.floor((x - LEFT) / band.value)))
}
function key(delta: number) {
    if (!n.value) return
    active.value = active.value === null ? n.value - 1 : Math.min(n.value - 1, Math.max(0, active.value + delta))
}

const tooltipStyle = computed(() => {
    if (active.value === null) return {}
    const x = cx(active.value)
    return { left: `${x}px`, bottom: `${HEIGHT - TOP + 6}px`, transform: x > width.value / 2 ? 'translateX(calc(-100% + 8px))' : 'translateX(-8px)' }
})

const t = computed(() => props.activity.totals)
const empty = computed(() => t.value.opens === 0)
const stats = computed(() => [
    { label: 'Played', value: formatDuration(t.value.seconds), title: `${formatNumber(t.value.seconds / 3600, false)} hours` },
    { label: 'Opens', value: formatNumber(t.value.opens), title: formatNumber(t.value.opens, false) },
    { label: 'Players', value: formatNumber(t.value.players), title: formatNumber(t.value.players, false) },
    { label: 'Most at once', value: formatNumber(t.value.peak), title: formatNumber(t.value.peak, false) }
])
const summary = computed(() => `Time played per day, last 30 days: ${formatDuration(t.value.seconds)} in total over ${t.value.opens} opens by ${t.value.players} players.`)
</script>

<template>
    <section class="space-y-3 rounded-2xl border bg-card p-4">
        <div class="flex items-baseline justify-between gap-2">
            <h2 class="text-xl">Activity</h2>
            <span class="text-xs text-muted-foreground">30 days</span>
        </div>

        <dl class="grid grid-cols-2 gap-2">
            <div v-for="s in stats" :key="s.label" class="rounded-xl bg-muted/50 px-3 py-2">
                <dt class="text-xs text-muted-foreground">{{ s.label }}</dt>
                <dd class="tabular text-lg font-bold leading-tight" :title="s.title">{{ s.value }}</dd>
            </div>
        </dl>

        <div>
            <p class="mb-1 text-xs text-muted-foreground">Time played per day</p>
            <div
                ref="root"
                class="relative rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                :style="{ height: `${HEIGHT}px` }"
                tabindex="0"
                role="group"
                :aria-label="summary"
                @keydown.left.prevent="key(-1)"
                @keydown.right.prevent="key(1)"
                @keydown.home.prevent="active = 0"
                @keydown.end.prevent="active = n - 1"
                @keydown.esc="active = null"
                @focus="active ??= n - 1"
                @blur="active = null"
            >
                <svg v-if="width > 0" :width="width" :height="HEIGHT" class="block touch-pan-y select-none" aria-hidden="true" @pointermove="pick" @pointerdown="pick" @pointerleave="active = null">
                    <g class="text-[10px]">
                        <line :x1="LEFT" :x2="width" :y1="TOP" :y2="TOP" stroke="var(--border)" stroke-width="1" shape-rendering="crispEdges" />
                        <line :x1="LEFT" :x2="width" :y1="base" :y2="base" stroke="color-mix(in oklch, var(--foreground) 28%, transparent)" stroke-width="1" shape-rendering="crispEdges" />
                        <text :x="LEFT - 5" :y="TOP" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">{{ axisLabel(maxMin) }}</text>
                        <text :x="LEFT - 5" :y="base" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">0</text>
                        <text v-if="n" :x="LEFT" :y="HEIGHT - 3" class="fill-muted-foreground">{{ formatDay(days[0]!.day) }}</text>
                        <text v-if="n" :x="width" :y="HEIGHT - 3" text-anchor="end" class="fill-muted-foreground">Today</text>
                    </g>
                    <line v-if="active !== null" :x1="cx(active)" :x2="cx(active)" :y1="TOP" :y2="base" stroke="var(--muted-foreground)" stroke-opacity="0.35" :stroke-width="Math.max(1, band)" />
                    <path v-for="(d, i) in bars" :key="i" :d="d" fill="var(--chart-in)" :opacity="active === null || active === i ? 1 : 0.45" />
                    <text v-if="empty" :x="LEFT + plotW / 2" :y="TOP + plotH / 2" dy="0.32em" text-anchor="middle" class="fill-muted-foreground text-xs">No plays yet</text>
                </svg>

                <div
                    v-if="current"
                    class="pointer-events-none absolute z-10 min-w-36 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
                    :style="tooltipStyle"
                    aria-live="polite"
                >
                    <p class="mb-1.5 font-medium text-muted-foreground">{{ formatDay(current.day) }}</p>
                    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        <dt class="text-muted-foreground">Played</dt>
                        <dd class="tabular text-right font-semibold">{{ formatDuration(current.seconds) }}</dd>
                        <dt class="text-muted-foreground">Opens</dt>
                        <dd class="tabular text-right font-semibold">{{ formatNumber(current.opens, false) }}</dd>
                        <dt class="text-muted-foreground">Players</dt>
                        <dd class="tabular text-right font-semibold">{{ formatNumber(current.players, false) }}</dd>
                        <dt class="text-muted-foreground">Most at once</dt>
                        <dd class="tabular text-right font-semibold">{{ formatNumber(current.peak, false) }}</dd>
                    </dl>
                </div>
            </div>
        </div>

        <p v-if="!empty" class="text-xs text-muted-foreground">
            Average session <span class="tabular font-medium text-foreground">{{ formatDuration(t.avgSessionSeconds) }}</span>
        </p>

        <table class="sr-only">
            <caption>Play per day</caption>
            <thead><tr><th scope="col">Day</th><th scope="col">Played</th><th scope="col">Opens</th><th scope="col">Players</th><th scope="col">Most at once</th></tr></thead>
            <tbody>
                <tr v-for="d in days" :key="d.day">
                    <th scope="row">{{ formatDay(d.day) }}</th><td>{{ formatDuration(d.seconds) }}</td><td>{{ d.opens }}</td><td>{{ d.players }}</td><td>{{ d.peak }}</td>
                </tr>
            </tbody>
        </table>
    </section>
</template>
