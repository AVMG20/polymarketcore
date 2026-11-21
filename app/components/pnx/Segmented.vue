<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

/**
 * A compact segmented control (one choice of a few). `iconsOnMobile` hides the
 * labels below `sm` and keeps them as the accessible name and tooltip.
 * Arrow keys move the choice, like a radio group.
 */
const props = defineProps<{
    options: { value: T, label: string, icon?: Component }[]
    label: string
    iconsOnMobile?: boolean
}>()
const model = defineModel<T>({ required: true })
const buttons = ref<HTMLButtonElement[]>([])

function step(delta: number) {
    const i = props.options.findIndex(o => o.value === model.value)
    const next = (i + delta + props.options.length) % props.options.length
    model.value = props.options[next]!.value
    nextTick(() => buttons.value[next]?.focus())
}
</script>

<template>
    <div role="radiogroup" :aria-label="label" class="inline-flex shrink-0 items-center gap-0.5 rounded-xl border bg-card p-0.5">
        <button
            v-for="o in options"
            ref="buttons"
            :key="o.value"
            type="button"
            role="radio"
            :aria-checked="model === o.value"
            :aria-label="o.label"
            :title="iconsOnMobile ? o.label : undefined"
            :tabindex="model === o.value ? 0 : -1"
            class="inline-flex h-7 items-center gap-1.5 rounded-[0.6rem] px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50"
            :class="model === o.value ? 'bg-primary/12 text-foreground ring-1 ring-inset ring-primary/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            @click="model = o.value"
            @keydown.left.prevent="step(-1)"
            @keydown.up.prevent="step(-1)"
            @keydown.right.prevent="step(1)"
            @keydown.down.prevent="step(1)"
        >
            <component :is="o.icon" v-if="o.icon" class="size-4 shrink-0" aria-hidden="true" />
            <span :class="iconsOnMobile && o.icon ? 'hidden sm:inline' : ''">{{ o.label }}</span>
        </button>
    </div>
</template>
