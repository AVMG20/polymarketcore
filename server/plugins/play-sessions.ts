import { defineNitroPlugin } from 'nitropack/runtime'
import { presenceSave } from '#server/utils/presence'

/** Save open play sessions when the server shuts down (a deploy), so their last minute isn't lost. */
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('close', presenceSave)
})
