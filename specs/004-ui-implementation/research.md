# Research: UI Modernization — Polished Components & Color Customization

**Date**: 2026-02-15 | **Spec**: 004-ui-implementation

## R1: shadcn Theme Architecture

**Question**: How do shadcn-svelte themes work, and what CSS variables need to change per palette?

**Finding**: shadcn themes override **ALL CSS variables** per palette — each palette ships with its own harmonized neutral base (background, foreground, secondary, muted, accent, border, input, card, popover) plus accent colors (primary, ring). This differs from the common misconception that only accent variables change.

**Official palette → neutral base pairings**:

| Palette | Neutral Base | Dark Background  |
| ------- | ------------ | ---------------- |
| Default | Zinc         | `240 10% 3.9%`   |
| Blue    | Slate        | `222.2 84% 4.9%` |
| Green   | Zinc+custom  | `20 14.3% 4.1%`  |
| Orange  | Stone        | `20 14.3% 4.1%`  |
| Red     | Neutral      | `0 0% 3.9%`      |
| Rose    | Zinc+custom  | `20 14.3% 4.1%`  |
| Violet  | Gray         | `224 71.4% 4.1%` |
| Yellow  | Stone        | `20 14.3% 4.1%`  |

**CSS Variable Inventory** (30+ variables):

| Variable                                    | Changes Per Palette? | Changes Per Mode? |
| ------------------------------------------- | -------------------- | ----------------- |
| `--background`                              | **Yes**              | Yes               |
| `--foreground`                              | **Yes**              | Yes               |
| `--card`, `--card-foreground`               | **Yes**              | Yes               |
| `--popover`, `--popover-foreground`         | **Yes**              | Yes               |
| `--primary`, `--primary-foreground`         | **Yes**              | Yes               |
| `--secondary`, `--secondary-foreground`     | **Yes**              | Yes               |
| `--muted`, `--muted-foreground`             | **Yes**              | Yes               |
| `--accent`, `--accent-foreground`           | **Yes**              | Yes               |
| `--destructive`, `--destructive-foreground` | **Yes**              | Yes               |
| `--border`                                  | **Yes**              | Yes               |
| `--input`                                   | **Yes**              | Yes               |
| `--ring`                                    | **Yes**              | Yes               |
| `--chart-1` through `--chart-5`             | No (universal)       | Yes               |
| `--radius`                                  | Sometimes            | No                |

**Chart colors are universal** — the same 5 chart colors are shared across all palettes:

- Light: `12 76% 61%`, `173 58% 39%`, `197 37% 24%`, `43 74% 66%`, `27 87% 67%`
- Dark: `220 70% 50%`, `160 60% 45%`, `30 80% 55%`, `280 65% 60%`, `340 75% 55%`

**Color format**: Current app.css uses HSL. shadcn v4 uses OKLCH. Decision: Keep HSL for consistency with existing Argos codebase. Both formats work with CSS variables.

**Source**: Official shadcn-ui/ui GitHub repository — `apps/v4/registry/_legacy-base-colors.ts` (verified 2026-02-15).

---

## R2: Palette CSS Values

**Question**: What are the exact CSS variable values for each of the 8 palettes?

**Source**: Official shadcn-ui/ui GitHub repository — `apps/v4/registry/_legacy-base-colors.ts` (verified 2026-02-15)

**Finding**: Each palette defines a COMPLETE set of CSS variables for both light and dark modes. All values in HSL format. Chart colors are universal (same across all palettes — see R1).

### Default (Zinc base)

**Light:** `--primary: 240 5.9% 10%` | `--primary-fg: 0 0% 98%` | `--ring: 240 5.9% 10%` | `--background: 0 0% 100%` | `--foreground: 240 10% 3.9%` | `--secondary: 240 4.8% 95.9%` | `--muted: 240 4.8% 95.9%` | `--muted-fg: 240 3.8% 46.1%` | `--accent: 240 4.8% 95.9%` | `--border: 240 5.9% 90%` | `--input: 240 5.9% 90%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 0 0% 98%` | `--primary-fg: 240 5.9% 10%` | `--ring: 240 4.9% 83.9%` | `--background: 240 10% 3.9%` | `--foreground: 0 0% 98%` | `--secondary: 240 3.7% 15.9%` | `--muted: 240 3.7% 15.9%` | `--muted-fg: 240 5% 64.9%` | `--accent: 240 3.7% 15.9%` | `--border: 240 3.7% 15.9%` | `--input: 240 3.7% 15.9%` | `--destructive: 0 62.8% 30.6%`

### Blue (Slate base)

**Light:** `--primary: 221.2 83.2% 53.3%` | `--primary-fg: 210 40% 98%` | `--ring: 221.2 83.2% 53.3%` | `--background: 0 0% 100%` | `--foreground: 222.2 84% 4.9%` | `--secondary: 210 40% 96.1%` | `--muted: 210 40% 96.1%` | `--muted-fg: 215.4 16.3% 46.9%` | `--accent: 210 40% 96.1%` | `--border: 214.3 31.8% 91.4%` | `--input: 214.3 31.8% 91.4%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 217.2 91.2% 59.8%` | `--primary-fg: 222.2 47.4% 11.2%` | `--ring: 224.3 76.3% 48%` | `--background: 222.2 84% 4.9%` | `--foreground: 210 40% 98%` | `--secondary: 217.2 32.6% 17.5%` | `--muted: 217.2 32.6% 17.5%` | `--muted-fg: 215 20.2% 65.1%` | `--accent: 217.2 32.6% 17.5%` | `--border: 217.2 32.6% 17.5%` | `--input: 217.2 32.6% 17.5%` | `--destructive: 0 62.8% 30.6%`

### Green (Zinc+custom base)

**Light:** `--primary: 142.1 76.2% 36.3%` | `--primary-fg: 355.7 100% 97.3%` | `--ring: 142.1 76.2% 36.3%` | `--background: 0 0% 100%` | `--foreground: 240 10% 3.9%` | `--secondary: 240 4.8% 95.9%` | `--muted: 240 4.8% 95.9%` | `--muted-fg: 240 3.8% 46.1%` | `--accent: 240 4.8% 95.9%` | `--border: 240 5.9% 90%` | `--input: 240 5.9% 90%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 142.1 70.6% 45.3%` | `--primary-fg: 144.9 80.4% 10%` | `--ring: 142.4 71.8% 29.2%` | `--background: 20 14.3% 4.1%` | `--foreground: 0 0% 95%` | `--card: 24 9.8% 10%` | `--popover: 0 0% 9%` | `--secondary: 240 3.7% 15.9%` | `--muted: 0 0% 15%` | `--muted-fg: 240 5% 64.9%` | `--accent: 12 6.5% 15.1%` | `--border: 240 3.7% 15.9%` | `--destructive: 0 62.8% 30.6%`

### Orange (Stone base)

**Light:** `--primary: 24.6 95% 53.1%` | `--primary-fg: 60 9.1% 97.8%` | `--ring: 24.6 95% 53.1%` | `--background: 0 0% 100%` | `--foreground: 20 14.3% 4.1%` | `--secondary: 60 4.8% 95.9%` | `--muted: 60 4.8% 95.9%` | `--muted-fg: 25 5.3% 44.7%` | `--accent: 60 4.8% 95.9%` | `--border: 20 5.9% 90%` | `--input: 20 5.9% 90%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 20.5 90.2% 48.2%` | `--primary-fg: 60 9.1% 97.8%` | `--ring: 20.5 90.2% 48.2%` | `--background: 20 14.3% 4.1%` | `--foreground: 60 9.1% 97.8%` | `--secondary: 12 6.5% 15.1%` | `--muted: 12 6.5% 15.1%` | `--muted-fg: 24 5.4% 63.9%` | `--accent: 12 6.5% 15.1%` | `--border: 12 6.5% 15.1%` | `--input: 12 6.5% 15.1%` | `--destructive: 0 72.2% 50.6%`

### Red (Neutral base)

**Light:** `--primary: 0 72.2% 50.6%` | `--primary-fg: 0 85.7% 97.3%` | `--ring: 0 72.2% 50.6%` | `--background: 0 0% 100%` | `--foreground: 0 0% 3.9%` | `--secondary: 0 0% 96.1%` | `--muted: 0 0% 96.1%` | `--muted-fg: 0 0% 45.1%` | `--accent: 0 0% 96.1%` | `--border: 0 0% 89.8%` | `--input: 0 0% 89.8%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 0 72.2% 50.6%` | `--primary-fg: 0 85.7% 97.3%` | `--ring: 0 72.2% 50.6%` | `--background: 0 0% 3.9%` | `--foreground: 0 0% 98%` | `--secondary: 0 0% 14.9%` | `--muted: 0 0% 14.9%` | `--muted-fg: 0 0% 63.9%` | `--accent: 0 0% 14.9%` | `--border: 0 0% 14.9%` | `--input: 0 0% 14.9%` | `--destructive: 0 62.8% 30.6%`

### Rose (Zinc+custom base)

**Light:** `--primary: 346.8 77.2% 49.8%` | `--primary-fg: 355.7 100% 97.3%` | `--ring: 346.8 77.2% 49.8%` | `--background: 0 0% 100%` | `--foreground: 240 10% 3.9%` | `--secondary: 240 4.8% 95.9%` | `--muted: 240 4.8% 95.9%` | `--muted-fg: 240 3.8% 46.1%` | `--accent: 240 4.8% 95.9%` | `--border: 240 5.9% 90%` | `--input: 240 5.9% 90%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 346.8 77.2% 49.8%` | `--primary-fg: 355.7 100% 97.3%` | `--ring: 346.8 77.2% 49.8%` | `--background: 20 14.3% 4.1%` | `--foreground: 0 0% 95%` | `--card: 24 9.8% 10%` | `--popover: 0 0% 9%` | `--secondary: 240 3.7% 15.9%` | `--muted: 0 0% 15%` | `--muted-fg: 240 5% 64.9%` | `--accent: 12 6.5% 15.1%` | `--border: 240 3.7% 15.9%` | `--destructive: 0 62.8% 30.6%`

### Violet (Gray base)

**Light:** `--primary: 262.1 83.3% 57.8%` | `--primary-fg: 210 20% 98%` | `--ring: 262.1 83.3% 57.8%` | `--background: 0 0% 100%` | `--foreground: 224 71.4% 4.1%` | `--secondary: 220 14.3% 95.9%` | `--muted: 220 14.3% 95.9%` | `--muted-fg: 220 8.9% 46.1%` | `--accent: 220 14.3% 95.9%` | `--border: 220 13% 91%` | `--input: 220 13% 91%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 263.4 70% 50.4%` | `--primary-fg: 210 20% 98%` | `--ring: 263.4 70% 50.4%` | `--background: 224 71.4% 4.1%` | `--foreground: 210 20% 98%` | `--secondary: 215 27.9% 16.9%` | `--muted: 215 27.9% 16.9%` | `--muted-fg: 217.9 10.6% 64.9%` | `--accent: 215 27.9% 16.9%` | `--border: 215 27.9% 16.9%` | `--input: 215 27.9% 16.9%` | `--destructive: 0 62.8% 30.6%`

### Yellow (Stone base)

**Light:** `--primary: 47.9 95.8% 53.1%` | `--primary-fg: 26 83.3% 14.1%` | `--ring: 20 14.3% 4.1%` | `--background: 0 0% 100%` | `--foreground: 20 14.3% 4.1%` | `--secondary: 60 4.8% 95.9%` | `--muted: 60 4.8% 95.9%` | `--muted-fg: 25 5.3% 44.7%` | `--accent: 60 4.8% 95.9%` | `--border: 20 5.9% 90%` | `--input: 20 5.9% 90%` | `--destructive: 0 84.2% 60.2%`

**Dark:** `--primary: 47.9 95.8% 53.1%` | `--primary-fg: 26 83.3% 14.1%` | `--ring: 35.5 91.7% 32.9%` | `--background: 20 14.3% 4.1%` | `--foreground: 60 9.1% 97.8%` | `--secondary: 12 6.5% 15.1%` | `--muted: 12 6.5% 15.1%` | `--muted-fg: 24 5.4% 63.9%` | `--accent: 12 6.5% 15.1%` | `--border: 12 6.5% 15.1%` | `--input: 12 6.5% 15.1%` | `--destructive: 0 62.8% 30.6%`

### Universal Chart Colors (same for all palettes)

**Light:** `--chart-1: 12 76% 61%` | `--chart-2: 173 58% 39%` | `--chart-3: 197 37% 24%` | `--chart-4: 43 74% 66%` | `--chart-5: 27 87% 67%`

**Dark:** `--chart-1: 220 70% 50%` | `--chart-2: 160 60% 45%` | `--chart-3: 30 80% 55%` | `--chart-4: 280 65% 60%` | `--chart-5: 340 75% 55%`

---

## R3: FOUC Prevention (mode-watcher)

**Question**: How should we prevent flash of wrong theme on page load?

**Finding**: `mode-watcher` from svecosystem is the shadcn-svelte recommended library.

**How it works**:

1. Injects a synchronous `<script>` via `<svelte:head>` that runs before CSS loads
2. Reads `localStorage` for saved theme preference
3. Falls back to system `prefers-color-scheme` media query
4. Applies correct class to `<html>` element before first paint
5. Provides Svelte stores for reactive mode state

**Integration pattern**:

```svelte
<!-- +layout.svelte -->
<script>
	import { ModeWatcher } from 'mode-watcher';
</script>

<ModeWatcher />
```

**Custom palette FOUC**: mode-watcher handles dark/light class. For the `data-palette` attribute, we add a small inline `<script>` in `app.html` that reads `localStorage.getItem('argos-theme')` and sets `document.documentElement.dataset.palette` before first paint.

**Package info**: MIT license, svecosystem team (same as bits-ui), Svelte 5 compatible, minimal dependencies.

---

## R4: Existing Component Inventory

**Question**: What hand-crafted CSS classes need to be replaced?

**Finding**: Complete inventory from `palantir-design-system.css`:

### Buttons (lines 170-262)

- `.btn` — base: padding, font-size, letter-spacing, border-radius, transition
- `.btn-primary` — blue accent background
- `.btn-secondary` — elevated background
- `.btn-ghost` — transparent, text color hover
- `.btn-open` — accent text, muted background hover
- `.btn-start` — green (#4ade80)
- `.btn-danger` — red (#f87171)
- `.btn-sm`, `.btn-lg`, `.btn-full` — size variants

### Tables (lines 140-168, 471-500)

- `.data-table` — base with thead/th/tbody/td styling
- `.data-table-compact` — smaller variant with cursor:pointer rows
- Hover effects with 2px left border accent
- Selected row with 3px left border

### Inputs (lines 502-529)

- `.input-field` — base with monospace font, border, focus glow
- `.input-field:focus` — accent border, box-shadow
- `.input-field:disabled` — opacity 0.5
- `.input-field-sm` — small variant

### Badges (lines 97-138)

- `.badge` — base: flex, gap, padding, uppercase, border-radius
- `.badge-success` — green tint
- `.badge-warning` — yellow tint
- `.badge-error` — red tint
- `.badge-info` — blue tint
- `.badge-neutral` — gray tint

**Component usage locations**:

- `ToolsNavigationView.svelte` — `.btn-start`, `.btn-danger`, `.btn-open`, `.badge`
- `DevicesPanel.svelte` — `.data-table-compact`, `.input-field`, `.badge-*`, `.band-chip`
- `ToolViewWrapper.svelte` — `.btn-ghost`, `.btn-sm`, `.badge-success`

---

## R5: Map Color Dependencies

**Question**: What map/spectrum components use hardcoded colors that need theme awareness?

**Finding**:

### DashboardMap.svelte — RANGE_BANDS (lines 44-58)

5 hardcoded hex colors:

```
#dc2626 (red, signal critical)
#f97316 (orange, signal strong)
#fbbf24 (yellow, signal good)
#10b981 (green, signal fair)
#4a90e2 (blue, signal weak)
```

### signal-utils.ts — getSignalHex() (lines 86-94)

Already uses `resolveThemeColor()` with hex fallbacks. This function is theme-aware via CSS variable resolution. No changes needed unless semantic toggle is OFF.

### theme-colors.ts — resolveThemeColor() (lines 1-49)

Uses `getComputedStyle()` to read CSS variables and convert to hex via temporary DOM element. Already supports any CSS color format (HSL, RGB, hex). Works correctly with palette switching since it reads computed values.

### Palantir CSS — Signal variables (lines 39-44)

Hardcoded hex values for signal colors:

```css
--palantir-signal-critical: #dc2626;
--palantir-signal-strong: #f97316;
--palantir-signal-good: #fbbf24;
--palantir-signal-fair: #10b981;
--palantir-signal-weak: #4a90e2;
```

These are in `:root` (always active), while `app.css` has HSL equivalents in `.dark {}`. The HSL versions will respond to semantic toggle; the hex Palantir versions will be used as fallbacks.

---

## R6: Store Patterns

**Question**: What localStorage persistence patterns exist in the codebase?

**Finding**: Three stores already use localStorage:

1. **dashboard-store.ts** — `ACTIVE_BOTTOM_TAB_KEY`, `BOTTOM_PANEL_STORAGE_KEY`
    - Simple key-value, read in store initializer
    - Written on state change via `$effect()` or explicit save

2. **terminal-store.ts** — `terminalPanelState`
    - Full JSON serialization of state object
    - Read in store initializer with fallback defaults
    - Written on every state change
    - Version-aware (resets on structure change)

3. **gsm-evil-store.ts** — `gsm-evil-state`
    - Full JSON serialization with explicit version field
    - QuotaExceededError handling
    - Manual persist via `forcePersist()` method
    - Version migration support

**Decision**: Theme store will follow the terminal-store pattern — JSON serialization of a simple state object, read at initialization, written on change. Add QuotaExceededError handling from gsm-evil-store.

---

## R7: Existing shadcn Components

**Question**: What shadcn components are already installed?

**Finding**: 2 components installed:

1. **Button** (`src/lib/components/ui/button/`)
    - Variants: default, destructive, outline, secondary, ghost, link
    - Sizes: default, sm, lg, icon, icon-sm, icon-lg
    - Uses: tailwind-variants, bits-ui
    - Already has barrel file (index.ts) per shadcn convention

2. **AlertDialog** (`src/lib/components/ui/alert-dialog/`)
    - Full dialog with header, content, description, footer, actions
    - Used in: gsm-evil/+page.svelte

**Components to install** (5):

- `table` — for DevicesPanel device list
- `input` — for DevicesPanel search
- `badge` — for status indicators across dashboard
- `select` — for Settings panel palette dropdown
- `switch` — for Settings panel mode and semantic toggles
