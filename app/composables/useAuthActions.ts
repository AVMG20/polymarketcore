/**
 * Sign in, sign up and sign out. After a successful sign-in the player is
 * loaded into `useMe` and sent to `redirect` (an in-app path; `/connect`
 * is a server route, so it gets a full navigation).
 */
export function useAuthActions() {
    const { refresh, clear } = useMe()
    const route = useRoute()
    const pending = ref(false)
    const error = ref<string | null>(null)

    const redirectTarget = computed(() => safeRedirect(route.query.redirect))

    async function continueAfterAuth() {
        await refresh()
        const target = redirectTarget.value
        const external = target.startsWith('/connect') || target.startsWith('/api/')
        await navigateTo(target, { external, replace: true })
    }

    async function run(action: () => Promise<{ error?: { message?: string } | null }>, fallback: string) {
        pending.value = true
        error.value = null
        try {
            const res = await action()
            if (res.error) {
                error.value = res.error.message || fallback
                return false
            }
            await continueAfterAuth()
            return true
        } catch (e) {
            error.value = apiErrorMessage(e, fallback)
            return false
        } finally {
            pending.value = false
        }
    }

    const signIn = (email: string, password: string) =>
        run(() => authClient.signIn.email({ email, password }), 'Could not sign in')

    const signUp = (name: string, email: string, password: string) =>
        run(() => authClient.signUp.email({ name, email, password }), 'Could not create your account')

    async function signInWithDiscord() {
        const callbackURL = redirectTarget.value
        await authClient.signIn.social({ provider: 'discord', callbackURL })
    }

    async function signOut() {
        await authClient.signOut()
        clear()
        await navigateTo('/login')
    }

    return { signIn, signUp, signInWithDiscord, signOut, pending, error, redirectTarget }
}

/** Public hub settings (`GET /api/config`). */
export const useHubConfig = () =>
    useAsyncData('pnx-config', () => apiFetch<{ discord: boolean }>('/api/config'), {
        getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    })
