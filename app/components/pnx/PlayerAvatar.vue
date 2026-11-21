<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

defineProps<{ name: string, image?: string | null, class?: string }>()
</script>

<template>
    <Avatar :class="$props.class ?? 'size-8'">
        <AvatarImage v-if="image" :src="image" :alt="name" />
        <AvatarFallback class="bg-primary/15 font-display font-bold text-primary">{{ name.slice(0, 1).toUpperCase() }}</AvatarFallback>
    </Avatar>
</template>
