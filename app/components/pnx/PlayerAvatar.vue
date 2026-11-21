<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { parseEmblem } from '#shared/emblem'
import { prestigeTier } from '#shared/prestige'

/**
 * The one player avatar: their emblem, else their image, else their initial.
 * With `prestige` 1-4 a ring in the tier's colours turns slowly around it.
 * Size it with `class` (`size-9`); text classes size the initial.
 */
const props = defineProps<{
    name: string
    image?: string | null
    /** Serialized emblem (shared/emblem.ts) or an EmblemData object. */
    emblem?: unknown
    prestige?: number | null
    class?: HTMLAttributes['class']
}>()

const data = computed(() => parseEmblem(props.emblem))
const tier = computed(() => prestigeTier(props.prestige))
</script>

<template>
    <span :class="cn('relative inline-flex size-8 shrink-0 rounded-full align-middle', props.class)">
        <!-- A conic disc behind the avatar: only its rim shows, at any size. -->
        <template v-if="tier">
            <span aria-hidden="true" class="pointer-events-none absolute -inset-[12%] rounded-full opacity-40 blur-[5px]" :style="{ background: tier.accent }" />
            <span
                aria-hidden="true"
                class="pointer-events-none absolute -inset-[9%] animate-spin rounded-full motion-reduce:animate-none"
                :style="{ background: tier.ring, animationDuration: `${tier.spinSeconds}s` }"
            />
        </template>
        <Avatar class="size-full" :class="tier ? 'border border-background' : ''">
            <span v-if="data" role="img" :aria-label="name" class="size-full"><PnxEmblemSvg :data="data" /></span>
            <template v-else>
                <AvatarImage v-if="image" :src="image" :alt="name" />
                <AvatarFallback class="bg-primary/15 font-display font-bold text-primary">{{ name.slice(0, 1).toUpperCase() }}</AvatarFallback>
            </template>
        </Avatar>
    </span>
</template>
