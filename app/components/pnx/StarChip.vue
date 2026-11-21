<script setup lang="ts">
const props = withDefaults(defineProps<{ count: number, size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const box = computed(() => ({
    sm: 'gap-1 px-2 py-0.5 text-xs',
    md: 'gap-1.5 px-2.5 py-1 text-sm',
    lg: 'gap-2 px-4 py-1.5 text-2xl'
})[props.size])
const glyph = computed(() => ({ sm: 'size-3.5', md: 'size-4', lg: 'size-6' })[props.size])
</script>

<template>
    <span class="inline-flex shrink-0 items-center rounded-full bg-star/20 font-semibold text-foreground ring-1 ring-inset ring-star/35" :class="box">
        <PnxStarGlyph class="text-star" :class="glyph" />
        <span class="tabular">{{ formatNumber(count) }}</span>
    </span>
</template>
