<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { GemHistoryKind, GemStatsSource } from '#shared/types/api'

/**
 * Where gems came from and went to: one bar per source with its amount and
 * share of that side. A source is a button that filters the ledger
 * (`select`), the active one shows a check; the tail folds into "Other".
 */
const props = defineProps<{ sources: GemStatsSource[], active: { kind: GemHistoryKind, game: string | null } | null }>()
const emit = defineEmits<{ select: [source: { kind: GemHistoryKind, game: string | null } | null] }>()

const MAX_ROWS = 6

interface Row {
    id: string
    source: GemStatsSource | null
    label: string
    amount: number
    moves: number
    share: number
}

function side(direction: 'in' | 'out') {
    const list = props.sources.filter(s => s.direction === direction)
    const total = list.reduce((sum, s) => sum + s.amount, 0)
    const rows: Row[] = list.slice(0, list.length > MAX_ROWS ? MAX_ROWS - 1 : MAX_ROWS).map(s => ({
        id: `${s.kind}:${s.game ?? ''}`,
        source: s,
        label: s.kind === 'spend' ? (s.gameName ?? s.game ?? GEM_KINDS.spend.label) : GEM_KINDS[s.kind].label,
        amount: s.amount,
        moves: s.moves,
        share: total ? s.amount / total : 0
    }))
    const rest = list.slice(rows.length)
    if (rest.length) {
        const amount = rest.reduce((sum, s) => sum + s.amount, 0)
        rows.push({ id: 'other', source: null, label: 'Other', amount, moves: rest.reduce((sum, s) => sum + s.moves, 0), share: total ? amount / total : 0 })
    }
    return { total, rows }
}

const groups = computed(() => [
    { direction: 'in' as const, title: 'In', color: 'bg-chart-in', ...side('in') },
    { direction: 'out' as const, title: 'Out', color: 'bg-chart-out', ...side('out') }
])

const isActive = (s: GemStatsSource | null) => !!s && props.active?.kind === s.kind && (props.active?.game ?? null) === s.game
const pct = (share: number) => (share >= 0.995 ? '100%' : share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`)

function toggle(s: GemStatsSource | null) {
    if (!s) return
    emit('select', isActive(s) ? null : { kind: s.kind, game: s.game })
}
</script>

<template>
    <div class="space-y-5">
        <div v-for="g in groups" :key="g.direction" class="space-y-2">
            <div class="flex items-baseline justify-between gap-2">
                <h3 class="text-sm font-semibold">{{ g.title }}</h3>
                <span class="tabular text-xs text-muted-foreground">{{ formatNumber(g.total, false) }}</span>
            </div>
            <p v-if="!g.rows.length" class="py-2 text-xs text-muted-foreground">None</p>
            <ul v-else class="space-y-1">
                <li v-for="row in g.rows" :key="row.id">
                    <component
                        :is="row.source ? 'button' : 'div'"
                        :type="row.source ? 'button' : undefined"
                        class="group w-full rounded-lg px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
                        :class="[row.source ? 'hover:bg-muted' : '', isActive(row.source) ? 'bg-muted ring-1 ring-inset ring-primary/30' : '']"
                        :aria-pressed="row.source ? isActive(row.source) : undefined"
                        :title="row.source ? `${formatNumber(row.amount, false)} gems · ${row.moves} ${row.moves === 1 ? 'move' : 'moves'}` : undefined"
                        @click="toggle(row.source)"
                    >
                        <span class="flex items-center gap-2 text-sm">
                            <component :is="row.source ? GEM_KINDS[row.source.kind].icon : 'span'" class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span class="min-w-0 flex-1 truncate">{{ row.label }}</span>
                            <Check v-if="isActive(row.source)" class="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                            <span class="tabular shrink-0 font-medium">{{ formatNumber(row.amount) }}</span>
                            <span class="tabular w-9 shrink-0 text-right text-xs text-muted-foreground">{{ pct(row.share) }}</span>
                        </span>
                        <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted group-hover:bg-background" aria-hidden="true">
                            <span class="block h-full rounded-r-[4px]" :class="g.color" :style="{ width: `${Math.max(row.share * 100, row.amount ? 1.5 : 0)}%` }" />
                        </span>
                    </component>
                </li>
            </ul>
        </div>
    </div>
</template>
