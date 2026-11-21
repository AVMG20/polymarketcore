<script setup lang="ts">
import { ArrowLeft, History } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EMBLEM_HISTORY_LIMIT, parseEmblem } from '#shared/emblem'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Emblem · Polynux' })

const { me, current, dirty, restoredDraft, history, historyPending, busy, change, reset, load, save, remove } = useEmblem()
const saved = computed(() => history.value.map(entry => ({ entry, data: parseEmblem(entry.emblem) })))
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-start justify-between gap-4">
            <h1 class="text-3xl">Emblem</h1>
            <Button variant="ghost" size="sm" as-child><NuxtLink to="/settings"><ArrowLeft /> Settings</NuxtLink></Button>
        </div>

        <div v-if="restoredDraft && dirty" class="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
            <p class="flex-1">Unsaved drawing restored</p>
            <Button size="sm" variant="outline" @click="reset">Discard it</Button>
        </div>

        <Card>
            <CardContent>
                <PnxEmblemEditor :model-value="current" :busy="busy" @update:model-value="change" @save="save" />
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Saved</CardTitle>
                <CardDescription class="tabular">{{ history.length }} / {{ EMBLEM_HISTORY_LIMIT }}</CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
                <div v-if="historyPending && !history.length" class="flex flex-wrap gap-3" aria-hidden="true">
                    <Skeleton v-for="i in 6" :key="i" class="size-20 rounded-2xl" />
                </div>
                <PnxStateBlock v-else-if="!history.length" :icon="History" title="Nothing saved yet" />
                <ul v-else class="flex flex-wrap gap-3">
                    <li v-for="{ entry, data } in saved" :key="entry.id">
                        <button
                            type="button"
                            class="flex w-20 flex-col items-center gap-1.5 rounded-2xl border p-2 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                            :class="entry.emblem === me?.emblem ? 'border-primary/60 bg-primary/5' : ''"
                            :aria-label="`Edit the emblem saved ${timeAgo(entry.createdAt)}`"
                            @click="load(entry)"
                        >
                            <span class="size-12 overflow-hidden rounded-full border">
                                <PnxEmblemSvg v-if="data" :data="data" />
                            </span>
                            <time :datetime="entry.createdAt" class="text-[10px] text-muted-foreground">{{ timeAgo(entry.createdAt) }}</time>
                        </button>
                    </li>
                </ul>
                <div v-if="me?.emblem" class="flex flex-wrap items-center gap-3 border-t pt-4">
                    <span class="flex-1" />
                    <Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" :disabled="busy" @click="remove">Remove emblem</Button>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
