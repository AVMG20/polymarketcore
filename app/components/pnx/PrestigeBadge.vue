<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { prestigeTier } from '#shared/prestige'

/** The tier's roman numeral next to a player's name, its name in a tooltip. Nothing at 0. */
const props = withDefaults(defineProps<{ prestige?: number | null, size?: 'sm' | 'md' }>(), { size: 'sm' })

const tier = computed(() => prestigeTier(props.prestige))
</script>

<template>
    <TooltipProvider v-if="tier" :delay-duration="100">
        <Tooltip>
            <TooltipTrigger as-child>
                <span
                    class="inline-flex shrink-0 items-center justify-center rounded-full align-middle font-display leading-none font-extrabold text-white shadow-[inset_0_-1px_0_0_rgb(0_0_0/0.2)] [text-shadow:0_1px_1px_rgb(0_0_0/0.35)]"
                    :class="size === 'md' ? 'h-5 min-w-5 px-1.5 text-xs' : 'h-4 min-w-4 px-1 text-[10px]'"
                    :style="{ background: tier.badge }"
                    :aria-label="tier.name"
                >{{ tier.roman }}</span>
            </TooltipTrigger>
            <TooltipContent>{{ tier.name }}</TooltipContent>
        </Tooltip>
    </TooltipProvider>
</template>
