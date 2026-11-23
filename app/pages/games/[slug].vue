<script setup lang="ts">
import { Gamepad2, Play, TriangleAlert } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data, pending, error, refresh } = useGame(slug)
const { loggedIn } = useMe()

const game = computed(() => data.value?.game ?? null)
const accent = computed(() => (game.value ? gameAccent(game.value) : 'var(--primary)'))
const notFound = computed(() => apiErrorStatus(error.value) === 404)
const description = computed(() => renderMarkdown(game.value?.description))
const coverBroken = ref(false)
const cover = ref<HTMLImageElement | null>(null)
// An image that failed before hydration never fires @error: check it once mounted.
onMounted(() => { if (cover.value?.complete && cover.value.naturalWidth === 0) coverBroken.value = true })
const best = computed(() => game.value?.me?.best ?? 0)
const current = computed(() => game.value?.me?.stars ?? 0)
const { counts } = usePresence()
const live = computed(() => counts.value[slug.value] ?? 0)

useHead({ title: () => `${game.value?.name ?? 'Game'} · Polynux` })
</script>

<template>
    <div class="space-y-6">
        <div v-if="pending && !game" class="space-y-4" aria-hidden="true">
            <Skeleton class="h-44 rounded-3xl" />
            <Skeleton class="h-64 rounded-2xl" />
        </div>
        <PnxStateBlock v-else-if="notFound" :icon="Gamepad2" title="Game not found">
            <Button variant="outline" as-child><NuxtLink to="/games">All games</NuxtLink></Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="error || !game" :icon="TriangleAlert" tone="error" title="Couldn't load this game">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>

        <template v-else>
            <section
                class="relative overflow-hidden rounded-3xl border p-5 sm:p-8"
                :style="{ background: `linear-gradient(135deg, color-mix(in oklch, ${accent} 38%, var(--card)), color-mix(in oklch, ${accent} 8%, var(--card)))` }"
            >
                <img v-if="game.cover && !coverBroken" ref="cover" :src="game.cover" alt="" class="absolute inset-0 size-full object-cover opacity-40" @error="coverBroken = true">
                <div class="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                    <PnxGameIcon :icon="game.icon" :accent="accent" :name="game.name" size="lg" />
                    <div class="min-w-0 flex-1 space-y-1.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-3xl sm:text-4xl">{{ game.name }}</h1>
                            <PnxHotBadge v-if="game.hot" />
                            <Badge v-if="live" variant="outline" class="gap-1.5 bg-background/70" :title="`${live} playing now`">
                                <span class="size-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" aria-hidden="true" />{{ live }} playing
                            </Badge>
                            <Badge v-if="game.visibility === 'draft'" variant="secondary">Draft</Badge>
                            <Badge v-else-if="!game.app.verified" variant="secondary">New</Badge>
                            <Badge v-if="game.offline" variant="outline" class="bg-background/70">offline?</Badge>
                        </div>
                        <p v-if="game.tagline" class="text-muted-foreground">{{ game.tagline }}</p>
                        <PnxGameMaker :app="game.app" class="pt-1" />
                    </div>
                    <div class="flex flex-col gap-2 sm:items-end">
                        <Button variant="chunky" size="lg" as-child>
                            <NuxtLink :to="loggedIn ? `/play/${game.slug}` : { path: '/login', query: { redirect: `/play/${game.slug}` } }"><Play /> Play</NuxtLink>
                        </Button>
                        <p v-if="!loggedIn" class="text-xs text-muted-foreground">Sign in to play</p>
                    </div>
                </div>
            </section>

            <p v-if="!game.counts && game.visibility === 'public'" class="flex items-center gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />
                Unverified: no star count, no bounties
            </p>

            <div class="grid gap-6 lg:grid-cols-3">
                <div class="space-y-6 lg:col-span-2">
                    <Card v-if="description" class="gap-0">
                        <CardContent><div class="prose-lite text-sm leading-relaxed" v-html="description" /></CardContent>
                    </Card>

                    <section class="space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                            <h2 class="text-xl">Star levels</h2>
                            <div v-if="loggedIn" class="flex items-center gap-2">
                                <PnxStarTrack :levels="game.stars" :stars="current" :best="best" />
                                <span class="tabular text-xs text-muted-foreground">★{{ current }}/{{ game.maxStars }}</span>
                            </div>
                        </div>
                        <PnxStateBlock v-if="game.stars.length === 0" title="No star levels" />
                        <ol v-else class="divide-y overflow-hidden rounded-2xl border bg-card">
                            <li
                                v-for="level in game.stars"
                                :key="level.key"
                                class="flex items-center gap-3 px-4 py-3"
                                :class="level.position <= current ? 'bg-star/10' : ''"
                            >
                                <span
                                    class="tabular flex h-9 w-12 shrink-0 items-center justify-center gap-0.5 rounded-xl border text-sm font-bold"
                                    :class="level.position <= current ? 'border-star bg-star text-star-foreground' : level.position <= best ? 'border-star/70 bg-star/15' : 'bg-muted text-muted-foreground'"
                                    :aria-label="`Star ${level.position}`"
                                ><PnxStarGlyph class="size-3.5" :class="level.position <= current ? '' : level.position <= best ? 'text-star' : 'opacity-60'" />{{ level.position }}</span>
                                <div class="min-w-0 flex-1">
                                    <p class="font-semibold leading-tight">{{ level.name }}</p>
                                    <p v-if="level.description" class="text-sm text-muted-foreground">{{ level.description }}</p>
                                </div>
                                <div class="flex shrink-0 flex-col items-end gap-1">
                                    <span v-if="level.bounty > 0 && game.app.verified" class="flex items-center gap-1.5 text-xs text-muted-foreground" :title="`First time you reach this level: +${level.bounty} gems`">
                                        {{ level.position <= best ? 'Earned' : 'Reward' }}
                                        <PnxGemChip :amount="level.bounty" size="sm" :class="level.position <= best ? 'opacity-50' : ''" />
                                    </span>
                                    <span class="tabular text-xs text-muted-foreground">{{ level.holders }} {{ level.holders === 1 ? 'player' : 'players' }}</span>
                                </div>
                            </li>
                        </ol>
                    </section>
                </div>

                <aside class="space-y-6">
                    <PnxGameActivity v-if="data?.activity" :activity="data.activity" />

                    <section class="space-y-3">
                        <h2 class="text-xl">Top players</h2>
                        <ol v-if="data?.topPlayers.length" class="divide-y overflow-hidden rounded-2xl border bg-card">
                            <li v-for="(p, i) in data.topPlayers" :key="p.id">
                                <NuxtLink :to="`/players/${p.id}`" class="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50">
                                    <span class="tabular w-5 text-center text-sm text-muted-foreground">{{ i + 1 }}</span>
                                    <PnxPlayerAvatar :name="p.name" :image="p.image" :emblem="p.emblem" :prestige="p.prestige" class="size-8" />
                                    <span class="min-w-0 flex-1 truncate font-medium">{{ p.name }}</span>
                                    <PnxStarChip :count="p.stars" size="sm" />
                                </NuxtLink>
                            </li>
                        </ol>
                        <PnxStateBlock v-else title="No stars yet" />
                    </section>

                    <section class="space-y-1">
                        <h2 class="text-xl">Recent</h2>
                        <ul v-if="data?.recent.length" class="divide-y">
                            <PnxFeedItem v-for="e in data.recent" :key="e.id" :event="e" />
                        </ul>
                        <p v-else class="py-4 text-sm text-muted-foreground">Nothing yet</p>
                    </section>
                </aside>
            </div>
        </template>
    </div>
</template>
