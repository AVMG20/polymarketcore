<script setup lang="ts">
import { Code, FileText, Gem, Rss, Search, Settings, Shield, Trophy, User, Users, Gamepad2, Palette } from 'lucide-vue-next'
import type { Component } from 'vue'
import { DialogDescription, DialogTitle } from 'reka-ui'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { GameSummary, GamesResponse, SearchPlayer, SearchResponse } from '#shared/types/api'

/** Nav bar search (⌘K / Ctrl+K): games, players and pages in one list. */
const open = ref(false)
const q = ref('')
const active = ref(0)
const { me, isAdmin, loggedIn } = useMe()
// Reuse the games list when a page already loaded it; fetch it on first open otherwise.
const { data: cachedGames } = useNuxtData<GamesResponse>('pnx-games')
const fetchedGames = ref<GamesResponse | null>(null)
const gamesData = computed(() => cachedGames.value ?? fetchedGames.value)
const players = ref<SearchPlayer[]>([])
const isMac = useState('pnx-is-mac', () => {
    const ua = import.meta.server
        ? (useRequestHeaders(['user-agent'])['user-agent'] ?? '')
        : (navigator.platform || navigator.userAgent)
    return /Mac|iPhone|iPad/i.test(ua)
})

interface Item {
    key: string
    to: string
    label: string
    hint?: string
    kind: 'game' | 'player' | 'page'
    icon?: Component
    game?: GameSummary
    player?: SearchPlayer
}

const pages = computed(() => {
    const list: { to: string, label: string, icon: Component }[] = [
        { to: '/games', label: 'Games', icon: Gamepad2 },
        { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        { to: '/feed', label: 'Feed', icon: Rss },
        { to: '/developers', label: 'Make a game', icon: FileText }
    ]
    if (me.value) {
        list.push(
            { to: `/players/${me.value.id}`, label: 'Profile', icon: User },
            { to: '/gems', label: 'Gem history', icon: Gem },
            { to: '/settings', label: 'Settings', icon: Settings },
            { to: '/settings/emblem', label: 'Emblem', icon: Palette },
            { to: '/settings/developer', label: 'Developer', icon: Code }
        )
    }
    if (isAdmin.value) {
        list.push({ to: '/admin/apps', label: 'Admin apps', icon: Shield }, { to: '/admin/players', label: 'Admin players', icon: Users })
    }
    return list
})

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
const matches = (text: string, term: string) => norm(text).includes(term)

/**
 * 3: the name has every word, 2: name or tagline, 1: anywhere else (description,
 * app, maker, star names), so "panda heist" finds the casino. 0: no match.
 */
function gameRank(g: GameSummary, terms: string[]): number {
    if (!terms.length) return 1
    const all = (text: string) => terms.every(t => text.includes(t))
    const name = norm(g.name)
    if (all(name)) return 3
    if (all(`${name} ${norm(g.tagline ?? '')}`)) return 2
    const rest = [g.name, g.tagline, g.description, g.app.name, g.app.owner?.name, ...g.stars.map(s => s.name)]
    return all(norm(rest.filter(Boolean).join(' '))) ? 1 : 0
}

const groups = computed(() => {
    const term = norm(q.value.trim())
    const terms = term.split(/\s+/).filter(Boolean)
    const games = (gamesData.value?.games ?? [])
        .map(g => ({ g, rank: gameRank(g, terms) }))
        .filter(x => x.rank > 0)
        .sort((a, b) => b.rank - a.rank)
        .map(x => x.g)
        .slice(0, term ? 6 : 4)
        .map<Item>(g => ({ key: `g:${g.slug}`, to: loggedIn.value ? `/play/${g.slug}` : `/games/${g.slug}`, label: g.name, hint: g.tagline ?? undefined, kind: 'game', game: g }))
    const people = term ? players.value.map<Item>(p => ({ key: `p:${p.id}`, to: `/players/${p.id}`, label: p.name, kind: 'player', player: p })) : []
    const pageItems = pages.value
        .filter(p => !term || matches(p.label, term))
        .map<Item>(p => ({ key: `n:${p.to}`, to: p.to, label: p.label, kind: 'page', icon: p.icon }))
    return [
        { label: 'Games', items: games },
        { label: 'Players', items: people },
        { label: 'Pages', items: pageItems }
    ].filter(g => g.items.length)
})
const flat = computed(() => groups.value.flatMap(g => g.items))

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(q, (value) => {
    active.value = 0
    clearTimeout(timer)
    const term = value.trim()
    if (!term) {
        players.value = []
        return
    }
    timer = setTimeout(async () => {
        const mine = ++seq
        try {
            const res = await apiFetch<SearchResponse>('/api/search', { query: { q: term } })
            if (mine === seq) players.value = res.players
        } catch {
            if (mine === seq) players.value = []
        }
    }, 150)
})

watch(open, (value) => {
    if (value) {
        if (!gamesData.value) apiFetch<GamesResponse>('/api/games').then(r => (fetchedGames.value = r)).catch(() => null)
        return
    }
    q.value = ''
    players.value = []
})

function go(item: Item | undefined) {
    if (!item) return
    open.value = false
    navigateTo(item.to)
}

function onKey(e: KeyboardEvent) {
    const n = flat.value.length
    if (e.key === 'ArrowDown' && n) {
        e.preventDefault()
        active.value = (active.value + 1) % n
    } else if (e.key === 'ArrowUp' && n) {
        e.preventDefault()
        active.value = (active.value - 1 + n) % n
    } else if (e.key === 'Enter') {
        e.preventDefault()
        go(flat.value[active.value])
    }
}

watch(active, async (i) => {
    await nextTick()
    document.querySelector(`[data-search-index="${i}"]`)?.scrollIntoView({ block: 'nearest' })
})

function onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open.value = !open.value
    }
}
onMounted(() => {
    window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))

const indexOf = (item: Item) => flat.value.indexOf(item)
</script>

<template>
    <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-lg:w-9 max-lg:justify-center lg:w-52 lg:border lg:bg-muted/40 lg:px-3"
        aria-label="Search"
        @click="open = true"
    >
        <Search class="size-4 shrink-0" />
        <span class="hidden flex-1 text-left lg:inline">Search</span>
        <kbd class="pointer-events-none hidden shrink-0 whitespace-nowrap rounded border bg-background px-1.5 font-mono text-[0.7rem] lg:inline">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </button>

    <Dialog v-model:open="open">
        <DialogContent :show-close-button="false" class="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
            <DialogTitle class="sr-only">Search</DialogTitle>
            <DialogDescription class="sr-only">Find games, players and pages</DialogDescription>
            <div class="flex items-center gap-2 border-b px-4">
                <Search class="size-4 shrink-0 text-muted-foreground" />
                <input
                    v-model="q"
                    type="search"
                    placeholder="Games, players, pages"
                    class="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                    autocomplete="off"
                    spellcheck="false"
                    aria-label="Search"
                    @keydown="onKey"
                >
                <kbd class="hidden shrink-0 whitespace-nowrap rounded border px-1.5 font-mono text-[0.7rem] text-muted-foreground sm:inline">Esc</kbd>
            </div>
            <div class="max-h-[min(60vh,28rem)] overflow-y-auto p-2" role="listbox" aria-label="Results">
                <p v-if="!flat.length" class="py-10 text-center text-sm text-muted-foreground">No results</p>
                <section v-for="group in groups" :key="group.label" class="mb-1 last:mb-0">
                    <h3 class="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">{{ group.label }}</h3>
                    <button
                        v-for="item in group.items"
                        :key="item.key"
                        type="button"
                        role="option"
                        :aria-selected="indexOf(item) === active"
                        :data-search-index="indexOf(item)"
                        class="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm"
                        :class="indexOf(item) === active ? 'bg-accent text-accent-foreground' : ''"
                        @mousemove="active = indexOf(item)"
                        @click="go(item)"
                    >
                        <PnxGameIcon v-if="item.game" :icon="item.game.icon" :accent="gameAccent(item.game)" :name="item.game.name" size="sm" class="!size-8 !rounded-lg" />
                        <PnxPlayerAvatar v-else-if="item.player" :name="item.player.name" :image="item.player.image" :emblem="item.player.emblem" :prestige="item.player.prestige" class="size-8" />
                        <span v-else class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><component :is="item.icon" class="size-4" /></span>
                        <span class="min-w-0 flex-1">
                            <span class="block truncate font-medium">{{ item.label }}</span>
                            <span v-if="item.hint" class="block truncate text-xs text-muted-foreground">{{ item.hint }}</span>
                        </span>
                        <span v-if="item.player" class="tabular shrink-0 text-xs text-muted-foreground">#{{ item.player.rank }} · ★{{ item.player.stars }}</span>
                    </button>
                </section>
            </div>
        </DialogContent>
    </Dialog>
</template>
