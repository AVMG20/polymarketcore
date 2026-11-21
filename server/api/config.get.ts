import { defineEventHandler } from 'h3'
import { discordEnabled } from '#server/utils/auth'

/** Public hub settings the login pages need. */
export default defineEventHandler(() => ({ discord: discordEnabled }))
