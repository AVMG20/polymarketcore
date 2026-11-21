<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import type { GameSummary } from '#shared/types/api'

/** A tile in the games grid: tinted cover, icon, name, the viewer's star track. */
const props = defineProps<{ game: GameSummary }>()
const accent = computed(() => gameAccent(props.game))
const coverBroken = ref(false)
const cover = ref<HTMLImageElement | null>(null)
// An image that failed before hydration never fires @error: check it once mounted.
onMounted(() => { if (cover.value?.complete && cover.value.naturalWidth === 0) coverBroken.value = true })
const isDraft = computed(() => props.game.visibility === 'draft')
</script>

<template>
    <NuxtLink
        :to="`/games/${game.slug}`"
        class="spring group relative block overflow-hidden rounded-2xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] hover:border-[color-mix(in_oklch,var(--accent-c)_55%,var(--border))]"
        :style="{ '--accent-c': accent }"
    >
        <div
            class="relative h-20 overflow-hidden"
            :style="{ background: `linear-gradient(135deg, color-mix(in oklch, ${accent} 45%, var(--card)), color-mix(in oklch, ${accent} 14%, var(--card)))` }"
        >
            <img v-if="game.cover && !coverBroken" ref="cover" :src="game.cover" alt="" class="absolute inset-0 size-full object-cover" loading="lazy" @error="coverBroken = true">
            <div class="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
                <Badge v-if="isDraft" variant="secondary">Draft</Badge>
                <Badge v-else-if="!game.app.verified" variant="secondary">New</Badge>
                <Badge v-if="game.offline" variant="outline" class="bg-background/70 backdrop-blur">offline?</Badge>
            </div>
        </div>
        <div class="relative -mt-7 px-4 pb-4">
            <PnxGameIcon :icon="game.icon" :accent="accent" :name="game.name" class="ring-4 ring-card" />
            <h3 class="mt-2 truncate font-display text-lg font-bold leading-tight">{{ game.name }}</h3>
            <p class="mt-0.5 line-clamp-2 min-h-10 text-sm text-muted-foreground">{{ game.tagline || game.app.name }}</p>
            <div class="mt-3 flex items-center justify-between gap-2">
                <PnxStarTrack :levels="game.stars" :stars="game.me?.stars ?? 0" :best="game.me?.best ?? 0" size="sm" />
                <span class="tabular shrink-0 text-xs text-muted-foreground">★{{ game.me?.stars ?? 0 }}/{{ game.maxStars }}</span>
            </div>
        </div>
    </NuxtLink>
</template>
