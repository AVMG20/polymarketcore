/**
 * Edit the signed-in player's display name and avatar URL (better-auth
 * updateUser; the server validates both). The next launch token carries them.
 */
export function useProfile() {
    const { me, patch } = useMe()
    const name = ref(me.value?.name ?? '')
    const image = ref(me.value?.image ?? '')
    const pending = ref(false)
    const error = ref<string | null>(null)

    watch(me, (value) => {
        if (!value) return
        name.value = value.name
        image.value = value.image ?? ''
    })

    async function save() {
        pending.value = true
        error.value = null
        try {
            const res = await authClient.updateUser({ name: name.value.trim(), image: image.value.trim() || null })
            if (res.error) {
                error.value = res.error.message || 'Could not save'
                return false
            }
            patch({ name: name.value.trim(), image: image.value.trim() || null })
            return true
        } catch (e) {
            error.value = apiErrorMessage(e, 'Could not save')
            return false
        } finally {
            pending.value = false
        }
    }

    return { name, image, pending, error, save }
}
