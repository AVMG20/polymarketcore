<script setup lang="ts">
const { loggedIn } = useMe()
</script>

<template>
    <div class="min-h-dvh">
        <PnxAppHeader />
        <main
            class="mx-auto max-w-6xl px-4 pt-6 sm:pt-8 md:pb-12"
            :class="loggedIn ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'pb-10'"
        >
            <slot />
        </main>
        <PnxBottomNav />
    </div>
</template>
