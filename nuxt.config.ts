import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: false },

    modules: [
        'shadcn-nuxt',
        '@nuxtjs/color-mode',
        './modules/sentry-sourcemaps'
    ],

    css: ['~/assets/css/main.css'],

    // Error tracking and performance (Rustrak, Sentry-compatible). Off unless NUXT_PUBLIC_SENTRY_DSN is set;
    // NUXT_PUBLIC_SENTRY_ENVIRONMENT defaults to development/production, NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
    // is the share of requests and page loads traced (0 to 1).
    runtimeConfig: {
        public: {
            sentryDsn: '',
            sentryEnvironment: '',
            sentryTracesSampleRate: 0.2
        }
    },

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
        // /api/presence: live "playing now" counts on the game cards.
        experimental: { websocket: true },
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
            link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=2' }]
        }
    }
})
