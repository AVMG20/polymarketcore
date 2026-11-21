<script setup lang="ts">
import { Gamepad2, TriangleAlert, UserX } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data, pending, error, refresh } = usePlayerProfile(id)
const { me } = useMe()

const player = computed(() => data.value?.player ?? null)
const notFound = computed(() => apiErrorStatus(error.value) === 404)
const isMe = computed(() => me.value?.id === id.value)
const joined = computed(() => player.value ? new Date(player.value.joinedAt).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : '')

useHead({ title: () => `${player.value?.name ?? 'Player'} · Polynux` })
</script>

<template>
    <div class="mx-auto max-w-3xl space-y-6">
        <div v-if="pending && !player" class="space-y-4" aria-hidden="true">
            <Skeleton class="h-40 rounded-3xl" />
            <Skeleton class="h-24 rounded-2xl" />
            <Skeleton class="h-24 rounded-2xl" />
        </div>
        <PnxStateBlock v-else-if="notFound" :icon="UserX" title="Player not found" text="That profile doesn't exist.">
            <Button variant="outline" as-child><NuxtLink to="/leaderboard">Leaderboard</NuxtLink></Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="error || !player" :icon="TriangleAlert" tone="error" title="Couldn't load this profile" text="Check your connection and try again.">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>

        <template v-else>
            <Card class="gap-5">
                <CardContent class="space-y-5">
                    <div class="flex items-center gap-4">
                        <PnxPlayerAvatar :name="player.name" :image="player.image" :emblem="player.emblem" :prestige="player.prestige" class="size-16 text-2xl" />
                        <div class="min-w-0 flex-1">
                            <div class="flex min-w-0 items-center gap-2">
                                <h1 class="truncate text-2xl sm:text-3xl">{{ player.name }}</h1>
                                <PnxPrestigeBadge :prestige="player.prestige" size="md" />
                            </div>
                            <p class="text-sm text-muted-foreground">
                                <template v-if="player.rank">Rank <span class="tabular font-semibold text-foreground">#{{ player.rank }}</span> · </template>Joined {{ joined }}
                            </p>
                        </div>
                        <PnxStarChip :count="player.stars" size="lg" class="hidden sm:inline-flex" />
                    </div>
                    <PnxStarChip :count="player.stars" size="lg" class="sm:hidden" />
                    <PnxTitleProgress :title="player.title" :stars="player.stars" :next="player.nextTitle" />
                    <Button v-if="isMe" variant="outline" size="sm" as-child><NuxtLink to="/settings">Edit profile</NuxtLink></Button>
                </CardContent>
            </Card>

            <section class="space-y-3">
                <h2 class="text-xl">Games</h2>
                <PnxStateBlock v-if="data!.tracks.length === 0" :icon="Gamepad2" title="No stars yet" :text="isMe ? 'Open a game and earn your first star.' : 'This player hasn\'t earned a star yet.'">
                    <Button v-if="isMe" variant="chunky" as-child><NuxtLink to="/games">Pick a game</NuxtLink></Button>
                </PnxStateBlock>
                <ul v-else class="grid gap-3 sm:grid-cols-2">
                    <li v-for="t in data!.tracks" :key="t.game">
                        <NuxtLink :to="`/games/${t.game}`" class="block h-full rounded-2xl border bg-card p-4 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50">
                            <div class="flex items-center gap-3">
                                <PnxGameIcon :icon="t.icon" :accent="gameAccent(t)" :name="t.name" size="sm" />
                                <div class="min-w-0 flex-1">
                                    <p class="truncate font-display font-bold leading-tight">{{ t.name }}</p>
                                    <p class="tabular text-xs text-muted-foreground">
                                        ★{{ t.stars }}/{{ t.maxStars }}<template v-if="t.best > t.stars"> · best ★{{ t.best }}</template>
                                    </p>
                                </div>
                                <Badge v-if="t.retired" variant="outline">retired</Badge>
                                <Badge v-else-if="!t.counts" variant="secondary">doesn't count</Badge>
                            </div>
                            <div class="mt-3"><PnxStarTrack :levels="t.levels" :stars="t.stars" :best="t.best" /></div>
                        </NuxtLink>
                    </li>
                </ul>
            </section>

            <section class="space-y-1">
                <h2 class="text-xl">Recent</h2>
                <ul v-if="data!.recent.length" class="divide-y">
                    <PnxFeedItem v-for="e in data!.recent" :key="e.id" :event="e" hide-player />
                </ul>
                <p v-else class="py-4 text-sm text-muted-foreground">Nothing yet.</p>
            </section>
        </template>
    </div>
</template>
