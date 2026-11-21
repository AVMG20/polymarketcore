/**
 * Password change and the linked Discord account (better-auth). `hasPassword`
 * is false for players who only ever signed in with Discord.
 */
export function useAccountSecurity() {
    const accounts = ref<{ providerId: string }[]>([])
    const loaded = ref(false)
    const pending = ref(false)
    const error = ref<string | null>(null)
    const saved = ref(false)
    const linkError = ref<string | null>(null)

    const hasPassword = computed(() => accounts.value.some(a => a.providerId === 'credential'))
    const discordLinked = computed(() => accounts.value.some(a => a.providerId === 'discord'))

    async function load() {
        try {
            const res = await authClient.listAccounts()
            accounts.value = (res.data as { providerId: string }[] | null) ?? []
        } catch {
            accounts.value = []
        }
        loaded.value = true
    }
    onMounted(load)

    async function changePassword(currentPassword: string, newPassword: string) {
        pending.value = true
        error.value = null
        saved.value = false
        try {
            const res = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
            if (res.error) {
                error.value = res.error.message || 'Could not change the password'
                return false
            }
            saved.value = true
            setTimeout(() => (saved.value = false), 2500)
            return true
        } catch (e) {
            error.value = apiErrorMessage(e, 'Could not change the password')
            return false
        } finally {
            pending.value = false
        }
    }

    async function linkDiscord() {
        linkError.value = null
        try {
            const res = await authClient.linkSocial({ provider: 'discord', callbackURL: '/settings' })
            if (res.error) linkError.value = res.error.message || 'Could not link Discord'
        } catch (e) {
            linkError.value = apiErrorMessage(e, 'Could not link Discord')
        }
    }

    return { loaded, pending, error, linkError, saved, hasPassword, discordLinked, changePassword, linkDiscord }
}
