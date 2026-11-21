<script setup lang="ts">
import { Crown } from 'lucide-vue-next'

/** A player title ("Regular", "Legend"). Amber: titles belong to stars. */
defineProps<{ title: string }>()
</script>

<template>
    <span class="inline-flex items-center gap-1 rounded-full bg-star/15 px-2 py-0.5 text-xs font-semibold text-foreground ring-1 ring-inset ring-star/30">
        <Crown class="size-3 text-star" aria-hidden="true" />{{ title }}
    </span>
</template>
