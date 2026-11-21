<script setup lang="ts">
import { TITLES } from '#shared/economy'
import type { NextTitle } from '#shared/types/api'

/** Progress from the current title to the next. Titles can drop, so say so plainly. */
const props = defineProps<{ title: string, stars: number, next: NextTitle | null }>()
const from = computed(() => TITLES.find(t => t.name === props.title)?.stars ?? 0)
const pct = computed(() => props.next ? Math.min(100, Math.max(0, ((props.stars - from.value) / (props.next.stars - from.value)) * 100)) : 100)
</script>

<template>
    <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-2 text-sm">
            <PnxTitleBadge :title="title" />
            <span v-if="next" class="tabular text-xs text-muted-foreground">{{ next.remaining }} ★ to {{ next.name }}</span>
            <span v-else class="text-xs text-muted-foreground">Top title</span>
        </div>
        <div class="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full rounded-full bg-star transition-[width] duration-700" :style="{ width: `${pct}%` }" />
        </div>
    </div>
</template>
