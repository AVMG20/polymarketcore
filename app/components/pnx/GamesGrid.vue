<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Gamepad2 } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import type { GameSummary } from '#shared/types/api'

/**
 * Games, sectioned: verified ("Games"), "New" (unverified: playable, stars
 * don't count yet) and the viewer's drafts.
 */
const props = defineProps<{ games: GameSummary[], pending?: boolean, error?: boolean }>()
defineEmits<{ retry: [] }>()

const sections = computed(() => [
    { key: 'games', title: 'Games', note: '', games: props.games.filter(g => g.visibility === 'public' && g.app.verified) },
    { key: 'new', title: 'New', note: "Playable now, but stars here don't count yet.", games: props.games.filter(g => g.visibility === 'public' && !g.app.verified) },
    { key: 'drafts', title: 'Your drafts', note: 'Only you can see these.', games: props.games.filter(g => g.visibility === 'draft') }
].filter(s => s.games.length > 0))
</script>

<template>
    <div class="space-y-8">
        <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            <Skeleton v-for="i in 3" :key="i" class="h-52 rounded-2xl" />
        </div>
        <PnxStateBlock v-else-if="error" :icon="Gamepad2" tone="error" title="Couldn't load the games" text="Check your connection and try again.">
            <Button variant="outline" @click="$emit('retry')">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="sections.length === 0" :icon="Gamepad2" title="No games yet" text="Games show up here as soon as one is published.">
            <Button variant="outline" as-child><NuxtLink to="/developers">Make one</NuxtLink></Button>
        </PnxStateBlock>
        <section v-for="section in sections" :key="section.key" class="space-y-3">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h2 class="text-xl">{{ section.title }}</h2>
                <p v-if="section.note" class="text-sm text-muted-foreground">{{ section.note }}</p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PnxGameCard v-for="game in section.games" :key="game.slug" :game="game" />
            </div>
        </section>
    </div>
</template>
