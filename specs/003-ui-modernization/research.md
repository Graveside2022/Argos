# Research: UI Modernization to Tailwind CSS v4 + shadcn

**Feature**: 003-ui-modernization
**Date**: 2026-02-15

---

## R1: Tailwind CSS v3 → v4 Migration Mechanics

### Decision: Use `@tailwindcss/vite` plugin with CSS-first configuration

**Rationale**: TW v4 eliminates PostCSS dependency when using framework-specific plugins. The `@tailwindcss/vite` plugin handles all CSS processing natively in the Vite pipeline, removing the need for `postcss.config.js` and `autoprefixer`.

**Key Changes**:

1. **Import syntax**: `@tailwind base/components/utilities` → `@import "tailwindcss"`
2. **Config format**: `tailwind.config.js` (JS) → `@theme` block in `app.css` (CSS-first)
3. **Content detection**: Automatic — no `content: [...]` array needed
4. **Plugin syntax**: `plugins: [require('@tailwindcss/forms')]` → `@plugin "@tailwindcss/forms"`
5. **PostCSS removal**: `@tailwindcss/vite` replaces both `postcss` and `autoprefixer`

**Vite config change**:

```typescript
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), terminalPlugin()]
	// ... rest unchanged
});
```

**Alternatives considered**:

- `@tailwindcss/postcss`: Keeps PostCSS pipeline. Rejected — unnecessary complexity when Vite plugin is available.
- Manual PostCSS + TW v4: Rejected — deprecated path.

---

## R2: Border Default Change Fix

### Decision: Global `@apply border-border` base style in app.css (UPDATED)

**Rationale**: TW v4 changed `border` utility from `border-color: gray-200` to `border-color: currentColor`. In dark mode, `currentColor` is light text color, causing bright white borders on all elements using `border` utility without explicit color.

**Fix** (in app.css `@layer base`, matches shadcn-svelte convention):

```css
@layer base {
	* {
		@apply border-border outline-ring/50;
	}
}
```

This sets all borders to use the `--border` design token and outlines to use `--ring` at 50% opacity. `--border` is set to `hsl(222 10% 19%)` (equivalent to `#2c2f36`) in the `.dark` block.

**Alternatives considered**:

- Per-element `border-border` classes: Rejected — requires modifying 193+ elements across 20 files.
- `border-color: var(--color-border)` on `*`: Works but doesn't follow shadcn convention and misses the `outline-ring/50` enhancement.

---

## R3: Cursor Pointer Restoration

### Decision: Global base style for buttons and interactive elements

**Rationale**: TW v4 changed buttons to `cursor: default`. Military operators expect pointer cursor on clickable elements.

**Fix** (in app.css `@layer base`):

```css
@layer base {
	button,
	[role='button'],
	[type='button'],
	[type='submit'],
	[type='reset'],
	select {
		cursor: pointer;
	}
}
```

---

## R4: Utility Class Renames in v4

### Decision: Let `npx @tailwindcss/upgrade` handle renames, verify manually

**Key renames**:
| v3 | v4 |
|---|---|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `shadow-md` | `shadow` |
| `rounded-sm` | `rounded-xs` |
| `rounded` | `rounded-sm` |
| `rounded-md` | `rounded` |
| `blur-sm` | `blur-xs` |
| `blur` | `blur-sm` |
| `ring-offset-*` | `ring-offset-*` (unchanged but syntax changes) |
| `text-opacity-*` | Removed — use `text-color/opacity` modifier |

**Rationale**: The upgrade CLI handles these renames automatically in most files. Manual review needed for Svelte template files where the CLI may miss dynamic class bindings.

---

## R5: Color Variable Format for shadcn

### Decision: Full `hsl()` wrapped values in CSS variables (UPDATED 2026-02-15)

**Rationale**: TW v4 no longer uses bare HSL channel values. The latest shadcn-svelte docs use **OKLCH** (`oklch(0.145 0 0)`) as the canonical format. However, for Argos we use **full `hsl()` wrapped values** (e.g., `hsl(220 24% 7%)`) because:

1. Our colors are already mapped from hex → HSL (simpler than hex → OKLCH conversion)
2. HSL is more human-readable for debugging tactical theme colors
3. TW v4 handles opacity modifiers natively via CSS relative color syntax regardless of format
4. The `@theme inline` block uses `var(--background)` directly (no `hsl()` wrapping in theme)

**IMPORTANT**: The old bare-channel pattern (`--background: 220 24% 7%` + `hsl(var(--background))` in `@theme`) is a **TW v3 convention** that does NOT work correctly in TW v4. CSS variables must contain complete, valid CSS color values.

**Complete Color Conversion Table** (Argos dark theme):

| Variable                   | Hex     | CSS Value         |
| -------------------------- | ------- | ----------------- |
| `--background`             | #0e1116 | hsl(220 24% 7%)   |
| `--foreground`             | #e8eaed | hsl(216 12% 92%)  |
| `--card`                   | #1c1f26 | hsl(222 16% 13%)  |
| `--card-foreground`        | #e8eaed | hsl(216 12% 92%)  |
| `--popover`                | #1c1f26 | hsl(222 16% 13%)  |
| `--popover-foreground`     | #e8eaed | hsl(216 12% 92%)  |
| `--primary`                | #4a9eff | hsl(212 100% 64%) |
| `--primary-foreground`     | #ffffff | hsl(0 0% 100%)    |
| `--secondary`              | #2a2d35 | hsl(224 13% 19%)  |
| `--secondary-foreground`   | #e8eaed | hsl(216 12% 92%)  |
| `--muted`                  | #16181d | hsl(223 15% 10%)  |
| `--muted-foreground`       | #9aa0a6 | hsl(210 5% 63%)   |
| `--accent`                 | #25282f | hsl(222 12% 16%)  |
| `--accent-foreground`      | #e8eaed | hsl(216 12% 92%)  |
| `--destructive`            | #f87171 | hsl(0 91% 71%)    |
| `--destructive-foreground` | #ffffff | hsl(0 0% 100%)    |
| `--border`                 | #2c2f36 | hsl(222 10% 19%)  |
| `--input`                  | #1a1d23 | hsl(220 15% 12%)  |
| `--ring`                   | #4a9eff | hsl(212 100% 64%) |
| `--radius`                 | —       | 0.5rem            |
| `--chart-1`                | #4a9eff | hsl(212 100% 64%) |
| `--chart-2`                | #10b981 | hsl(160 84% 39%)  |
| `--chart-3`                | #f97316 | hsl(25 95% 53%)   |
| `--chart-4`                | #a78bfa | hsl(263 90% 76%)  |
| `--chart-5`                | #f87171 | hsl(0 91% 71%)    |

| Custom Variable        | Hex     | CSS Value        |
| ---------------------- | ------- | ---------------- |
| `--success`            | #4ade80 | hsl(142 69% 58%) |
| `--success-foreground` | #0e1116 | hsl(220 24% 7%)  |
| `--warning`            | #fbbf24 | hsl(43 96% 56%)  |
| `--warning-foreground` | #0e1116 | hsl(220 24% 7%)  |
| `--info`               | #60a5fa | hsl(217 92% 68%) |
| `--info-foreground`    | #0e1116 | hsl(220 24% 7%)  |
| `--text-muted`         | #5f6368 | hsl(213 4% 39%)  |
| `--signal-critical`    | #dc2626 | hsl(0 72% 51%)   |
| `--signal-strong`      | #f97316 | hsl(25 95% 53%)  |
| `--signal-good`        | #fbbf24 | hsl(43 96% 56%)  |
| `--signal-fair`        | #10b981 | hsl(160 84% 39%) |
| `--signal-weak`        | #4a90e2 | hsl(212 72% 59%) |
| `--feature-rf`         | #f97316 | hsl(25 95% 53%)  |
| `--feature-drone`      | #06b6d4 | hsl(189 95% 43%) |
| `--feature-radio`      | #a855f7 | hsl(272 91% 65%) |

**:root (light mode) — shadcn zinc defaults** (never displayed, convention only):

| Variable                   | CSS Value       |
| -------------------------- | --------------- |
| `--background`             | hsl(0 0% 100%)  |
| `--foreground`             | hsl(240 10% 4%) |
| `--card`                   | hsl(0 0% 100%)  |
| `--card-foreground`        | hsl(240 10% 4%) |
| `--popover`                | hsl(0 0% 100%)  |
| `--popover-foreground`     | hsl(240 10% 4%) |
| `--primary`                | hsl(240 6% 10%) |
| `--primary-foreground`     | hsl(0 0% 98%)   |
| `--secondary`              | hsl(240 5% 96%) |
| `--secondary-foreground`   | hsl(240 6% 10%) |
| `--muted`                  | hsl(240 5% 96%) |
| `--muted-foreground`       | hsl(240 4% 46%) |
| `--accent`                 | hsl(240 5% 96%) |
| `--accent-foreground`      | hsl(240 6% 10%) |
| `--destructive`            | hsl(0 84% 60%)  |
| `--destructive-foreground` | hsl(0 0% 98%)   |
| `--border`                 | hsl(240 6% 90%) |
| `--input`                  | hsl(240 6% 90%) |
| `--ring`                   | hsl(240 6% 10%) |

---

## R6: `color-mix()` and `rgb(var())` Pattern Migration

### Decision: Convert to `var()` references using full color values, preserve `color-mix()` for glass effects

**Rationale**: The current codebase uses `rgb(var(--border-primary))` where `--border-primary: 44 47 54` (bare RGB triplets). This pattern is a TW v3 convention for opacity support. In TW v4, CSS variables contain complete color values (e.g., `hsl(222 10% 19%)`), so `color-mix()` can reference them directly via `var()`.

**Migration approach**:

1. Replace `rgb(var(--border-primary))` with `var(--border)` in app.css glass effects
2. Replace `rgb(var(--bg-card))` with `var(--card)` etc.
3. `color-mix()` calls remain unchanged in structure — the `var()` reference resolves to a full color value
4. app.html inline CSS: remove entirely (move to FOUC-prevention only) — all `rgb(var())` patterns there are dead weight since the same styles exist in app.css

**Example before/after**:

```css
/* Before */
background-color: color-mix(in srgb, rgb(var(--bg-card)) 80%, transparent);

/* After (CSS variables now contain full hsl() values) */
background-color: color-mix(in srgb, var(--card) 80%, transparent);
```

---

## R7: shadcn CLI + SvelteKit + TW v4 Setup

### Decision: Use `npx shadcn init` with manual theme override in same commit

**Workflow**:

1. Run `npx shadcn-svelte@latest init` — select base-color=zinc
2. CLI creates `components.json` and `src/lib/utils.ts` (cn utility + type helpers)
3. CLI may modify `app.css` — immediately restore and apply Argos theme colors
4. Theme colors applied in same commit to avoid any commit with default zinc colors

**components.json structure** (TW v4 format — UPDATED):

```json
{
	"$schema": "https://shadcn-svelte.com/schema.json",
	"tailwind": {
		"css": "src/app.css",
		"baseColor": "zinc"
	},
	"aliases": {
		"components": "$lib/components",
		"utils": "$lib/utils",
		"ui": "$lib/components/ui",
		"hooks": "$lib/hooks",
		"lib": "$lib"
	},
	"typescript": true,
	"registry": "https://shadcn-svelte.com/registry"
}
```

**Key differences from TW v3 format**: No `style` field (new-york is default/only). No `tailwind.config` field. Added `registry`, `ui`, and `lib` alias fields.

**cn() utility + type helpers** (`src/lib/utils.ts`):

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
```

The four type helpers (`WithoutChild`, `WithoutChildren`, `WithoutChildrenOrChild`, `WithElementRef`) are used by shadcn-svelte components for bits-ui prop typing in Svelte 5.

**Note**: Constitution Article II §2.7 forbids catch-all `utils.ts` files. However, shadcn CLI generates this file and all shadcn components import from it. This is an accepted deviation — the file contains `cn()` plus type helpers with clear, well-defined purposes. Document as complexity tracking item.

---

## R8: tw-animate-css vs tailwindcss-animate

### Decision: Use `tw-animate-css` (CSS-only, TW v4 compatible)

**Rationale**: `tailwindcss-animate` is a TW v3 JavaScript plugin that uses `addUtilities()` API — incompatible with TW v4's CSS-first architecture. `tw-animate-css` is the CSS-only replacement that provides the same animation classes via a CSS import.

**Usage in app.css**:

```css
@import 'tw-animate-css';
```

No `@plugin` directive needed — it's a pure CSS file, not a TW plugin.

---

## R9: `@plugin` Directive for Forms and Typography

### Decision: Use `@plugin` directive in app.css

**Syntax**:

```css
@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/typography";
```

**Compatibility**: Both packages declare `peerDependencies: { tailwindcss: ">=4.0.0-beta.1" }` (confirmed in spec's dependency table). The `@plugin` directive is TW v4's replacement for the JS config `plugins: [require()]` pattern.

---

## R10: `@custom-variant dark` for shadcn Dark Mode

### Decision: Use class-based dark mode with shadcn's custom variant

**Syntax in app.css**:

```css
@custom-variant dark (&:is(.dark *));
```

**Requirement**: `<html class="dark">` must be set in `app.html`. Currently missing — must be added during color consolidation phase.

**How it works**: When `class="dark"` is on `<html>`, all descendant elements match the `&:is(.dark *)` selector, activating the `.dark {}` CSS variable block. This replaces TW v3's `darkMode: 'class'` config option.

---

## R11: Vite 7 Compatibility

### Decision: Compatible — `@tailwindcss/vite@4.1.18` supports Vite 7

**Rationale**: The `@tailwindcss/vite` package updated its peer dependency to include `vite@^7` in releases after 4.1.10 (GitHub PR #18384). The project uses Vite 7.0.3, which is within the supported range for `@tailwindcss/vite@4.1.18`.

---

## R12: CSS Variable Opacity Support in TW v4 (UPDATED)

### Decision: Direct `var()` reference in `@theme inline` — no wrapper needed

**Rationale**: In TW v4, CSS variables contain complete color values (e.g., `hsl(220 24% 7%)`). The `@theme inline` block maps them directly via `var()`. TW v4 uses CSS-native relative color syntax for opacity modifiers (`bg-primary/50`), which works with any valid CSS color format (hsl, oklch, hex).

**@theme block example** (matches current shadcn-svelte convention):

```css
@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-primary: var(--primary);
	/* ... */
}
```

This allows `bg-primary/50` to work automatically. The `inline` keyword ensures the utility resolves the variable at use-time (correct for `.dark` mode switching).

This allows usage like `bg-primary/50` which compiles to `background-color: hsl(var(--primary) / 0.5)`.

---

## R13: Dead CSS Audit Results

### Decision: Confirmed dead classes for removal

**Palantir classes with zero Svelte usages**:

- `.section-header` — 0 usages
- `.metric-value`, `.metric-label` — 0 usages
- `.saasfly-*` (in app.html) — 0 usages in Svelte
- `.glass-panel`, `.glass-button`, `.glass-panel-light` (in app.html) — 0 usages in Svelte (duplicated in app.css)
- `.status-panel`, `.saasfly-info-card`, `.saasfly-metric-card`, `.saasfly-status-card`, `.saasfly-interactive-card` — 0 usages

**Palantir utility classes that shadow Tailwind**:

- `.text-primary` — 26 usages in 12 Svelte files (must update to `text-foreground`)
- `.text-secondary` — 22 usages in 13 files (must update to `text-muted-foreground`)
- `.bg-panel` — 7 usages in 4 files (must update to `bg-card`)
- `.border-default` — 10 usages in 6 files (must update to `border-border`)

**Active palantir component classes** (keep until P4/P5 adoption):

- `.btn-*` — 20 usages in 4 files
- `.badge-*` — 1 usage in 1 file
- `.input-field` — 3 usages in 1 file
- `.data-table` — 1 usage in 1 file

**Note**: Spec claimed 79 btn-_ usages and 27 badge-_ usages. Actual codebase audit shows 20 and 1 respectively. Plan uses actual counts.

---

## R14: `@tailwindcss/upgrade` CLI Tool

### Decision: Run the upgrade tool, then manually fix Svelte-specific issues

**Command**: `npx @tailwindcss/upgrade`

**What it does**:

- Renames utility classes (shadow-sm → shadow-xs, etc.)
- Converts `tailwind.config.js` to CSS-first `@theme` block
- Updates `@tailwind` directives to `@import "tailwindcss"`
- Removes PostCSS config if detected

**What it does NOT do well**:

- Svelte template expressions with dynamic classes
- `class:directive={condition}` bindings
- Conditional class strings in `{#if}` blocks

**Approach**: Run the tool first, then `git diff` to review all changes. Manually fix any missed patterns in Svelte files.
