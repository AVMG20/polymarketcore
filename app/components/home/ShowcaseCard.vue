<script setup lang="ts">
import type { ShowcaseGame } from '#shared/types/api'

const props = defineProps<{ game: ShowcaseGame }>()
const accent = computed(() => gameAccent(props.game))
const coverBroken = ref(false)
const cover = ref<HTMLImageElement | null>(null)
onMounted(() => { if (cover.value?.complete && cover.value.naturalWidth === 0) coverBroken.value = true })
</script>

<template>
    <article
        class="spring h-full overflow-hidden rounded-2xl border bg-card dark:shadow-[0_1px_0_oklch(1_0_0/0.05)_inset] hover:-translate-y-1 hover:border-[color-mix(in_oklch,var(--accent-c)_50%,var(--border))]"
        :style="{ '--accent-c': accent }"
    >
        <div
            class="relative h-28 overflow-hidden sm:h-32"
            :style="{
                background: `radial-gradient(80% 90% at 80% 15%, color-mix(in oklch, ${accent} 58%, transparent), transparent 70%), linear-gradient(135deg, color-mix(in oklch, ${accent} 36%, var(--card)), color-mix(in oklch, ${accent} 10%, var(--card)))`
            }"
        >
            <img
                v-if="game.cover && !coverBroken"
                ref="cover"
                :src="game.cover"
                alt=""
                class="absolute inset-0 size-full object-cover"
                loading="lazy"
                @error="coverBroken = true"
            >
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card via-card/20 to-transparent" aria-hidden="true" />
        </div>
        <div class="-mt-7 flex flex-col px-4 pb-4">
            <PnxGameIcon :icon="game.icon" :accent="accent" :name="game.name" class="relative ring-4 ring-card" />
            <h3 class="mt-2.5 truncate font-display text-lg font-bold leading-tight">{{ game.name }}</h3>
            <p v-if="game.tagline" class="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{{ game.tagline }}</p>
        </div>
    </article>
</template>
