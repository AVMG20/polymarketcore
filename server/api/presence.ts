import { auth } from '#server/utils/auth'
import { presenceClose, presenceMessage, presenceOpen } from '#server/utils/presence'

/**
 * Live player counts: /api/presence (WebSocket). Everyone receives
 * `{ counts: { [slug]: players } }`; a signed-in /play page also reports the
 * game it shows.
 */
export default defineWebSocketHandler({
    async upgrade(request) {
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null)
        ;(request as unknown as { context: Record<string, unknown> }).context.userId = session?.user?.id ?? null
    },

    open(peer) {
        presenceOpen(peer, (peer.context as { userId?: string | null }).userId ?? null)
    },

    message(peer, message) {
        presenceMessage(peer, message.text())
    },

    close(peer) {
        presenceClose(peer)
    },

    error(peer) {
        presenceClose(peer)
    }
})
