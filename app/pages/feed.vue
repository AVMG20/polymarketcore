<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'
import { Newspaper, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

useHead({ title: 'Feed · Polynux' })

const { events, pending, error, loadingMore, moreError, done, more, reload } = useFeedStream()

// Endless scroll: load the next page when the sentinel nears the viewport.
const sentinel = ref<HTMLElement | null>(null)
const { stop } = useIntersectionObserver(sentinel, ([entry]) => {
    if (entry?.isIntersecting) more()
}, { rootMargin: '400px' })
onBeforeUnmount(stop)
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-5">
        <div>
            <h1 class="text-3xl">Feed</h1>
            <p class="text-sm text-muted-foreground">Level changes, claims and new faces.</p>
        </div>
        <PnxFeedSkeleton v-if="pending && events.length === 0" :rows="8" />
        <PnxStateBlock v-else-if="error && events.length === 0" :icon="TriangleAlert" tone="error" title="Couldn't load the feed" text="Check your connection and try again.">
            <Button variant="outline" @click="reload()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="events.length === 0" :icon="Newspaper" title="Nothing yet" text="Level changes and claims show up here as people play.">
            <Button variant="chunky" as-child><NuxtLink to="/games">Play a game</NuxtLink></Button>
        </PnxStateBlock>
        <Card v-else class="py-2">
            <CardContent>
                <ul class="divide-y">
                    <PnxFeedItem v-for="e in events" :key="e.id" :event="e" />
                </ul>
                <div ref="sentinel" class="py-3 text-center text-xs text-muted-foreground">
                    <PnxFeedSkeleton v-if="loadingMore" :rows="2" />
                    <Button v-else-if="moreError" size="sm" variant="outline" @click="more()">Couldn't load more. Try again</Button>
                    <span v-else-if="done">That's everything.</span>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
