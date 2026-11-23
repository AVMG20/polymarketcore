import type {
    FeedResponse,
    GameDetailResponse,
    GamesResponse,
    LeaderboardResponse,
    PlayerProfileResponse,
    ShowcaseResponse
} from '#shared/types/api'

/*
 * Thin `useAsyncData` wrappers over the hub API, one per read endpoint, so
 * pages stay declarative and share cache keys. Each returns the usual
 * `{ data, pending, error, refresh }`.
 */

export const useShowcaseGames = () =>
    useAsyncData('pnx-showcase', () => apiFetch<ShowcaseResponse>('/api/showcase'))

export const useGames = () =>
    useAsyncData('pnx-games', () => apiFetch<GamesResponse>('/api/games'))

export const useGame = (slug: MaybeRefOrGetter<string>) =>
    useAsyncData(() => `pnx-game-${toValue(slug)}`, () => apiFetch<GameDetailResponse>(`/api/games/${encodeURIComponent(toValue(slug))}`))

export const useLeaderboard = (limit: MaybeRefOrGetter<number> = 100, offset: MaybeRefOrGetter<number> = 0) =>
    useAsyncData(
        () => `pnx-leaderboard-${toValue(limit)}-${toValue(offset)}`,
        () => apiFetch<LeaderboardResponse>('/api/leaderboard', { query: { limit: toValue(limit), offset: toValue(offset) } })
    )

export const usePlayerProfile = (id: MaybeRefOrGetter<string>) =>
    useAsyncData(() => `pnx-player-${toValue(id)}`, () => apiFetch<PlayerProfileResponse>(`/api/players/${encodeURIComponent(toValue(id))}`))

export const useFeed = () =>
    useAsyncData('pnx-feed', () => apiFetch<FeedResponse>('/api/feed'))
