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
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined

function send() {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ play: playing }))
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
        onMounted(acquire)
        onBeforeUnmount(release)
    }
    return { counts: readonly(counts) }
}

/** Tell the hub this tab is playing `slug` while the calling component is mounted. */
export function reportPlaying(slug: MaybeRefOrGetter<string>) {
    if (!import.meta.client) return
    onMounted(() => {
        acquire()
        watch(() => toValue(slug), (s) => {
            playing = s
            send()
        }, { immediate: true })
    })
    onBeforeUnmount(() => {
        playing = null
        send()
        release()
    })
}
