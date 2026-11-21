<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { ChartColumn, Table2 } from 'lucide-vue-next'
import type { GemStatsBucket } from '#shared/types/api'

/**
 * Gems per day (or week): in above the baseline, out below, net as a line;
 * under it the balance at the end of each bucket on its own axis (small
 * multiples, never a second y-scale). One crosshair and tooltip for both,
 * by pointer or arrow keys; a table view holds every number.
 */
const props = defineProps<{ buckets: GemStatsBucket[], bucket: 'day' | 'week' }>()

const root = ref<HTMLElement | null>(null)
const { width } = useElementSize(root)
const showTable = ref(false)

const FLOW_H = 160
const GAP = 22
const BAL_H = 72
const AXIS_H = 22
const LEFT = 44
const RIGHT = 10
const TOP = 8
const HEIGHT = TOP + FLOW_H + GAP + BAL_H + AXIS_H
const flowTop = TOP
const balTop = TOP + FLOW_H + GAP
const balBase = balTop + BAL_H

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

/** The next round number at or above `v` (1, 1.2, 1.5, 2, … 8 × 10ⁿ), for integer gem axes. */
function niceCeil(v: number): number {
    if (v <= 0) return 0
    if (v <= 5) return Math.ceil(v)
    const p = 10 ** Math.floor(Math.log10(v))
    return NICE.find(f => f * p >= v)! * p
}

const n = computed(() => props.buckets.length)
const plotW = computed(() => Math.max(0, width.value - LEFT - RIGHT))
const band = computed(() => (n.value ? plotW.value / n.value : 0))
const cx = (i: number) => LEFT + band.value * (i + 0.5)
const barW = computed(() => Math.max(1, Math.min(24, band.value - 2)))

const flowDomain = computed(() => {
    let up = 0
    let down = 0
    for (const b of props.buckets) {
        up = Math.max(up, b.in, b.net)
        down = Math.max(down, b.out, -b.net)
    }
    up = niceCeil(up)
    down = niceCeil(down)
    if (!up && !down) up = 10
    return { up, down }
})
const y = (v: number) => flowTop + ((flowDomain.value.up - v) / (flowDomain.value.up + flowDomain.value.down)) * FLOW_H
const y0 = computed(() => y(0))

const balMax = computed(() => niceCeil(Math.max(0, ...props.buckets.map(b => b.balance))) || 10)
const yb = (v: number) => balTop + (1 - v / balMax.value) * BAL_H

// A label closer than 14px to the zero line would overlap it: keep the gridline, drop the label.
const flowTicks = computed(() => [flowDomain.value.up, 0, -flowDomain.value.down]
    .filter((v, i) => i === 1 || v !== 0)
    .map(v => ({ v, label: v === 0 || Math.abs(y(v) - y0.value) >= 14 })))
const balTicks = computed(() => [balMax.value, 0])

/** A bar from the baseline with a 4px rounded data end; square at the baseline. */
function barPath(i: number, value: number, dir: 1 | -1): string {
    if (value <= 0) return ''
    const w = barW.value
    const x0 = cx(i) - w / 2
    // 1px off the baseline on each side: a 2px gap where an in and an out bar meet.
    const base = y0.value - dir
    const end = dir === 1 ? Math.min(y(value), base - 1) : Math.max(y(-value), base + 1)
    const h = Math.abs(base - end)
    const r = Math.min(4, w / 2, h)
    if (dir === 1) {
        return `M${x0},${base}V${end + r}Q${x0},${end} ${x0 + r},${end}H${x0 + w - r}Q${x0 + w},${end} ${x0 + w},${end + r}V${base}Z`
    }
    return `M${x0},${base}V${end - r}Q${x0},${end} ${x0 + r},${end}H${x0 + w - r}Q${x0 + w},${end} ${x0 + w},${end - r}V${base}Z`
}

const inBars = computed(() => props.buckets.map((b, i) => barPath(i, b.in, 1)))
const outBars = computed(() => props.buckets.map((b, i) => barPath(i, b.out, -1)))

function linePoints(values: number[], scale: (v: number) => number): string {
    if (values.length === 1) {
        const half = Math.min(band.value / 2, 12)
        return `${cx(0) - half},${scale(values[0]!)} ${cx(0) + half},${scale(values[0]!)}`
    }
    return values.map((v, i) => `${cx(i)},${scale(v)}`).join(' ')
}
const netLine = computed(() => linePoints(props.buckets.map(b => b.net), y))
const balLine = computed(() => linePoints(props.buckets.map(b => b.balance), yb))
const balArea = computed(() => {
    const pts = balLine.value.split(' ')
    if (!pts.length || !pts[0]) return ''
    const first = pts[0].split(',')[0]
    const last = pts.at(-1)!.split(',')[0]
    return `M${pts.join('L')}L${last},${balBase}L${first},${balBase}Z`
})

const xLabels = computed(() => {
    if (!n.value || !plotW.value) return []
    const fit = Math.max(2, Math.floor(plotW.value / 72))
    const step = Math.max(1, Math.ceil(n.value / fit))
    const out: { i: number, x: number, text: string }[] = []
    for (let i = n.value - 1; i >= 0; i -= step) {
        out.push({ i, x: Math.min(Math.max(cx(i), LEFT + 18), LEFT + plotW.value - 18), text: formatDay(props.buckets[i]!.day) })
    }
    return out.reverse()
})

const tick = (v: number) => (v < 0 ? `−${formatNumber(-v)}` : formatNumber(v))
const signed = (v: number) => (v > 0 ? `+${formatNumber(v, false)}` : v < 0 ? `−${formatNumber(-v, false)}` : '0')
const bucketLabel = (b: GemStatsBucket) => (props.bucket === 'week' ? `Week of ${formatDay(b.day)}` : formatDay(b.day))
const empty = computed(() => props.buckets.every(b => b.moves === 0))

// ─── Hover and keys ──────────────────────────────────────────────────────

const active = ref<number | null>(null)
const current = computed(() => (active.value === null ? null : props.buckets[active.value] ?? null))

function pick(e: PointerEvent) {
    const svg = e.currentTarget as SVGElement
    const x = e.clientX - svg.getBoundingClientRect().left
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
    const right = x > width.value / 2
    return { left: `${x}px`, top: `${flowTop}px`, transform: right ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }
})

const summary = computed(() => {
    const sum = props.buckets.reduce((s, b) => ({ in: s.in + b.in, out: s.out + b.out }), { in: 0, out: 0 })
    const last = props.buckets.at(-1)
    return `Gems per ${props.bucket}: ${formatNumber(sum.in, false)} in, ${formatNumber(sum.out, false)} out, balance ${formatNumber(last?.balance ?? 0, false)}.`
})
</script>

<template>
    <div class="space-y-3">
        <div class="flex items-center justify-between gap-3">
            <ul class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
                <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-[3px] bg-chart-in" aria-hidden="true" />In</li>
                <li class="flex items-center gap-1.5"><span class="size-2.5 rounded-[3px] bg-chart-out" aria-hidden="true" />Out</li>
                <li class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full bg-foreground/75" aria-hidden="true" />Net</li>
                <li class="flex items-center gap-1.5"><span class="h-0.5 w-3 rounded-full bg-chart-in" aria-hidden="true" />Balance</li>
            </ul>
            <button
                type="button"
                class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                :aria-pressed="showTable"
                :aria-label="showTable ? 'Show chart' : 'Show table'"
                :title="showTable ? 'Chart' : 'Table'"
                @click="showTable = !showTable"
            >
                <component :is="showTable ? ChartColumn : Table2" class="size-4" aria-hidden="true" />
            </button>
        </div>

        <div v-if="showTable" class="max-h-[294px] overflow-auto rounded-xl border">
            <table class="w-full text-right text-xs">
                <thead class="sticky top-0 bg-card text-muted-foreground">
                    <tr class="border-b">
                        <th scope="col" class="px-3 py-2 text-left font-medium">{{ bucket === 'week' ? 'Week' : 'Day' }}</th>
                        <th scope="col" class="px-2 py-2 font-medium">In</th>
                        <th scope="col" class="px-2 py-2 font-medium">Out</th>
                        <th scope="col" class="px-2 py-2 font-medium">Net</th>
                        <th scope="col" class="px-3 py-2 font-medium">Balance</th>
                    </tr>
                </thead>
                <tbody class="tabular divide-y">
                    <tr v-for="b in [...buckets].reverse()" :key="b.day">
                        <th scope="row" class="px-3 py-1.5 text-left font-normal text-muted-foreground">{{ formatDay(b.day) }}</th>
                        <td class="px-2 py-1.5">{{ b.in ? formatNumber(b.in, false) : '·' }}</td>
                        <td class="px-2 py-1.5">{{ b.out ? formatNumber(b.out, false) : '·' }}</td>
                        <td class="px-2 py-1.5">{{ signed(b.net) }}</td>
                        <td class="px-3 py-1.5">{{ formatNumber(b.balance, false) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div
            v-else
            ref="root"
            class="relative rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                <!-- grid and axes -->
                <g class="text-[11px]">
                    <template v-for="t in flowTicks" :key="`f${t.v}`">
                        <line :x1="LEFT" :x2="LEFT + plotW" :y1="y(t.v)" :y2="y(t.v)" :stroke="t.v === 0 ? 'color-mix(in oklch, var(--foreground) 28%, transparent)' : 'var(--border)'" stroke-width="1" shape-rendering="crispEdges" />
                        <text v-if="t.label" :x="LEFT - 6" :y="y(t.v)" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">{{ tick(t.v) }}</text>
                    </template>
                    <template v-for="t in balTicks" :key="`b${t}`">
                        <line :x1="LEFT" :x2="LEFT + plotW" :y1="yb(t)" :y2="yb(t)" :stroke="t === 0 ? 'color-mix(in oklch, var(--foreground) 28%, transparent)' : 'var(--border)'" stroke-width="1" shape-rendering="crispEdges" />
                        <text :x="LEFT - 6" :y="yb(t)" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">{{ tick(t) }}</text>
                    </template>
                    <text v-for="l in xLabels" :key="`x${l.i}`" :x="l.x" :y="HEIGHT - 6" text-anchor="middle" class="fill-muted-foreground">{{ l.text }}</text>
                </g>

                <!-- in/out bars, net line -->
                <path v-for="(d, i) in inBars" :key="`in${i}`" :d="d" fill="var(--chart-in)" :opacity="active === null || active === i ? 1 : 0.4" />
                <path v-for="(d, i) in outBars" :key="`out${i}`" :d="d" fill="var(--chart-out)" :opacity="active === null || active === i ? 1 : 0.4" />
                <polyline v-if="!empty" :points="netLine" fill="none" stroke="color-mix(in oklch, var(--foreground) 75%, transparent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

                <!-- balance -->
                <path :d="balArea" fill="var(--chart-in)" fill-opacity="0.1" />
                <polyline :points="balLine" fill="none" stroke="var(--chart-in)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

                <text v-if="empty" :x="LEFT + plotW / 2" :y="flowTop + FLOW_H / 2" text-anchor="middle" class="fill-muted-foreground text-sm">No moves</text>

                <!-- crosshair -->
                <g v-if="current && active !== null">
                    <line :x1="cx(active)" :x2="cx(active)" :y1="flowTop" :y2="balBase" stroke="var(--muted-foreground)" stroke-opacity="0.6" stroke-width="1" />
                    <circle :cx="cx(active)" :cy="y(current.net)" r="4" fill="color-mix(in oklch, var(--foreground) 85%, var(--card))" stroke="var(--card)" stroke-width="2" />
                    <circle :cx="cx(active)" :cy="yb(current.balance)" r="4" fill="var(--chart-in)" stroke="var(--card)" stroke-width="2" />
                </g>
            </svg>

            <div
                v-if="current"
                class="pointer-events-none absolute z-10 min-w-36 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
                :style="tooltipStyle"
                aria-live="polite"
            >
                <p class="mb-1.5 font-medium text-muted-foreground">{{ bucketLabel(current) }}</p>
                <dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
                    <dt class="flex items-center gap-1.5 text-muted-foreground"><span class="h-0.5 w-3 rounded-full bg-chart-in" aria-hidden="true" />In</dt>
                    <dd class="tabular text-right font-semibold">{{ formatNumber(current.in, false) }}</dd>
                    <dt class="flex items-center gap-1.5 text-muted-foreground"><span class="h-0.5 w-3 rounded-full bg-chart-out" aria-hidden="true" />Out</dt>
                    <dd class="tabular text-right font-semibold">{{ formatNumber(current.out, false) }}</dd>
                    <dt class="flex items-center gap-1.5 text-muted-foreground"><span class="h-0.5 w-3 rounded-full bg-foreground/75" aria-hidden="true" />Net</dt>
                    <dd class="tabular text-right font-semibold">{{ signed(current.net) }}</dd>
                    <dt class="flex items-center gap-1.5 text-muted-foreground"><span class="h-0.5 w-3 rounded-full bg-chart-in" aria-hidden="true" />Balance</dt>
                    <dd class="tabular text-right font-semibold">{{ formatNumber(current.balance, false) }}</dd>
                </dl>
            </div>
        </div>
    </div>
</template>
