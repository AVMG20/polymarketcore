import { createError, defineEventHandler, getQuery, sendRedirect } from 'h3'
import { getSessionUserId } from '#server/utils/auth'
import { getActiveApp, launchTokenFor } from '#server/utils/launch'
import { normalizeReturnUrl } from '#shared/return-url'

/**
 * Flow B (contract §1): `/connect?app=<appId>&return=<absolute url>`.
 * The return URL is checked before the login bounce, so the hub never sends a
 * player through its login page towards a URL it would refuse anyway.
 */
export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const appId = typeof query.app === 'string' ? query.app : ''
    if (!appId) throw createError({ statusCode: 400, statusMessage: 'Missing app' })

    const app = await getActiveApp(appId)
    const returnUrl = normalizeReturnUrl(query.return, app.returnUrlPrefixes)
    if (!returnUrl) throw createError({ statusCode: 400, statusMessage: 'Return URL is not registered for this app' })

    const userId = await getSessionUserId(event)
    if (!userId) {
        const back = `/connect?app=${encodeURIComponent(app.id)}&return=${encodeURIComponent(returnUrl)}`
        return sendRedirect(event, `/login?redirect=${encodeURIComponent(back)}`, 302)
    }

    const token = await launchTokenFor(userId, app.id)
    event.node.res.setHeader('Cache-Control', 'no-store')
    return sendRedirect(event, `${returnUrl}#pnx=${token}`, 302)
})
