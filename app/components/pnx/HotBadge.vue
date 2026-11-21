<script setup lang="ts">
import { Flame } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

/** Among the most played games of the last day. */
</script>

<template>
    <Badge class="gap-1 border-transparent bg-orange-500 text-white shadow-sm" title="One of the most played games today">
        <Flame class="size-3 fill-current" aria-hidden="true" />Hot
    </Badge>
</template>
