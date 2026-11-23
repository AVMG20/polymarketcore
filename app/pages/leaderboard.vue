<script setup lang="ts">
import { Crown, Hammer, Trophy, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { GameSummary, LeaderboardEntry } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Leaderboard · Polynux' })

const PAGE = 25
const MAX_MADE_ICONS = 5

const page = ref(1)
const { data, pending, error, refresh } = useLeaderboard(PAGE, () => (page.value - 1) * PAGE)
const { data: gamesData } = useGames()
const { me } = useMe()

const entries = computed(() => data.value?.entries ?? [])
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE)))
// Only games whose stars count are in the totals; show those tracks.
const columns = computed(() => (gamesData.value?.games ?? []).filter(g => g.counts))
const mine = computed(() => data.value?.me ?? null)
const mineVisible = computed(() => !!mine.value && entries.value.some(e => e.id === mine.value!.id))

const medal = (rank: number) => (
    rank === 1
        ? 'bg-star text-star-foreground shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.16)]'
        : rank === 2
            ? 'bg-zinc-300 text-zinc-900 ring-1 ring-inset ring-zinc-400/40 shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.12)] dark:bg-zinc-400/25 dark:text-zinc-100'
            : 'bg-[oklch(0.75_0.11_55/0.35)] text-foreground ring-1 ring-inset ring-[oklch(0.72_0.11_55/0.45)] shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.12)]'
)

const rowTone = (e: LeaderboardEntry) => {
    if (e.id === me.value?.id) return 'bg-primary/[0.06] shadow-[inset_3px_0_0_0_var(--primary)]'
    if (e.rank === 1) return 'bg-star/[0.04]'
    return ''
}

const tracks = (e: LeaderboardEntry) => columns.value.filter(g => (e.games[g.slug] ?? 0) > 0)

const currentLevelName = (g: GameSummary, stars: number) =>
    g.stars.find(l => l.position === stars)?.name ?? null
</script>

<template>
    <div class="space-y-5">
        <div class="flex items-baseline justify-between gap-3">
            <h1 class="text-3xl">Leaderboard</h1>
            <p v-if="data?.total" class="tabular text-sm text-muted-foreground">
                {{ data.total }} {{ data.total === 1 ? 'player' : 'players' }}
            </p>
        </div>

        <div v-if="pending && !data" class="divide-y overflow-hidden rounded-2xl border bg-card" aria-hidden="true">
            <div v-for="i in 6" :key="i" class="flex items-center gap-3 px-4 py-3.5">
                <Skeleton class="size-8 rounded-xl" />
                <Skeleton class="size-10 rounded-full" />
                <div class="flex-1 space-y-2">
                    <Skeleton class="h-4 w-32" />
                    <Skeleton class="h-3 w-20" />
                </div>
                <Skeleton class="h-7 w-14 rounded-full" />
            </div>
        </div>

        <PnxStateBlock v-else-if="error" :icon="TriangleAlert" tone="error" title="Couldn't load the leaderboard">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>

        <PnxStateBlock v-else-if="entries.length === 0" :icon="Trophy" title="No players yet">
            <Button variant="chunky" as-child><NuxtLink to="/games">Pick a game</NuxtLink></Button>
        </PnxStateBlock>

        <template v-else>
            <TooltipProvider :delay-duration="120">
                <ol class="divide-y divide-border/70 overflow-hidden rounded-2xl border bg-card">
                    <li v-for="e in entries" :key="e.id">
                        <div
                            class="group relative px-3 py-3 transition-colors hover:bg-accent/35 has-[a:focus-visible]:bg-accent/35 sm:px-4 sm:py-3.5"
                            :class="rowTone(e)"
                        >
                            <div class="flex flex-col gap-2.5 md:flex-row md:items-center md:gap-4">
                                <!-- Player identity (clicking the row background opens the profile). -->
                                <div class="flex min-w-0 flex-1 items-center gap-3">
                                    <span
                                        v-if="e.rank <= 3"
                                        class="tabular flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                                        :class="medal(e.rank)"
                                    >{{ e.rank }}</span>
                                    <span
                                        v-else
                                        class="tabular flex size-8 shrink-0 items-center justify-center text-sm font-semibold text-muted-foreground"
                                    >{{ e.rank }}</span>

                                    <PnxPlayerAvatar :name="e.name" :image="e.image" :emblem="e.emblem" :prestige="e.prestige" class="size-10" />

                                    <div class="min-w-0 flex-1">
                                        <div class="flex min-w-0 items-center gap-1.5">
                                            <NuxtLink
                                                :to="`/players/${e.id}`"
                                                class="truncate font-semibold leading-tight text-foreground outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                                            >{{ e.name }}</NuxtLink>
                                            <PnxPrestigeBadge :prestige="e.prestige" class="relative z-10" />
                                            <span
                                                v-if="e.id === me?.id"
                                                class="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                                            >You</span>
                                        </div>

                                        <div class="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
                                            <span class="inline-flex items-center gap-1 font-medium">
                                                <Crown class="size-3 shrink-0 text-star" aria-hidden="true" />
                                                {{ e.title }}
                                            </span>

                                            <div
                                                v-if="e.madeGames.length"
                                                class="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/45 py-0.5 pl-2 pr-1"
                                            >
                                                <Tooltip>
                                                    <TooltipTrigger as-child>
                                                        <span class="inline-flex cursor-default items-center gap-1 text-[11px] text-muted-foreground">
                                                            <Hammer class="size-3 shrink-0 text-primary" aria-hidden="true" />
                                                            <span>Made <strong class="tabular font-semibold text-foreground">{{ e.madeGames.length }}</strong></span>
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Added {{ e.madeGames.length }} {{ e.madeGames.length === 1 ? 'game' : 'games' }} to Polynux
                                                    </TooltipContent>
                                                </Tooltip>

                                                <span class="flex items-center gap-1">
                                                    <Tooltip v-for="g in e.madeGames.slice(0, MAX_MADE_ICONS)" :key="g.slug">
                                                        <TooltipTrigger as-child>
                                                            <NuxtLink
                                                                :to="`/games/${g.slug}`"
                                                                :aria-label="`${g.name} (made by ${e.name})`"
                                                                class="spring inline-flex rounded-[6px] outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
                                                            >
                                                                <PnxGameIcon :icon="g.icon" :accent="gameAccent(g)" :name="g.name" size="xs" />
                                                            </NuxtLink>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p class="font-semibold">{{ g.name }}</p>
                                                            <p class="text-[11px] text-muted-foreground">Made by {{ e.name }}</p>
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    <NuxtLink
                                                        v-if="e.madeGames.length > MAX_MADE_ICONS"
                                                        :to="`/players/${e.id}`"
                                                        class="tabular inline-flex size-5 items-center justify-center rounded-[6px] bg-background/80 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                                        :aria-label="`View all ${e.madeGames.length} games made by ${e.name}`"
                                                        :title="`View all ${e.madeGames.length} games`"
                                                    >+{{ e.madeGames.length - MAX_MADE_ICONS }}</NuxtLink>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <PnxStarChip :count="e.stars" class="md:hidden" />
                                </div>

                                <!-- Per-game stars: compact clickable icon chips, full track in tooltip. -->
                                <div
                                    v-if="tracks(e).length"
                                    class="flex flex-wrap items-center gap-1.5 pl-11 md:max-w-[46%] md:justify-end md:pl-0"
                                >
                                    <Tooltip v-for="g in tracks(e)" :key="g.slug">
                                        <TooltipTrigger as-child>
                                            <NuxtLink
                                                :to="`/games/${g.slug}`"
                                                :aria-label="`${g.name}: ${e.games[g.slug]} of ${g.maxStars} stars`"
                                                class="spring relative z-10 inline-flex items-center gap-1.5 rounded-xl border py-1 pl-1 pr-2 text-xs outline-none hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
                                                :class="(e.games[g.slug] ?? 0) >= g.maxStars && g.maxStars > 0
                                                    ? 'border-star/45 bg-star/12 hover:border-star/70 hover:bg-star/18'
                                                    : 'border-border/80 bg-background/60 hover:border-border hover:bg-accent/50'"
                                            >
                                                <PnxGameIcon :icon="g.icon" :accent="gameAccent(g)" :name="g.name" size="xs" />
                                                <span class="tabular leading-none">
                                                    <span
                                                        class="font-semibold"
                                                        :class="(e.games[g.slug] ?? 0) >= g.maxStars && g.maxStars > 0 ? 'text-star' : 'text-foreground'"
                                                    >{{ e.games[g.slug] }}</span><span v-if="g.maxStars > 0" class="text-muted-foreground">/{{ g.maxStars }}</span>
                                                </span>
                                            </NuxtLink>
                                        </TooltipTrigger>
                                        <TooltipContent class="space-y-1.5">
                                            <div class="flex items-center justify-between gap-3">
                                                <p class="font-semibold">{{ g.name }}</p>
                                                <span class="tabular text-[11px] text-muted-foreground">★{{ e.games[g.slug] }}/{{ g.maxStars }}</span>
                                            </div>
                                            <div v-if="g.stars.length" class="flex gap-[3px]" aria-hidden="true">
                                                <span
                                                    v-for="level in g.stars"
                                                    :key="level.position"
                                                    class="size-2.5 rounded-[3px] border"
                                                    :class="level.position <= (e.games[g.slug] ?? 0)
                                                        ? 'border-star bg-star'
                                                        : 'border-border bg-muted'"
                                                />
                                            </div>
                                            <p v-if="currentLevelName(g, e.games[g.slug] ?? 0)" class="text-[11px] text-muted-foreground">
                                                {{ currentLevelName(g, e.games[g.slug] ?? 0) }}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>

                                <div class="hidden shrink-0 justify-end md:flex md:min-w-[4.25rem]">
                                    <PnxStarChip :count="e.stars" />
                                </div>
                            </div>
                        </div>
                    </li>
                </ol>
            </TooltipProvider>

            <div v-if="pages > 1" class="flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">Previous</Button>
                <span class="tabular text-xs text-muted-foreground">{{ page }} / {{ pages }}</span>
                <Button size="sm" variant="outline" :disabled="page >= pages" @click="page++">Next</Button>
            </div>

            <!-- The viewer's own row stays in reach when they are off this page. -->
            <div
                v-if="mine && !mineVisible"
                class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:bottom-4"
            >
                <NuxtLink
                    :to="`/players/${mine.id}`"
                    class="flex items-center gap-3 rounded-2xl border border-primary/50 bg-card/95 px-3 py-3 shadow-lg backdrop-blur transition-colors hover:bg-card sm:px-4"
                >
                    <span class="tabular flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">{{ mine.rank }}</span>
                    <PnxPlayerAvatar :name="mine.name" :image="mine.image" :emblem="mine.emblem" :prestige="mine.prestige" class="size-10" />
                    <div class="min-w-0 flex-1">
                        <p class="flex min-w-0 items-center gap-1.5 font-semibold leading-tight">
                            <span class="truncate">You</span>
                            <PnxPrestigeBadge :prestige="mine.prestige" />
                        </p>
                        <div class="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                            <span class="inline-flex items-center gap-1 font-medium">
                                <Crown class="size-3 shrink-0 text-star" aria-hidden="true" />
                                {{ mine.title }}
                            </span>
                            <span v-if="mine.madeGames.length" class="inline-flex items-center gap-1">
                                <Hammer class="size-3 shrink-0 text-primary" aria-hidden="true" />
                                Made <strong class="tabular font-semibold text-foreground">{{ mine.madeGames.length }}</strong>
                            </span>
                        </div>
                    </div>
                    <PnxStarChip :count="mine.stars" />
                </NuxtLink>
            </div>
        </template>
    </div>
</template>
