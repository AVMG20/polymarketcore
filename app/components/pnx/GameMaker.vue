<script setup lang="ts">
import { Code, Github, Package } from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { isGithubUrl } from '#shared/app-urls'
import type { GameSummary } from '#shared/types/api'

/** Who made a game and where its code lives: the owner's avatar and name, the app, a repo button. */
const props = defineProps<{ app: GameSummary['app'] }>()

const owner = computed(() => props.app.owner)
const repo = computed(() => props.app.repoUrl)
const github = computed(() => !!repo.value && isGithubUrl(repo.value))
// `github.com/me/my-game`: the host and path, without the scheme.
const repoLabel = computed(() => (repo.value ? repo.value.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '') : ''))
</script>

<template>
    <div class="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
        <TooltipProvider :delay-duration="100">
            <Tooltip v-if="owner">
                <TooltipTrigger as-child>
                    <NuxtLink
                        :to="`/players/${owner.id}`"
                        class="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-background/70 py-0.5 pl-0.5 pr-2.5 font-medium outline-none backdrop-blur transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <PnxPlayerAvatar :name="owner.name" :image="owner.image" :emblem="owner.emblem" :prestige="owner.prestige" class="size-6 text-xs" />
                        <span class="max-w-40 truncate" :title="owner.name">{{ owner.name }}</span>
                    </NuxtLink>
                </TooltipTrigger>
                <TooltipContent>Maker</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger as-child>
                    <span class="inline-flex h-7 min-w-0 items-center gap-1 rounded-full bg-background/50 px-2.5 text-muted-foreground outline-none backdrop-blur focus-visible:ring-3 focus-visible:ring-ring/50" tabindex="0">
                        <Package class="size-3.5 shrink-0" aria-hidden="true" />
                        <span class="max-w-40 truncate">{{ app.name }}</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent>App</TooltipContent>
            </Tooltip>
            <Tooltip v-if="repo">
                <TooltipTrigger as-child>
                    <a
                        :href="repo"
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        :aria-label="`Code: ${repoLabel}`"
                        class="inline-flex size-7 items-center justify-center rounded-full border bg-background/70 text-foreground outline-none backdrop-blur transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <Github v-if="github" class="size-3.5" aria-hidden="true" />
                        <Code v-else class="size-3.5" aria-hidden="true" />
                    </a>
                </TooltipTrigger>
                <TooltipContent><span class="tabular">{{ repoLabel }}</span></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    </div>
</template>
