import { auth } from '#server/utils/auth'
import { presenceClose, presenceMessage, presenceOpen } from '#server/utils/presence'

/**
 * Live player counts: /api/presence (WebSocket). Signed-in players receive
 * `{ counts: { [slug]: players } }`; a /play page also reports the game it shows.
 */
export default defineWebSocketHandler({
    async upgrade(request) {
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
        ;(request as unknown as { context: Record<string, unknown> }).context.userId = session?.user?.id ?? null
    },

    open(peer) {
        const userId = (peer.context as { userId?: string | null }).userId ?? null
        if (!userId) {
            peer.close(4401, 'Unauthorized')
            return
        }
        presenceOpen(peer, userId)
    },

    message(peer, message) {
        if (!(peer.context as { userId?: string | null }).userId) return
        presenceMessage(peer, message.text())
    },

    close(peer) {
        presenceClose(peer)
    },

    error(peer) {
        presenceClose(peer)
    }
})
