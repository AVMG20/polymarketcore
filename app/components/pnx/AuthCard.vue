<script setup lang="ts">
defineProps<{
    title: string
}>()
</script>

<template>
    <div class="mx-auto flex min-h-[calc(100dvh-10.5rem)] w-full max-w-[400px] flex-col justify-center py-4 sm:py-8 md:min-h-[calc(100dvh-9rem)]">
        <div class="relative overflow-hidden rounded-3xl border border-border/90 bg-card shadow-[0_1px_2px_oklch(0_0_0/0.04),0_12px_32px_-12px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_0_oklch(1_0_0/0.04)_inset,0_20px_48px_-16px_oklch(0_0_0/0.45)]">
            <div
                class="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-75 dark:opacity-55"
                aria-hidden="true"
                style="background: radial-gradient(75% 100% at 50% 0%, color-mix(in oklch, var(--primary) 15%, transparent), transparent 72%)"
            />
            <div class="relative px-6 py-7 sm:px-8 sm:py-8">
                <div class="mb-6 flex flex-col items-center text-center">
                    <div class="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/80 bg-background/90 shadow-xs">
                        <PnxLogo class="size-7" />
                    </div>
                    <h1 class="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-[1.625rem]">
                        {{ title }}
                    </h1>
                    <div v-if="$slots.subtitle" class="mt-1.5 text-sm text-muted-foreground">
                        <slot name="subtitle" />
                    </div>
                </div>
                <slot />
            </div>
        </div>
        <div v-if="$slots.footer" class="mt-5 text-center text-sm text-muted-foreground">
            <slot name="footer" />
        </div>
    </div>
</template>
