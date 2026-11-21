const GEM_SVG = '<svg viewBox="0 0 24 24" fill="none" width="100%" height="100%"><path d="M6 3h12l4 6-10 12L2 9l4-6Z" fill="currentColor"/><path d="M2 9h20M12 21 8 9l4-6 4 6-4 12Z" stroke="white" stroke-opacity=".45" stroke-width="1.2" stroke-linejoin="round"/></svg>'

/**
 * The daily claim moment: gems fly from an element into the wallet chip in the
 * header (`[data-pnx-wallet]`), which bumps when they land. Does nothing under
 * `prefers-reduced-motion`, and never throws if the wallet isn't on screen.
 */
export function useGemFlight() {
    function fly(from: Element | null | undefined, count = 10) {
        if (!import.meta.client || !from) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const target = document.querySelector('[data-pnx-wallet]')
        if (!target) return
        const a = from.getBoundingClientRect()
        const b = target.getBoundingClientRect()
        const sx = a.left + a.width / 2
        const sy = a.top + a.height / 2
        const tx = b.left + 18
        const ty = b.top + b.height / 2
        let landed = 0
        const n = Math.min(14, Math.max(4, count))
        for (let i = 0; i < n; i++) {
            const gem = document.createElement('span')
            gem.setAttribute('aria-hidden', 'true')
            gem.innerHTML = GEM_SVG
            Object.assign(gem.style, {
                position: 'fixed', left: '0', top: '0', width: '20px', height: '20px', zIndex: '100',
                pointerEvents: 'none', color: 'var(--gem)', filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / .25))'
            })
            document.body.appendChild(gem)
            const jitterX = (Math.random() - 0.5) * 120
            const jitterY = -40 - Math.random() * 70
            const mx = sx + jitterX
            const my = sy + jitterY
            const anim = gem.animate([
                { transform: `translate(${sx - 10}px, ${sy - 10}px) scale(.4)`, opacity: 0 },
                { transform: `translate(${mx - 10}px, ${my - 10}px) scale(1.15)`, opacity: 1, offset: 0.35 },
                { transform: `translate(${tx - 10}px, ${ty - 10}px) scale(.6)`, opacity: 0.9 }
            ], { duration: 750 + Math.random() * 350, delay: i * 55, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' })
            anim.onfinish = () => {
                gem.remove()
                if (++landed === 1) {
                    target.classList.remove('pnx-wallet-bump')
                    void (target as HTMLElement).offsetWidth
                    target.classList.add('pnx-wallet-bump')
                    setTimeout(() => target.classList.remove('pnx-wallet-bump'), 500)
                }
            }
        }
    }
    return { fly }
}
