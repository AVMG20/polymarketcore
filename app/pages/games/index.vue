<script setup lang="ts">
useHead({ title: 'Games · Polynux' })

const { data, pending, error, refresh } = useGames()
const games = computed(() => data.value?.games ?? [])
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-3xl">Games</h1>
            <p class="text-sm text-muted-foreground">Every game has its own star levels. Stars add up on the leaderboard.</p>
        </div>
        <PnxGamesGrid :games="games" :pending="pending" :error="!!error" @retry="refresh()" />
    </div>
</template>
