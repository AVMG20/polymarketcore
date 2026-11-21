<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

useHead({ title: 'New password · Polynux' })

// Opened from a one-time link an admin created (there is no email provider).
const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const confirm = ref('')
const pending = ref(false)
const done = ref(false)
const error = ref<string | null>(null)
const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value)

async function submit() {
    if (password.value !== confirm.value) return
    pending.value = true
    error.value = null
    try {
        const res = await authClient.resetPassword({ newPassword: password.value, token: token.value })
        if (res.error) {
            error.value = res.error.message || 'This link is invalid or has expired'
            return
        }
        done.value = true
    } catch (e) {
        error.value = apiErrorMessage(e, 'This link is invalid or has expired')
    } finally {
        pending.value = false
    }
}
</script>

<template>
    <div class="mx-auto max-w-sm pt-2 sm:pt-12">
        <Card class="rounded-2xl">
            <CardHeader><CardTitle class="font-display text-2xl">Choose a new password</CardTitle></CardHeader>
            <CardContent>
                <div v-if="done" class="flex flex-col items-center gap-4 py-2 text-center">
                    <span class="flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success"><Check class="size-6" aria-hidden="true" /></span>
                    <p class="font-display text-lg font-bold" role="status">Password changed</p>
                    <Button variant="chunky" class="w-full" as-child><NuxtLink to="/login">Sign in</NuxtLink></Button>
                </div>
                <p v-else-if="!token" class="text-sm text-destructive" role="alert">Invalid link</p>
                <form v-else class="space-y-4" @submit.prevent="submit">
                    <div class="space-y-2">
                        <Label for="password">New password</Label>
                        <Input id="password" v-model="password" type="password" minlength="8" autocomplete="new-password" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="confirm">Confirm password</Label>
                        <Input id="confirm" v-model="confirm" type="password" minlength="8" autocomplete="new-password" :aria-invalid="mismatch || undefined" required />
                    </div>
                    <p v-if="mismatch" class="text-sm text-destructive" role="alert">Passwords don't match</p>
                    <p v-else-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
                    <Button type="submit" variant="chunky" class="w-full" :disabled="pending || mismatch">Save password</Button>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
