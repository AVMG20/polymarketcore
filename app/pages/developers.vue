<script setup lang="ts">
import { ArrowRight, Bot, Check, Copy, Gem, KeyRound, Play, Star, TriangleAlert, Gamepad2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DAILY_GEMS, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'

useHead({ title: 'Make a game · Polynux' })

const { markdown, pending, error, refresh, copied, copy } = useDeveloperGuide()
const { loggedIn } = useMe()

// The visual flow: token → app → manifest → players → gems & stars.
const flow = [
    { icon: KeyRound, title: 'Token', text: 'You create one.' },
    { icon: Bot, title: 'Your agent', text: 'Registers the app.' },
    { icon: Gamepad2, title: 'Games', text: 'Each with up to 10 levels.' },
    { icon: Play, title: 'Players', text: 'Open it from Polynux.' },
    { icon: Star, title: 'Gems & stars', text: 'They spend, you rank.' }
]
</script>

<template>
    <div class="mx-auto max-w-3xl space-y-10">
        <div class="space-y-2">
            <h1 class="text-3xl sm:text-4xl">Make a game for Polynux</h1>
            <p class="text-muted-foreground">Build it with your coding agent. It does the wiring, you play it.</p>
        </div>

        <ol class="grid grid-cols-1 gap-2 sm:grid-cols-5 sm:gap-0" aria-label="How it works">
            <li v-for="(step, i) in flow" :key="step.title" class="relative flex items-center gap-3 rounded-2xl border bg-card p-3 sm:flex-col sm:gap-2 sm:border-0 sm:bg-transparent sm:p-2 sm:text-center">
                <span class="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:size-14">
                    <component :is="step.icon" class="size-5 sm:size-6" aria-hidden="true" />
                    <span class="tabular absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{{ i + 1 }}</span>
                </span>
                <div class="min-w-0">
                    <p class="font-display font-bold leading-tight">{{ step.title }}</p>
                    <p class="text-xs text-muted-foreground">{{ step.text }}</p>
                </div>
                <ArrowRight v-if="i < flow.length - 1" class="absolute -right-2.5 top-[1.9rem] z-10 hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
            </li>
        </ol>

        <section class="space-y-4">
            <h2 class="text-xl">Two steps</h2>
            <div class="grid gap-3 sm:grid-cols-2">
                <div class="space-y-2 rounded-2xl border bg-card p-5">
                    <span class="flex size-8 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">1</span>
                    <p class="font-display text-lg font-bold">Get a token</p>
                    <p class="text-sm text-muted-foreground">It lets your agent register your app.</p>
                    <Button variant="outline" size="sm" as-child>
                        <NuxtLink :to="loggedIn ? '/settings/developer' : '/register'">{{ loggedIn ? 'Create a token' : 'Sign up first' }}</NuxtLink>
                    </Button>
                </div>
                <div class="space-y-2 rounded-2xl border bg-card p-5">
                    <span class="flex size-8 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">2</span>
                    <p class="font-display text-lg font-bold">Paste the brief</p>
                    <p class="text-sm text-muted-foreground">Into Claude Code or any agent, with your token and the game you want.</p>
                    <Button variant="chunky" size="sm" :disabled="!markdown" @click="copy">
                        <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy brief' }}
                    </Button>
                </div>
            </div>
        </section>

        <section class="space-y-3">
            <div class="flex items-center justify-between gap-3">
                <h2 class="text-xl">Copy for your AI agent</h2>
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
                Agents can fetch it themselves: <a href="/developers.md" class="font-medium text-primary">/developers.md</a> ·
                <a href="/api/v1/openapi.json" class="font-medium text-primary">OpenAPI</a> ·
                <a href="/developers/hello-game/server.ts" class="font-medium text-primary">reference game</a>
            </p>
        </section>

        <div class="grid gap-3 text-sm sm:grid-cols-2">
            <div class="rounded-2xl border p-4">
                <p class="flex items-center gap-2 font-display font-bold"><Star class="size-4 text-star" /> New games start unverified</p>
                <p class="mt-1 text-muted-foreground">
                    They're playable under "New", but their stars don't count yet, earn no bounties, and can take at most
                    {{ UNVERIFIED_DAILY_SPEND_CAP }} gems per player a day. Once we verify a game, earned bounties are paid out.
                </p>
            </div>
            <div class="rounded-2xl border p-4">
                <p class="flex items-center gap-2 font-display font-bold"><Gem class="size-4 text-gem" /> Pricing</p>
                <p class="mt-1 text-muted-foreground">Players earn {{ DAILY_GEMS }} gems a day. Small boost 3-5 gems, a real unlock 30-70, never more than ~200.</p>
            </div>
        </div>
    </div>
</template>
