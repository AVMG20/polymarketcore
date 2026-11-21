<script setup lang="ts">
import { ArrowLeft, ExternalLink, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { StarMomentData } from '@/components/pnx/StarMoment.vue'

definePageMeta({ layout: 'bare', middleware: 'auth' })

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { me } = useMe()
const { launch, error, pending, reload } = useGameLaunch(slug)
const iframe = ref<HTMLIFrameElement | null>(null)
const loaded = ref(false)

// Level names, bounties and the viewer's previous level, to tell a rise from a drop.
const { data: gamesData, refresh: refreshGames } = useGames()
const levels = new Map<string, number>()
const meta = computed(() => gamesData.value?.games.find(g => g.slug === slug.value) ?? null)
watch(() => gamesData.value, (d) => {
    for (const g of d?.games ?? []) if (!levels.has(g.slug)) levels.set(g.slug, g.me?.stars ?? 0)
}, { immediate: true })

const moment = ref<StarMomentData | null>(null)
let momentTimer: ReturnType<typeof setTimeout> | undefined

function onStar({ game, stars }: { game: string, stars: number }) {
    const g = gamesData.value?.games.find(x => x.slug === game) ?? meta.value
    const from = levels.get(game) ?? 0
    if (stars === from) return
    const up = stars > from
    const best = g?.me?.best ?? 0
    const bounty = up && g?.app.verified && stars > best
        ? g.stars.filter(s => s.position > best && s.position <= stars).reduce((sum, s) => sum + s.bounty, 0)
        : 0
    moment.value = {
        direction: up ? 'up' : 'down',
        game: g?.name ?? title.value,
        stars,
        from,
        name: g?.stars.find(s => s.position === stars)?.name ?? null,
        bounty: bounty || undefined
    }
    levels.set(game, stars)
    clearTimeout(momentTimer)
    momentTimer = setTimeout(() => (moment.value = null), up ? 3600 : 4500)
    // Keep best/bounty data current for the next change.
    refreshGames().catch(() => null)
}

const { gameTitle, sendHello } = usePnxBridge(iframe, () => launch.value?.app.origin, {
    // The app's session expired: fetch a fresh token; the new src reloads the iframe.
    onRelaunch: reload,
    onStar
})

const title = computed(() => gameTitle.value || launch.value?.game.name || meta.value?.name || 'Loading')
useHead({ title: () => `${title.value} · Polynux` })

// New launch URL means a new iframe: show the loading state again.
watch(() => launch.value?.url, () => (loaded.value = false))
function onLoad() {
    loaded.value = true
    sendHello()
}

// Games are untrusted: scripts and their own origin, but no top navigation
// (a game can't redirect the hub to a phishing page).
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads'

onBeforeUnmount(() => clearTimeout(momentTimer))
</script>

<template>
    <!-- The bar is 2.75rem + the notch; the game gets everything below it (dvh, no page scroll). -->
    <div class="flex h-full flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <header class="flex h-[calc(2.75rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background px-2 pt-[env(safe-area-inset-top)] sm:px-3">
            <Button variant="ghost" size="icon-sm" as-child aria-label="Back to Polynux">
                <NuxtLink to="/"><ArrowLeft /></NuxtLink>
            </Button>
            <span class="min-w-0 flex-1 truncate font-display font-bold">{{ title }}</span>
            <template v-if="me">
                <NuxtLink to="/gems" data-pnx-wallet class="shrink-0 rounded-full" aria-label="Gem history"><PnxGemChip :amount="me.gems" size="sm" /></NuxtLink>
                <PnxStarChip :count="me.stars" size="sm" class="max-[380px]:hidden" />
            </template>
            <Button v-if="launch" variant="ghost" size="icon-sm" as-child aria-label="Open in new tab">
                <a :href="launch.directUrl" target="_blank" rel="noopener"><ExternalLink /></a>
            </Button>
        </header>

        <div class="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
            <div v-if="error" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span class="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><TriangleAlert class="size-6" /></span>
                <p class="font-display text-lg font-bold">Couldn't start this game</p>
                <p class="max-w-sm text-sm text-muted-foreground">{{ error }}</p>
                <div class="flex gap-2">
                    <Button variant="chunky" @click="reload">Try again</Button>
                    <Button variant="outline" as-child><NuxtLink to="/games">Games</NuxtLink></Button>
                </div>
            </div>
            <template v-else>
                <iframe
                    v-if="launch"
                    ref="iframe"
                    :key="launch.url"
                    :src="launch.url"
                    :title="title"
                    :sandbox="SANDBOX"
                    class="block size-full border-0 bg-background"
                    allow="fullscreen; pointer-lock; gamepad; autoplay; clipboard-write"
                    @load="onLoad"
                />
                <div v-if="pending || !loaded" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background" role="status">
                    <PnxGemGlyph class="size-10 text-gem motion-safe:animate-pulse" />
                    <p class="text-sm text-muted-foreground">Loading {{ title === 'Loading' ? 'game' : title }}…</p>
                </div>
            </template>
        </div>

        <PnxStarMoment v-if="moment" :moment="moment" />
    </div>
</template>
