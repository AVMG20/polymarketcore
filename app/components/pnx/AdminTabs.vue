<script setup lang="ts">
import { Package, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

/** Admin section switch, shown at the top of each admin page. */
const route = useRoute()
const tabs = [
    { to: '/admin/apps', label: 'Apps', icon: Package },
    { to: '/admin/players', label: 'Players', icon: Users }
]
</script>

<template>
    <nav class="flex gap-1.5" aria-label="Admin">
        <Button v-for="t in tabs" :key="t.to" :variant="route.path === t.to ? 'secondary' : 'ghost'" size="sm" as-child>
            <NuxtLink :to="t.to" :aria-current="route.path === t.to ? 'page' : undefined"><component :is="t.icon" /> {{ t.label }}</NuxtLink>
        </Button>
    </nav>
</template>
