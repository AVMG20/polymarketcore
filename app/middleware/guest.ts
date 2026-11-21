// Signed-out visitors only (login, register).
export default defineNuxtRouteMiddleware((to) => {
    const { loggedIn } = useMe()
    if (loggedIn.value) return navigateTo(safeRedirect(to.query.redirect), { external: String(to.query.redirect ?? '').startsWith('/connect') })
})
