/**
 * The agent brief: the same Markdown the hub serves at /developers.md
 * (one source: shared/guide/developer-guide.md), plus a copy action.
 */
export function useDeveloperGuide() {
    const { data: markdown, pending, error, refresh } = useAsyncData('pnx-dev-guide', () => apiFetch<string>('/developers.md', { responseType: 'text' }))
    const { copied, copyText } = useCopy()

    async function copy() {
        if (!markdown.value) return false
        return copyText(markdown.value)
    }

    return { markdown, pending, error, refresh, copied, copy }
}
