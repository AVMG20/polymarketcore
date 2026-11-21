import type { MaybeRefOrGetter, Ref } from 'vue'

export interface BridgeStar {
    game: string
    /** The player's new level in that game (0-10). */
    stars: number
    at: number
}

/** A `relaunch` is honoured at most once per this many ms, so a broken app can't loop. */
export const RELAUNCH_COOLDOWN_MS = 30_000

/** A `star` message refetches the player at most once per this many ms. */
const STAR_REFRESH_MIN_MS = 3_000

/**
 * The postMessage bridge between the hub and a game iframe (contract §1).
 *
 * Accepts only `{ source: 'pnx', ... }` messages whose `event.origin` equals
 * `appOrigin` and that come from this iframe's window:
 * - `wallet { gems }` updates the gem count (`useMe().setGems`)
 * - `star { game, stars }` refetches the player and sets `lastStar` for the level moment
 * - `title { title }` sets `gameTitle` for the top bar
 * - `relaunch` (the app's session expired) calls `onRelaunch` (fetch a new token
 *   and reload the iframe), at most once per RELAUNCH_COOLDOWN_MS
 * Unknown types are ignored. Sends `{ source: 'pnx', type: 'hello', gems }` on iframe load.
 */
export function usePnxBridge(
    iframeRef: Ref<HTMLIFrameElement | null | undefined>,
    appOrigin: MaybeRefOrGetter<string | null | undefined>,
    options: { onStar?: (star: BridgeStar) => void, onRelaunch?: () => void | Promise<void> } = {}
) {
    const { me, setGems, refresh } = useMe()
    const gameTitle = ref<string | null>(null)
    const lastStar = ref<BridgeStar | null>(null)
    let lastRelaunch = 0
    let lastStarRefresh = 0

    function post(message: Record<string, unknown>) {
        const origin = toValue(appOrigin)
        const target = iframeRef.value?.contentWindow
        if (!origin || !target) return
        target.postMessage({ source: 'pnx', ...message }, origin)
    }

    function sendHello() {
        post({ type: 'hello', gems: me.value?.gems ?? 0 })
    }

    async function onMessage(event: MessageEvent) {
        const origin = toValue(appOrigin)
        if (!origin || event.origin !== origin) return
        const frame = iframeRef.value?.contentWindow
        if (!frame || event.source !== frame) return
        const data = event.data as Record<string, unknown> | null
        if (!data || typeof data !== 'object' || data.source !== 'pnx') return

        switch (data.type) {
            case 'wallet':
                if (typeof data.gems === 'number' && Number.isInteger(data.gems) && data.gems >= 0) setGems(data.gems)
                break
            case 'star':
                if (typeof data.game === 'string' && typeof data.stars === 'number' && Number.isInteger(data.stars)) {
                    const star = { game: data.game, stars: data.stars, at: Date.now() }
                    lastStar.value = star
                    // A game can post as often as it likes; refetch the player at most every few seconds.
                    if (Date.now() - lastStarRefresh >= STAR_REFRESH_MIN_MS) {
                        lastStarRefresh = Date.now()
                        await refresh().catch(() => null)
                    }
                    options.onStar?.(star)
                }
                break
            case 'title':
                if (typeof data.title === 'string') gameTitle.value = data.title.slice(0, 120)
                break
            case 'relaunch':
                if (Date.now() - lastRelaunch < RELAUNCH_COOLDOWN_MS) break
                lastRelaunch = Date.now()
                await options.onRelaunch?.()
                break
        }
    }

    onMounted(() => window.addEventListener('message', onMessage))
    onBeforeUnmount(() => window.removeEventListener('message', onMessage))

    return { gameTitle, lastStar, sendHello, post }
}
