const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function inline(raw: string): string {
    return escapeHtml(raw)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer nofollow">$1</a>')
}

/**
 * A deliberately tiny, safe Markdown subset for game descriptions: paragraphs,
 * `#` headings (rendered as small headings), `-` lists, **bold**, *italic*,
 * `code` and http(s) links. Everything is HTML-escaped first, so the result
 * is safe for `v-html`.
 */
export function renderMarkdown(src: string | null | undefined): string {
    if (!src) return ''
    const out: string[] = []
    let list = false
    const closeList = () => {
        if (list) out.push('</ul>')
        list = false
    }
    for (const line of src.replace(/\r\n/g, '\n').split('\n')) {
        const t = line.trim()
        const item = /^[-*]\s+(.*)$/.exec(t)
        if (item) {
            if (!list) out.push('<ul>')
            list = true
            out.push(`<li>${inline(item[1]!)}</li>`)
            continue
        }
        closeList()
        if (!t) continue
        const h = /^#{1,6}\s+(.*)$/.exec(t)
        out.push(h ? `<h4>${inline(h[1]!)}</h4>` : `<p>${inline(t)}</p>`)
    }
    closeList()
    return out.join('')
}
