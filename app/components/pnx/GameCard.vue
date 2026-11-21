<script setup lang="ts">
import { Info, Package, Play } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import type { GameSummary } from '#shared/types/api'

/**
 * A tile in the games grid: clicking it plays the game; the info button opens its page (stars, top players).
 * `editing` (reordering the grid): the links go inert and the hover effects stop.
 */
const props = defineProps<{ game: GameSummary, hideMaker?: boolean, editing?: boolean }>()
const accent = computed(() => gameAccent(props.game))
const coverBroken = ref(false)
const cover = ref<HTMLImageElement | null>(null)
// An image that failed before hydration never fires @error: check it once mounted.
onMounted(() => { if (cover.value?.complete && cover.value.naturalWidth === 0) coverBroken.value = true })
const isDraft = computed(() => props.game.visibility === 'draft')
const { loggedIn } = useMe()
const playTo = computed(() => (loggedIn.value ? `/play/${props.game.slug}` : { path: '/login', query: { redirect: `/play/${props.game.slug}` } }))
</script>

<template>
    <div
        class="spring group relative overflow-hidden rounded-2xl border bg-card has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50"
        :class="editing ? '' : 'motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] hover:border-[color-mix(in_oklch,var(--accent-c)_55%,var(--border))]'"
        :style="{ '--accent-c': accent }"
    >
        <div
            class="relative h-20 overflow-hidden"
            :style="{ background: `linear-gradient(135deg, color-mix(in oklch, ${accent} 45%, var(--card)), color-mix(in oklch, ${accent} 14%, var(--card)))` }"
        >
            <img v-if="game.cover && !coverBroken" ref="cover" :src="game.cover" alt="" class="absolute inset-0 size-full object-cover" loading="lazy" @error="coverBroken = true">
            <span v-if="!editing" class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
                <span class="flex size-11 items-center justify-center rounded-full bg-background/85 text-foreground shadow-lg backdrop-blur"><Play class="size-5 translate-x-px fill-current" /></span>
            </span>
            <div class="absolute right-2 top-2 flex flex-wrap justify-end gap-1">
                <Badge v-if="isDraft" variant="secondary">Draft</Badge>
                <Badge v-else-if="!game.app.verified" variant="secondary">New</Badge>
                <Badge v-if="game.offline" variant="outline" class="bg-background/70 backdrop-blur">offline?</Badge>
            </div>
        </div>
        <div class="relative -mt-7 px-4 pb-4">
            <PnxGameIcon :icon="game.icon" :accent="accent" :name="game.name" class="ring-4 ring-card" />
            <h3 class="mt-2 truncate font-display text-lg font-bold leading-tight">
                <!-- Stretched over the whole card: a click anywhere plays. -->
                <NuxtLink
                    :to="playTo"
                    class="outline-none after:absolute after:inset-0 after:content-['']"
                    :class="editing ? 'pointer-events-none' : ''"
                    :tabindex="editing ? -1 : undefined"
                    :aria-label="`Play ${game.name}`"
                >{{ game.name }}</NuxtLink>
            </h3>
            <p class="mt-0.5 line-clamp-2 min-h-10 text-sm text-muted-foreground">{{ game.tagline }}</p>
            <p v-if="!hideMaker" class="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <template v-if="game.app.owner">
                    <PnxPlayerAvatar :name="game.app.owner.name" :image="game.app.owner.image" :emblem="game.app.owner.emblem" :prestige="game.app.owner.prestige" class="size-5 text-[10px]" />
                    <span class="max-w-36 truncate font-medium text-foreground/80" :title="game.app.owner.name">{{ game.app.owner.name }}</span>
                </template>
                <template v-else>
                    <Package class="size-3.5 shrink-0" aria-hidden="true" />
                    <span class="truncate">{{ game.app.name }}</span>
                </template>
            </p>
            <div v-if="game.maxStars > 0" class="mt-3 flex items-center justify-between gap-2">
                <PnxStarTrack :levels="game.stars" :stars="game.me?.stars ?? 0" :best="game.me?.best ?? 0" size="sm" />
                <span class="tabular shrink-0 text-xs text-muted-foreground">★{{ game.me?.stars ?? 0 }}/{{ game.maxStars }}</span>
            </div>
        </div>
        <NuxtLink
            v-if="!editing"
            :to="`/games/${game.slug}`"
            class="absolute left-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/75 text-foreground/80 outline-none backdrop-blur transition-colors hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            :aria-label="`${game.name} info`"
            title="Info"
        ><Info class="size-4" /></NuxtLink>
    </div>
</template>
