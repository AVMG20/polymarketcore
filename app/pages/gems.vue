<script setup lang="ts">
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Gift, Gem, RotateCcw, Star, TriangleAlert, Wrench } from 'lucide-vue-next'
import type { Component } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { GemHistoryItem } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Gem history · Polynux' })

const SIZE = 25
const page = ref(1)
const { data, pending, error, refresh } = useGemHistory(page, SIZE)
const { me } = useMe()
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / SIZE)))

const KINDS: Record<GemHistoryItem['kind'], { label: string, icon: Component, tone: string }> = {
    welcome: { label: 'Welcome gift', icon: Gift, tone: 'bg-gem/15 text-gem' },
    daily: { label: 'Daily gems', icon: CalendarDays, tone: 'bg-gem/15 text-gem' },
    admin: { label: 'Adjustment', icon: Wrench, tone: 'bg-muted text-muted-foreground' },
    spend: { label: 'Spent', icon: ArrowUpRight, tone: 'bg-muted text-muted-foreground' },
    refund: { label: 'Refund', icon: RotateCcw, tone: 'bg-success/15 text-success' },
    bounty: { label: 'Star bounty', icon: Star, tone: 'bg-star/20 text-star' }
}
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 class="text-3xl">Gem history</h1>
                <p class="text-sm text-muted-foreground">Every gem in and out.</p>
            </div>
            <PnxGemChip v-if="me" :amount="me.gems" :compact="false" size="lg" />
        </div>

        <PnxFeedSkeleton v-if="pending && !data" :rows="8" />
        <PnxStateBlock v-else-if="error" :icon="TriangleAlert" tone="error" title="Couldn't load your history" text="Check your connection and try again.">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="!data?.items.length" :icon="Gem" title="No gem moves yet" text="Your first claim will show up here.">
            <Button variant="chunky" as-child><NuxtLink to="/">Go claim</NuxtLink></Button>
        </PnxStateBlock>

        <template v-else>
            <Card class="py-2" :class="pending ? 'opacity-60 transition-opacity' : ''">
                <CardContent>
                    <ul class="divide-y">
                        <li v-for="item in data.items" :key="item.id" class="flex items-center gap-3 py-3">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-xl" :class="KINDS[item.kind].tone">
                                <component :is="KINDS[item.kind].icon" class="size-4" aria-hidden="true" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold leading-tight">
                                    {{ KINDS[item.kind].label }}
                                    <Badge v-if="item.refund && item.kind !== 'refund'" variant="outline">refund</Badge>
                                </p>
                                <p class="truncate text-xs text-muted-foreground">
                                    <template v-if="item.gameName">{{ item.gameName }} · </template>{{ timeAgo(item.createdAt) }}
                                </p>
                            </div>
                            <div class="shrink-0 text-right">
                                <p class="tabular flex items-center justify-end gap-1 text-sm font-semibold" :class="item.amount < 0 ? 'text-foreground' : 'text-success'">
                                    <ArrowDownLeft v-if="item.amount > 0" class="size-3.5" aria-hidden="true" />
                                    {{ item.amount > 0 ? '+' : '' }}{{ formatNumber(item.amount, false) }}
                                </p>
                                <p class="tabular text-xs text-muted-foreground">{{ formatNumber(item.balanceAfter, false) }}</p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>
            <div v-if="pages > 1" class="flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">Newer</Button>
                <span class="tabular text-xs text-muted-foreground">{{ page }} / {{ pages }}</span>
                <Button size="sm" variant="outline" :disabled="page >= pages" @click="page++">Older</Button>
            </div>
        </template>
    </div>
</template>
