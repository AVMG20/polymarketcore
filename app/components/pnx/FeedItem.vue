<script setup lang="ts">
import { ArrowDown, ArrowUp, Gem, Sparkles, UserPlus } from 'lucide-vue-next'
import type { FeedEvent } from '#shared/types/api'

/**
 * One feed line. Rises are warm (amber), drops are deliberately quiet (muted,
 * no emphasis). `hidePlayer` is for lists already about one player.
 */
const props = defineProps<{ event: FeedEvent, hidePlayer?: boolean }>()

const p = computed(() => props.event.payload as Record<string, any>)
const down = computed(() => props.event.type === 'star' && p.value.direction === 'down')
</script>

<template>
    <li class="flex items-start gap-3 py-3">
        <NuxtLink v-if="!hidePlayer" :to="`/players/${event.player.id}`" class="shrink-0" :aria-label="event.player.name">
            <PnxPlayerAvatar :name="event.player.name" :image="event.player.image" :emblem="event.player.emblem" :prestige="event.player.prestige" class="size-9" />
        </NuxtLink>
        <span
            v-else
            class="flex size-9 shrink-0 items-center justify-center rounded-full"
            :class="event.type === 'star' && !down ? 'bg-star/20 text-star' : 'bg-muted text-muted-foreground'"
        >
            <ArrowUp v-if="event.type === 'star' && !down" class="size-4" />
            <ArrowDown v-else-if="event.type === 'star'" class="size-4" />
            <Gem v-else-if="event.type === 'claim'" class="size-4" />
            <UserPlus v-else-if="event.type === 'join'" class="size-4" />
            <Sparkles v-else class="size-4" />
        </span>
        <div class="min-w-0 flex-1 text-sm leading-snug">
            <p :class="down ? 'text-muted-foreground' : ''">
                <NuxtLink v-if="!hidePlayer" :to="`/players/${event.player.id}`" class="font-semibold text-foreground hover:underline">{{ event.player.name }}</NuxtLink>
                <template v-if="event.type === 'star'">
                    {{ hidePlayer ? '' : ' ' }}{{ down ? 'dropped to ' : 'reached ' }}                    <span class="tabular font-semibold" :class="down ? '' : 'text-foreground'">
                        <span :class="down ? '' : 'rounded bg-star/25 px-1'">★{{ p.stars }}</span>
                    </span>
                    <template v-if="p.name">{{ ' ' + p.name }}</template>
                    {{ ' in ' }}<span class="font-medium" :class="down ? '' : 'text-foreground'">{{ p.gameName }}</span>
                </template>
                <template v-else-if="event.type === 'claim'">
                    {{ hidePlayer ? 'Claimed ' : ' claimed ' }}<PnxGemChip :amount="Number(p.gems) || 0" size="sm" class="align-middle" />
                </template>
                <template v-else-if="event.type === 'title'">
                    {{ hidePlayer ? 'Became ' : ' became ' }}<PnxTitleBadge :title="String(p.title)" class="align-middle" />
                </template>
                <template v-else>{{ hidePlayer ? 'Joined' : ' joined' }} Polynux</template>
            </p>
        </div>
        <time :datetime="event.createdAt" class="shrink-0 pt-0.5 text-xs text-muted-foreground">{{ timeAgo(event.createdAt) }}</time>
    </li>
</template>
