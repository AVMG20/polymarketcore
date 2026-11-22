<script setup lang="ts">
import { Check, Copy, Gem, KeyRound, Star, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DAILY_GEMS, MAX_STARS_PER_GAME, STARTER_GEMS, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'

useHead({ title: 'Make a game · Polynux' })

const { markdown, pending, error, refresh, copied, copy } = useDeveloperGuide()
const { loggedIn } = useMe()
</script>

<template>
    <div class="space-y-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl sm:text-4xl">Make a game</h1>
            <Button variant="outline" as-child>
                <NuxtLink :to="loggedIn ? '/settings/developer' : '/register'"><KeyRound /> {{ loggedIn ? 'Get a token' : 'Sign up' }}</NuxtLink>
            </Button>
        </div>

        <section class="space-y-3">
            <h2 class="text-xl">How it works</h2>
            <ol class="list-inside list-decimal space-y-1.5 text-muted-foreground marker:font-bold marker:text-primary">
                <li><NuxtLink :to="loggedIn ? '/settings/developer' : '/register'" class="font-medium text-primary">Create a developer token</NuxtLink> in your settings.</li>
                <li>Give the token and the agent brief below to a coding agent (Claude Code, Codex, …).</li>
                <li>The agent builds and hosts your game and registers it here. You can play it right away from Games.</li>
            </ol>
        </section>

        <div class="grid gap-4 sm:grid-cols-2">
            <section class="space-y-2 rounded-2xl border bg-card p-4">
                <h2 class="flex items-center gap-2 text-xl"><Star class="size-5 text-star" aria-hidden="true" /> Stars</h2>
                <p class="text-sm text-muted-foreground">
                    Optional. A game can have 1 to {{ MAX_STARS_PER_GAME }} star levels, one per milestone, or none at all.
                    Stars count toward the leaderboard and titles, and a player's first time reaching level n pays n gems.
                </p>
            </section>
            <section class="space-y-2 rounded-2xl border bg-card p-4">
                <h2 class="flex items-center gap-2 text-xl"><Gem class="size-5 text-gem" aria-hidden="true" /> Gems</h2>
                <p class="text-sm text-muted-foreground">
                    Your game can charge gems for things like boosts or cosmetics, but must stay playable without them.
                    Players only get gems here: {{ STARTER_GEMS }} to start, {{ DAILY_GEMS }} a day and star rewards. Keep prices small.
                </p>
            </section>
        </div>

        <section class="space-y-3">
            <div class="flex items-center justify-between gap-3">
                <h2 class="text-xl">Agent brief</h2>
                <Button variant="chunky" size="sm" :disabled="!markdown" @click="copy">
                    <Check v-if="copied" /><Copy v-else />
                    {{ copied ? 'Copied' : 'Copy' }}
                </Button>
            </div>
            <div class="overflow-hidden rounded-2xl border bg-muted/40">
                <div class="flex items-center gap-2 border-b bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                    <span class="size-2.5 rounded-full bg-destructive/60" /><span class="size-2.5 rounded-full bg-star" /><span class="size-2.5 rounded-full bg-success" />
                    <span class="ml-2 font-mono">developers.md</span>
                </div>
                <div v-if="pending && !markdown" class="space-y-2 p-4" aria-hidden="true">
                    <Skeleton v-for="i in 6" :key="i" class="h-3" :style="{ width: `${95 - i * 8}%` }" />
                </div>
                <div v-else-if="error" class="flex flex-col items-center gap-3 p-8 text-center">
                    <TriangleAlert class="size-6 text-destructive" />
                    <p class="text-sm text-muted-foreground">Couldn't load the brief.</p>
                    <Button size="sm" variant="outline" @click="refresh()">Try again</Button>
                </div>
                <pre v-else class="max-h-96 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed" tabindex="0">{{ markdown }}</pre>
            </div>
            <p class="text-xs text-muted-foreground">
                <a href="/developers.md" class="font-medium text-primary">/developers.md</a> ·
                <a href="/api/v1/openapi.json" class="font-medium text-primary">OpenAPI</a> ·
                <a href="/developers/hello-game/server.ts" class="font-medium text-primary">reference game</a>
            </p>
        </section>

        <p class="flex items-start gap-2 text-sm text-muted-foreground">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            New games start unverified: only you can see them, their stars don't count and players can spend at most {{ UNVERIFIED_DAILY_SPEND_CAP }} gems a day in them. An admin verifies them.
        </p>
    </div>
</template>
