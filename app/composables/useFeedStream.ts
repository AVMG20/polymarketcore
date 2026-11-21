import type { FeedEvent, FeedResponse } from '#shared/types/api'

/**
 * The activity feed as an endless list: the first 50 events come with the page
 * (SSR), `more()` loads the next 50 older than the last one (`?before=`).
 */
export function useFeedStream() {
    const { data, pending, error, refresh } = useAsyncData('pnx-feed-stream', () => apiFetch<FeedResponse>('/api/feed'))
    const older = ref<FeedEvent[]>([])
    const loadingMore = ref(false)
    const ended = ref(false)
    const moreError = ref(false)

    const events = computed(() => {
        const seen = new Set<string>()
        return [...(data.value?.events ?? []), ...older.value].filter(e => !seen.has(e.id) && seen.add(e.id))
    })

    // A short first page means there is nothing older (computed, so SSR and the client agree).
    const done = computed(() => ended.value || (!!data.value && data.value.events.length < 50))

    async function more() {
        if (loadingMore.value || done.value || events.value.length === 0) return
        loadingMore.value = true
        moreError.value = false
        try {
            const last = events.value[events.value.length - 1]!
            const res = await apiFetch<FeedResponse>('/api/feed', { query: { before: last.createdAt } })
            older.value.push(...res.events)
            if (res.events.length < 50) ended.value = true
        } catch {
            moreError.value = true
        } finally {
            loadingMore.value = false
        }
    }

    async function reload() {
        older.value = []
        ended.value = false
        await refresh()
    }

    return { events, pending, error, loadingMore, moreError, done, more, reload }
}
