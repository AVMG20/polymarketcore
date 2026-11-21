<script setup lang="ts">
import { Check, Paintbrush } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

definePageMeta({ middleware: 'auth' })
useHead({ title: 'Settings · Polynux' })

const { me } = useMe()
const { name, image, pending, error, save } = useProfile()
const { data: config } = useHubConfig()
const { loaded: accountsLoaded, pending: pwPending, error: pwError, linkError, saved: pwSaved, hasPassword, discordLinked, changePassword, linkDiscord } = useAccountSecurity()

const profileSaved = ref(false)
async function saveProfile() {
    if (await save()) {
        profileSaved.value = true
        setTimeout(() => (profileSaved.value = false), 2000)
    }
}

const current = ref('')
const next = ref('')
async function submitPassword() {
    if (await changePassword(current.value, next.value)) {
        current.value = ''
        next.value = ''
    }
}
</script>

<template>
    <div class="mx-auto max-w-xl space-y-6">
        <h1 class="text-3xl">Settings</h1>

        <Card>
            <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Games see your new name and avatar the next time you open them.</CardDescription>
            </CardHeader>
            <CardContent>
                <form class="space-y-4" @submit.prevent="saveProfile">
                    <div class="flex items-center gap-4">
                        <PnxPlayerAvatar :name="name || me?.name || '?'" :image="image" :emblem="me?.emblem" :prestige="me?.prestige" class="size-14 text-xl" />
                        <div class="min-w-0 flex-1 space-y-2">
                            <Label for="name">Name</Label>
                            <Input id="name" v-model="name" maxlength="30" required />
                        </div>
                    </div>
                    <div class="space-y-2">
                        <Label for="image">Avatar URL</Label>
                        <Input id="image" v-model="image" type="url" placeholder="https://…/me.png" />
                    </div>
                    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
                    <Button type="submit" variant="chunky" :disabled="pending">
                        <Check v-if="profileSaved" /> {{ profileSaved ? 'Saved' : 'Save' }}
                    </Button>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Emblem</CardTitle>
                <CardDescription>{{ me?.emblem ? 'Your drawn avatar. It shows instead of your picture.' : 'Draw your own avatar.' }}</CardDescription>
            </CardHeader>
            <CardContent class="flex items-center gap-4">
                <PnxPlayerAvatar :name="me?.name || '?'" :image="me?.image" :emblem="me?.emblem" :prestige="me?.prestige" class="size-12 text-lg" />
                <Button variant="outline" as-child><NuxtLink to="/settings/emblem"><Paintbrush /> {{ me?.emblem ? 'Edit emblem' : 'Draw emblem' }}</NuxtLink></Button>
            </CardContent>
        </Card>

        <Card v-if="hasPassword">
            <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Changing it signs you out everywhere else.</CardDescription>
            </CardHeader>
            <CardContent>
                <form class="space-y-4" @submit.prevent="submitPassword">
                    <div class="space-y-2">
                        <Label for="current-password">Current password</Label>
                        <Input id="current-password" v-model="current" type="password" autocomplete="current-password" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="new-password">New password</Label>
                        <Input id="new-password" v-model="next" type="password" minlength="8" autocomplete="new-password" required />
                    </div>
                    <p v-if="pwError" class="text-sm text-destructive" role="alert">{{ pwError }}</p>
                    <Button type="submit" variant="chunky" :disabled="pwPending">
                        <Check v-if="pwSaved" /> {{ pwSaved ? 'Changed' : 'Change password' }}
                    </Button>
                </form>
            </CardContent>
        </Card>

        <Card v-if="config?.discord">
            <CardHeader>
                <CardTitle>Discord</CardTitle>
                <CardDescription>{{ discordLinked ? 'Linked. You can sign in with it.' : 'Link it to sign in with one click.' }}</CardDescription>
            </CardHeader>
            <CardContent>
                <Button v-if="!discordLinked" variant="outline" :disabled="!accountsLoaded" @click="linkDiscord()">Link Discord</Button>
                <p v-else class="flex items-center gap-1.5 text-sm text-success"><Check class="size-4" /> Connected</p>
                <p v-if="linkError" class="mt-2 text-sm text-destructive" role="alert">{{ linkError }}</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Developer</CardTitle>
                <CardDescription>Connect your own game to Polynux.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-2">
                <Button variant="outline" as-child><NuxtLink to="/settings/developer">Developer tokens</NuxtLink></Button>
                <Button variant="ghost" as-child><NuxtLink to="/developers">How it works</NuxtLink></Button>
            </CardContent>
        </Card>
    </div>
</template>
