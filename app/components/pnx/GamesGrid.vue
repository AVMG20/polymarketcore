<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gamepad2, GripVertical, Shield } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import { groupGameSections } from '#shared/game-sections'
import type { GameSummary } from '#shared/types/api'

/**
 * Games, sectioned: verified ("Games"), unverified ("New" for yours,
 * "Unverified" for others an admin sees), and drafts ("Your drafts" vs
 * "Other drafts" for admins), each in the incoming order.
 * `untitledFirst` drops the "Games" heading when that section comes first.
 * `editing`: cards move by drag (pointer events, so touch works: from the grip
 * on touch, anywhere with a mouse) or with the arrow buttons and keys. Every
 * move emits `move(slug, toSlug)` within a section; the parent reorders.
 * `limit` caps the cards shown across all sections (in section order); when
 * some are cut, the first heading links to `moreTo`.
 */
const props = defineProps<{ games: GameSummary[], pending?: boolean, error?: boolean, untitledFirst?: boolean, editing?: boolean, limit?: number, moreTo?: string }>()
const emit = defineEmits<{ retry: [], move: [slug: string, to: string] }>()
const { me } = useMe()

const allSections = computed(() => groupGameSections(props.games, me.value?.id ?? null))

const sections = computed(() => {
    let left = props.limit ?? Number.POSITIVE_INFINITY
    return allSections.value
        .map((s) => {
            const games = s.games.slice(0, Math.max(0, left))
            left -= games.length
            return { ...s, games }
        })
        .filter(s => s.games.length > 0)
})
const truncated = computed(() => allSections.value.reduce((n, s) => n + s.games.length, 0) > sections.value.reduce((n, s) => n + s.games.length, 0))

const sectionOf = (slug: string) => sections.value.find(s => s.games.some(g => g.slug === slug))?.games ?? []

const els = new Map<string, HTMLElement>()
function setEl(slug: string, el: unknown) {
    if (el instanceof HTMLElement) els.set(slug, el)
    else els.delete(slug)
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const announcement = ref('')
function announce(slug: string) {
    const list = sectionOf(slug)
    const i = list.findIndex(g => g.slug === slug)
    if (i >= 0) announcement.value = `${list[i]!.name}: ${i + 1} / ${list.length}`
}

/** Move, then slide the other cards from where they were to their new place (FLIP). */
async function moveAnimated(slug: string, to: string) {
    const before = new Map<string, { x: number, y: number }>()
    for (const g of sectionOf(slug)) {
        const el = els.get(g.slug)
        if (el) before.set(g.slug, { x: el.offsetLeft, y: el.offsetTop })
    }
    emit('move', slug, to)
    await nextTick()
    if (reducedMotion()) return
    for (const [s, pos] of before) {
        const el = els.get(s)
        if (!el || s === slug) continue
        const dx = pos.x - el.offsetLeft
        const dy = pos.y - el.offsetTop
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    }
}

// ─── Keyboard and buttons ────────────────────────────────────────────────

async function nudge(slug: string, delta: number) {
    const list = sectionOf(slug)
    const target = list[list.findIndex(g => g.slug === slug) + delta]
    if (!target) return
    await moveAnimated(slug, target.slug)
    announce(slug)
    els.get(slug)?.querySelector<HTMLElement>('[data-grip]')?.focus()
}

// ─── Drag ────────────────────────────────────────────────────────────────
// Window listeners rather than pointer capture: reordering moves the card in
// the DOM, which would drop a capture mid-drag.

interface Drag {
    slug: string
    pointerId: number
    /** Where the pointer grabbed the card, from its top-left corner. */
    ox: number
    oy: number
    x: number
    y: number
}
const drag = ref<Drag | null>(null)
let frame = 0
let moving = false

function onPointerDown(e: PointerEvent, slug: string) {
    if (!props.editing || drag.value || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-nudge]')) return
    // Touch and pen drag from the grip only, so the page still scrolls under a finger.
    if (e.pointerType !== 'mouse' && !target.closest('[data-grip]')) return
    const el = els.get(slug)
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    drag.value = { slug, pointerId: e.pointerId, ox: e.clientX - rect.left, oy: e.clientY - rect.top, x: e.clientX, y: e.clientY }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    frame = requestAnimationFrame(tick)
}

function onPointerMove(e: PointerEvent) {
    const d = drag.value
    if (!d || e.pointerId !== d.pointerId) return
    d.x = e.clientX
    d.y = e.clientY
}

function stopDrag() {
    cancelAnimationFrame(frame)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    const d = drag.value
    if (!d) return
    const el = els.get(d.slug)
    if (el) el.style.transform = ''
    drag.value = null
    return d.slug
}

function onPointerUp(e: PointerEvent) {
    if (!drag.value || e.pointerId !== drag.value.pointerId) return
    const slug = stopDrag()
    if (slug) announce(slug)
}

/** Each frame: scroll near the viewport edges, follow the pointer, take the place of the card under it. */
async function tick() {
    const d = drag.value
    if (!d) return
    const edge = 72
    if (d.y < edge) window.scrollBy(0, -Math.ceil((edge - d.y) / 6))
    else if (d.y > window.innerHeight - edge) window.scrollBy(0, Math.ceil((d.y - window.innerHeight + edge) / 6))

    const el = els.get(d.slug)
    const grid = el?.offsetParent as HTMLElement | null
    if (el && grid) {
        const box = grid.getBoundingClientRect()
        const px = d.x - box.left
        const py = d.y - box.top
        el.style.transform = `translate(${px - d.ox - el.offsetLeft}px, ${py - d.oy - el.offsetTop}px) scale(1.03)`
        if (!moving) {
            const over = sectionOf(d.slug).find((g) => {
                const o = g.slug === d.slug ? null : els.get(g.slug)
                return !!o && px >= o.offsetLeft && px <= o.offsetLeft + o.offsetWidth && py >= o.offsetTop && py <= o.offsetTop + o.offsetHeight
            })
            if (over) {
                moving = true
                await moveAnimated(d.slug, over.slug)
                moving = false
            }
        }
    }
    if (drag.value) frame = requestAnimationFrame(tick)
}

watch(() => props.editing, (on) => {
    if (!on) stopDrag()
})
onBeforeUnmount(stopDrag)
</script>

<template>
    <div class="space-y-8">
        <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            <Skeleton v-for="i in 3" :key="i" class="h-52 rounded-2xl" />
        </div>
        <PnxStateBlock v-else-if="error" :icon="Gamepad2" tone="error" title="Couldn't load the games">
            <Button variant="outline" @click="$emit('retry')">Try again</Button>
        </PnxStateBlock>
        <PnxStateBlock v-else-if="sections.length === 0" :icon="Gamepad2" title="No games yet">
            <Button variant="outline" as-child><NuxtLink to="/developers">Make one</NuxtLink></Button>
        </PnxStateBlock>
        <section v-for="(section, si) in sections" :key="section.key" class="space-y-3" :aria-label="section.title">
            <div v-if="!(untitledFirst && si === 0 && section.key === 'games')" class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2 class="text-xl">{{ section.title }}</h2>
                <Badge v-if="section.adminOnly" variant="outline" class="gap-1">
                    <Shield class="size-3" aria-hidden="true" />Admin
                </Badge>
                <p v-if="section.note" class="text-sm text-muted-foreground">{{ section.note }}</p>
                <NuxtLink v-if="si === 0 && truncated && moreTo" :to="moreTo" class="ml-auto text-sm font-medium text-primary">See all</NuxtLink>
            </div>
            <div class="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3" :class="editing ? 'select-none' : ''">
                <div
                    v-for="(game, gi) in section.games"
                    :key="game.slug"
                    :ref="el => setEl(game.slug, el)"
                    class="relative rounded-2xl"
                    :class="[
                        editing ? 'cursor-grab outline-2 outline-offset-2 outline-dashed outline-primary/35' : '',
                        drag?.slug === game.slug ? 'z-20 cursor-grabbing shadow-2xl outline-primary' : ''
                    ]"
                    @pointerdown="onPointerDown($event, game.slug)"
                >
                    <PnxGameCard :game="game" :editing="editing" class="h-full" />
                    <div v-if="editing" class="absolute left-2 top-2 z-10 flex items-center gap-1">
                        <button
                            type="button"
                            data-grip
                            class="flex size-8 touch-none cursor-grab items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm outline-none backdrop-blur focus-visible:ring-3 focus-visible:ring-ring/50"
                            :aria-label="`Move ${game.name}`"
                            aria-roledescription="sortable"
                            title="Drag"
                            @keydown.left.prevent="nudge(game.slug, -1)"
                            @keydown.up.prevent="nudge(game.slug, -1)"
                            @keydown.right.prevent="nudge(game.slug, 1)"
                            @keydown.down.prevent="nudge(game.slug, 1)"
                        ><GripVertical class="size-4" aria-hidden="true" /></button>
                        <button
                            type="button"
                            data-nudge
                            class="flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm outline-none backdrop-blur hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                            :disabled="gi === 0"
                            :aria-label="`Move ${game.name} earlier`"
                            title="Earlier"
                            @click="nudge(game.slug, -1)"
                        >
                            <ChevronUp class="size-4 sm:hidden" aria-hidden="true" /><ChevronLeft class="hidden size-4 sm:block" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            data-nudge
                            class="flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm outline-none backdrop-blur hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40"
                            :disabled="gi === section.games.length - 1"
                            :aria-label="`Move ${game.name} later`"
                            title="Later"
                            @click="nudge(game.slug, 1)"
                        >
                            <ChevronDown class="size-4 sm:hidden" aria-hidden="true" /><ChevronRight class="hidden size-4 sm:block" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
        <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </div>
</template>
