<script setup lang="ts">
import { Button } from '@/components/ui/button'

/**
 * The daily claim: a pile of up to 10 days filling toward the cap. Claiming
 * sends the gems flying into the wallet chip in the header.
 */
const { claim, pending, canClaim, claimableGems, pile } = useClaim()
const { fly } = useGemFlight()
const button = ref<{ $el: Element } | null>(null)

const days = computed(() => pile.value?.days ?? 0)
const full = computed(() => !!pile.value && pile.value.gems >= pile.value.cap)

async function onClaim() {
    const from = button.value?.$el
    const amount = claimableGems.value
    const res = await claim()
    if (res) fly(from, Math.round(amount / 5))
}
</script>

<template>
    <div v-if="pile" class="space-y-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div class="mr-auto min-w-0">
                <p class="tabular text-2xl font-bold">
                    {{ pile.gems }}<span class="text-base font-medium text-muted-foreground"> / {{ pile.cap }} ready</span>
                </p>
                <p class="text-sm text-muted-foreground">
                    <template v-if="full">Pile is full. Claim to keep it filling.</template>
                    <template v-else-if="pile.gems === 0">Nothing yet, the next 10 arrive tomorrow.</template>
                    <template v-else>Full in {{ pile.fullInDays }} {{ pile.fullInDays === 1 ? 'day' : 'days' }}</template>
                </p>
            </div>
            <Button ref="button" variant="gem" size="lg" class="w-full sm:w-auto" :disabled="!canClaim" @click="onClaim">
                <PnxGemGlyph class="size-5" />
                <template v-if="claimableGems > 0">Claim {{ formatNumber(claimableGems) }}</template>
                <template v-else>All claimed</template>
            </Button>
            <span v-if="pending" class="sr-only" role="status">Claiming</span>
        </div>
        <div class="grid grid-cols-10 gap-1" role="img" :aria-label="`${pile.gems} of ${pile.cap} gems ready`">
            <span
                v-for="i in 10"
                :key="i"
                class="h-3 rounded-full transition-colors duration-500"
                :class="i <= days ? 'bg-gem shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.15)]' : 'bg-muted'"
            />
        </div>
    </div>
</template>
