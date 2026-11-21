import type { Ref } from 'vue'
import { toast } from 'vue-sonner'
import type { GameOrderResponse, GamesResponse, GameSummary } from '#shared/types/api'

export type GameSort = 'mine' | 'featured' | 'newest' | 'stars' | 'popular'

const STORAGE_KEY = 'pnx-games-sort'
const SAVE_DELAY_MS = 600

function readStored(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

function store(sort: GameSort) {
    try {
        localStorage.setItem(STORAGE_KEY, sort)
    } catch {
        // private mode or blocked storage: the URL still carries the choice
    }
}

/** `games` in `order` first (by their place there), the rest after in their incoming (hub) order. */
export function applyOrder(games: GameSummary[], order: readonly string[]): GameSummary[] {
    const rank = new Map(order.map((slug, i) => [slug, i]))
    return games
        .map((game, i) => ({ game, i, r: rank.get(game.slug) ?? Number.POSITIVE_INFINITY }))
        .sort((a, b) => a.r - b.r || a.i - b.i)
        .map(x => x.game)
}

/** The games sorted by `sort`; ties keep the hub order (the incoming order). */
export function sortGames(games: GameSummary[], sort: GameSort, order: readonly string[]): GameSummary[] {
    if (sort === 'mine') return applyOrder(games, order)
    const by: Record<Exclude<GameSort, 'mine'>, ((a: GameSummary, b: GameSummary) => number) | null> = {
        featured: null,
        newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        stars: (a, b) => (b.me?.stars ?? 0) - (a.me?.stars ?? 0) || b.maxStars - a.maxStars,
        popular: (a, b) => b.players - a.players
    }
    const compare = by[sort]
    if (!compare) return games
    return games.map((game, i) => ({ game, i })).sort((a, b) => compare(a.game, b.game) || a.i - b.i).map(x => x.game)
}

/**
 * Sorting of the games list: the choice lives in `?sort=` and is remembered
 * per browser. Signed-in players also get "My order", which they set by
 * moving cards while `editing`; it saves (debounced) to `PUT /api/me/game-order`.
 */
export function useGameSort(data: Ref<GamesResponse | null | undefined>) {
    const route = useRoute()
    const router = useRouter()
    const { loggedIn } = useMe()

    const options = computed<GameSort[]>(() => (loggedIn.value ? ['mine', 'newest', 'stars', 'popular'] : ['featured', 'newest', 'popular']))
    const fallback = computed<GameSort>(() => (loggedIn.value ? 'mine' : 'featured'))
    const valid = (v: unknown): GameSort | null => (typeof v === 'string' && options.value.includes(v as GameSort) ? v as GameSort : null)

    const sort = computed<GameSort>({
        get: () => valid(route.query.sort) ?? fallback.value,
        set: (value) => {
            store(value)
            const query = { ...route.query, sort: value === fallback.value ? undefined : value }
            router.replace({ query })
        }
    })

    onMounted(() => {
        if (route.query.sort) return
        const stored = valid(readStored())
        if (stored && stored !== fallback.value) router.replace({ query: { ...route.query, sort: stored } })
    })

    // Unsaved moves live in `local` and win over the saved order until the save lands.
    const local = ref<string[] | null>(null)
    const editing = ref(false)
    const dirty = ref(false)
    const order = computed(() => local.value ?? data.value?.order ?? [])

    const games = computed(() => sortGames(data.value?.games ?? [], sort.value, order.value))

    let timer: ReturnType<typeof setTimeout> | undefined
    async function save() {
        clearTimeout(timer)
        if (!dirty.value) return
        dirty.value = false
        try {
            const res = await apiFetch<GameOrderResponse>('/api/me/game-order', { method: 'PUT', body: { order: order.value } })
            if (data.value) data.value = { ...data.value, order: res.order.length ? res.order : null }
            if (!dirty.value) local.value = null
        } catch (e) {
            toast.error(apiErrorMessage(e, "Couldn't save your order"))
        }
    }
    function queueSave() {
        dirty.value = true
        clearTimeout(timer)
        timer = setTimeout(save, SAVE_DELAY_MS)
    }

    /** Move `slug` to the place of `to` (array-move semantics), in the displayed order. */
    function move(slug: string, to: string) {
        const list = games.value.map(g => g.slug)
        const from = list.indexOf(slug)
        const at = list.indexOf(to)
        if (from < 0 || at < 0 || from === at) return
        list.splice(from, 1)
        list.splice(at, 0, slug)
        local.value = list
        queueSave()
    }

    function reset() {
        local.value = []
        dirty.value = true
        save()
    }

    function toggleEditing() {
        if (editing.value) save()
        editing.value = !editing.value
    }

    watch(sort, (value) => {
        if (value !== 'mine' && editing.value) toggleEditing()
    })
    onBeforeUnmount(save)

    return { sort, options, games, editing, toggleEditing, move, reset, hasOrder: computed(() => order.value.length > 0) }
}
