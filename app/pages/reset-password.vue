<script setup lang="ts">
import { AlertCircle, Check, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
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
    <PnxAuthCard :title="done ? 'Password changed' : 'New password'">
        <div v-if="done" class="flex flex-col items-center gap-5 pt-1 text-center">
            <span class="flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success ring-1 ring-inset ring-success/25">
                <Check class="size-6" aria-hidden="true" />
            </span>
            <p class="sr-only" role="status">Password changed</p>
            <Button variant="chunky" size="lg" class="w-full text-[15px]" as-child>
                <NuxtLink to="/login">Sign in</NuxtLink>
            </Button>
        </div>

        <div v-else-if="!token" class="space-y-4">
            <div
                role="alert"
                class="flex items-center justify-center gap-2 rounded-sm border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
            >
                <AlertCircle class="size-4 shrink-0" aria-hidden="true" />
                <span>Invalid link</span>
            </div>
            <Button variant="outline" size="lg" class="w-full rounded-xl" as-child>
                <NuxtLink to="/login">Back to sign in</NuxtLink>
            </Button>
        </div>

        <form v-else class="space-y-4" @submit.prevent="submit">
            <div class="space-y-1.5">
                <Label for="password" class="text-[13px] font-medium text-foreground/90">New password</Label>
                <PnxPasswordInput
                    id="password"
                    v-model="password"
                    minlength="8"
                    autocomplete="new-password"
                    placeholder="At least 8 characters"
                    required
                />
            </div>

            <div class="space-y-1.5">
                <Label for="confirm" class="text-[13px] font-medium text-foreground/90">Confirm password</Label>
                <PnxPasswordInput
                    id="confirm"
                    v-model="confirm"
                    minlength="8"
                    autocomplete="new-password"
                    placeholder="Repeat password"
                    :aria-invalid="mismatch || undefined"
                    required
                />
            </div>

            <div
                v-if="mismatch || error"
                role="alert"
                class="flex items-start gap-2 rounded-sm border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
                <AlertCircle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{{ mismatch ? "Passwords don't match" : error }}</span>
            </div>

            <Button type="submit" variant="chunky" size="lg" class="mt-1 w-full text-[15px]" :disabled="pending || mismatch">
                <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
                Save password
            </Button>
        </form>

        <template v-if="!done && token" #footer>
            <NuxtLink to="/login" class="font-medium text-primary underline-offset-4 hover:underline">
                Back to sign in
            </NuxtLink>
        </template>
    </PnxAuthCard>
</template>
