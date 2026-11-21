<script setup lang="ts">
import { Check, Paintbrush } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
const confirmNext = ref('')
const mismatch = computed(() => confirmNext.value.length > 0 && confirmNext.value !== next.value)
async function submitPassword() {
    if (next.value !== confirmNext.value) return
    if (await changePassword(current.value, next.value)) {
        current.value = ''
        next.value = ''
        confirmNext.value = ''
    }
}
</script>

<template>
    <div class="space-y-6">
        <h1 class="text-3xl">Settings</h1>

        <div class="grid items-start gap-6 lg:grid-cols-2">
            <div class="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
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
                    </CardHeader>
                    <CardContent class="flex items-center gap-4">
                        <PnxPlayerAvatar :name="me?.name || '?'" :image="me?.image" :emblem="me?.emblem" :prestige="me?.prestige" class="size-12 text-lg" />
                        <Button variant="outline" as-child><NuxtLink to="/settings/emblem"><Paintbrush /> {{ me?.emblem ? 'Edit emblem' : 'Draw emblem' }}</NuxtLink></Button>
                    </CardContent>
                </Card>
            </div>

            <div class="space-y-6">
                <Card v-if="hasPassword">
                    <CardHeader>
                        <CardTitle>Password</CardTitle>
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
                            <div class="space-y-2">
                                <Label for="confirm-password">Confirm password</Label>
                                <Input id="confirm-password" v-model="confirmNext" type="password" minlength="8" autocomplete="new-password" :aria-invalid="mismatch || undefined" required />
                            </div>
                            <p v-if="mismatch" class="text-sm text-destructive" role="alert">Passwords don't match</p>
                            <p v-else-if="pwError" class="text-sm text-destructive" role="alert">{{ pwError }}</p>
                            <Button type="submit" variant="chunky" :disabled="pwPending || mismatch">
                                <Check v-if="pwSaved" /> {{ pwSaved ? 'Changed' : 'Change password' }}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card v-if="config?.discord">
                    <CardHeader>
                        <CardTitle>Discord</CardTitle>
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
                    </CardHeader>
                    <CardContent class="flex flex-wrap gap-2">
                        <Button variant="outline" as-child><NuxtLink to="/settings/developer">Developer tokens</NuxtLink></Button>
                        <Button variant="ghost" as-child><NuxtLink to="/developers">Guide</NuxtLink></Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
</template>
