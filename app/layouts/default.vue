<template>
    <div class="min-h-dvh">
        <PnxAppHeader />
        <main class="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 sm:pt-8 md:pb-12">
            <slot />
        </main>
        <PnxBottomNav />
    </div>
</template>
