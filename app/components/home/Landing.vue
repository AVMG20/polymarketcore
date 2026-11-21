<script setup lang="ts">
import { ArrowRight, Code, Gem, Trophy } from 'lucide-vue-next'
import { DAILY_GEMS, STARTER_GEMS } from '#shared/economy'

const { data, pending, error, refresh } = useGames()
const games = computed(() => data.value?.games ?? [])
const featured = computed(() => games.value.filter(g => g.visibility === 'public').slice(0, 3))

const steps = [
    { icon: Gem, title: 'Collect gems', text: `${STARTER_GEMS} to start, ${DAILY_GEMS} more every day. They pile up for up to 10 days.` },
    { icon: Trophy, title: 'Earn stars', text: 'Every game has up to 10 star levels. Play well, climb them. They can drop, too.' },
    { icon: Code, title: 'Make your own', text: 'Have a coding agent build a game and put it on Polynux.' }
]
</script>

<template>
    <div class="space-y-14 sm:space-y-20">
        <section class="relative overflow-hidden rounded-3xl border bg-card px-5 py-12 text-center sm:px-10 sm:py-20">
            <div class="pointer-events-none absolute inset-0 -z-0 opacity-70" aria-hidden="true"
                style="background: radial-gradient(60% 70% at 15% 0%, color-mix(in oklch, var(--primary) 22%, transparent), transparent), radial-gradient(50% 60% at 90% 100%, color-mix(in oklch, var(--gem) 25%, transparent), transparent)" />
            <PnxStarGlyph class="absolute left-[6%] top-[5%] size-7 sm:left-[8%] sm:top-[18%] sm:size-8 rotate-[-12deg] text-star motion-safe:animate-[pnx-pop_700ms_both]" aria-hidden="true" />
            <PnxGemGlyph class="absolute bottom-[4%] right-[6%] size-8 sm:bottom-[14%] sm:right-[9%] sm:size-10 rotate-[10deg] text-gem motion-safe:animate-[pnx-pop_700ms_150ms_both]" aria-hidden="true" />
            <PnxStarGlyph class="absolute right-[16%] top-[12%] hidden size-5 rotate-12 text-star/70 sm:block" aria-hidden="true" />
            <PnxGemGlyph class="absolute bottom-[22%] left-[14%] hidden size-6 -rotate-12 text-gem/70 sm:block" aria-hidden="true" />
            <div class="relative mx-auto max-w-2xl space-y-5">
                <h1 class="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">Play. Collect stars. <span class="text-primary">Climb.</span></h1>
                <p class="mx-auto max-w-md text-base text-muted-foreground sm:text-lg">Free games, one gem wallet, one leaderboard. No real money, ever.</p>
                <div class="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                    <Button variant="chunky" size="lg" as-child><NuxtLink to="/register">Play free <ArrowRight /></NuxtLink></Button>
                    <Button variant="outline" size="lg" as-child><NuxtLink to="/login">Sign in</NuxtLink></Button>
                </div>
                <p class="flex items-center justify-center gap-2 text-sm text-muted-foreground">Start with <PnxGemChip :amount="STARTER_GEMS" /></p>
            </div>
        </section>

        <section class="space-y-4">
            <div class="flex items-end justify-between gap-3">
                <h2 class="text-2xl">Jump in</h2>
                <NuxtLink to="/games" class="text-sm font-medium text-primary">All games</NuxtLink>
            </div>
            <PnxGamesGrid v-if="pending || error || featured.length === 0" :games="[]" :pending="pending" :error="!!error" @retry="refresh()" />
            <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <PnxGameCard v-for="g in featured" :key="g.slug" :game="g" />
            </div>
        </section>

        <section class="grid gap-4 md:grid-cols-3">
            <div v-for="(s, i) in steps" :key="s.title" class="rounded-2xl border bg-card p-5">
                <span class="flex size-10 items-center justify-center rounded-xl text-white"
                    :class="['bg-gem !text-gem-foreground', 'bg-star !text-star-foreground', 'bg-primary'][i]">
                    <component :is="s.icon" class="size-5" />
                </span>
                <h3 class="mt-3 text-lg">{{ s.title }}</h3>
                <p class="mt-1 text-sm text-muted-foreground">{{ s.text }}</p>
            </div>
        </section>
    </div>
</template>
