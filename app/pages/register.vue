<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STARTER_GEMS } from '#shared/economy'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Create account · Polynux' })

const name = ref('')
const email = ref('')
const password = ref('')
const { signUp, signInWithDiscord, pending, error, redirectTarget } = useAuthActions()
const { data: config } = useHubConfig()
</script>

<template>
    <div class="mx-auto max-w-sm pt-2 sm:pt-12">
        <Card class="rounded-2xl">
            <CardHeader>
                <CardTitle class="font-display text-2xl">Create your account</CardTitle>
                <CardDescription class="flex items-center gap-1.5">
                    Start with <PnxGemChip :amount="STARTER_GEMS" />
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form class="space-y-4" @submit.prevent="signUp(name, email, password)">
                    <div class="space-y-2">
                        <Label for="name">Name</Label>
                        <Input id="name" v-model="name" maxlength="30" autocomplete="nickname" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="email">Email</Label>
                        <Input id="email" v-model="email" type="email" autocomplete="email" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="password">Password</Label>
                        <Input id="password" v-model="password" type="password" minlength="8" autocomplete="new-password" required />
                    </div>
                    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
                    <Button type="submit" variant="chunky" class="w-full" :disabled="pending">Create account</Button>
                    <Button v-if="config?.discord" type="button" variant="outline" class="w-full" @click="signInWithDiscord">
                        Continue with Discord
                    </Button>
                </form>
                <p class="mt-4 text-center text-sm text-muted-foreground">
                    Have an account?
                    <NuxtLink :to="{ path: '/login', query: { redirect: redirectTarget } }" class="font-medium text-primary">Sign in</NuxtLink>
                </p>
            </CardContent>
        </Card>
    </div>
</template>
