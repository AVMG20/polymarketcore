import { toast } from 'vue-sonner'
import type { GemHistoryItem, GemHistoryKind, GemHistoryResponse, GemRange, GemStatsResponse } from '#shared/types/api'

/** `GET /api/gems/stats`: totals, per-day buckets and sources of a range. */
export const useGemStats = (range: MaybeRefOrGetter<GemRange>) =>
    useAsyncData(
        () => `pnx-gem-stats-${toValue(range)}`,
        () => apiFetch<GemStatsResponse>('/api/gems/stats', { query: { range: toValue(range) } })
    )

export interface GemLedgerFilter {
    range: GemRange
    dir: 'all' | 'in' | 'out'
    /** A source from the stats: a kind, plus the game for spends. */
    source: { kind: GemHistoryKind, game: string | null } | null
}

const LEDGER_PAGE = 25

/**
 * The gem ledger for a filter, newest first: the first page loads with the
 * page (SSR), `loadMore()` appends the rows after the last one shown.
 */
export function useGemLedger(filter: MaybeRefOrGetter<GemLedgerFilter>) {
    const query = computed(() => {
        const f = toValue(filter)
        return {
            range: f.range,
            dir: f.dir === 'all' ? undefined : f.dir,
            kind: f.source?.kind,
            game: f.source?.game ?? undefined,
            pageSize: LEDGER_PAGE
        }
    })
    const key = computed(() => `pnx-gem-ledger-${JSON.stringify(query.value)}`)
    const { data, pending, error, refresh } = useAsyncData(key, () => apiFetch<GemHistoryResponse>('/api/gems/history', { query: query.value }))

    const more = ref<GemHistoryItem[]>([])
    const loadingMore = ref(false)
    watch(key, () => { more.value = [] })

    const items = computed(() => [...(data.value?.items ?? []), ...more.value])
    const total = computed(() => data.value?.total ?? 0)
    const hasMore = computed(() => items.value.length < total.value)

    async function loadMore() {
        const last = items.value.at(-1)
        if (!last || loadingMore.value) return
        loadingMore.value = true
        const forKey = key.value
        try {
            const res = await apiFetch<GemHistoryResponse>('/api/gems/history', { query: { ...query.value, before: last.id } })
            if (forKey === key.value) more.value = [...more.value, ...res.items]
        } catch (e) {
            toast.error(apiErrorMessage(e, "Couldn't load more"))
        } finally {
            loadingMore.value = false
        }
    }

    return { items, total, hasMore, pending, error, refresh, loadMore, loadingMore }
}
