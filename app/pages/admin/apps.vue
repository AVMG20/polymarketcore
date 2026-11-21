<script setup lang="ts">
import { Check, Copy, Package, TriangleAlert } from 'lucide-vue-next'
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

// Verify pays out bounties and disable takes the app's games offline: both ask first.
const confirm = ref<{ kind: 'verify' | 'disable', app: AppInfo } | null>(null)
const confirmOpen = computed({
    get: () => !!confirm.value,
    set: (open: boolean) => {
        if (!open) confirm.value = null
    }
})
async function runConfirm() {
    const c = confirm.value
    if (!c) return
    if (c.kind === 'verify') await verify(c.app.id)
    else await update(c.app.id, { status: 'disabled' })
    confirm.value = null
}
</script>

<template>
    <div class="space-y-6">
        <h1 class="text-3xl">Apps</h1>

        <Skeleton v-if="pending && apps.length === 0" class="h-40 rounded-2xl" />
        <PnxStateBlock v-else-if="error && apps.length === 0" :icon="TriangleAlert" tone="error" title="Couldn't load the apps" text="Check your connection and try again.">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="apps.length === 0" :icon="Package" title="No apps yet" text="Register one below, or have a player create one with a developer token." />
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
                    <dt class="text-muted-foreground">Owner</dt><dd>{{ app.owner?.name ?? 'none' }}</dd>
                    <dt class="text-muted-foreground">Games</dt><dd class="tabular">{{ app.games }}</dd>
                    <dt class="text-muted-foreground">Seen</dt><dd>{{ app.lastSeenAt ? timeAgo(app.lastSeenAt) : 'never' }}</dd>
                </dl>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="!app.verified" size="sm" variant="gem" :disabled="busy" @click="confirm = { kind: 'verify', app }">Verify</Button>
                    <Button size="sm" variant="outline" :disabled="busy" @click="rotateKey(app.id)">Rotate key</Button>
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
                <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="makeResetLink">
                    <div class="flex-1 space-y-2">
                        <Label for="reset-email">Player email</Label>
                        <Input id="reset-email" v-model="resetEmail" type="email" required />
                    </div>
                    <Button type="submit" variant="outline" :disabled="busy">Create link</Button>
                </form>
                <code v-if="resetUrl" class="block break-all rounded-xl bg-muted p-3 font-mono text-xs">{{ resetUrl }}</code>
                <p v-if="resetUrl" class="text-xs text-muted-foreground">One use, valid for an hour. Send it to the player yourself.</p>
            </CardContent>
        </Card>

        <Dialog v-model:open="keyOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>API key for {{ revealedKey?.appId }}</DialogTitle>
                    <DialogDescription>Copy it now. It is shown once and can't be retrieved again.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealedKey?.apiKey }}</code>
                <Button variant="chunky" @click="revealedKey && copyText(revealedKey.apiKey)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy key' }}
                </Button>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="confirmOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ confirm?.kind === 'verify' ? 'Verify' : 'Disable' }} {{ confirm?.app.name }}?</DialogTitle>
                    <DialogDescription v-if="confirm?.kind === 'verify'">Its stars start to count, and every outstanding star bounty is paid out once.</DialogDescription>
                    <DialogDescription v-else>Its games stop launching until you enable it again.</DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                    <Button variant="outline" @click="confirm = null">Cancel</Button>
                    <Button :variant="confirm?.kind === 'verify' ? 'gem' : 'destructive'" :disabled="busy" @click="runConfirm">
                        {{ confirm?.kind === 'verify' ? 'Verify' : 'Disable' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
</template>
