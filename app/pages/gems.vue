<script setup lang="ts">
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Gem, TriangleAlert, X } from 'lucide-vue-next'
import type { Component } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GEM_RANGES } from '#shared/gem-history'
import type { GemHistoryItem, GemHistoryKind, GemRange } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Gem history · Polynux' })

const route = useRoute()
const router = useRouter()
const DEFAULT_RANGE: GemRange = '30d'
const range = computed<GemRange>({
    get: () => (GEM_RANGES.includes(route.query.range as GemRange) ? route.query.range as GemRange : DEFAULT_RANGE),
    set: v => router.replace({ query: { ...route.query, range: v === DEFAULT_RANGE ? undefined : v } })
})
const rangeOptions = GEM_RANGES.map(value => ({ value, label: value === 'all' ? 'All' : value }))

const dir = ref<'all' | 'in' | 'out'>('all')
const dirOptions = [
    { value: 'all' as const, label: 'All' },
    { value: 'in' as const, label: 'In', icon: ArrowDownLeft },
    { value: 'out' as const, label: 'Out', icon: ArrowUpRight }
]
const source = ref<{ kind: GemHistoryKind, game: string | null } | null>(null)

const { data: stats, pending: statsPending, error: statsError, refresh: refreshStats } = useGemStats(range)
const ledger = useGemLedger(() => ({ range: range.value, dir: dir.value, source: source.value }))

const signed = (v: number) => (v > 0 ? `+${formatNumber(v, false)}` : v < 0 ? `−${formatNumber(-v, false)}` : '0')

const tiles = computed<{ label: string, value: string, icon: Component | null, tone: string }[]>(() => {
    const s = stats.value
    if (!s) return []
    return [
        { label: 'In', value: formatNumber(s.totals.in, false), icon: ArrowDownLeft, tone: 'bg-chart-in/15 text-chart-in' },
        { label: 'Out', value: formatNumber(s.totals.out, false), icon: ArrowUpRight, tone: 'bg-chart-out/15 text-chart-out' },
        { label: 'Net', value: signed(s.totals.net), icon: ArrowRightLeft, tone: 'bg-muted text-muted-foreground' },
        { label: 'Balance', value: formatNumber(s.balance, false), icon: null, tone: 'bg-gem/15 text-gem' }
    ]
})

const sourceLabel = computed(() => {
    const s = source.value
    if (!s) return ''
    if (s.kind === 'spend' && s.game) return stats.value?.sources.find(x => x.game === s.game)?.gameName ?? s.game
    return GEM_KINDS[s.kind].label
})

function showAll() {
    source.value = null
    dir.value = 'all'
}

const reasonOf = (item: GemHistoryItem) => (item.kind === 'spend' && typeof item.meta?.reason === 'string' ? item.meta.reason.trim() : '')
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl">Gem history</h1>
            <PnxSegmented v-model="range" :options="rangeOptions" label="Range" />
        </div>

        <PnxStateBlock v-if="statsError && !stats" :icon="TriangleAlert" tone="error" title="Couldn't load your gems">
            <Button variant="outline" @click="refreshStats()">Try again</Button>
        </PnxStateBlock>

        <template v-else>
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" :class="statsPending && stats ? 'opacity-60 transition-opacity' : ''">
                <template v-if="stats">
                    <div v-for="t in tiles" :key="t.label" class="min-w-0 rounded-2xl border bg-card p-4">
                        <p class="flex items-center gap-2 text-sm text-muted-foreground">
                            <span class="flex size-6 items-center justify-center rounded-lg" :class="t.tone">
                                <component :is="t.icon" v-if="t.icon" class="size-3.5" aria-hidden="true" />
                                <PnxGemGlyph v-else class="size-3.5" />
                            </span>
                            {{ t.label }}
                        </p>
                        <p class="mt-2 truncate font-display text-2xl font-bold leading-none">{{ t.value }}</p>
                    </div>
                </template>
                <template v-else>
                    <Skeleton v-for="i in 4" :key="i" class="h-[5.25rem] rounded-2xl" />
                </template>
            </div>

            <div class="grid gap-4 lg:grid-cols-3">
                <Card class="min-w-0 py-4 lg:col-span-2" :class="statsPending && stats ? 'opacity-60 transition-opacity' : ''">
                    <CardContent class="px-4">
                        <PnxGemFlowChart v-if="stats" :buckets="stats.buckets" :bucket="stats.bucket" />
                        <Skeleton v-else class="h-[330px] rounded-xl" />
                    </CardContent>
                </Card>
                <Card class="min-w-0 py-4" :class="statsPending && stats ? 'opacity-60 transition-opacity' : ''">
                    <CardContent class="px-4">
                        <PnxGemSources v-if="stats" :sources="stats.sources" :active="source" @select="source = $event" />
                        <Skeleton v-else class="h-[330px] rounded-xl" />
                    </CardContent>
                </Card>
            </div>
        </template>

        <section class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-baseline gap-2">
                    <h2 class="text-xl">Moves</h2>
                    <span class="tabular text-sm text-muted-foreground">{{ formatNumber(ledger.total.value, false) }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Badge v-if="source" as-child variant="secondary" class="h-7 gap-1 pr-1.5">
                        <button type="button" :aria-label="`Clear filter ${sourceLabel}`" @click="source = null">
                            {{ sourceLabel }}<X class="size-3.5" aria-hidden="true" />
                        </button>
                    </Badge>
                    <PnxSegmented v-model="dir" :options="dirOptions" label="Direction" />
                </div>
            </div>

            <PnxStateBlock v-if="ledger.error.value && !ledger.items.value.length" :icon="TriangleAlert" tone="error" title="Couldn't load your moves">
                <Button variant="outline" @click="ledger.refresh()">Try again</Button>
            </PnxStateBlock>
            <PnxFeedSkeleton v-else-if="ledger.pending.value && !ledger.items.value.length" :rows="6" />
            <PnxStateBlock v-else-if="!ledger.items.value.length" :icon="Gem" title="No moves">
                <Button v-if="source || dir !== 'all'" variant="outline" @click="showAll()">Show all</Button>
                <Button v-else variant="chunky" as-child><NuxtLink to="/">Go claim</NuxtLink></Button>
            </PnxStateBlock>

            <Card v-else class="py-2" :class="ledger.pending.value ? 'opacity-60 transition-opacity' : ''">
                <CardContent class="px-4">
                    <div class="hidden grid-cols-[2.25rem_1fr_8.5rem_6rem_6rem] gap-3 border-b py-2 text-xs text-muted-foreground sm:grid" aria-hidden="true">
                        <span /><span /><span>When</span><span class="text-right">Gems</span><span class="text-right">Balance</span>
                    </div>
                    <ul class="divide-y">
                        <li v-for="item in ledger.items.value" :key="item.id" class="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[2.25rem_1fr_8.5rem_6rem_6rem]">
                            <span class="flex size-9 items-center justify-center rounded-xl" :class="GEM_KINDS[item.kind].tone">
                                <component :is="GEM_KINDS[item.kind].icon" class="size-4" aria-hidden="true" />
                            </span>
                            <div class="min-w-0">
                                <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold leading-tight">
                                    {{ GEM_KINDS[item.kind].label }}
                                    <Badge v-if="item.refund && item.kind !== 'refund'" variant="outline">refund</Badge>
                                </p>
                                <p class="line-clamp-2 text-xs text-muted-foreground">
                                    <NuxtLink v-if="item.game" :to="`/games/${item.game}`" class="font-medium text-foreground/80 hover:text-foreground hover:underline">{{ item.gameName }}</NuxtLink>
                                    <template v-if="item.game && reasonOf(item)"> · </template>
                                    <template v-if="reasonOf(item)">{{ reasonOf(item) }}</template>
                                    <span class="sm:hidden"><template v-if="item.game || reasonOf(item)"> · </template><time :datetime="item.createdAt">{{ formatMoveTime(item.createdAt) }}</time></span>
                                </p>
                            </div>
                            <time :datetime="item.createdAt" class="tabular hidden text-xs text-muted-foreground sm:block">{{ formatMoveTime(item.createdAt) }}</time>
                            <div class="text-right">
                                <p class="tabular text-sm font-semibold" :class="item.amount < 0 ? 'text-loss' : 'text-success'">{{ signed(item.amount) }}</p>
                                <p class="tabular text-xs text-muted-foreground sm:hidden">{{ formatNumber(item.balanceAfter, false) }}</p>
                            </div>
                            <p class="tabular hidden text-right text-sm text-muted-foreground sm:block">{{ formatNumber(item.balanceAfter, false) }}</p>
                        </li>
                    </ul>
                </CardContent>
            </Card>
            <div v-if="ledger.hasMore.value" class="flex justify-center">
                <Button variant="outline" size="sm" :disabled="ledger.loadingMore.value" @click="ledger.loadMore()">More</Button>
            </div>
        </section>
    </div>
</template>
