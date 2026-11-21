<script setup lang="ts">
import { Trophy, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry } from '#shared/types/api'

useHead({ title: 'Leaderboard · Polynux' })

const PAGE = 25
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

const medal = (rank: number) => (rank === 1 ? 'bg-star text-star-foreground' : rank === 2 ? 'bg-muted-foreground/25' : rank === 3 ? 'bg-[oklch(0.72_0.1_55/0.35)]' : 'bg-muted')
const tracks = (e: LeaderboardEntry) => columns.value.filter(g => (e.games[g.slug] ?? 0) > 0)
</script>

<template>
    <div class="space-y-5">
        <h1 class="text-3xl">Leaderboard</h1>

        <ul v-if="pending && !data" class="space-y-2" aria-hidden="true">
            <li v-for="i in 6" :key="i"><Skeleton class="h-16 rounded-2xl" /></li>
        </ul>
        <PnxStateBlock v-else-if="error" :icon="TriangleAlert" tone="error" title="Couldn't load the leaderboard">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="entries.length === 0" :icon="Trophy" title="No players yet">
            <Button variant="chunky" as-child><NuxtLink to="/games">Pick a game</NuxtLink></Button>
        </PnxStateBlock>

        <template v-else>
            <ol class="space-y-2">
                <li v-for="e in entries" :key="e.id">
                    <NuxtLink
                        :to="`/players/${e.id}`"
                        class="block rounded-2xl border bg-card px-3 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-4"
                        :class="e.id === me?.id ? 'border-primary/50 bg-primary/5' : ''"
                    >
                        <div class="flex items-center gap-3">
                            <span class="tabular flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold" :class="medal(e.rank)">{{ e.rank }}</span>
                            <PnxPlayerAvatar :name="e.name" :image="e.image" :emblem="e.emblem" :prestige="e.prestige" class="size-9" />
                            <div class="min-w-0 flex-1">
                                <p class="flex min-w-0 items-center gap-1.5 font-semibold leading-tight"><span class="truncate">{{ e.name }}</span><PnxPrestigeBadge :prestige="e.prestige" /></p>
                                <PnxTitleBadge :title="e.title" class="mt-0.5" />
                            </div>
                            <PnxStarChip :count="e.stars" />
                        </div>
                        <div v-if="tracks(e).length" class="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 pl-0 sm:pl-[4.5rem]">
                            <div v-for="g in tracks(e)" :key="g.slug" class="flex items-center gap-2">
                                <span class="max-w-24 truncate text-xs text-muted-foreground">{{ g.name }}</span>
                                <PnxStarTrack :levels="g.stars" :stars="e.games[g.slug] ?? 0" size="sm" />
                            </div>
                        </div>
                    </NuxtLink>
                </li>
            </ol>

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
                    class="flex items-center gap-3 rounded-2xl border border-primary/50 bg-card/95 px-3 py-3 shadow-lg backdrop-blur sm:px-4"
                >
                    <span class="tabular flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{{ mine.rank }}</span>
                    <PnxPlayerAvatar :name="mine.name" :image="mine.image" :emblem="mine.emblem" :prestige="mine.prestige" class="size-9" />
                    <div class="min-w-0 flex-1">
                        <p class="flex min-w-0 items-center gap-1.5 font-semibold leading-tight"><span class="truncate">You</span><PnxPrestigeBadge :prestige="mine.prestige" /></p>
                        <PnxTitleBadge :title="mine.title" class="mt-0.5" />
                    </div>
                    <PnxStarChip :count="mine.stars" />
                </NuxtLink>
            </div>
        </template>
    </div>
</template>
