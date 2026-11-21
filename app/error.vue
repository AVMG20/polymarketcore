<script setup lang="ts">
import { Compass, TriangleAlert } from 'lucide-vue-next'
import type { NuxtError } from '#app'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

// The error page replaces app.vue, so it brings its own layout and Toaster.
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useHead({ title: () => `${notFound.value ? 'Not found' : 'Error'} · Polynux` })
const colorMode = useColorMode()
const toastTheme = computed(() => (colorMode.value === 'light' ? 'light' : 'dark'))
const home = () => clearError({ redirect: '/' })
</script>

<template>
    <NuxtLayout>
        <div class="mx-auto flex max-w-sm flex-col items-center gap-3 pt-8 text-center sm:pt-16">
            <span class="flex size-16 items-center justify-center rounded-3xl" :class="notFound ? 'bg-primary/15 text-primary' : 'bg-destructive/10 text-destructive'">
                <component :is="notFound ? Compass : TriangleAlert" class="size-8" aria-hidden="true" />
            </span>
            <p class="tabular text-5xl font-bold">{{ notFound ? '404' : error.statusCode || '500' }}</p>
            <h1 class="text-xl">{{ notFound ? 'Not found' : 'Something broke' }}</h1>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
                <Button variant="chunky" @click="home">Home</Button>
                <Button v-if="!notFound" variant="outline" @click="reloadNuxtApp()">Retry</Button>
            </div>
        </div>
    </NuxtLayout>
    <Toaster rich-colors position="top-center" :theme="toastTheme" />
</template>
