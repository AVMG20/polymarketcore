/**
 * Live "playing now" counts over one shared WebSocket (/api/presence). Pages
 * that show counts call `usePresence()`; the /play page also calls
 * `reportPlaying(slug)`. The socket opens with the first user, closes when the
 * last one unmounts, and reconnects with backoff.
 */
const counts = ref<Record<string, number>>({})
let socket: WebSocket | null = null
let users = 0
let playing: string | null = null
/** The page is visible and focused (focus inside the game's iframe counts). */
let active = true
let activeTimer: ReturnType<typeof setInterval> | undefined
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined

function send() {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(playing ? { play: playing, active } : { play: null }))
}

function connect() {
    clearTimeout(retryTimer)
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/api/presence`)
    socket = ws
    ws.onopen = () => {
        retry = 0
        if (playing) send()
    }
    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(String(e.data)) as { counts?: Record<string, number> }
            if (data.counts) counts.value = data.counts
        } catch { /* ignore */ }
    }
    ws.onclose = () => {
        if (socket !== ws) return
        socket = null
        if (users > 0) retryTimer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
    }
}

function acquire() {
    if (users++ === 0 && !socket) connect()
}

function release() {
    if (--users > 0) return
    clearTimeout(retryTimer)
    const ws = socket
    socket = null
    ws?.close()
}

export function usePresence() {
    if (import.meta.client) {
        const { loggedIn } = useMe()
        let held = false
        const sync = (on: boolean) => {
            if (on && !held) {
                held = true
                acquire()
            } else if (!on && held) {
                held = false
                release()
            }
        }
        onMounted(() => sync(loggedIn.value))
        watch(loggedIn, (on) => {
            sync(on)
            if (!on) counts.value = {}
        })
        onBeforeUnmount(() => sync(false))
    }
    return { counts: readonly(counts) }
}

const isActive = () => document.visibilityState === 'visible' && document.hasFocus()

/** Report a change of `active`. Focus moving into the iframe blurs the window first: check after it settles. */
function checkActive() {
    setTimeout(() => {
        const now = isActive()
        if (now === active) return
        active = now
        send()
    }, 0)
}

const ACTIVE_EVENTS = ['focus', 'blur', 'visibilitychange'] as const

/**
 * Tell the hub this tab is playing `slug` while the calling component is
 * mounted, and whether the page is in use (visible and focused), for play time.
 */
export function reportPlaying(slug: MaybeRefOrGetter<string>) {
    if (!import.meta.client) return
    onMounted(() => {
        active = isActive()
        for (const e of ACTIVE_EVENTS) (e === 'visibilitychange' ? document : window).addEventListener(e, checkActive)
        // Focus leaving the browser from inside the iframe fires nothing here: poll as well.
        activeTimer = setInterval(checkActive, 5000)
        acquire()
        watch(() => toValue(slug), (s) => {
            playing = s
            send()
        }, { immediate: true })
    })
    onBeforeUnmount(() => {
        for (const e of ACTIVE_EVENTS) (e === 'visibilitychange' ? document : window).removeEventListener(e, checkActive)
        clearInterval(activeTimer)
        playing = null
        send()
        release()
    })
}
