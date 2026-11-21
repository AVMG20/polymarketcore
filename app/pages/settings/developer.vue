<script setup lang="ts">
import { Check, Copy, KeyRound } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Developer tokens · Polynux' })

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
</script>

<template>
    <div class="mx-auto max-w-2xl space-y-6">
        <div>
            <h1 class="text-3xl">Developer tokens</h1>
            <p class="text-sm text-muted-foreground">
                A token lets you (or your coding agent) register apps and games.
                <NuxtLink to="/developers" class="font-medium text-primary">How it works</NuxtLink>
            </p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>New token</CardTitle>
                <CardDescription class="tabular">{{ tokens.length }} / {{ max }} active</CardDescription>
            </CardHeader>
            <CardContent>
                <form class="flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="submit">
                    <div class="flex-1 space-y-2">
                        <Label for="token-name">Name</Label>
                        <Input id="token-name" v-model="tokenName" placeholder="my laptop agent" maxlength="60" required />
                    </div>
                    <Button type="submit" variant="chunky" :disabled="busy || tokens.length >= max">Create</Button>
                </form>
            </CardContent>
        </Card>

        <Skeleton v-if="pending && tokens.length === 0" class="h-24 rounded-2xl" />
        <PnxStateBlock v-else-if="tokens.length === 0" :icon="KeyRound" title="No tokens yet" text="Create one, then paste it into your agent with the brief from the developer page." />
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

        <Dialog v-model:open="revealOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ revealed?.token.name }}</DialogTitle>
                    <DialogDescription>Copy it now: it is shown once. Paste it into your agent with the brief from /developers.</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-sm">{{ revealed?.secret }}</code>
                <Button variant="chunky" @click="revealed && copyText(revealed.secret)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy token' }}
                </Button>
            </DialogContent>
        </Dialog>
    </div>
</template>
