<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
    <div class="relative">
        <Input
            v-bind="$attrs"
            v-model="model"
            :type="visible ? 'text' : 'password'"
            class="h-11 rounded-sm bg-background/70 px-3.5 pr-10 text-base placeholder:text-muted-foreground/65 transition-[color,box-shadow,border-color] hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 dark:bg-background/50 sm:text-sm"
        />
        <button
            type="button"
            class="absolute inset-y-0 right-1.5 my-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :aria-label="visible ? 'Hide password' : 'Show password'"
            :aria-pressed="visible"
            @click="visible = !visible"
        >
            <EyeOff v-if="visible" class="size-4" aria-hidden="true" />
            <Eye v-else class="size-4" aria-hidden="true" />
        </button>
    </div>
</template>
