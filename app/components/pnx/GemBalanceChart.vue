<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import type { GemStatsBucket } from '#shared/types/api'

/**
 * Compact 30-day gem balance chart for the home dashboard: one clean line
 * with a soft fill showing the closing balance each day, plus hover/keyboard
 * inspection for daily balance and in/out moves.
 */
const props = defineProps<{ buckets: GemStatsBucket[] }>()

const root = ref<HTMLElement | null>(null)
const { width } = useElementSize(root)
const gradId = useId()

const HEIGHT = 124
const TOP = 10
const BOTTOM = 20
const LEFT = 40
const RIGHT = 8
const plotH = HEIGHT - TOP - BOTTOM
const base = TOP + plotH

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceCeil(v: number): number {
    if (v <= 0) return 0
    if (v <= 5) return Math.ceil(v)
    const p = 10 ** Math.floor(Math.log10(v))
    return NICE.find(f => f * p >= v)! * p
}

const n = computed(() => props.buckets.length)
const plotW = computed(() => Math.max(0, width.value - LEFT - RIGHT))
const x = (i: number) => (n.value > 1 ? LEFT + (i / (n.value - 1)) * plotW.value : LEFT + plotW.value / 2)

const balMax = computed(() => niceCeil(Math.max(0, ...props.buckets.map(b => b.balance))) || 10)
const y = (v: number) => base - (v / balMax.value) * plotH

const linePoints = computed(() => {
    if (!n.value || !plotW.value) return ''
    if (n.value === 1) return `${LEFT},${y(props.buckets[0]!.balance)} ${LEFT + plotW.value},${y(props.buckets[0]!.balance)}`
    return props.buckets.map((b, i) => `${x(i)},${y(b.balance)}`).join(' ')
})

const areaPath = computed(() => {
    const pts = linePoints.value.split(' ')
    if (!pts.length || !pts[0]) return ''
    const firstX = pts[0].split(',')[0]
    const lastX = pts.at(-1)!.split(',')[0]
    return `M${pts.join('L')}L${lastX},${base}L${firstX},${base}Z`
})

const net30 = computed(() => props.buckets.reduce((sum, b) => sum + b.net, 0))
const signed = (v: number) => (v > 0 ? `+${formatNumber(v, false)}` : v < 0 ? `−${formatNumber(-v, false)}` : '0')

const active = ref<number | null>(null)
const current = computed(() => (active.value === null ? null : props.buckets[active.value] ?? null))

function pick(e: PointerEvent) {
    if (!n.value || !plotW.value) return
    const px = e.clientX - (e.currentTarget as SVGElement).getBoundingClientRect().left
    active.value = n.value > 1
        ? Math.min(n.value - 1, Math.max(0, Math.round(((px - LEFT) / plotW.value) * (n.value - 1))))
        : 0
}
function key(delta: number) {
    if (!n.value) return
    active.value = active.value === null ? n.value - 1 : Math.min(n.value - 1, Math.max(0, active.value + delta))
}

const tooltipStyle = computed(() => {
    if (active.value === null) return {}
    const px = x(active.value)
    return {
        left: `${px}px`,
        bottom: `${HEIGHT - TOP + 6}px`,
        transform: px > width.value / 2 ? 'translateX(calc(-100% + 8px))' : 'translateX(-8px)'
    }
})

const summary = computed(() => {
    const last = props.buckets.at(-1)
    return `Gem balance over the last 30 days: ${formatNumber(last?.balance ?? 0, false)} now, ${signed(net30.value)} net.`
})
</script>

<template>
    <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
            <p class="text-xs font-medium text-muted-foreground">Last 30 days</p>
            <span
                class="tabular text-xs font-medium"
                :class="net30 > 0 ? 'text-chart-in' : net30 < 0 ? 'text-loss' : 'text-muted-foreground'"
            >
                {{ signed(net30) }}
            </span>
        </div>

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
            <svg
                v-if="width > 0"
                :width="width"
                :height="HEIGHT"
                class="block touch-pan-y select-none"
                aria-hidden="true"
                @pointermove="pick"
                @pointerdown="pick"
                @pointerleave="active = null"
            >
                <defs>
                    <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--gem)" stop-opacity="0.22" />
                        <stop offset="100%" stop-color="var(--gem)" stop-opacity="0" />
                    </linearGradient>
                </defs>

                <g class="text-[10px]">
                    <line :x1="LEFT" :x2="LEFT + plotW" :y1="TOP" :y2="TOP" stroke="var(--border)" stroke-width="1" shape-rendering="crispEdges" />
                    <line :x1="LEFT" :x2="LEFT + plotW" :y1="base" :y2="base" stroke="color-mix(in oklch, var(--foreground) 28%, transparent)" stroke-width="1" shape-rendering="crispEdges" />
                    <text :x="LEFT - 6" :y="TOP" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">{{ formatNumber(balMax) }}</text>
                    <text :x="LEFT - 6" :y="base" dy="0.32em" text-anchor="end" class="tabular fill-muted-foreground">0</text>
                    <text v-if="n" :x="LEFT" :y="HEIGHT - 3" class="fill-muted-foreground">{{ formatDay(buckets[0]!.day) }}</text>
                    <text v-if="n" :x="LEFT + plotW" :y="HEIGHT - 3" text-anchor="end" class="fill-muted-foreground">Today</text>
                </g>

                <path v-if="areaPath" :d="areaPath" :fill="`url(#${gradId})`" />
                <polyline v-if="linePoints" :points="linePoints" fill="none" stroke="var(--gem)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

                <circle
                    v-if="n && active === null"
                    :cx="x(n - 1)"
                    :cy="y(buckets[n - 1]!.balance)"
                    r="3"
                    fill="var(--gem)"
                    stroke="var(--card)"
                    stroke-width="1.5"
                />

                <g v-if="current && active !== null">
                    <line :x1="x(active)" :x2="x(active)" :y1="TOP" :y2="base" stroke="var(--muted-foreground)" stroke-opacity="0.5" stroke-width="1" />
                    <circle :cx="x(active)" :cy="y(current.balance)" r="4" fill="var(--gem)" stroke="var(--card)" stroke-width="2" />
                </g>
            </svg>

            <div
                v-if="current"
                class="pointer-events-none absolute z-10 min-w-32 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
                :style="tooltipStyle"
                aria-live="polite"
            >
                <p class="mb-1 font-medium text-muted-foreground">{{ formatDay(current.day) }}</p>
                <dl class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5">
                    <dt class="text-muted-foreground">Balance</dt>
                    <dd class="tabular text-right font-semibold">{{ formatNumber(current.balance, false) }}</dd>
                    <template v-if="current.in > 0">
                        <dt class="text-muted-foreground">In</dt>
                        <dd class="tabular text-right font-semibold text-chart-in">+{{ formatNumber(current.in, false) }}</dd>
                    </template>
                    <template v-if="current.out > 0">
                        <dt class="text-muted-foreground">Out</dt>
                        <dd class="tabular text-right font-semibold text-loss">−{{ formatNumber(current.out, false) }}</dd>
                    </template>
                </dl>
            </div>
        </div>

        <table class="sr-only">
            <caption>Gem balance per day</caption>
            <thead>
                <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Net</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="b in buckets" :key="b.day">
                    <th scope="row">{{ formatDay(b.day) }}</th>
                    <td>{{ formatNumber(b.balance, false) }}</td>
                    <td>{{ signed(b.net) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
