<script setup lang="ts">
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Code } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const { data, pending } = useShowcaseGames()
const games = computed(() => data.value?.games ?? [])

const track = ref<HTMLElement | null>(null)
const canPrev = ref(false)
const canNext = ref(false)
const paused = ref(false)
const scrollable = computed(() => canPrev.value || canNext.value)

function syncScroll() {
    const el = track.value
    if (!el) return
    canPrev.value = el.scrollLeft > 4
    canNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function step(dir: -1 | 1) {
    const el = track.value
    if (!el) return
    const first = el.firstElementChild as HTMLElement | null
    const distance = first ? first.offsetWidth + 16 : Math.round(el.clientWidth * 0.85)
    if (dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
        return
    }
    el.scrollBy({ left: dir * distance, behavior: 'smooth' })
}

let observer: ResizeObserver | null = null
let timer: ReturnType<typeof setInterval> | undefined

watch(track, (el) => {
    observer?.disconnect()
    observer = null
    if (!el || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(syncScroll)
    observer.observe(el)
    syncScroll()
}, { immediate: true, flush: 'post' })

onMounted(() => {
    syncScroll()
    timer = setInterval(() => {
        if (paused.value || !scrollable.value) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        step(1)
    }, 4500)
})

watch(games, () => nextTick(syncScroll))

onBeforeUnmount(() => {
    observer?.disconnect()
    clearInterval(timer)
})

const fadeMask = computed(() => (canNext.value ? 'linear-gradient(to right, black calc(100% - 36px), transparent)' : undefined))
</script>

<template>
    <div class="flex min-h-[calc(100dvh-9rem)] flex-col justify-center gap-9 py-4 sm:gap-10 sm:py-6">
        <section class="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div
                class="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-[min(42rem,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl dark:opacity-45"
                aria-hidden="true"
                style="background: radial-gradient(circle at 38% 42%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 62%), radial-gradient(circle at 68% 60%, color-mix(in oklch, var(--gem) 20%, transparent), transparent 58%)"
            />
            <h1 class="font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl">
                All your games. <span class="whitespace-nowrap text-primary">One place.</span>
            </h1>
            <p class="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
                Play free in your browser — no downloads.
            </p>
            <div class="mt-7 flex w-full max-w-xs flex-col items-stretch justify-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center">
                <Button variant="chunky" size="lg" as-child>
                    <NuxtLink to="/register">Play free <ArrowRight /></NuxtLink>
                </Button>
                <Button variant="outline" size="lg" as-child>
                    <NuxtLink to="/login">Sign in</NuxtLink>
                </Button>
            </div>
        </section>

        <section
            v-if="pending || games.length"
            aria-label="Games on Polynux"
            class="mx-auto w-full space-y-4"
            :class="games.length > 0 && games.length <= 2 ? 'max-w-2xl' : ''"
            @mouseenter="paused = true"
            @mouseleave="paused = false"
            @focusin="paused = true"
            @focusout="paused = false"
        >
            <div class="flex items-center justify-between gap-3">
                <h2 class="text-xl sm:text-2xl">Games on Polynux</h2>
                <div v-if="scrollable" class="flex items-center gap-1.5">
                    <Button
                        variant="outline"
                        size="icon-sm"
                        class="rounded-full"
                        :disabled="!canPrev"
                        aria-label="Previous games"
                        @click="step(-1)"
                    >
                        <ChevronLeft class="size-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-sm"
                        class="rounded-full"
                        :disabled="!canNext"
                        aria-label="Next games"
                        @click="step(1)"
                    >
                        <ChevronRight class="size-4" />
                    </Button>
                </div>
            </div>

            <div v-if="pending && !games.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                <Skeleton v-for="i in 3" :key="i" class="h-56 rounded-2xl" />
            </div>

            <div
                v-else
                ref="track"
                class="-my-2 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                :style="fadeMask ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined"
                @scroll.passive="syncScroll"
            >
                <div
                    v-for="game in games"
                    :key="game.slug"
                    class="shrink-0 snap-start"
                    :class="games.length <= 2
                        ? 'w-[80vw] max-w-[320px] sm:w-[calc((100%-1rem)/2)] sm:max-w-none'
                        : 'w-[80vw] max-w-[310px] sm:w-[312px] lg:w-[332px]'"
                >
                    <HomeShowcaseCard :game="game" />
                </div>
            </div>
        </section>

        <section
            aria-label="Add your own game"
            class="mx-auto w-full"
            :class="games.length > 0 && games.length <= 2 ? 'max-w-2xl' : ''"
        >
            <div class="flex flex-col justify-between gap-4 rounded-2xl border bg-card/80 px-5 py-4 backdrop-blur-xs sm:flex-row sm:items-center sm:px-6">
                <div class="flex items-center gap-3.5">
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                        <Code class="size-5" aria-hidden="true" />
                    </span>
                    <div class="min-w-0">
                        <p class="font-display text-base font-bold leading-tight">Build your own game</p>
                        <p class="mt-0.5 text-sm text-muted-foreground">Add any web game in minutes — or let an agent build it for you.</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" class="self-start sm:self-center" as-child>
                    <NuxtLink to="/developers">Add a game <ArrowUpRight /></NuxtLink>
                </Button>
            </div>
        </section>
    </div>
</template>
