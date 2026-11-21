<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'

// vue-sonner's stylesheet is imported in assets/css/main.css.
const colorMode = useColorMode()
// Notches: let the layout use env(safe-area-inset-*).
useHead({ meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }] })
const toastTheme = computed(() => (colorMode.value === 'light' ? 'light' : 'dark'))
</script>

<template>
    <NuxtLayout>
        <NuxtPage />
    </NuxtLayout>
    <Toaster rich-colors position="top-center" :theme="toastTheme" />
</template>
