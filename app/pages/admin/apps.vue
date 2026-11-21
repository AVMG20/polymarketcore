<script setup lang="ts">
import { Check, Code, Copy, Package, TriangleAlert } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppInfo } from '#shared/types/api'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Apps · Polynux' })

const { apps, pending, error, busy, revealedKey, refresh, create, rotateKey, update, verify, resetLink } = useAdminApps()
const { copied, copyText } = useCopy()

const resetEmail = ref('')
const resetUrl = ref<string | null>(null)
async function makeResetLink() {
    const res = await resetLink(resetEmail.value.trim())
    resetUrl.value = res?.url ?? null
}

const form = reactive({ id: '', name: '', baseUrl: '', prefixes: '' })
const { baseUrl, prefixes } = toRefs(form)
async function submit() {
    const res = await create({
        id: form.id.trim(),
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        returnUrlPrefixes: form.prefixes.split(/[\s,]+/).filter(Boolean)
    })
    if (res) Object.assign(form, { id: '', name: '', baseUrl: '', prefixes: '' })
}

const keyOpen = computed({
    get: () => !!revealedKey.value,
    set: (open: boolean) => {
        if (!open) revealedKey.value = null
    }
})

// Verify pays out bounties, rotate cuts the app off until it gets the new key, disable takes its games offline: all ask first.
const confirm = ref<{ kind: 'verify' | 'rotate' | 'disable', app: AppInfo } | null>(null)
const CONFIRM = {
    verify: { title: 'Verify', text: 'Its stars count and bounties are paid out.', action: 'Verify', variant: 'gem' },
    rotate: { title: 'Rotate the key of', text: 'The old key stops working right away. The app is cut off until it gets the new one.', action: 'Rotate key', variant: 'destructive' },
    disable: { title: 'Disable', text: 'Its games stop launching.', action: 'Disable', variant: 'destructive' }
} as const
const confirmCopy = computed(() => (confirm.value ? CONFIRM[confirm.value.kind] : null))
const confirmOpen = computed({
    get: () => !!confirm.value,
    set: (open: boolean) => {
        if (!open) confirm.value = null
    }
})
// The repo URL: set or clear it (empty clears).
const repoEdit = ref<AppInfo | null>(null)
const repoText = ref('')
function editRepo(app: AppInfo) {
    repoText.value = app.repoUrl ?? ''
    repoEdit.value = app
}
const repoOpen = computed({
    get: () => !!repoEdit.value,
    set: (open: boolean) => {
        if (!open) repoEdit.value = null
    }
})
async function saveRepo() {
    const app = repoEdit.value
    if (!app) return
    const res = await update(app.id, { repoUrl: repoText.value.trim() || null })
    if (res) repoEdit.value = null
}

async function runConfirm() {
    const c = confirm.value
    if (!c) return
    if (c.kind === 'verify') await verify(c.app.id)
    else if (c.kind === 'rotate') await rotateKey(c.app.id)
    else await update(c.app.id, { status: 'disabled' })
    confirm.value = null
}
</script>

<template>
    <div class="space-y-6">
        <h1 class="sr-only">Apps</h1>
        <PnxAdminTabs />

        <Skeleton v-if="pending && apps.length === 0" class="h-40 rounded-2xl" />
        <PnxStateBlock v-else-if="error && apps.length === 0" :icon="TriangleAlert" tone="error" title="Couldn't load the apps">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="apps.length === 0" :icon="Package" title="No apps yet" />
        <ul v-else class="grid gap-3 lg:grid-cols-2">
            <li v-for="app in apps" :key="app.id" class="space-y-3 rounded-2xl border bg-card p-4">
                <div class="flex flex-wrap items-start gap-2">
                    <div class="mr-auto min-w-0">
                        <p class="truncate font-display text-lg font-bold leading-tight">{{ app.name }}</p>
                        <p class="tabular truncate text-xs text-muted-foreground">{{ app.id }}</p>
                    </div>
                    <Badge :variant="app.status === 'active' ? 'default' : 'secondary'">{{ app.status }}</Badge>
                    <Badge :variant="app.verified ? 'default' : 'outline'">{{ app.verified ? 'verified' : 'unverified' }}</Badge>
                </div>
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt class="text-muted-foreground">URL</dt><dd class="tabular break-all">{{ app.baseUrl }}</dd>
                    <template v-if="app.returnUrlPrefixes.length">
                        <dt class="text-muted-foreground">Returns</dt>
                        <dd class="tabular break-all">{{ app.returnUrlPrefixes.join('  ') }}</dd>
                    </template>
                    <dt class="text-muted-foreground">Repo</dt>
                    <dd class="tabular break-all">
                        <a v-if="app.repoUrl" :href="app.repoUrl" target="_blank" rel="noopener noreferrer nofollow" class="underline-offset-2 hover:underline">{{ app.repoUrl }}</a>
                        <span v-else class="text-muted-foreground">none</span>
                    </dd>
                    <dt class="text-muted-foreground">Owner</dt><dd>{{ app.owner?.name ?? 'none' }}</dd>
                    <dt class="text-muted-foreground">Games</dt><dd class="tabular">{{ app.games }}</dd>
                    <dt class="text-muted-foreground">Seen</dt><dd>{{ app.lastSeenAt ? timeAgo(app.lastSeenAt) : 'never' }}</dd>
                </dl>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="!app.verified" size="sm" variant="gem" :disabled="busy" @click="confirm = { kind: 'verify', app }">Verify</Button>
                    <Button size="sm" variant="outline" :disabled="busy" @click="confirm = { kind: 'rotate', app }">Rotate key</Button>
                    <Button size="sm" variant="outline" :disabled="busy" @click="editRepo(app)"><Code /> Repo</Button>
                    <Button
                        v-if="app.status === 'active'"
                        size="sm"
                        variant="ghost"
                        class="text-destructive hover:text-destructive"
                        :disabled="busy"
                        @click="confirm = { kind: 'disable', app }"
                    >Disable</Button>
                    <Button v-else size="sm" variant="secondary" :disabled="busy" @click="update(app.id, { status: 'active' })">Enable</Button>
                </div>
            </li>
        </ul>

        <Card>
            <CardHeader><CardTitle>Register an app</CardTitle></CardHeader>
            <CardContent>
                <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="submit">
                    <div class="space-y-2">
                        <Label for="app-id">App id</Label>
                        <Input id="app-id" v-model="form.id" placeholder="casino" pattern="[a-z0-9\-]{2,40}" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="app-name">Name</Label>
                        <Input id="app-name" v-model="form.name" placeholder="Polynux Casino" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="app-base">Base URL</Label>
                        <Input id="app-base" v-model="baseUrl" placeholder="http://localhost:3200" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="app-prefixes">Return URL prefixes</Label>
                        <Input id="app-prefixes" v-model="prefixes" placeholder="http://localhost:3200/" required />
                    </div>
                    <div class="sm:col-span-2">
                        <Button type="submit" variant="chunky" :disabled="busy">Create app</Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Password reset link</CardTitle></CardHeader>
            <CardContent class="space-y-3">
                <form class="grid gap-2" @submit.prevent="makeResetLink">
                    <Label for="reset-email">Player email</Label>
                    <div class="flex items-center gap-2">
                        <Input id="reset-email" v-model="resetEmail" type="email" class="flex-1" required />
                        <Button type="submit" variant="outline" :disabled="busy">Create link</Button>
                    </div>
                </form>
                <code v-if="resetUrl" class="block break-all rounded-xl bg-muted p-3 font-mono text-xs">{{ resetUrl }}</code>
                <p v-if="resetUrl" class="text-xs text-muted-foreground">1 use, 1 hour</p>
            </CardContent>
        </Card>

        <Dialog v-model:open="keyOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>API key for {{ revealedKey?.appId }}</DialogTitle>
                    <DialogDescription>Shown once. Copy it now.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealedKey?.apiKey }}</code>
                <Button variant="chunky" @click="revealedKey && copyText(revealedKey.apiKey)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy key' }}
                </Button>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="repoOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Repo for {{ repoEdit?.name }}</DialogTitle>
                    <DialogDescription>Empty clears it</DialogDescription>
                </DialogHeader>
                <form class="space-y-4" @submit.prevent="saveRepo">
                    <div class="space-y-2">
                        <Label for="app-repo">Repo URL</Label>
                        <Input id="app-repo" v-model="repoText" type="url" placeholder="https://github.com/me/my-game" />
                    </div>
                    <DialogFooter class="gap-2">
                        <Button type="button" variant="outline" @click="repoEdit = null">Cancel</Button>
                        <Button type="submit" variant="chunky" :disabled="busy">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="confirmOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ confirmCopy?.title }} {{ confirm?.app.name }}?</DialogTitle>
                    <DialogDescription>{{ confirmCopy?.text }}</DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                    <Button variant="outline" @click="confirm = null">Cancel</Button>
                    <Button :variant="confirmCopy?.variant ?? 'destructive'" :disabled="busy" @click="runConfirm">
                        {{ confirmCopy?.action }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
