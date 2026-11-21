<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

useHead({ title: 'New password · Polynux' })

// Opened from a one-time link an admin created (there is no email provider).
const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const password = ref('')
const pending = ref(false)
const error = ref<string | null>(null)

async function submit() {
    pending.value = true
    error.value = null
    try {
        const res = await authClient.resetPassword({ newPassword: password.value, token: token.value })
        if (res.error) {
            error.value = res.error.message || 'This link is invalid or has expired'
            return
        }
        await navigateTo('/login')
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
                <p v-if="!token" class="text-sm text-destructive">This link is missing its token.</p>
                <form v-else class="space-y-4" @submit.prevent="submit">
                    <div class="space-y-2">
                        <Label for="password">New password</Label>
                        <Input id="password" v-model="password" type="password" minlength="8" autocomplete="new-password" required />
                    </div>
                    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
                    <Button type="submit" variant="chunky" class="w-full" :disabled="pending">Save password</Button>
                </form>
            </CardContent>
        </Card>
    </div>
</template>
