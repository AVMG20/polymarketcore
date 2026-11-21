<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { Circle, Pencil, Pipette, Save, Square, Star, Trash2, Triangle, Undo2 } from 'lucide-vue-next'
import type { Component } from 'vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
    EMBLEM_MAX_ELEMENTS,
    EMBLEM_MAX_POINTS_PER_STROKE,
    EMBLEM_MAX_SERIALIZED_LENGTH,
    emblemPolygonPoints,
    emblemStarPoints,
    emptyEmblem,
    parseEmblem,
    type EmblemData,
    type EmblemElement,
    type EmblemPlacedShape,
    type EmblemPoint,
    type EmblemShape,
    type EmblemStroke
} from '#shared/emblem'

/**
 * Draw an emblem: pencil strokes and placed shapes on a 100x100 canvas,
 * paint and background colours, undo and clear. `modelValue` is a serialized
 * emblem or EmblemData; a new value from the parent (a history pick) replaces
 * the canvas. Emits every change and `save`.
 */
const props = defineProps<{ modelValue?: unknown, busy?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: EmblemData], save: [value: EmblemData] }>()

// Headroom for the element or point about to be added, so the serialized
// emblem never crosses the limit parseEmblem rejects at.
const ELEMENT_BYTE_MARGIN = 250
const POINT_BYTE_MARGIN = 50
const UNDO_DEPTH = 30

type Tool = 'pencil' | EmblemShape

const tools: { id: Tool, label: string, icon: Component, key: string }[] = [
    { id: 'pencil', label: 'Draw', icon: Pencil, key: 'D' },
    { id: 'circle', label: 'Circle', icon: Circle, key: '1' },
    { id: 'square', label: 'Square', icon: Square, key: '2' },
    { id: 'triangle', label: 'Triangle', icon: Triangle, key: '3' },
    { id: 'star', label: 'Star', icon: Star, key: '4' }
]
const palette = ['#ffffff', '#111827', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']

const canvas = ref<SVGSVGElement | null>(null)
const tool = ref<Tool>('pencil')
const color = ref('#ffffff')
const brushSize = ref([6])
const shapeSize = ref([34])
const shapeRotation = ref([0])
const drawing = ref(false)
const activeStroke = ref<EmblemStroke | null>(null)
const undoStack = ref<EmblemElement[][]>([])
const hoverPoint = ref<EmblemPoint | null>(null)

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const emblem = reactive<EmblemData>(clone(parseEmblem(props.modelValue) ?? emptyEmblem()))

const serializedLength = computed(() => JSON.stringify(emblem).length)
const full = computed(() => emblem.elements.length >= EMBLEM_MAX_ELEMENTS
    || serializedLength.value >= EMBLEM_MAX_SERIALIZED_LENGTH - ELEMENT_BYTE_MARGIN)
const capacity = computed(() => Math.min(100, Math.round(Math.max(
    emblem.elements.length / EMBLEM_MAX_ELEMENTS,
    serializedLength.value / EMBLEM_MAX_SERIALIZED_LENGTH
) * 100)))

watch(tool, (next) => {
    shapeRotation.value = [next === 'square' ? 45 : 0]
})

watch(() => props.modelValue, (value) => {
    const next = parseEmblem(value)
    if (!next || JSON.stringify(next) === JSON.stringify(emblem)) return
    Object.assign(emblem, clone(next))
    undoStack.value = []
})

const previewShape = computed<EmblemPlacedShape | null>(() => {
    if (tool.value === 'pencil' || !hoverPoint.value || full.value) return null
    const [x, y] = hoverPoint.value
    return { kind: 'shape', shape: tool.value, color: color.value, x, y, size: shapeSize.value[0]!, rotation: shapeRotation.value[0]! }
})

function snapshot() {
    undoStack.value.push(clone(emblem.elements))
    if (undoStack.value.length > UNDO_DEPTH) undoStack.value.shift()
}

function changed() {
    emit('update:modelValue', clone(emblem))
}

const round2 = (value: number) => Math.round(value * 100) / 100

function pointFromEvent(event: PointerEvent): EmblemPoint {
    const rect = canvas.value!.getBoundingClientRect()
    return [
        round2(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))),
        round2(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)))
    ]
}

function pointerDown(event: PointerEvent) {
    if (!canvas.value || full.value) return
    canvas.value.setPointerCapture(event.pointerId)
    const [x, y] = pointFromEvent(event)
    snapshot()

    if (tool.value === 'pencil') {
        const stroke: EmblemStroke = { kind: 'stroke', color: color.value, width: brushSize.value[0]!, points: [[x, y]] }
        emblem.elements.push(stroke)
        // The reactive copy, so added points render while drawing.
        activeStroke.value = emblem.elements.at(-1) as EmblemStroke
        drawing.value = true
        return
    }

    emblem.elements.push({ kind: 'shape', shape: tool.value, color: color.value, x, y, size: shapeSize.value[0]!, rotation: shapeRotation.value[0]! })
    changed()
}

function pointerMove(event: PointerEvent) {
    const next = pointFromEvent(event)
    hoverPoint.value = next
    if (!drawing.value || !activeStroke.value) return
    const last = activeStroke.value.points.at(-1)!
    if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 1.2) return
    if (activeStroke.value.points.length < EMBLEM_MAX_POINTS_PER_STROKE
        && serializedLength.value < EMBLEM_MAX_SERIALIZED_LENGTH - POINT_BYTE_MARGIN) activeStroke.value.points.push(next)
}

function pointerUp(event: PointerEvent) {
    if (canvas.value?.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId)
    if (drawing.value) changed()
    drawing.value = false
    activeStroke.value = null
}

function wheelRotate(event: WheelEvent) {
    if (tool.value === 'pencil' || (!event.metaKey && !event.altKey)) return
    event.preventDefault()
    const delta = event.deltaY > 0 ? -5 : 5
    shapeRotation.value = [Math.max(-180, Math.min(180, shapeRotation.value[0]! + delta))]
}

function undo() {
    const previous = undoStack.value.pop()
    if (!previous) return
    emblem.elements = previous
    changed()
}

function clear() {
    if (!emblem.elements.length) return
    snapshot()
    emblem.elements = []
    changed()
}

function setBackground(value: string) {
    emblem.background = value
    changed()
}

function save() {
    if (!props.busy) emit('save', clone(emblem))
}

useEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (mod && key === 'z') {
        event.preventDefault()
        undo()
    } else if (mod && key === 's') {
        event.preventDefault()
        save()
    } else if (!mod && !event.altKey) {
        const picked = tools.find(t => t.key.toLowerCase() === key)
        if (picked) tool.value = picked.id
        else if (event.key === 'Delete') clear()
    }
})
</script>

<template>
    <div class="grid gap-6 lg:grid-cols-[minmax(240px,380px)_1fr]">
        <div class="mx-auto w-full max-w-[380px]">
            <div class="relative aspect-square overflow-hidden rounded-full border-4 bg-card">
                <PnxEmblemSvg :data="emblem" />
                <svg
                    ref="canvas"
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label="Emblem canvas"
                    class="absolute inset-0 size-full touch-none rounded-full"
                    :class="full ? 'cursor-not-allowed' : 'cursor-crosshair'"
                    @pointerdown="pointerDown"
                    @pointermove="pointerMove"
                    @pointerup="pointerUp"
                    @pointercancel="pointerUp"
                    @pointerleave="hoverPoint = null"
                    @wheel="wheelRotate"
                >
                    <g pointer-events="none" opacity="0.5">
                        <circle
                            v-if="tool === 'pencil' && hoverPoint && !full"
                            :cx="hoverPoint[0]"
                            :cy="hoverPoint[1]"
                            :r="brushSize[0]! / 2"
                            :fill="color"
                            :stroke="color"
                            stroke-width="0.5"
                        />
                        <template v-else-if="previewShape">
                            <circle v-if="previewShape.shape === 'circle'" :cx="previewShape.x" :cy="previewShape.y" :r="previewShape.size / 2" :fill="previewShape.color" />
                            <rect
                                v-else-if="previewShape.shape === 'square'"
                                :x="previewShape.x - previewShape.size / 2"
                                :y="previewShape.y - previewShape.size / 2"
                                :width="previewShape.size"
                                :height="previewShape.size"
                                :transform="`rotate(${previewShape.rotation} ${previewShape.x} ${previewShape.y})`"
                                :fill="previewShape.color"
                                rx="2"
                            />
                            <polygon v-else-if="previewShape.shape === 'star'" :points="emblemStarPoints(previewShape)" :fill="previewShape.color" />
                            <polygon v-else :points="emblemPolygonPoints(previewShape)" :fill="previewShape.color" />
                        </template>
                    </g>
                </svg>
            </div>
            <p class="mt-3 text-center text-xs text-muted-foreground">Draw, or tap to place a shape. It shows as a circle everywhere.</p>
        </div>

        <div class="space-y-5">
            <div class="space-y-2">
                <Label>Tool</Label>
                <div class="flex flex-wrap gap-2">
                    <Button
                        v-for="t in tools"
                        :key="t.id"
                        size="sm"
                        :variant="tool === t.id ? 'default' : 'outline'"
                        :aria-pressed="tool === t.id"
                        @click="tool = t.id"
                    >
                        <component :is="t.icon" /> {{ t.label }}
                        <kbd class="hidden rounded border border-current/25 px-1 font-mono text-[10px] opacity-70 sm:inline">{{ t.key }}</kbd>
                    </Button>
                </div>
            </div>

            <div class="space-y-2">
                <Label>Paint</Label>
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        v-for="swatch in palette"
                        :key="swatch"
                        type="button"
                        class="size-8 rounded-full border outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50"
                        :class="color === swatch ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''"
                        :style="{ backgroundColor: swatch }"
                        :aria-label="`Paint ${swatch}`"
                        :aria-pressed="color === swatch"
                        @click="color = swatch"
                    />
                    <label class="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground" title="Any colour">
                        <Pipette class="pointer-events-none size-4" />
                        <input v-model="color" type="color" aria-label="Any paint colour" class="absolute inset-0 cursor-pointer opacity-0">
                    </label>
                </div>
            </div>

            <div class="space-y-2">
                <Label>Background</Label>
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        v-for="swatch in palette"
                        :key="swatch"
                        type="button"
                        class="size-8 rounded-full border outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50"
                        :class="emblem.background === swatch ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''"
                        :style="{ backgroundColor: swatch }"
                        :aria-label="`Background ${swatch}`"
                        :aria-pressed="emblem.background === swatch"
                        @click="setBackground(swatch)"
                    />
                    <label class="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground" title="Any colour">
                        <Pipette class="pointer-events-none size-4" />
                        <input
                            :value="emblem.background"
                            type="color"
                            aria-label="Any background colour"
                            class="absolute inset-0 cursor-pointer opacity-0"
                            @input="setBackground(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                </div>
            </div>

            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <Label>{{ tool === 'pencil' ? 'Brush' : 'Size' }}</Label>
                    <span class="tabular text-xs text-muted-foreground">{{ tool === 'pencil' ? brushSize[0] : shapeSize[0] }}</span>
                </div>
                <Slider v-if="tool === 'pencil'" v-model="brushSize" :min="1" :max="18" :step="1" aria-label="Brush size" />
                <Slider v-else v-model="shapeSize" :min="8" :max="80" :step="1" aria-label="Shape size" />
            </div>

            <div v-if="tool !== 'pencil'" class="space-y-3">
                <div class="flex items-center justify-between">
                    <Label>Rotation</Label>
                    <span class="tabular text-xs text-muted-foreground">{{ shapeRotation[0] }}°</span>
                </div>
                <Slider v-model="shapeRotation" :min="-180" :max="180" :step="1" aria-label="Shape rotation" />
                <p class="text-xs text-muted-foreground">Or hold ⌘ / Alt and scroll over the canvas.</p>
            </div>

            <div class="flex flex-wrap gap-2 border-t pt-5">
                <Button variant="outline" :disabled="!undoStack.length" @click="undo"><Undo2 /> Undo</Button>
                <Button variant="outline" :disabled="!emblem.elements.length" @click="clear"><Trash2 /> Clear</Button>
                <Button variant="chunky" class="sm:ml-auto" :disabled="busy" @click="save"><Save /> Save emblem</Button>
            </div>
            <div class="space-y-1.5">
                <Progress
                    :model-value="capacity"
                    class="h-1.5"
                    :class="full ? '[&>*]:bg-destructive' : capacity >= 85 ? '[&>*]:bg-star' : ''"
                />
                <p class="text-xs" :class="full ? 'font-medium text-destructive' : 'text-muted-foreground'">
                    <template v-if="full">Full: undo or clear some marks to keep drawing.</template>
                    <template v-else><span class="tabular">{{ emblem.elements.length }}/{{ EMBLEM_MAX_ELEMENTS }}</span> marks · <span class="tabular">{{ capacity }}%</span> of the space used</template>
                </p>
            </div>
        </div>
    </div>
</template>
