<script setup lang="ts">
import { Eye, EyeOff, Info, RotateCcw, Search, X } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GAME_ICON_NAMES, isInlineSvg } from '#shared/game-icons'
import type { OwnedGame } from '#shared/types/api'
import type { UpdateOwnGamePayload } from '@/composables/useMyApps'

const props = defineProps<{
    game: OwnedGame | null
    verified: boolean
    busy: boolean
}>()

const emit = defineEmits<{
    close: []
    save: [slug: string, payload: UpdateOwnGamePayload]
}>()

const open = computed({
    get: () => !!props.game,
    set: (v: boolean) => { if (!v) emit('close') }
})

type IconMode = 'lucide' | 'url' | 'svg'

const form = ref({
    name: '',
    tagline: '',
    description: '',
    playPath: '/',
    visibility: 'public' as 'draft' | 'public',
    accent: '',
    cover: '',
    iconMode: 'lucide' as IconMode,
    lucideIcon: '' as string,
    iconUrl: '',
    iconSvg: ''
})

const iconQuery = ref('')
const coverBroken = ref(false)

watch(() => props.game, (g) => {
    if (!g) return
    const f = form.value
    f.name = g.name
    f.tagline = g.tagline ?? ''
    f.description = g.description ?? ''
    f.playPath = g.playPath
    f.visibility = g.visibility
    f.accent = g.accent ?? ''
    f.cover = g.cover ?? ''
    coverBroken.value = false
    iconQuery.value = ''

    if (g.icon && isInlineSvg(g.icon)) {
        f.iconMode = 'svg'
        f.iconSvg = g.icon
        f.lucideIcon = ''
        f.iconUrl = ''
    } else if (g.icon?.startsWith('lucide:')) {
        f.iconMode = 'lucide'
        f.lucideIcon = g.icon.slice(7)
        f.iconUrl = ''
        f.iconSvg = ''
    } else if (g.icon) {
        f.iconMode = 'url'
        f.iconUrl = g.icon
        f.lucideIcon = ''
        f.iconSvg = ''
    } else {
        f.iconMode = 'lucide'
        f.lucideIcon = ''
        f.iconUrl = ''
        f.iconSvg = ''
    }
}, { immediate: true })

watch(() => form.value.cover, () => { coverBroken.value = false })

const effectiveIcon = computed<string | null>(() => {
    const f = form.value
    if (f.iconMode === 'lucide') return f.lucideIcon ? `lucide:${f.lucideIcon}` : null
    if (f.iconMode === 'url') return f.iconUrl.trim() || null
    return f.iconSvg.trim() || null
})

const previewAccent = computed(() => gameAccent({ slug: props.game?.slug ?? '', accent: form.value.accent.trim() || null }))
const colorPickerValue = computed({
    get: () => (/^#[0-9a-fA-F]{6}$/.test(form.value.accent.trim()) ? form.value.accent.trim() : '#7c5cff'),
    set: (v: string) => { form.value.accent = v }
})

const filteredIcons = computed(() => {
    const q = iconQuery.value.trim().toLowerCase()
    if (!q) return GAME_ICON_NAMES
    return GAME_ICON_NAMES.filter(n => n.includes(q))
})

const iconComponent = (name: string) => {
    const resolved = resolveGameIcon(`lucide:${name}`)
    return 'component' in resolved ? resolved.component : null
}

function submit() {
    if (!props.game) return
    const f = form.value
    emit('save', props.game.slug, {
        name: f.name.trim(),
        tagline: f.tagline.trim() || null,
        description: f.description.trim() ? f.description : null,
        playPath: f.playPath.trim(),
        visibility: f.visibility,
        accent: f.accent.trim() || null,
        cover: f.cover.trim() || null,
        icon: effectiveIcon.value
    })
}
</script>

<template>
    <Dialog v-model:open="open">
        <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit {{ game?.name }}</DialogTitle>
                <DialogDescription class="tabular">{{ game?.slug }}</DialogDescription>
            </DialogHeader>

            <!-- Live card preview -->
            <div v-if="game" class="overflow-hidden rounded-2xl border bg-background">
                <div
                    class="relative h-24 overflow-hidden"
                    :style="{ background: `linear-gradient(135deg, color-mix(in oklch, ${previewAccent} 45%, var(--card)), color-mix(in oklch, ${previewAccent} 14%, var(--card)))` }"
                >
                    <img
                        v-if="form.cover.trim() && !coverBroken"
                        :src="form.cover.trim()"
                        alt=""
                        class="absolute inset-0 size-full object-cover"
                        @error="coverBroken = true"
                    >
                    <div class="absolute right-2.5 top-2.5 flex gap-1.5">
                        <Badge v-if="form.visibility === 'draft'" variant="secondary">Draft</Badge>
                        <Badge v-else-if="!verified" variant="secondary">New (unverified)</Badge>
                        <Badge v-else variant="default">Public</Badge>
                    </div>
                </div>
                <div class="-mt-7 flex items-end gap-3 px-4 pb-3.5">
                    <PnxGameIcon
                        :key="effectiveIcon ?? 'default'"
                        :icon="effectiveIcon"
                        :accent="previewAccent"
                        :name="form.name || game.name"
                        class="relative ring-4 ring-background"
                    />
                    <div class="min-w-0 flex-1 pt-7">
                        <p class="truncate font-display text-lg font-bold leading-tight">{{ form.name || game.name }}</p>
                        <p class="truncate text-xs text-muted-foreground">{{ form.tagline || 'No tagline' }}</p>
                    </div>
                </div>
            </div>

            <form class="space-y-5" @submit.prevent="submit">
                <!-- Visibility -->
                <div class="space-y-2">
                    <Label>Visibility</Label>
                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            :class="form.visibility === 'public' ? 'border-primary bg-primary/10 text-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'"
                            @click="form.visibility = 'public'"
                        >
                            <Eye class="size-4 shrink-0" :class="form.visibility === 'public' ? 'text-primary' : ''" />
                            <div class="min-w-0">
                                <p class="text-sm font-semibold leading-tight">Public</p>
                                <p class="text-[11px] text-muted-foreground">{{ verified ? 'Listed for all players' : 'Ready once app is verified' }}</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            :class="form.visibility === 'draft' ? 'border-primary bg-primary/10 text-foreground' : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'"
                            @click="form.visibility = 'draft'"
                        >
                            <EyeOff class="size-4 shrink-0" :class="form.visibility === 'draft' ? 'text-primary' : ''" />
                            <div class="min-w-0">
                                <p class="text-sm font-semibold leading-tight">Draft</p>
                                <p class="text-[11px] text-muted-foreground">Only you and admins</p>
                            </div>
                        </button>
                    </div>
                </div>

                <!-- Basics -->
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="space-y-1.5">
                        <Label for="game-name">Name</Label>
                        <Input id="game-name" v-model="form.name" maxlength="60" required />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="game-play-path">Play path</Label>
                        <Input id="game-play-path" v-model="form.playPath" placeholder="/" maxlength="500" class="font-mono text-sm" required />
                    </div>
                </div>

                <div class="space-y-1.5">
                    <Label for="game-tagline">Tagline</Label>
                    <Input id="game-tagline" v-model="form.tagline" placeholder="Short one-line pitch" maxlength="120" />
                </div>

                <div class="space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                        <Label for="game-description">Description</Label>
                        <span class="text-[11px] text-muted-foreground">Markdown supported</span>
                    </div>
                    <textarea
                        id="game-description"
                        v-model="form.description"
                        rows="4"
                        maxlength="10000"
                        placeholder="How to play, rules, tips…"
                        class="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                <!-- Banner & Accent -->
                <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div class="space-y-1.5">
                        <Label for="game-cover">Banner image URL</Label>
                        <div class="flex items-center gap-1.5">
                            <Input id="game-cover" v-model="form.cover" type="url" inputmode="url" placeholder="https://example.com/banner.png" maxlength="500" class="flex-1" />
                            <Button v-if="form.cover" type="button" size="icon-sm" variant="ghost" aria-label="Clear banner" @click="form.cover = ''">
                                <X class="size-4" />
                            </Button>
                        </div>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="game-accent">Accent color</Label>
                        <div class="flex items-center gap-1.5">
                            <label class="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border" :style="{ background: previewAccent }">
                                <input v-model="colorPickerValue" type="color" class="sr-only" aria-label="Pick accent color">
                            </label>
                            <Input id="game-accent" v-model="form.accent" placeholder="#7c5cff" maxlength="7" class="w-26 font-mono text-sm" />
                            <Button v-if="form.accent" type="button" size="icon-sm" variant="ghost" title="Use automatic color" aria-label="Reset accent color" @click="form.accent = ''">
                                <RotateCcw class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <!-- Icon -->
                <div class="space-y-2.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <Label>Icon</Label>
                        <div class="inline-flex rounded-xl border bg-muted/40 p-0.5 text-xs">
                            <button
                                v-for="mode in ([{ id: 'lucide', label: 'Icons' }, { id: 'url', label: 'Image URL' }, { id: 'svg', label: 'SVG' }] as const)"
                                :key="mode.id"
                                type="button"
                                class="rounded-lg px-2.5 py-1 font-medium transition-colors"
                                :class="form.iconMode === mode.id ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'"
                                @click="form.iconMode = mode.id"
                            >{{ mode.label }}</button>
                        </div>
                    </div>

                    <div v-if="form.iconMode === 'lucide'" class="space-y-2 rounded-xl border bg-muted/20 p-3">
                        <div class="flex items-center gap-2">
                            <div class="relative flex-1">
                                <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input v-model="iconQuery" placeholder="Search icons…" class="h-8 pl-8 text-xs" />
                            </div>
                            <Button v-if="form.lucideIcon" type="button" size="sm" variant="ghost" class="h-8 text-xs" @click="form.lucideIcon = ''">
                                Default
                            </Button>
                        </div>
                        <div class="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto p-0.5 sm:grid-cols-10">
                            <button
                                v-for="name in filteredIcons"
                                :key="name"
                                type="button"
                                :title="name"
                                :aria-label="name"
                                :aria-pressed="form.lucideIcon === name"
                                class="flex aspect-square items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                :class="form.lucideIcon === name
                                    ? 'border-primary bg-primary/15 text-primary'
                                    : 'border-transparent bg-background/60 text-muted-foreground hover:border-border hover:text-foreground'"
                                @click="form.lucideIcon = name"
                            >
                                <component :is="iconComponent(name)" class="size-4" />
                            </button>
                        </div>
                    </div>

                    <div v-else-if="form.iconMode === 'url'" class="flex items-center gap-1.5">
                        <Input v-model="form.iconUrl" type="url" inputmode="url" placeholder="https://example.com/icon.png" maxlength="500" class="flex-1" />
                        <Button v-if="form.iconUrl" type="button" size="icon-sm" variant="ghost" aria-label="Clear icon URL" @click="form.iconUrl = ''">
                            <X class="size-4" />
                        </Button>
                    </div>

                    <div v-else class="space-y-1">
                        <textarea
                            v-model="form.iconSvg"
                            rows="3"
                            placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'
                            class="flex w-full rounded-xl border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                        <p class="text-[11px] text-muted-foreground">Must be an &lt;svg&gt; with xmlns="http://www.w3.org/2000/svg" (no scripts or handlers).</p>
                    </div>
                </div>

                <p class="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <Info class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span>Changes apply right away. If your app pushes a manifest on startup, update it there too so restarts don't overwrite them.</span>
                </p>

                <DialogFooter class="gap-2">
                    <Button type="button" variant="outline" @click="emit('close')">Cancel</Button>
                    <Button type="submit" variant="chunky" :disabled="busy">Save changes</Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
</template>
