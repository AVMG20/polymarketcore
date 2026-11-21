<script setup lang="ts">
import { emblemPolygonPoints, emblemStarPoints, emblemStrokePath, type EmblemData } from '#shared/emblem'

/** A parsed emblem drawn on its 100x100 canvas. The parent crops it (avatars to a circle). */
defineProps<{ data: EmblemData }>()
</script>

<template>
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" class="size-full">
        <rect :fill="data.background" width="100" height="100" />
        <template v-for="(element, index) in data.elements" :key="index">
            <path
                v-if="element.kind === 'stroke'"
                :d="emblemStrokePath(element.points)"
                :stroke="element.color"
                :stroke-width="element.width"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <circle v-else-if="element.shape === 'circle'" :cx="element.x" :cy="element.y" :r="element.size / 2" :fill="element.color" />
            <rect
                v-else-if="element.shape === 'square'"
                :x="element.x - element.size / 2"
                :y="element.y - element.size / 2"
                :width="element.size"
                :height="element.size"
                :transform="`rotate(${element.rotation} ${element.x} ${element.y})`"
                :fill="element.color"
                rx="2"
            />
            <polygon v-else-if="element.shape === 'star'" :points="emblemStarPoints(element)" :fill="element.color" />
            <polygon v-else :points="emblemPolygonPoints(element)" :fill="element.color" />
        </template>
    </svg>
</template>
