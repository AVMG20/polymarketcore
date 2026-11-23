<script setup lang="ts">
import { Gamepad2 } from 'lucide-vue-next'

/** A game's icon in a tile tinted with its accent colour. */
const props = withDefaults(defineProps<{
    icon: string | null
    accent: string
    name?: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
}>(), { size: 'md', name: '' })

const broken = ref(false)
const resolved = computed(() => resolveGameIcon(props.icon))
const box = computed(() => ({
    xs: 'size-5 rounded-[6px] shadow-[inset_0_-1.5px_0_0_rgb(0_0_0/0.18)]',
    sm: 'size-9 rounded-xl shadow-[inset_0_-3px_0_0_rgb(0_0_0/0.18)]',
    md: 'size-12 rounded-2xl shadow-[inset_0_-3px_0_0_rgb(0_0_0/0.18)]',
    lg: 'size-16 rounded-[1.25rem] shadow-[inset_0_-3px_0_0_rgb(0_0_0/0.18)]'
})[props.size])
const glyph = computed(() => ({ xs: 'size-3', sm: 'size-4.5', md: 'size-6', lg: 'size-8' })[props.size])
</script>

<template>
    <span
        class="inline-flex shrink-0 items-center justify-center overflow-hidden text-white"
        :class="box"
        :style="{ background: `linear-gradient(145deg, color-mix(in oklch, ${accent} 80%, white), ${accent})` }"
    >
        <img v-if="'src' in resolved && !broken" :src="resolved.src" :alt="name" class="size-full object-cover" loading="lazy" @error="broken = true">
        <component :is="'component' in resolved ? resolved.component : Gamepad2" v-else :class="glyph" aria-hidden="true" />
    </span>
</template>
