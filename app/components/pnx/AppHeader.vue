<script setup lang="ts">
import { Code, Gem, LogOut, Moon, Settings, Shield, Sun, User, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const { me, isAdmin } = useMe()
const { signOut } = useAuthActions()
const colorMode = useColorMode()
const route = useRoute()
const isDark = computed(() => colorMode.value === 'dark')
const toggleTheme = () => {
    colorMode.preference = isDark.value ? 'light' : 'dark'
}

const links = [
    { to: '/games', label: 'Games' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/feed', label: 'Feed' }
]
const active = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
    <header class="sticky top-0 z-40 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div class="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
            <NuxtLink to="/" class="flex items-center gap-1.5 font-display text-xl font-extrabold tracking-tight">
                <PnxGemGlyph class="size-5 text-gem" />Polynux
            </NuxtLink>
            <nav class="ml-2 hidden items-center gap-1 text-sm md:flex" aria-label="Main">
                <Button
                    v-for="l in links"
                    :key="l.to"
                    :variant="active(l.to) ? 'secondary' : 'ghost'"
                    size="sm"
                    as-child
                >
                    <NuxtLink :to="l.to" :aria-current="active(l.to) ? 'page' : undefined">{{ l.label }}</NuxtLink>
                </Button>
            </nav>
            <div class="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
                <Button variant="ghost" size="icon" :class="me ? 'hidden md:inline-flex' : ''" aria-label="Toggle theme" @click="toggleTheme">
                    <ClientOnly>
                        <Sun v-if="isDark" class="size-4" />
                        <Moon v-else class="size-4" />
                        <template #fallback><Sun class="size-4" /></template>
                    </ClientOnly>
                </Button>
                <template v-if="me">
                    <NuxtLink to="/gems" data-pnx-wallet class="rounded-full" aria-label="Gem history"><PnxGemChip :amount="me.gems" /></NuxtLink>
                    <NuxtLink :to="`/players/${me.id}`" class="rounded-full" aria-label="Your profile"><PnxStarChip :count="me.stars" /></NuxtLink>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <button class="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Account">
                                <PnxPlayerAvatar :name="me.name" :image="me.image" :emblem="me.emblem" :prestige="me.prestige" class="size-8" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-56">
                            <DropdownMenuLabel>
                                <p class="flex min-w-0 items-center gap-1.5"><span class="truncate">{{ me.name }}</span><PnxPrestigeBadge :prestige="me.prestige" /></p>
                                <p class="text-xs font-normal text-muted-foreground">{{ me.title }}</p>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem as-child>
                                <NuxtLink :to="`/players/${me.id}`"><User class="size-4" /> Profile</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem as-child>
                                <NuxtLink to="/gems"><Gem class="size-4" /> Gem history</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem as-child>
                                <NuxtLink to="/settings"><Settings class="size-4" /> Settings</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem as-child>
                                <NuxtLink to="/settings/developer"><Code class="size-4" /> Developer</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem v-if="isAdmin" as-child>
                                <NuxtLink to="/admin/apps"><Shield class="size-4" /> Apps</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem v-if="isAdmin" as-child>
                                <NuxtLink to="/admin/players"><Users class="size-4" /> Players</NuxtLink>
                            </DropdownMenuItem>
                            <DropdownMenuItem class="md:hidden" @select="toggleTheme">
                                <Sun v-if="isDark" class="size-4" /><Moon v-else class="size-4" /> {{ isDark ? 'Light mode' : 'Dark mode' }}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem @select="signOut">
                                <LogOut class="size-4" /> Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </template>
                <template v-else>
                    <Button variant="ghost" size="sm" as-child><NuxtLink to="/login">Sign in</NuxtLink></Button>
                    <Button variant="chunky" size="sm" as-child><NuxtLink to="/register">Play free</NuxtLink></Button>
                </template>
            </div>
        </div>
    </header>
</template>
