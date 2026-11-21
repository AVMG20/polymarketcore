<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

withDefaults(defineProps<{ rows?: number }>(), { rows: 5 })
</script>

<template>
    <ul class="divide-y" aria-hidden="true">
        <li v-for="i in rows" :key="i" class="flex items-center gap-3 py-3">
            <Skeleton class="size-9 rounded-full" />
            <Skeleton class="h-4 flex-1" />
            <Skeleton class="h-3 w-12" />
        </li>
    </ul>
</template>
