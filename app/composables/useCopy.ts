import { toast } from 'vue-sonner'

/**
 * Copy text to the clipboard, with a textarea fallback for insecure contexts
 * and in-app browsers. `copied` flips for a moment; failure is the only toast.
 */
export function useCopy(resetMs = 1800) {
    const copied = ref(false)
    let timer: ReturnType<typeof setTimeout> | undefined

    async function copyText(text: string): Promise<boolean> {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text)
            } else {
                const area = document.createElement('textarea')
                area.value = text
                area.setAttribute('readonly', '')
                Object.assign(area.style, { position: 'fixed', top: '0', opacity: '0' })
                document.body.appendChild(area)
                area.select()
                const ok = document.execCommand('copy')
                area.remove()
                if (!ok) throw new Error('copy failed')
            }
            copied.value = true
            clearTimeout(timer)
            timer = setTimeout(() => (copied.value = false), resetMs)
            return true
        } catch {
            toast.error('Could not copy. Select the text and copy it by hand.')
            return false
        }
    }

    onBeforeUnmount(() => clearTimeout(timer))
    return { copied, copyText }
}
