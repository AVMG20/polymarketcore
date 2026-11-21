<script setup lang="ts">
import type { Component } from 'vue'

/** Empty and error states: a soft icon, one line of title, one of help, optional actions. */
defineProps<{ icon?: Component, title: string, text?: string, tone?: 'neutral' | 'error' }>()
</script>

<template>
    <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
        <span
            class="mb-1 flex size-12 items-center justify-center rounded-2xl"
            :class="tone === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'"
        >
            <component :is="icon" v-if="icon" class="size-6" aria-hidden="true" />
        </span>
        <p class="font-display text-lg font-bold">{{ title }}</p>
        <p v-if="text" class="max-w-sm text-sm text-muted-foreground">{{ text }}</p>
        <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2"><slot /></div>
    </div>
</template>
