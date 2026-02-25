# Quickstart: Lunaris UI Unification

**Feature**: 017-lunaris-ui-unification
**Date**: 2026-02-24

## TL;DR

Replace shadcn oklch CSS with Lunaris hex tokens. The work is 90% CSS, 10% TypeScript (theme store). No new components, no new routes, no new dependencies (except self-hosted Geist font files).

## Prerequisites

- Branch `017-lunaris-ui-unification` checked out
- Dev server running (`npm run dev`)
- Geist font woff2 files downloaded (MIT license from Vercel)

## Implementation Order

### Step 1: Install Geist Font (~5 min)

```bash
mkdir -p static/fonts/geist
# Copy Geist-Regular.woff2, Geist-Medium.woff2, Geist-SemiBold.woff2 into static/fonts/geist/
```

Create `static/fonts/geist.css`:

```css
@font-face {
	font-family: 'Geist';
	src: url('/fonts/geist/Geist-Regular.woff2') format('woff2');
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}
@font-face {
	font-family: 'Geist';
	src: url('/fonts/geist/Geist-Medium.woff2') format('woff2');
	font-weight: 500;
	font-style: normal;
	font-display: swap;
}
@font-face {
	font-family: 'Geist';
	src: url('/fonts/geist/Geist-SemiBold.woff2') format('woff2');
	font-weight: 600;
	font-style: normal;
	font-display: swap;
}
```

### Step 2: Rewrite app.css Token Foundation (~30 min)

1. Delete `:root` light mode block (lines 7-41)
2. Merge `.dark` block into `:root` — replace all oklch with Lunaris hex
3. Delete all 7 `[data-palette=...]` blocks (lines 106-195)
4. Add 13 Lunaris `[data-palette=...]` blocks (1 line each, only `--primary`)
5. Delete glass-\* classes (lines 271-309)
6. Replace with opaque solid equivalents
7. Remove glow shadow classes

### Step 3: Update palantir-design-system.css (~20 min)

1. Update fallback hex values to match new Lunaris tokens
2. Remove glow box-shadows from signal and status indicators
3. Remove accent-glow classes
4. Add typography scale tokens (13px, 10px, 9px)
5. Update `.tactical-sidebar` width to 280px

### Step 4: Update dashboard.css (~5 min)

1. `--font-sans` → `'Geist', system-ui, sans-serif`
2. `--font-mono` → `'Fira Code', 'JetBrains Mono', monospace`
3. Add `--font-primary: var(--font-mono)` and `--font-secondary: var(--font-sans)`
4. `--panel-width` → `280px`
5. `--top-bar-height` → `40px`

### Step 5: Update theme-store.svelte.ts (~10 min)

1. Change `ThemePalette` type to 13 Lunaris names
2. Update `VALID_PALETTES` array
3. Change `DEFAULT_STATE.palette` from `'default'` to `'blue'`
4. Remove `.dark` class logic from `applyPalette` (no palette needs `.dark` prefix)

### Step 6: Fix Component Violations (~20 min)

- TopStatusBar: brand mark 14px, 2px letter-spacing, accent color
- AgentChatPanel: `font-family: var(--font-primary, monospace)`
- TowerPopup: `font-family: var(--font-primary, monospace)`
- ScanConsole: `font-family: var(--font-primary, monospace)`
- DeviceOverlay: remove backdrop-filter, use `background: var(--card)`
- TerminalTabContent: clean fallback chain (remove SF Mono, Menlo, Monaco)

### Step 7: Verify (~15 min)

```bash
# Build succeeds
npm run build

# Grep for violations
grep -r "oklch" src/app.css                          # Should be 0
grep -r "Inter" src/                                  # Should be 0 in CSS
grep -r "SF Mono" src/lib/styles/                     # Should be 0
grep -r ":root\b" src/app.css | grep -v data-palette  # Should be 1 (the main :root)
grep -r "backdrop-filter" src/                        # Should be 0 (except dashboard.css neutralizer)
```

## Verification Checklist

- [ ] `npm run build` passes
- [ ] No oklch values in app.css
- [ ] No `:root` light mode block
- [ ] No shadcn palette names (blue/green/orange/red/rose/violet/yellow as data-palette values)
- [ ] 13 Lunaris palettes defined
- [ ] Background resolves to #111111
- [ ] Card resolves to #1A1A1A
- [ ] Border resolves to #2E2E2E (solid)
- [ ] Primary resolves to #A8B8E0 (Blue ★ default)
- [ ] Body font is Geist
- [ ] Data readouts use Fira Code
- [ ] Panel width is 280px
- [ ] Command bar height is 40px
- [ ] No glow box-shadows on status dots
- [ ] No backdrop-filter / glass effects
- [ ] ARGOS brand: 14px Fira Code semibold, 2px letter-spacing, accent color
