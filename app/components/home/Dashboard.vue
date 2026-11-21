<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'

const { me } = useMe()
const { data: gamesData, pending: gamesPending, error: gamesError, refresh: refreshGames } = useGames()
const { data: profile, pending: profilePending } = usePlayerProfile(() => me.value?.id ?? '')
const { data: feed, pending: feedPending } = useFeed()

const games = computed(() => gamesData.value?.games ?? [])
const recentStars = computed(() => (profile.value?.recent ?? []).filter(e => e.type === 'star').slice(0, 4))
const feedPreview = computed(() => (feed.value?.events ?? []).slice(0, 6))
</script>

<template>
    <div v-if="me" class="space-y-8">
        <div class="flex items-center gap-3">
            <PnxPlayerAvatar :name="me.name" :image="me.image" :emblem="me.emblem" :prestige="me.prestige" class="size-12" />
            <div class="min-w-0">
                <h1 class="truncate text-2xl sm:text-3xl">Hi {{ me.name }}</h1>
            </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-5">
            <Card class="gap-5 lg:col-span-3">
                <CardContent class="space-y-5">
                    <div class="flex flex-wrap items-center gap-2">
                        <PnxGemChip :amount="me.gems" :compact="false" size="lg" />
                        <PnxStarChip :count="me.stars" size="lg" />
                    </div>
                    <hr class="border-t">
                    <PnxClaimPile />
                    <hr class="border-t">
                    <PnxTitleProgress :title="me.title" :stars="me.stars" :next="me.nextTitle" />
                </CardContent>
            </Card>

            <Card class="gap-3 lg:col-span-2">
                <CardContent>
                    <div class="mb-1 flex items-center justify-between">
                        <h2 class="text-lg">Your levels</h2>
                        <NuxtLink :to="`/players/${me.id}`" class="text-sm font-medium text-primary">Profile</NuxtLink>
                    </div>
                    <PnxFeedSkeleton v-if="profilePending" :rows="3" />
                    <ul v-else-if="recentStars.length" class="divide-y">
                        <PnxFeedItem v-for="e in recentStars" :key="e.id" :event="e" hide-player />
                    </ul>
                    <p v-else class="py-6 text-center text-sm text-muted-foreground">No changes yet</p>
                </CardContent>
            </Card>
        </div>

        <PnxGamesGrid :games="games" :pending="gamesPending" :error="!!gamesError" @retry="refreshGames()" />

        <section>
            <Card class="gap-3">
                <CardContent>
                    <div class="mb-1 flex items-center justify-between">
                        <h2 class="text-lg">Around Polynux</h2>
                        <NuxtLink to="/feed" class="text-sm font-medium text-primary">See all</NuxtLink>
                    </div>
                    <PnxFeedSkeleton v-if="feedPending" />
                    <ul v-else-if="feedPreview.length" class="divide-y">
                        <PnxFeedItem v-for="e in feedPreview" :key="e.id" :event="e" />
                    </ul>
                    <p v-else class="py-6 text-center text-sm text-muted-foreground">Nothing yet</p>
                </CardContent>
            </Card>
        </section>
    </div>
</template>
