<script setup lang="ts">
import { Check, Copy, KeyRound, Search, Shield, ShieldOff, TriangleAlert, Users } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

definePageMeta({ middleware: 'admin' })
useHead({ title: 'Players · Polynux' })

const { search, page, pages, players, total, pending, error, refresh, resetting, resetLink, changingRole, setAdmin } = useAdminPlayers()
const { me } = useMe()
const { copied, copyText } = useCopy()

const link = ref<{ name: string, url: string } | null>(null)
const linkOpen = computed({
    get: () => !!link.value,
    set: (open: boolean) => {
        if (!open) link.value = null
    }
})
async function makeLink(p: { name: string, email: string }) {
    const url = await resetLink(p.email)
    if (url) link.value = { name: p.name, url }
}

// Changing a role always asks first.
const roleChange = ref<{ id: string, name: string, admin: boolean } | null>(null)
const roleOpen = computed({
    get: () => !!roleChange.value,
    set: (open: boolean) => {
        if (!open) roleChange.value = null
    }
})
async function confirmRole() {
    const c = roleChange.value
    if (!c) return
    await setAdmin(c.id, c.admin)
    roleChange.value = null
}

const joined = (iso: string) => new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
    <div class="space-y-6">
        <h1 class="sr-only">Players</h1>
        <PnxAdminTabs />

        <div class="relative max-w-sm">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input v-model="search" type="search" placeholder="Name or email" class="pl-9" aria-label="Search players" />
        </div>

        <ul v-if="pending && players.length === 0" class="space-y-2" aria-hidden="true">
            <li v-for="i in 8" :key="i"><Skeleton class="h-14 rounded-2xl" /></li>
        </ul>
        <PnxStateBlock v-else-if="error && players.length === 0" :icon="TriangleAlert" tone="error" title="Couldn't load the players">
            <Button variant="outline" @click="refresh()">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="players.length === 0" :icon="Users" title="No players found" />

        <template v-else>
            <div class="overflow-x-auto rounded-2xl border bg-card" :class="pending ? 'opacity-60 transition-opacity' : ''">
                <Table class="min-w-[44rem]">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead class="text-right">Gems</TableHead>
                            <TableHead class="text-right">Stars</TableHead>
                            <TableHead class="pl-6">Joined</TableHead>
                            <TableHead class="w-24"><span class="sr-only">Actions</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow v-for="p in players" :key="p.id">
                            <TableCell>
                                <NuxtLink :to="`/players/${p.id}`" class="flex min-w-0 items-center gap-2.5 font-medium hover:underline">
                                    <PnxPlayerAvatar :name="p.name" :image="p.image" :emblem="p.emblem" :prestige="p.prestige" class="size-8 shrink-0" />
                                    <span class="max-w-40 truncate">{{ p.name }}</span>
                                    <Badge v-if="p.admin" variant="secondary" :title="p.adminFixed ? 'Set in ADMIN_EMAILS' : undefined">Admin</Badge>
                                </NuxtLink>
                            </TableCell>
                            <TableCell class="max-w-56 truncate text-muted-foreground">{{ p.email }}</TableCell>
                            <TableCell class="tabular text-right">{{ formatNumber(p.gems, false) }}</TableCell>
                            <TableCell class="tabular text-right">{{ p.stars }}</TableCell>
                            <TableCell class="whitespace-nowrap pl-6 text-muted-foreground">{{ joined(p.createdAt) }}</TableCell>
                            <TableCell class="whitespace-nowrap text-right">
                                <TooltipProvider :delay-duration="100">
                                    <Tooltip v-if="p.id !== me?.id && !p.adminFixed">
                                        <TooltipTrigger as-child>
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                :aria-label="p.admin ? 'Remove admin' : 'Make admin'"
                                                :disabled="changingRole === p.id"
                                                @click="roleChange = { id: p.id, name: p.name, admin: !p.admin }"
                                            >
                                                <ShieldOff v-if="p.admin" /><Shield v-else />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{{ p.admin ? 'Remove admin' : 'Make admin' }}</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger as-child>
                                            <Button size="icon-sm" variant="ghost" aria-label="Create reset link" :disabled="resetting === p.email" @click="makeLink(p)"><KeyRound /></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Reset link</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <div class="flex items-center justify-between gap-3">
                <span class="tabular text-xs text-muted-foreground">{{ total }} players</span>
                <div v-if="pages > 1" class="flex items-center gap-3">
                    <Button size="sm" variant="outline" :disabled="page <= 1" @click="page--">Previous</Button>
                    <span class="tabular text-xs text-muted-foreground">{{ page }} / {{ pages }}</span>
                    <Button size="sm" variant="outline" :disabled="page >= pages" @click="page++">Next</Button>
                </div>
            </div>
        </template>

        <Dialog v-model:open="roleOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{{ roleChange?.admin ? `Make ${roleChange?.name} an admin?` : `Remove ${roleChange?.name} as admin?` }}</DialogTitle>
                    <DialogDescription>{{ roleChange?.admin ? 'Admins can verify and disable apps, see every player and make other admins.' : 'They become a regular player.' }}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" @click="roleChange = null">Cancel</Button>
                    <Button :variant="roleChange?.admin ? 'chunky' : 'destructive'" :disabled="!!changingRole" @click="confirmRole">
                        {{ roleChange?.admin ? 'Make admin' : 'Remove admin' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="linkOpen">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reset link for {{ link?.name }}</DialogTitle>
                    <DialogDescription>1 use, 1 hour</DialogDescription>
                </DialogHeader>
                <code class="block break-all rounded-xl bg-muted p-3 font-mono text-xs">{{ link?.url }}</code>
                <Button variant="chunky" @click="link && copyText(link.url)">
                    <Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy link' }}
                </Button>
            </DialogContent>
        </Dialog>
    </div>
</template>
