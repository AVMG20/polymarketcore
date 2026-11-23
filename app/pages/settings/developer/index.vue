<script setup lang="ts">
import { Check, ChevronRight, CircleHelp, Copy, Github, KeyRound, Package, Plus } from 'lucide-vue-next'
import { isGithubUrl } from '#shared/app-urls'
import { MAX_DEVELOPER_APPS } from '#shared/economy'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Developer · Polynux' })

const { tokens, max, pending, busy, revealed, create: createToken, revoke } = useDeveloperTokens()
const tokenName = ref('')

async function submitToken() {
    if (await createToken(tokenName.value.trim())) tokenName.value = ''
}

const revealTokenOpen = computed({
    get: () => !!revealed.value,
    set: (open: boolean) => { if (!open) revealed.value = null }
})

const { apps: myApps, pending: appsPending, busy: appBusy, revealedKey, create: createApp } = useMyApps()
const activeAppCount = computed(() => myApps.value.filter(a => a.status === 'active').length)

const createOpen = ref(false)
const appForm = ref({ id: '', name: '', baseUrl: '', prefixes: '', repoUrl: '' })

async function submitApp() {
    const f = appForm.value
    const prefixes = f.prefixes.split(/[\s,]+/).filter(Boolean)
    const res = await createApp({
        id: f.id.trim(),
        name: f.name.trim(),
        baseUrl: f.baseUrl.trim(),
        returnUrlPrefixes: prefixes.length ? prefixes : undefined,
        repoUrl: f.repoUrl.trim() || null
    })
    if (res) {
        appForm.value = { id: '', name: '', baseUrl: '', prefixes: '', repoUrl: '' }
        createOpen.value = false
    }
}

const revealKeyOpen = computed({
    get: () => !!revealedKey.value,
    set: (open: boolean) => { if (!open) revealedKey.value = null }
})

const { copied, copyText } = useCopy()
</script>

<template>
    <div class="space-y-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-3xl">Developer</h1>
            <Button variant="outline" size="sm" as-child><NuxtLink to="/developers">Agent guide</NuxtLink></Button>
        </div>

        <!-- Apps -->
        <section class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="text-xl">Your apps</h2>
                    <p class="text-xs text-muted-foreground">Click an app to manage its settings, API key and games.</p>
                </div>
                <Button size="sm" variant="chunky" :disabled="activeAppCount >= MAX_DEVELOPER_APPS" @click="createOpen = true">
                    <Plus /> Register app
                </Button>
            </div>

            <div v-if="appsPending && myApps.length === 0" class="grid gap-4 lg:grid-cols-2" aria-hidden="true">
                <Skeleton class="h-36 rounded-2xl" />
                <Skeleton class="h-36 rounded-2xl" />
            </div>
            <PnxStateBlock v-else-if="myApps.length === 0" :icon="Package" title="No apps yet">
                <Button size="sm" variant="chunky" @click="createOpen = true"><Plus /> Register your first app</Button>
            </PnxStateBlock>
            <ul v-else class="grid gap-4 lg:grid-cols-2">
                <li v-for="app in myApps" :key="app.id">
                    <NuxtLink
                        :to="`/settings/developer/apps/${encodeURIComponent(app.id)}`"
                        class="spring group flex h-full flex-col justify-between gap-3 rounded-2xl border bg-card p-4 outline-none hover:-translate-y-0.5 hover:border-primary/45 hover:bg-accent/25 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                        <div class="space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="truncate font-display text-lg font-bold leading-tight">{{ app.name }}</p>
                                    <p class="tabular text-xs text-muted-foreground">{{ app.id }}</p>
                                </div>
                                <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                    <Badge v-if="app.status !== 'active'" variant="destructive">disabled</Badge>
                                    <Badge
                                        :variant="app.verified ? 'default' : 'secondary'"
                                        :title="app.verified ? 'Listed for everyone' : 'Only you see its games until an admin verifies it'"
                                    >{{ app.verified ? 'verified' : 'unverified' }}</Badge>
                                </div>
                            </div>

                            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                                <dt class="text-muted-foreground">URL</dt>
                                <dd class="tabular truncate">{{ app.baseUrl }}</dd>
                                <dt class="text-muted-foreground">Repo</dt>
                                <dd class="flex min-w-0 items-center gap-1">
                                    <template v-if="app.repoUrl">
                                        <Github v-if="isGithubUrl(app.repoUrl)" class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <span class="tabular truncate">{{ app.repoUrl }}</span>
                                    </template>
                                    <span v-else class="text-muted-foreground">none</span>
                                </dd>
                                <dt class="text-muted-foreground">Seen</dt>
                                <dd>{{ app.lastSeenAt ? timeAgo(app.lastSeenAt) : 'never' }}</dd>
                            </dl>
                        </div>

                        <div class="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                            <span class="tabular font-medium text-muted-foreground">
                                {{ app.games }} {{ app.games === 1 ? 'game' : 'games' }}
                            </span>
                            <span class="inline-flex items-center gap-1 font-medium text-primary transition-transform group-hover:translate-x-0.5">
                                Manage <ChevronRight class="size-3.5" aria-hidden="true" />
                            </span>
                        </div>
                    </NuxtLink>
                </li>
            </ul>
        </section>

        <!-- Developer tokens -->
        <section class="space-y-3">
            <div>
                <h2 class="text-xl">Developer tokens</h2>
                <p class="text-xs text-muted-foreground">Give a token to a coding agent so it can register and update apps on your behalf.</p>
            </div>

            <div class="grid items-start gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>New token</CardTitle>
                        <CardDescription class="tabular">{{ tokens.length }} / {{ max }} active</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form class="grid gap-2" @submit.prevent="submitToken">
                            <Label for="token-name">Name</Label>
                            <div class="flex items-center gap-2">
                                <Input id="token-name" v-model="tokenName" placeholder="my laptop agent" maxlength="60" class="flex-1" required />
                                <Button type="submit" variant="chunky" :disabled="busy || tokens.length >= max">Create</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Skeleton v-if="pending && tokens.length === 0" class="h-24 rounded-2xl" />
                <PnxStateBlock v-else-if="tokens.length === 0" :icon="KeyRound" title="No tokens yet" />
                <ul v-else class="divide-y overflow-hidden rounded-2xl border bg-card">
                    <li v-for="t in tokens" :key="t.id" class="flex items-center gap-3 px-4 py-3">
                        <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><KeyRound class="size-4" /></span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-semibold leading-tight">{{ t.name }}</p>
                            <p class="truncate text-xs text-muted-foreground">
                                <span class="tabular">{{ t.prefix }}…</span> · {{ t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : 'never used' }}
                            </p>
                        </div>
                        <Button size="sm" variant="ghost" class="text-destructive hover:text-destructive" :disabled="busy" @click="revoke(t.id)">Revoke</Button>
                    </li>
                </ul>
            </div>
        </section>

        <!-- Register app dialog -->
        <Dialog v-model:open="createOpen">
            <DialogContent class="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Register an app</DialogTitle>
                    <DialogDescription class="tabular">{{ activeAppCount }} / {{ MAX_DEVELOPER_APPS }} active apps</DialogDescription>
                </DialogHeader>
                <form class="space-y-4" @submit.prevent="submitApp">
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="space-y-1.5">
                            <Label for="new-app-id">App id</Label>
                            <Input id="new-app-id" v-model="appForm.id" placeholder="my-game" pattern="[a-z0-9\-]{2,40}" class="font-mono text-sm" required />
                        </div>
                        <div class="space-y-1.5">
                            <Label for="new-app-name">Name</Label>
                            <Input id="new-app-name" v-model="appForm.name" placeholder="My Game" maxlength="60" required />
                        </div>
                    </div>
                    <div class="space-y-1.5">
                        <Label for="new-app-base">Base URL</Label>
                        <Input id="new-app-base" v-model="appForm.baseUrl" type="url" inputmode="url" placeholder="https://mygame.example.com" required />
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-1.5">
                            <Label for="new-app-prefixes">Return URL prefixes <span class="font-normal text-muted-foreground">(optional)</span></Label>
                            <TooltipProvider :delay-duration="100">
                                <Tooltip>
                                    <TooltipTrigger as-child>
                                        <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="What are return URL prefixes?"><CircleHelp class="size-3.5" /></button>
                                    </TooltipTrigger>
                                    <TooltipContent class="max-w-64">
                                        Where Polynux may redirect players after login from your own site. Defaults to Base URL + /. Separate several with commas.
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Input id="new-app-prefixes" v-model="appForm.prefixes" placeholder="Defaults to Base URL/" />
                    </div>
                    <div class="space-y-1.5">
                        <Label for="new-app-repo">Repo URL <span class="font-normal text-muted-foreground">(optional)</span></Label>
                        <Input id="new-app-repo" v-model="appForm.repoUrl" type="url" inputmode="url" placeholder="https://github.com/me/my-game" maxlength="500" />
                    </div>
                    <DialogFooter class="gap-2">
                        <Button type="button" variant="outline" @click="createOpen = false">Cancel</Button>
                        <Button type="submit" variant="chunky" :disabled="appBusy === '__create__'">Register</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <!-- Reveal newly created app API key -->
        <Dialog v-model:open="revealKeyOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>API key for {{ revealedKey?.appId }}</DialogTitle>
                    <DialogDescription>Shown once. Store it as <code class="font-mono">PNX_APP_KEY</code> on your server.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealedKey?.apiKey }}</code>
                <Button variant="chunky" @click="revealedKey && copyText(revealedKey.apiKey)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy key' }}
                </Button>
            </DialogContent>
        </Dialog>

        <!-- Reveal newly created developer token -->
        <Dialog v-model:open="revealTokenOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ revealed?.token.name }}</DialogTitle>
                    <DialogDescription>Shown once. Copy it now.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealed?.secret }}</code>
                <Button variant="chunky" @click="revealed && copyText(revealed.secret)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy token' }}
                </Button>
            </DialogContent>
        </Dialog>
    </div>
</template>
