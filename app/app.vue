<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'

// vue-sonner's stylesheet is imported in assets/css/main.css.
const colorMode = useColorMode()
// Notches: let the layout use env(safe-area-inset-*).
useHead({ meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }] })
// Link previews: no logo file exists, so the card is text only.
const TITLE = 'Polynux'
const DESCRIPTION = 'Free games, one gem wallet, one leaderboard.'
useHead({
    meta: [
        { name: 'description', content: DESCRIPTION },
        { name: 'theme-color', content: '#7c5cf0' },
        { property: 'og:site_name', content: TITLE },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION }
    ]
})
const toastTheme = computed(() => (colorMode.value === 'light' ? 'light' : 'dark'))
</script>

<template>
    <!-- html sets scrollbar-gutter: stable, so dialogs must not add extra body padding on scroll lock. -->
    <ConfigProvider :scroll-body="false">
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
        <Toaster rich-colors position="top-center" :theme="toastTheme" />
    </ConfigProvider>
</template>
