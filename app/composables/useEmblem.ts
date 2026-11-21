import { toast } from 'vue-sonner'
import { emptyEmblem, parseEmblem, type EmblemData } from '#shared/emblem'
import type { EmblemHistoryEntry, EmblemHistoryResponse, SaveEmblemResponse } from '#shared/types/api'

/**
 * The emblem editor's state: what the canvas shows (`draft`, else the saved
 * emblem), the saved history (`PUT /api/me/emblem`, `GET /api/me/emblem/history`)
 * and an unsaved draft kept in this browser so a reload doesn't lose it.
 */
export function useEmblem() {
    const { me, patch } = useMe()
    const { data, pending: historyPending, refresh: refreshHistory } = useAsyncData(
        'pnx-emblem-history',
        () => apiFetch<EmblemHistoryResponse>('/api/me/emblem/history')
    )
    const history = computed(() => data.value?.entries ?? [])

    const draft = ref<string | null>(null)
    const restoredDraft = ref(false)
    const busy = ref(false)
    /** What the editor starts from: the draft, the saved emblem, or a blank canvas. */
    const current = computed(() => draft.value ?? me.value?.emblem ?? JSON.stringify(emptyEmblem()))
    const dirty = computed(() => draft.value !== null && draft.value !== me.value?.emblem)

    const draftKey = () => (me.value ? `pnx-emblem-draft:${me.value.id}` : null)
    function storeDraft(value: string | null) {
        const key = draftKey()
        if (!key) return
        try {
            if (value) localStorage.setItem(key, value)
            else localStorage.removeItem(key)
        } catch {
            // storage blocked: the draft just doesn't survive a reload
        }
    }

    onMounted(() => {
        const key = draftKey()
        if (!key) return
        let stored: string | null = null
        try {
            stored = localStorage.getItem(key)
        } catch {
            return
        }
        if (!stored) return
        if (stored === me.value?.emblem || !parseEmblem(stored)) {
            storeDraft(null)
            return
        }
        draft.value = stored
        restoredDraft.value = true
    })

    function change(value: EmblemData) {
        draft.value = JSON.stringify(value)
        storeDraft(draft.value)
    }

    function reset() {
        draft.value = null
        restoredDraft.value = false
        storeDraft(null)
    }

    function load(entry: EmblemHistoryEntry) {
        draft.value = entry.emblem
        restoredDraft.value = false
        storeDraft(entry.emblem)
    }

    async function put(emblem: EmblemData | null, fallback: string) {
        busy.value = true
        try {
            const res = await apiFetch<SaveEmblemResponse>('/api/me/emblem', { method: 'PUT', body: { emblem } })
            patch({ emblem: res.emblem })
            reset()
            if (res.emblem) await refreshHistory()
            return true
        } catch (e) {
            toast.error(apiErrorMessage(e, fallback))
            return false
        } finally {
            busy.value = false
        }
    }

    /** Save the canvas as the player's emblem. */
    const save = (emblem: EmblemData) => put(emblem, 'Could not save the emblem')
    /** Drop the emblem: the avatar goes back to the image or initial. History stays. */
    const remove = () => put(null, 'Could not remove the emblem')

    return { me, current, dirty, restoredDraft, history, historyPending, busy, change, reset, load, save, remove }
}
