<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A game's levels as small rounded squares, one per declared level (1 to 10):
 * filled amber up to the current level, outlined amber up to the best, the
 * level name in a tooltip.
 */
const props = withDefaults(defineProps<{
    levels: { key?: string, position: number, name: string, description?: string | null }[]
    stars?: number
    best?: number
    size?: 'sm' | 'md'
}>(), { stars: 0, best: 0, size: 'md' })

const slots = computed(() => [...props.levels].sort((a, b) => a.position - b.position))
const cell = computed(() => props.size === 'sm' ? 'size-3 rounded-[3px]' : 'size-4 rounded-[5px]')
</script>

<template>
    <TooltipProvider :delay-duration="100">
        <div
            class="flex gap-[3px]"
            role="img"
            :aria-label="`Level ${stars} of ${levels.length}${best > stars ? `, best ${best}` : ''}`"
        >
            <template v-for="level in slots" :key="level.position">
                <Tooltip>
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
            </template>
        </div>
    </TooltipProvider>
</template>
