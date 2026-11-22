<script setup lang="ts">
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Sign in · Polynux' })

const email = ref('')
const password = ref('')
const { signIn, signInWithDiscord, pending, error, redirectTarget } = useAuthActions()
const { data: config } = await useHubConfig()
</script>

<template>
    <PnxAuthCard title="Welcome back">
        <template #subtitle>Sign in to play</template>

        <form class="space-y-4" @submit.prevent="signIn(email, password)">
            <div class="space-y-1.5">
                <Label for="email" class="text-[13px] font-medium text-foreground/90">Email</Label>
                <Input
                    id="email"
                    v-model="email"
                    type="email"
                    autocomplete="email"
                    placeholder="you@example.com"
                    required
                    class="h-11 rounded-sm bg-background/70 px-3.5 text-base placeholder:text-muted-foreground/65 transition-[color,box-shadow,border-color] hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 dark:bg-background/50 sm:text-sm"
                />
            </div>

            <div class="space-y-1.5">
                <Label for="password" class="text-[13px] font-medium text-foreground/90">Password</Label>
                <PnxPasswordInput
                    id="password"
                    v-model="password"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    required
                />
            </div>

            <div
                v-if="error"
                role="alert"
                class="flex items-start gap-2 rounded-sm border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
                <AlertCircle class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{{ error }}</span>
            </div>

            <Button type="submit" variant="chunky" size="lg" class="mt-1 w-full text-[15px]" :disabled="pending">
                <Loader2 v-if="pending" class="size-4 animate-spin" aria-hidden="true" />
                Sign in
            </Button>
        </form>

        <template v-if="config?.discord">
            <div class="my-5 flex items-center gap-3" aria-hidden="true">
                <span class="h-px flex-1 bg-border" />
                <span class="text-xs font-medium text-muted-foreground">or</span>
                <span class="h-px flex-1 bg-border" />
            </div>
            <PnxDiscordButton :disabled="pending" @click="signInWithDiscord" />
        </template>

        <template #footer>
            New here?
            <NuxtLink
                :to="{ path: '/register', query: { redirect: redirectTarget } }"
                class="font-medium text-primary underline-offset-4 hover:underline"
            >
                Create an account
            </NuxtLink>
        </template>
    </PnxAuthCard>
</template>
