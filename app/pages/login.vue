<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

definePageMeta({ middleware: 'guest' })
useHead({ title: 'Sign in · Polynux' })

const email = ref('')
const password = ref('')
const { signIn, signInWithDiscord, pending, error, redirectTarget } = useAuthActions()
const { data: config } = useHubConfig()
</script>

<template>
    <div class="mx-auto max-w-sm pt-2 sm:pt-12">
        <Card class="rounded-2xl">
            <CardHeader>
                <CardTitle class="font-display text-2xl">Welcome back</CardTitle>
                <CardDescription>Sign in to play.</CardDescription>
            </CardHeader>
            <CardContent>
                <form class="space-y-4" @submit.prevent="signIn(email, password)">
                    <div class="space-y-2">
                        <Label for="email">Email</Label>
                        <Input id="email" v-model="email" type="email" autocomplete="email" required />
                    </div>
                    <div class="space-y-2">
                        <Label for="password">Password</Label>
                        <Input id="password" v-model="password" type="password" autocomplete="current-password" required />
                    </div>
                    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
                    <Button type="submit" variant="chunky" class="w-full" :disabled="pending">Sign in</Button>
                    <Button v-if="config?.discord" type="button" variant="outline" class="w-full" @click="signInWithDiscord">
                        Continue with Discord
                    </Button>
                </form>
                <p class="mt-4 text-center text-sm text-muted-foreground">
                    New here?
                    <NuxtLink :to="{ path: '/register', query: { redirect: redirectTarget } }" class="font-medium text-primary">Create an account</NuxtLink>
                </p>
            </CardContent>
        </Card>
    </div>
</template>
