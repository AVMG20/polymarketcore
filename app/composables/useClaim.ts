import { toast } from 'vue-sonner'
import type { ClaimResponse } from '#shared/types/api'
import { CLAIM_CAP_GEMS, CLAIM_MAX_DAYS } from '#shared/economy'

/**
 * The daily gem claim. `claim()` pays every claimable day and updates `useMe`
 * from the response; `lastClaimed` is what the last claim paid, for the
 * "gems fly into the wallet" moment.
 */
export function useClaim() {
    const { me, setGems, patch } = useMe()
    const pending = ref(false)
    const lastClaimed = ref(0)

    const claimableGems = computed(() => me.value?.claimable.gems ?? 0)
    /** The pile filling toward the cap: `{ gems, cap, fullInDays }` for "x / 100 ready, full in N days". */
    const pile = computed(() => me.value?.claimable ?? null)
    const canClaim = computed(() => claimableGems.value > 0 && !pending.value)

    async function claim(): Promise<ClaimResponse | null> {
        if (pending.value) return null
        pending.value = true
        try {
            const res = await apiFetch<ClaimResponse>('/api/gems/claim', { method: 'POST' })
            setGems(res.gems)
            const cap = me.value?.claimable.cap ?? CLAIM_CAP_GEMS
            patch({ claimable: { days: 0, gems: 0, cap, fullInDays: CLAIM_MAX_DAYS } })
            lastClaimed.value = res.claimed
            return res
        } catch (e) {
            toast.error(apiErrorMessage(e, 'Could not claim your gems'))
            return null
        } finally {
            pending.value = false
        }
    }

    return { claim, pending, canClaim, claimableGems, pile, lastClaimed }
}
