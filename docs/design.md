# Polynux look and feel (shared by the hub and every first-party app)

**Clean and fun.** Bright, friendly, toy-like, but organised. Generous rounding, chunky buttons with a
soft bottom "press" shadow, playful display type, lots of white space, colour used for meaning
(gems = teal, stars = amber). Not a dark neon casino template, not a corporate dashboard.
Both light and dark mode, dark is the default for game pages, light and dark both first-class.

## Stack

- Tailwind CSS v4 (`@tailwindcss/vite`), **shadcn-vue** via `shadcn-nuxt` (components copied into
  `app/components/ui`), `lucide-vue-next` icons, `@vueuse/core`, self-hosted `@fontsource/*` fonts (no build-time downloads), `@nuxtjs/color-mode`
  (`classSuffix: ''`, `.dark` class).
- Toasts: shadcn-vue **Sonner** (`vue-sonner`). **Import its stylesheet**, it is the step everyone
  forgets: `import 'vue-sonner/style.css'` in `app/assets/css/main.css` via `@import "vue-sonner/style.css";`
  or in the plugin/app that mounts `<Toaster />`. Mount `<Toaster rich-colors position="top-center" />` once
  in `app.vue`. Toasts are for errors and failures only; never success toasts.

## Type

- Display: **Bricolage Grotesque** (700/800), headings, numbers in hero spots, buttons.
- Body: **Inter** (400/500/600).
- Numbers/mono: **JetBrains Mono** with `tabular-nums` for balances and tables.

## Tokens (shadcn variable names, OKLCH)

```css
:root {
  --radius: 1rem;
  --background: oklch(0.985 0.004 250);
  --foreground: oklch(0.21 0.03 262);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.03 262);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.03 262);
  --primary: oklch(0.62 0.21 285);          /* grape: main actions */
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.955 0.012 260);
  --secondary-foreground: oklch(0.28 0.03 262);
  --muted: oklch(0.955 0.012 260);
  --muted-foreground: oklch(0.52 0.025 262);
  --accent: oklch(0.95 0.03 285);
  --accent-foreground: oklch(0.32 0.12 285);
  --destructive: oklch(0.62 0.22 25);
  --border: oklch(0.91 0.012 260);
  --input: oklch(0.91 0.012 260);
  --ring: oklch(0.62 0.21 285);
  --gem: oklch(0.70 0.13 185);              /* teal: gems, always */
  --gem-foreground: oklch(0.99 0 0);
  --star: oklch(0.80 0.16 80);              /* amber: stars, titles, wins */
  --star-foreground: oklch(0.25 0.05 70);
  --coin: oklch(0.83 0.15 92);              /* gold: app-local coins (casino) */
  --success: oklch(0.70 0.17 150);
}
.dark {
  --background: oklch(0.17 0.025 268);
  --foreground: oklch(0.96 0.01 260);
  --card: oklch(0.215 0.03 268);
  --card-foreground: oklch(0.96 0.01 260);
  --popover: oklch(0.23 0.03 268);
  --popover-foreground: oklch(0.96 0.01 260);
  --primary: oklch(0.70 0.19 285);
  --primary-foreground: oklch(0.16 0.03 268);
  --secondary: oklch(0.27 0.03 268);
  --secondary-foreground: oklch(0.94 0.01 260);
  --muted: oklch(0.27 0.03 268);
  --muted-foreground: oklch(0.70 0.025 262);
  --accent: oklch(0.30 0.06 285);
  --accent-foreground: oklch(0.92 0.05 285);
  --destructive: oklch(0.66 0.21 25);
  --border: oklch(0.30 0.03 268);
  --input: oklch(0.32 0.03 268);
  --ring: oklch(0.70 0.19 285);
  --gem: oklch(0.78 0.13 185);
  --gem-foreground: oklch(0.18 0.03 200);
  --star: oklch(0.84 0.15 82);
  --star-foreground: oklch(0.22 0.05 70);
  --coin: oklch(0.86 0.14 92);
  --success: oklch(0.74 0.16 150);
}
```

Expose `gem`, `star`, `coin`, `success` to Tailwind with `@theme inline` (`--color-gem: var(--gem)` …) so
`bg-gem`, `text-star` work.

## Signature details

- **Gem chip**: a rounded pill with a small faceted gem glyph (SVG, teal) and the amount in mono.
  **Star chip** likewise in amber with a star glyph. The same components everywhere.
- **Star track**: 10 small rounded squares per game, filled amber when unlocked, with the star name in
  a tooltip. Used on profiles, game pages and the leaderboard.
- **Chunky button** variant: `shadow-[0_3px_0_0_color-mix(in_oklch,var(--primary)_60%,black)]`,
  `active:translate-y-[2px] active:shadow-none`.
- Cards: `rounded-2xl`, 1px border, no heavy shadows. Background has a very subtle dotted grid.
- Motion: small springy scale on hover for game tiles; the daily claim shows gems flying into the wallet
  chip (respect `prefers-reduced-motion`). One celebratory moment per action, nothing ambient.
- Copy: short, plain, game-like. No marketing fluff.
