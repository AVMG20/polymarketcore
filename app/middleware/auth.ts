// Signed-in players only; others go to /login and come back afterwards.
export default defineNuxtRouteMiddleware((to) => {
    const { loggedIn } = useMe()
    if (!loggedIn.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
})
