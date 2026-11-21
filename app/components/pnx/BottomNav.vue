<script setup lang="ts">
import { Gamepad2, Home, Newspaper, Trophy } from 'lucide-vue-next'

/** Phone navigation: thumb-reachable tabs, hidden from md up (the header has the links there). */
const route = useRoute()
const tabs = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/games', label: 'Games', icon: Gamepad2 },
    { to: '/leaderboard', label: 'Ranks', icon: Trophy },
    { to: '/feed', label: 'Feed', icon: Newspaper }
]
const active = (to: string) => (to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`))
</script>

<template>
    <nav class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        <ul class="mx-auto grid max-w-md grid-cols-4">
            <li v-for="t in tabs" :key="t.to">
                <NuxtLink
                    :to="t.to"
                    class="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none transition-colors focus-visible:bg-accent"
                    :class="active(t.to) ? 'text-primary' : 'text-muted-foreground'"
                    :aria-current="active(t.to) ? 'page' : undefined"
                >
                    <component :is="t.icon" class="size-5" aria-hidden="true" />
                    {{ t.label }}
                </NuxtLink>
            </li>
        </ul>
    </nav>
</template>
