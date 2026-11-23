<script setup lang="ts">
import { Check, Clock, ListOrdered, Pencil, RotateCcw, Sparkles, Star, Users } from 'lucide-vue-next'
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'
import type { GameSort } from '@/composables/useGameSort'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Games · Polynux' })

const { data, pending, error, refresh } = useGames()
const { sort, options, games, editing, toggleEditing, move, reset, hasOrder } = useGameSort(data)

const SORTS: Record<GameSort, { label: string, icon: Component }> = {
    mine: { label: 'Mine', icon: ListOrdered },
    featured: { label: 'Featured', icon: Sparkles },
    newest: { label: 'Newest', icon: Clock },
    stars: { label: 'Stars', icon: Star },
    popular: { label: 'Popular', icon: Users }
}
const sortOptions = computed(() => options.value.map(value => ({ value, ...SORTS[value] })))
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl">Games</h1>
            <div class="flex items-center gap-2">
                <template v-if="sort === 'mine'">
                    <Button v-if="editing && hasOrder" size="icon-sm" variant="ghost" aria-label="Reset order" title="Reset" @click="reset()">
                        <RotateCcw />
                    </Button>
                    <Button size="sm" :variant="editing ? 'default' : 'outline'" :aria-pressed="editing" :title="editing ? 'Done' : 'Edit order'" @click="toggleEditing()">
                        <component :is="editing ? Check : Pencil" />
                        <span class="hidden sm:inline">{{ editing ? 'Done' : 'Edit order' }}</span>
                        <span class="sr-only sm:hidden">{{ editing ? 'Done' : 'Edit order' }}</span>
                    </Button>
                </template>
                <PnxSegmented v-model="sort" :options="sortOptions" label="Sort games" icons-on-mobile />
            </div>
        </div>
        <PnxGamesGrid :games="games" :pending="pending" :error="!!error" untitled-first :editing="editing" @retry="refresh()" @move="move" />
    </div>
</template>
