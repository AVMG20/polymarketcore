<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A game's levels as 10 small rounded squares: filled amber up to the current
 * level, outlined amber up to the best, the level name in a tooltip.
 */
const props = withDefaults(defineProps<{
    levels: { key?: string, position: number, name: string, description?: string | null }[]
    stars?: number
    best?: number
    size?: 'sm' | 'md'
}>(), { stars: 0, best: 0, size: 'md' })

const slots = computed(() => Array.from({ length: 10 }, (_, i) => props.levels.find(s => s.position === i + 1) ?? null))
const cell = computed(() => props.size === 'sm' ? 'size-3 rounded-[3px]' : 'size-4 rounded-[5px]')
</script>

<template>
    <TooltipProvider :delay-duration="100">
        <div
            class="flex gap-[3px]"
            role="img"
            :aria-label="`Level ${stars} of ${levels.length}${best > stars ? `, best ${best}` : ''}`"
        >
            <template v-for="(level, i) in slots" :key="i">
                <Tooltip v-if="level">
                    <TooltipTrigger as-child>
                        <span
                            class="border transition-colors"
                            :class="[
                                cell,
                                level.position <= stars
                                    ? 'border-star bg-star shadow-[inset_0_-2px_0_0_rgb(0_0_0/0.14)]'
                                    : level.position <= best ? 'border-star/70 bg-star/15' : 'border-border bg-muted'
                            ]"
                        />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p class="font-semibold">★{{ level.position }} {{ level.name }}</p>
                        <p v-if="level.description" class="max-w-56 opacity-80">{{ level.description }}</p>
                    </TooltipContent>
                </Tooltip>
                <span v-else class="border border-dashed border-border/50" :class="cell" />
            </template>
        </div>
    </TooltipProvider>
</template>
