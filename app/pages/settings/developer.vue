<script setup lang="ts">
import { Check, Copy, KeyRound, Package } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'vue-sonner'
import type { AppInfo, MyAppsResponse } from '#shared/types/api'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Developer · Polynux' })

const { tokens, max, pending, busy, revealed, create, revoke } = useDeveloperTokens()
const tokenName = ref('')

async function submit() {
    if (await create(tokenName.value.trim())) tokenName.value = ''
}

const revealOpen = computed({
    get: () => !!revealed.value,
    set: (open: boolean) => {
        if (!open) revealed.value = null
    }
})
const { copied, copyText } = useCopy()

const { data: appsData, pending: appsPending } = useAsyncData('pnx-my-apps', () => apiFetch<MyAppsResponse>('/api/me/apps'))
const myApps = computed(() => appsData.value?.apps ?? [])
const appBusy = ref<string | null>(null)
// Disabling takes the app's games offline: ask first.
const disabling = ref<AppInfo | null>(null)
const disableOpen = computed({
    get: () => !!disabling.value,
    set: (open: boolean) => {
        if (!open) disabling.value = null
    }
})
async function setStatus(app: AppInfo, status: 'active' | 'disabled') {
    appBusy.value = app.id
    try {
        const res = await apiFetch<{ app: AppInfo }>(`/api/me/apps/${encodeURIComponent(app.id)}`, { method: 'PATCH', body: { status } })
        if (appsData.value) appsData.value = { apps: appsData.value.apps.map(a => (a.id === app.id ? res.app : a)) }
        disabling.value = null
    } catch (e) {
        toast.error(apiErrorMessage(e, 'Could not update the app'))
    } finally {
        appBusy.value = null
    }
}
</script>

<template>
    <div class="space-y-6">
        <div class="flex items-center justify-between gap-3">
            <h1 class="text-3xl">Developer tokens</h1>
            <Button variant="ghost" size="sm" as-child><NuxtLink to="/developers">Guide</NuxtLink></Button>
        </div>

        <div class="grid items-start gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>New token</CardTitle>
                    <CardDescription class="tabular">{{ tokens.length }} / {{ max }} active</CardDescription>
                </CardHeader>
                <CardContent>
                    <form class="grid gap-2" @submit.prevent="submit">
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

        <section class="space-y-3">
            <h2 class="text-xl">Your apps</h2>
            <Skeleton v-if="appsPending && myApps.length === 0" class="h-24 rounded-2xl" />
            <PnxStateBlock v-else-if="myApps.length === 0" :icon="Package" title="No apps yet" />
            <ul v-else class="grid gap-4 lg:grid-cols-2">
                <li v-for="app in myApps" :key="app.id" class="space-y-3 rounded-2xl border bg-card p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="truncate font-display text-lg font-bold leading-tight">{{ app.name }}</p>
                            <p class="tabular text-xs text-muted-foreground">{{ app.id }}</p>
                        </div>
                        <div class="flex shrink-0 flex-wrap justify-end gap-1">
                            <Badge v-if="app.status !== 'active'" variant="destructive">disabled</Badge>
                            <Badge :variant="app.verified ? 'default' : 'secondary'" :title="app.verified ? 'Listed for everyone' : 'Only you see its games until an admin verifies it'">{{ app.verified ? 'verified' : 'unverified' }}</Badge>
                        </div>
                    </div>
                    <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt class="text-muted-foreground">URL</dt>
                        <dd class="tabular break-all"><a :href="app.baseUrl" target="_blank" rel="noopener noreferrer" class="underline-offset-2 hover:underline">{{ app.baseUrl }}</a></dd>
                        <dt class="text-muted-foreground">Games</dt><dd class="tabular">{{ app.games }}</dd>
                        <dt class="text-muted-foreground">Seen</dt><dd>{{ app.lastSeenAt ? timeAgo(app.lastSeenAt) : 'never' }}</dd>
                    </dl>
                    <div class="flex items-center gap-2">
                        <Button
                            v-if="app.status === 'active'"
                            size="sm"
                            variant="ghost"
                            class="text-destructive hover:text-destructive"
                            :disabled="appBusy === app.id"
                            @click="disabling = app"
                        >Disable</Button>
                        <Button v-else-if="!app.disabledByAdmin" size="sm" variant="secondary" :disabled="appBusy === app.id" @click="setStatus(app, 'active')">Enable</Button>
                        <span v-else class="text-xs text-muted-foreground">Disabled by an admin</span>
                    </div>
                </li>
            </ul>
        </section>

        <Dialog v-model:open="disableOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Disable {{ disabling?.name }}?</DialogTitle>
                    <DialogDescription>Its games go offline until you enable it again.</DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                    <Button variant="outline" @click="disabling = null">Cancel</Button>
                    <Button variant="destructive" :disabled="!!appBusy" @click="disabling && setStatus(disabling, 'disabled')">Disable</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="revealOpen">
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
