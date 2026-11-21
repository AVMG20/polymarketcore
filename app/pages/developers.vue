<script setup lang="ts">
import { ArrowRight, Bot, Check, Copy, Gamepad2, Gem, KeyRound, Play, Star, TriangleAlert } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DAILY_GEMS, UNVERIFIED_DAILY_SPEND_CAP } from '#shared/economy'

useHead({ title: 'Make a game · Polynux' })

const { markdown, pending, error, refresh, copied, copy } = useDeveloperGuide()
const { loggedIn } = useMe()

// The visual flow: token → app → manifest → players → gems & stars.
const flow = [
    { icon: KeyRound, title: 'Token', text: 'You' },
    { icon: Bot, title: 'Agent', text: 'Registers' },
    { icon: Gamepad2, title: 'Games', text: '10 levels' },
    { icon: Play, title: 'Players', text: 'Launch' },
    { icon: Star, title: 'Gems', text: 'Spend, rank' }
]
</script>

<template>
    <div class="space-y-10">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl sm:text-4xl">Make a game</h1>
            <Button variant="outline" as-child>
                <NuxtLink :to="loggedIn ? '/settings/developer' : '/register'"><KeyRound /> {{ loggedIn ? 'Get a token' : 'Sign up' }}</NuxtLink>
            </Button>
        </div>

        <ol class="grid grid-cols-5" aria-label="How it works">
            <li v-for="(step, i) in flow" :key="step.title" class="relative flex flex-col items-center gap-2 p-1 text-center sm:p-2">
                <span class="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary sm:size-14">
                    <component :is="step.icon" class="size-5 sm:size-6" aria-hidden="true" />
                    <span class="tabular absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{{ i + 1 }}</span>
                </span>
                <div class="min-w-0">
                    <p class="text-xs font-bold leading-tight sm:font-display sm:text-base">{{ step.title }}</p>
                    <p class="hidden text-xs text-muted-foreground sm:block">{{ step.text }}</p>
                </div>
                <ArrowRight v-if="i < flow.length - 1" class="absolute -right-2 top-5 z-10 hidden size-4 text-muted-foreground sm:top-7 sm:block" aria-hidden="true" />
            </li>
        </ol>

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

        <div class="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span class="flex items-center gap-2 rounded-full border px-3 py-1.5" :title="`Unverified games: stars don't count, no bounties, ${UNVERIFIED_DAILY_SPEND_CAP} gems per player a day`">
                <Star class="size-4 text-star" aria-hidden="true" /> New games start unverified
            </span>
            <span class="flex items-center gap-2 rounded-full border px-3 py-1.5" :title="`Players earn ${DAILY_GEMS} gems a day. Keep prices small.`">
                <Gem class="size-4 text-gem" aria-hidden="true" /> Players earn {{ DAILY_GEMS }} a day
            </span>
        </div>
    </div>
</template>
