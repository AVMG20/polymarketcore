<script setup lang="ts">
import {
    ArrowLeft,
    Check,
    CircleHelp,
    Copy,
    ExternalLink,
    Eye,
    EyeOff,
    Gamepad2,
    Github,
    KeyRound,
    PackageX,
    Pencil,
    Play,
    Power,
    Settings2,
    Star,
    TriangleAlert
} from 'lucide-vue-next'
import { isGithubUrl } from '#shared/app-urls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { OwnedGame } from '#shared/types/api'
import type { UpdateOwnGamePayload } from '@/composables/useMyApps'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { app, games, pending, error, busy, gameBusy, revealedKey, refresh, updateApp, rotateKey, updateGame } = useMyApp(id)
const { copied, copyText } = useCopy()

const notFound = computed(() => apiErrorStatus(error.value) === 404)
useHead({ title: () => `${app.value?.name ?? 'App'} · Developer · Polynux` })

const activeGames = computed(() => games.value.filter(g => !g.retired))
const retiredGames = computed(() => games.value.filter(g => g.retired))

// Edit app settings dialog
const editAppOpen = ref(false)
const appForm = ref({ name: '', baseUrl: '', prefixes: '', repoUrl: '' })

function openEditApp() {
    if (!app.value) return
    appForm.value = {
        name: app.value.name,
        baseUrl: app.value.baseUrl,
        prefixes: app.value.returnUrlPrefixes.join(', '),
        repoUrl: app.value.repoUrl ?? ''
    }
    editAppOpen.value = true
}

async function saveAppSettings() {
    const f = appForm.value
    const prefixes = f.prefixes.split(/[\s,]+/).filter(Boolean)
    const res = await updateApp({
        name: f.name.trim(),
        baseUrl: f.baseUrl.trim(),
        returnUrlPrefixes: prefixes.length ? prefixes : undefined,
        repoUrl: f.repoUrl.trim() || null
    })
    if (res) editAppOpen.value = false
}

// Confirm dialogs (rotate key, disable app)
const confirmKind = ref<'rotate' | 'disable' | null>(null)
const confirmOpen = computed({
    get: () => !!confirmKind.value,
    set: (open: boolean) => { if (!open) confirmKind.value = null }
})

async function runConfirm() {
    if (confirmKind.value === 'rotate') {
        await rotateKey()
    } else if (confirmKind.value === 'disable') {
        await updateApp({ status: 'disabled' })
    }
    confirmKind.value = null
}

const revealKeyOpen = computed({
    get: () => !!revealedKey.value,
    set: (open: boolean) => { if (!open) revealedKey.value = null }
})

// Game editing
const editingGame = ref<OwnedGame | null>(null)
const brokenCovers = reactive<Record<string, boolean>>({})

async function toggleVisibility(game: OwnedGame) {
    const next = game.visibility === 'public' ? 'draft' : 'public'
    await updateGame(game.slug, { visibility: next })
}

async function saveGame(slug: string, payload: UpdateOwnGamePayload) {
    const updated = await updateGame(slug, payload)
    if (updated) {
        delete brokenCovers[slug]
        editingGame.value = null
    }
}
</script>

<template>
    <div class="space-y-6">
        <NuxtLink
            to="/settings/developer"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
            <ArrowLeft class="size-4" aria-hidden="true" /> Developer
        </NuxtLink>

        <div v-if="pending && !app" class="space-y-4" aria-hidden="true">
            <Skeleton class="h-36 rounded-2xl" />
            <div class="grid gap-4 sm:grid-cols-2">
                <Skeleton class="h-44 rounded-2xl" />
                <Skeleton class="h-44 rounded-2xl" />
            </div>
        </div>

        <PnxStateBlock v-else-if="notFound" :icon="PackageX" title="App not found">
            <Button variant="outline" as-child><NuxtLink to="/settings/developer">Back to Developer</NuxtLink></Button>
        </PnxStateBlock>

        <PnxStateBlock v-else-if="error || !app" :icon="TriangleAlert" tone="error" title="Couldn't load this app">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>

        <template v-else>
            <!-- App header card -->
            <section class="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div class="min-w-0 space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="truncate text-2xl sm:text-3xl">{{ app.name }}</h1>
                            <Badge v-if="app.status !== 'active'" variant="destructive">disabled</Badge>
                            <Badge
                                :variant="app.verified ? 'default' : 'secondary'"
                                :title="app.verified ? 'Listed for everyone' : 'Only you see its games until an admin verifies it'"
                            >{{ app.verified ? 'verified' : 'unverified' }}</Badge>
                        </div>
                        <p class="tabular text-xs text-muted-foreground">
                            {{ app.id }} · Seen {{ app.lastSeenAt ? timeAgo(app.lastSeenAt) : 'never' }}
                        </p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" :disabled="busy" @click="openEditApp">
                            <Settings2 /> Edit app
                        </Button>
                        <Button size="sm" variant="outline" :disabled="busy" @click="confirmKind = 'rotate'">
                            <KeyRound /> Rotate key
                        </Button>
                        <Button
                            v-if="app.status === 'active'"
                            size="sm"
                            variant="ghost"
                            class="text-destructive hover:text-destructive"
                            :disabled="busy"
                            @click="confirmKind = 'disable'"
                        ><Power /> Disable</Button>
                        <Button
                            v-else-if="!app.disabledByAdmin"
                            size="sm"
                            variant="secondary"
                            :disabled="busy"
                            @click="updateApp({ status: 'active' })"
                        ><Power /> Enable</Button>
                        <span v-else class="text-xs text-muted-foreground">Disabled by an admin</span>
                    </div>
                </div>

                <dl class="grid gap-x-4 gap-y-1.5 border-t border-border/60 pt-4 text-xs sm:grid-cols-[auto_1fr]">
                    <dt class="text-muted-foreground">Base URL</dt>
                    <dd class="tabular break-all">
                        <a :href="app.baseUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                            {{ app.baseUrl }} <ExternalLink class="size-3 text-muted-foreground" aria-hidden="true" />
                        </a>
                    </dd>
                    <dt class="text-muted-foreground">Return URLs</dt>
                    <dd class="tabular break-all text-foreground/90">{{ app.returnUrlPrefixes.join(', ') }}</dd>
                    <dt class="text-muted-foreground">Repo</dt>
                    <dd class="flex min-w-0 items-center gap-1.5">
                        <a v-if="app.repoUrl" :href="app.repoUrl" target="_blank" rel="noopener noreferrer" class="tabular inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:underline">
                            <Github v-if="isGithubUrl(app.repoUrl)" class="size-3.5 shrink-0" aria-hidden="true" />
                            <span class="truncate">{{ app.repoUrl }}</span>
                        </a>
                        <span v-else class="text-muted-foreground">none</span>
                    </dd>
                </dl>
            </section>

            <p v-if="!app.verified" class="flex items-start gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                This app is unverified: only you and admins can see its games, and its stars don't count yet.
            </p>

            <!-- Active registered games -->
            <section class="space-y-3">
                <div class="flex items-baseline justify-between gap-3">
                    <h2 class="text-xl">Games</h2>
                    <span class="tabular text-xs text-muted-foreground">
                        {{ activeGames.length }} {{ activeGames.length === 1 ? 'game' : 'games' }}
                    </span>
                </div>

                <PnxStateBlock
                    v-if="activeGames.length === 0"
                    :icon="Gamepad2"
                    title="No games registered yet"
                    body="Push a manifest with PUT /api/v1/manifest from your app server to register games."
                >
                    <Button size="sm" variant="outline" as-child><NuxtLink to="/developers">Read guide</NuxtLink></Button>
                </PnxStateBlock>

                <ul v-else class="grid gap-4 lg:grid-cols-2">
                    <li
                        v-for="g in activeGames"
                        :key="g.slug"
                        class="flex flex-col overflow-hidden rounded-2xl border bg-card"
                    >
                        <!-- Mini banner -->
                        <div
                            class="relative h-20 overflow-hidden"
                            :style="{ background: `linear-gradient(135deg, color-mix(in oklch, ${gameAccent(g)} 42%, var(--card)), color-mix(in oklch, ${gameAccent(g)} 12%, var(--card)))` }"
                        >
                            <img
                                v-if="g.cover && !brokenCovers[g.slug]"
                                :src="g.cover"
                                alt=""
                                class="absolute inset-0 size-full object-cover"
                                loading="lazy"
                                @error="brokenCovers[g.slug] = true"
                            >
                            <div class="absolute right-2.5 top-2.5 flex flex-wrap justify-end gap-1.5">
                                <Badge :variant="g.visibility === 'public' ? 'default' : 'secondary'">
                                    {{ g.visibility === 'public' ? 'Public' : 'Draft' }}
                                </Badge>
                            </div>
                        </div>

                        <div class="-mt-6 flex flex-1 flex-col gap-3 px-4 pb-4">
                            <div class="flex items-end gap-3">
                                <PnxGameIcon :icon="g.icon" :accent="gameAccent(g)" :name="g.name" class="relative ring-4 ring-card" />
                                <div class="min-w-0 flex-1 pt-6">
                                    <p class="truncate font-display text-lg font-bold leading-tight">{{ g.name }}</p>
                                    <p class="tabular truncate text-xs text-muted-foreground">{{ g.slug }} · {{ g.playPath }}</p>
                                </div>
                            </div>

                            <p v-if="g.tagline" class="line-clamp-2 text-sm text-muted-foreground">{{ g.tagline }}</p>
                            <p v-else class="text-xs italic text-muted-foreground/70">No tagline</p>

                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <Star class="size-3.5 text-star" aria-hidden="true" />
                                    <span class="tabular">{{ g.stars.filter(s => !s.retired).length }}</span>
                                    {{ g.stars.filter(s => !s.retired).length === 1 ? 'star level' : 'star levels' }}
                                </span>
                                <span v-if="g.counts" class="text-success">Counts for leaderboard</span>
                                <span v-else-if="g.visibility === 'draft'">Hidden from players</span>
                            </div>

                            <div class="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                                <Button size="sm" variant="chunky" :disabled="gameBusy === g.slug" @click="editingGame = g">
                                    <Pencil /> Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    :disabled="gameBusy === g.slug"
                                    @click="toggleVisibility(g)"
                                >
                                    <EyeOff v-if="g.visibility === 'public'" />
                                    <Eye v-else />
                                    {{ g.visibility === 'public' ? 'Make draft' : 'Publish' }}
                                </Button>
                                <div class="ml-auto flex items-center gap-1">
                                    <Button v-if="app.status === 'active'" size="sm" variant="ghost" as-child>
                                        <NuxtLink :to="`/games/${g.slug}`">Page</NuxtLink>
                                    </Button>
                                    <Button v-if="app.status === 'active'" size="sm" variant="ghost" as-child>
                                        <NuxtLink :to="`/play/${g.slug}`"><Play class="size-3.5" /> Play</NuxtLink>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
            </section>

            <!-- Retired games (read-only) -->
            <section v-if="retiredGames.length" class="space-y-2.5">
                <h2 class="text-lg text-muted-foreground">Retired games</h2>
                <ul class="divide-y overflow-hidden rounded-2xl border bg-card/60">
                    <li v-for="g in retiredGames" :key="g.slug" class="flex items-center gap-3 px-4 py-3 opacity-75">
                        <PnxGameIcon :icon="g.icon" :accent="gameAccent(g)" :name="g.name" size="sm" />
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-semibold leading-tight">{{ g.name }}</p>
                            <p class="tabular truncate text-xs text-muted-foreground">{{ g.slug }} · {{ g.playPath }}</p>
                        </div>
                        <Badge variant="outline">Retired</Badge>
                    </li>
                </ul>
            </section>
        </template>

        <!-- Edit app settings dialog -->
        <Dialog v-model:open="editAppOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit {{ app?.name }}</DialogTitle>
                    <DialogDescription class="tabular">{{ app?.id }}</DialogDescription>
                </DialogHeader>
                <form class="space-y-4" @submit.prevent="saveAppSettings">
                    <div class="space-y-1.5">
                        <Label for="edit-app-name">Name</Label>
                        <Input id="edit-app-name" v-model="appForm.name" maxlength="60" required />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-app-base">Base URL</Label>
                        <Input id="edit-app-base" v-model="appForm.baseUrl" type="url" inputmode="url" required />
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-1.5">
                            <Label for="edit-app-prefixes">Return URL prefixes</Label>
                            <TooltipProvider :delay-duration="100">
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="What are return URL prefixes?"><CircleHelp class="size-3.5" /></button>
                                    </TooltipTrigger>
                                    <TooltipContent class="max-w-64">
                                        URL prefixes sharing Base URL's origin where Polynux may redirect after login. Separate several with commas.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Input id="edit-app-prefixes" v-model="appForm.prefixes" placeholder="https://mygame.example.com/" required />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="edit-app-repo">Repo URL <span class="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input id="edit-app-repo" v-model="appForm.repoUrl" type="url" inputmode="url" placeholder="https://github.com/me/my-game" maxlength="500" />
                    </div>
                    <DialogFooter class="gap-2">
                        <Button type="button" variant="outline" @click="editAppOpen = false">Cancel</Button>
                        <Button type="submit" variant="chunky" :disabled="busy">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <!-- Edit game dialog -->
        <PnxGameEditDialog
            :game="editingGame"
            :verified="app?.verified ?? false"
            :busy="!!editingGame && gameBusy === editingGame.slug"
            @close="editingGame = null"
            @save="saveGame"
        />

        <!-- Confirm rotate key / disable -->
        <Dialog v-model:open="confirmOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {{ confirmKind === 'rotate' ? `Rotate API key for ${app?.name}?` : `Disable ${app?.name}?` }}
                    </DialogTitle>
                    <DialogDescription>
                        {{ confirmKind === 'rotate'
                            ? 'The old key stops working immediately. Update PNX_APP_KEY on your server with the new key.'
                            : 'Its games go offline until you enable it again.' }}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                    <Button variant="outline" @click="confirmKind = null">Cancel</Button>
                    <Button variant="destructive" :disabled="busy" @click="runConfirm">
                        {{ confirmKind === 'rotate' ? 'Rotate key' : 'Disable' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Reveal rotated API key -->
        <Dialog v-model:open="revealKeyOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New API key for {{ revealedKey?.appId }}</DialogTitle>
                    <DialogDescription>Shown once. Copy it now.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealedKey?.apiKey }}</code>
                <Button variant="chunky" @click="revealedKey && copyText(revealedKey.apiKey)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy key' }}
                </Button>
            </DialogContent>
        </Dialog>
    </div>
</template>
