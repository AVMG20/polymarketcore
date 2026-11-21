// Admins only (role admin or ADMIN_EMAILS).
export default defineNuxtRouteMiddleware((to) => {
    const { loggedIn, isAdmin } = useMe()
    if (!loggedIn.value) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    if (!isAdmin.value) return navigateTo('/')
})
