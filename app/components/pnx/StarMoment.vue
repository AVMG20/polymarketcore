<script setup lang="ts">
import { ArrowDown } from 'lucide-vue-next'

export interface StarMomentData {
    direction: 'up' | 'down'
    game: string
    stars: number
    from: number
    name?: string | null
    /** Gems the level paid (first time, verified apps), when known. */
    bounty?: number
}

/**
 * A level change. A rise is the one celebratory moment: a star pops in with a
 * short burst. A drop is a quiet muted line, no motion, no colour.
 */
defineProps<{ moment: StarMomentData }>()
const sparks = Array.from({ length: 12 }, (_, i) => ({ a: `${i * 30}deg`, d: `${46 + (i % 3) * 14}px`, delay: `${(i % 4) * 30}ms` }))
</script>

<template>
    <div class="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-50 flex justify-center px-4" role="status">
        <div
            v-if="moment.direction === 'up'"
            class="relative flex items-center gap-3 rounded-2xl border border-star/50 bg-popover/95 py-2.5 pl-3 pr-5 shadow-lg backdrop-blur motion-safe:animate-[pnx-rise_380ms_cubic-bezier(0.34,1.56,0.64,1)]"
        >
            <span class="relative flex size-12 items-center justify-center">
                <PnxStarGlyph class="size-12 text-star drop-shadow-[0_2px_0_rgb(0_0_0/0.15)] motion-safe:animate-[pnx-pop_520ms_cubic-bezier(0.34,1.56,0.64,1)]" />
                <span class="tabular absolute pt-0.5 text-sm font-extrabold text-star-foreground">{{ moment.stars }}</span>
                <span
                    v-for="(s, i) in sparks"
                    :key="i"
                    class="absolute left-1/2 top-1/2 hidden size-1.5 rounded-[2px] bg-star motion-safe:block motion-safe:animate-[pnx-burst_700ms_ease-out_forwards]"
                    :style="{ '--a': s.a, '--d': s.d, animationDelay: s.delay }"
                />
            </span>
            <div class="min-w-0 text-left">
                <p class="font-display text-base font-extrabold leading-tight">Level {{ moment.stars }}<template v-if="moment.name"> · {{ moment.name }}</template></p>
                <p class="truncate text-xs text-muted-foreground">
                    {{ moment.game }}<template v-if="moment.bounty"> · +{{ moment.bounty }} gems</template>
                </p>
            </div>
        </div>
        <div v-else class="flex items-center gap-1.5 rounded-full border bg-popover/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <ArrowDown class="size-3" aria-hidden="true" />
            <span>{{ moment.game }}: <span class="tabular">★{{ moment.from }} → ★{{ moment.stars }}</span></span>
        </div>
    </div>
</template>
