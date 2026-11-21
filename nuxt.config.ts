import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: false },

    modules: [
        'shadcn-nuxt',
        '@nuxtjs/color-mode'
    ],

    css: ['~/assets/css/main.css'],

    // shadcn-nuxt registers app/components/ui itself (Button, Card, …); every
    // other folder is prefixed by its path (pnx/GemChip.vue → <PnxGemChip>).
    components: [
        { path: '~/components', extensions: ['vue'], ignore: ['ui/**'] }
    ],

    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['better-auth/vue', 'reka-ui', 'vue-sonner', 'lucide-vue-next', '@vueuse/core', 'class-variance-authority', 'clsx', 'tailwind-merge']
        }
    },

    shadcn: {
        prefix: '',
        componentDir: './app/components/ui'
    },

    colorMode: {
        classSuffix: '',
        preference: 'dark',
        fallback: 'dark'
    },

    nitro: {
        // Production serves on Bun (Dockerfile, `bun run preview`).
        preset: 'bun',
        // Served raw: /developers.md (one source with the /developers copy block) and the reference game.
        // `dir` is relative to server/.
        serverAssets: [
            { baseName: 'guide', dir: '../shared/guide' },
            { baseName: 'hello-game', dir: '../examples/hello-game' }
        ]
    },

    app: {
        head: {
            title: 'Polynux',
            meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
            link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
        }
    }
})
