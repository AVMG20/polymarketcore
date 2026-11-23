<script setup lang="ts">
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const { me } = useMe()
const { data: gamesData, pending: gamesPending, error: gamesError, refresh: refreshGames } = useGames()
const { data: profile, pending: profilePending } = usePlayerProfile(() => me.value?.id ?? '')
const { data: feed, pending: feedPending } = useFeed()
const { data: gemStats, pending: gemStatsPending, refresh: refreshGemStats } = useGemStats('30d')

watch(() => me.value?.gems, (next, prev) => {
    if (prev !== undefined && next !== undefined && next !== prev) refreshGemStats()
})

// The player's own order from the games page ("Mine"); games they never placed follow in hub order.
const games = computed(() => applyOrder(gamesData.value?.games ?? [], gamesData.value?.order ?? []))
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

        <div class="grid gap-4 lg:grid-cols-2">
            <Card class="gap-5">
                <CardContent class="space-y-5">
                    <div class="flex items-center justify-between gap-2">
                        <PnxGemChip :amount="me.gems" :compact="false" size="lg" />
                        <NuxtLink to="/gems" class="text-sm font-medium text-primary">History</NuxtLink>
                    </div>
                    <hr class="border-t">
                    <PnxClaimPile />
                    <template v-if="gemStats || gemStatsPending">
                        <hr class="border-t">
                        <PnxGemBalanceChart v-if="gemStats" :buckets="gemStats.buckets" />
                        <Skeleton v-else class="h-[148px] rounded-xl" />
                    </template>
                </CardContent>
            </Card>

            <Card class="gap-3">
                <CardContent>
                    <div class="mb-3 flex items-center justify-between gap-2">
                        <PnxStarChip :count="me.stars" size="lg" />
                        <NuxtLink :to="`/players/${me.id}`" class="text-sm font-medium text-primary">Profile</NuxtLink>
                    </div>
                    <PnxTitleProgress :title="me.title" :stars="me.stars" :next="me.nextTitle" />
                    <hr class="my-4 border-t">
                    <h2 class="mb-1 text-lg">Your levels</h2>
                    <PnxFeedSkeleton v-if="profilePending" :rows="3" />
                    <ul v-else-if="recentStars.length" class="divide-y">
                        <PnxFeedItem v-for="e in recentStars" :key="e.id" :event="e" hide-player />
                    </ul>
                    <p v-else class="py-6 text-center text-sm text-muted-foreground">No changes yet</p>
                </CardContent>
            </Card>
        </div>

        <PnxGamesGrid :games="games" :pending="gamesPending" :error="!!gamesError" :limit="6" more-to="/games" @retry="refreshGames()" />

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
