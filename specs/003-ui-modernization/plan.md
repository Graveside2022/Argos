# Implementation Plan: UI Modernization to Tailwind CSS v4 + shadcn

**Branch**: `003-ui-modernization` | **Date**: 2026-02-15 | **Spec**: [specs/003-ui-modernization/spec.md](spec.md)
**Input**: Feature specification from `/specs/003-ui-modernization/spec.md`

## Summary

Upgrade the Argos CSS infrastructure from Tailwind CSS v3.4.19 to v4.1.18, consolidate three parallel color systems into a single CSS variable system, install shadcn component library with Argos dark theme, and create a theme color bridge for Canvas/Leaflet APIs. Zero visual regression — the existing cyberpunk tactical theme must survive intact across all routes.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: SvelteKit 2.22.3, Svelte 5.35.5, Tailwind CSS 4.1.18 (upgrading from 3.4.19), @tailwindcss/vite 4.1.18, bits-ui 2.15.5, shadcn 3.8.4 (CLI)
**Storage**: SQLite (rf_signals.db) — no changes
**Testing**: Vitest 3.2.4, Playwright 1.53.2 — no test framework changes
**Target Platform**: Raspberry Pi 5 (8GB RAM, NVMe SSD), Kali Linux 2025.4, Docker v27.5.1, ARM64
**Project Type**: Web application (SvelteKit)
**Performance Goals**: Zero visual regression, build time increase <20%, bundle size increase <250KB gzipped
**Constraints**: Node.js heap 1024MB max, dark mode only, no layout changes, no functionality changes
**Scale/Scope**: 3 routes, 21 Svelte components, 586-line palantir CSS, 94-line app.css, 186-line app.html

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Design Check

| Article                        | Requirement                        | Status    | Notes                                                                                    |
| ------------------------------ | ---------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| I §1.1 Comprehension Lock      | Problem fully understood           | PASS      | Spec defines exact files, line counts, color mappings, dependency versions               |
| I §1.3 Codebase Inventory      | Related files identified           | PASS      | All 18 affected files inventoried with current line counts                               |
| II §2.1 TypeScript Strict      | No new `any` types                 | PASS      | Only new TS: cn() utility and resolveThemeColor() — both fully typed                     |
| II §2.7 Forbidden Patterns     | No service layers, no barrel files | DEVIATION | shadcn generates `src/lib/utils.ts` (catch-all name) — accepted, see Complexity Tracking |
| III §3.1 Test-First            | Tests for new code                 | PASS      | resolveThemeColor() and cn() get unit tests                                              |
| IV §4.1 Cyberpunk Design       | Theme preserved                    | PASS      | Same hex values mapped to new variable names                                             |
| IV §4.2 Reuse Before Create    | Search existing code first         | PASS      | `clsx` and `tailwind-merge` already installed, cn() reuses them                          |
| IV §4.3 State Communication    | All UI states handled              | N/A       | No new UI features — AlertDialog replaces browser alert()                                |
| V §5.2 Bundle Performance      | Bundle size within budget          | PASS      | bits-ui + tailwind-variants + lucide/svelte + svelte-sonner < 250KB gzipped              |
| VI §6.1 Dependency Discipline  | Pin exact versions                 | PASS      | All versions pinned in spec dependency table                                             |
| VI §6.3 Forbidden Dependencies | No CSS frameworks added            | PASS      | Tailwind CSS is the existing framework, being upgraded                                   |
| IX §9.3 Permission Boundaries  | User approval for config changes   | REQUIRED  | vite.config.ts, package.json, tailwind.config.js, postcss.config.js all need approval    |
| XII §12.1 Task-Based Commits   | One commit per task                | PASS      | Each phase → multiple tasks → one commit each                                            |

### Post-Design Check

| Article                        | Requirement                 | Status    | Notes                                                        |
| ------------------------------ | --------------------------- | --------- | ------------------------------------------------------------ |
| II §2.7 `utils.ts` prohibition | No catch-all utils          | DEVIATION | Documented in Complexity Tracking below                      |
| IV §4.5 No browser dialogs     | No alert()                  | PASS      | 2 alert() calls in gsm-evil replaced with shadcn AlertDialog |
| IV §4.5 No hardcoded colors    | Colors from theme           | PASS (P3) | 19 hex values in 5 TS files converted to resolveThemeColor() |
| VIII §8.3 Verification         | Full verification per phase | PASS      | typecheck + lint + test:unit + build after each phase        |

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-modernization/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 research output
├── data-model.md        # Entity definitions
├── quickstart.md        # Implementation guide
├── contracts/           # Component interface contracts
│   └── component-contracts.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app.css                              # REWRITE: CSS variables, @import, @theme, @plugin
├── app.html                             # SLIM: 186→~15 lines, add class="dark"
├── lib/
│   ├── utils.ts                         # CREATE: cn() utility (shadcn)
│   ├── utils/
│   │   └── theme-colors.ts              # CREATE: resolveThemeColor()
│   ├── styles/
│   │   └── palantir-design-system.css   # MODIFY: remove dead/shadowing classes
│   ├── components/
│   │   └── ui/
│   │       └── alert-dialog/            # CREATE: shadcn AlertDialog
│   ├── hackrf/
│   │   └── spectrum.ts                  # MODIFY: hex→resolveThemeColor()
│   ├── tactical-map/
│   │   ├── map-service.ts               # MODIFY: hex→resolveThemeColor()
│   │   └── utils/map-utils.ts           # MODIFY: hex→resolveThemeColor()
│   └── utils/
│       ├── signal-utils.ts              # MODIFY: hex→resolveThemeColor()
│       └── css-loader.ts               # MODIFY: hex check→CSS variable
├── routes/
│   └── gsm-evil/+page.svelte           # MODIFY: alert()→AlertDialog
├── Svelte files with palantir class updates:
│   ├── routes/dashboard/+page.svelte
│   ├── lib/components/dashboard/DashboardMap.svelte
│   ├── lib/components/dashboard/TerminalPanel.svelte
│   ├── lib/components/dashboard/TopStatusBar.svelte
│   ├── lib/components/dashboard/ResizableBottomPanel.svelte
│   ├── lib/components/dashboard/TerminalTabContent.svelte
│   ├── lib/components/dashboard/IconRail.svelte
│   ├── lib/components/dashboard/panels/OverviewPanel.svelte
│   ├── lib/components/dashboard/panels/DevicesPanel.svelte
│   ├── lib/components/dashboard/panels/LayersPanel.svelte
│   ├── lib/components/dashboard/panels/SettingsPanel.svelte
│   ├── lib/components/dashboard/panels/ToolsPanelHeader.svelte
│   ├── lib/components/dashboard/shared/ToolCard.svelte
│   └── lib/components/dashboard/shared/ToolCategoryCard.svelte

config/
├── postcss.config.js                    # DELETE
vite.config.ts                           # MODIFY: add @tailwindcss/vite
tailwind.config.js                       # DELETE
postcss.config.js (symlink)              # DELETE
components.json                          # CREATE: shadcn config
```

**Structure Decision**: SvelteKit project (existing structure preserved). New files added in `src/lib/components/ui/` (shadcn convention) and `src/lib/utils/` (theme bridge). No directory restructuring needed.

## Implementation Phases

### Phase 1: Tailwind CSS v4 Migration + Color Consolidation (P1)

**Goal**: Upgrade from TW v3 to v4, consolidate 3 color systems into 1, preserve all visual rendering.

**Tasks** (to be detailed in tasks.md):

1. Take pre-migration screenshots of all routes
2. Install TW v4 packages, remove PostCSS/autoprefixer
3. Run `npx @tailwindcss/upgrade`, review changes
4. Update `vite.config.ts` with `@tailwindcss/vite` plugin
5. Rewrite `src/app.css` with CSS-first config:
    - `@import "tailwindcss"` + `@import "tw-animate-css"`
    - `:root` block (shadcn zinc defaults)
    - `.dark` block (Argos theme in full `hsl()` values — see research.md R5)
    - `@custom-variant dark (&:is(.dark *))`
    - `@theme inline` block mapping CSS vars to Tailwind colors via `var()` (no `hsl()` wrapper)
    - `@plugin "@tailwindcss/forms"` + `@plugin "@tailwindcss/typography"`
    - `@layer base` with `@apply border-border outline-ring/50`, cursor-pointer fix
    - `@layer components` with glass effects (migrated from `rgb(var())` to `var()`)
6. Add `class="dark"` to `<html>` in `app.html`
7. Slim `app.html` inline CSS to FOUC-prevention only
8. Update shadowing palantir utility classes in all Svelte files:
    - `.text-primary` (26 usages, 12 files) → `text-foreground`
    - `.text-secondary` (22 usages, 13 files) → `text-muted-foreground`
    - `.bg-panel` (7 usages, 4 files) → `bg-card`
    - `.border-default` (10 usages, 6 files) → `border-border`
9. Remove dead CSS classes from palantir-design-system.css
10. Delete `tailwind.config.js`, `postcss.config.js` (symlink + target)
11. Verify: typecheck + lint + build + visual comparison

**Critical path**: Tasks 2→3→4→5 must be sequential. Task 6 then 7 sequentially (app.html removes old CSS vars that app.css recreates). Tasks 8-9 after 5+7. Task 10-11 last.

### Phase 2: shadcn Component Library Installation (P2)

**Goal**: Install shadcn, generate AlertDialog, replace browser alert() calls.

**Tasks**:

1. Install shadcn dependencies (bits-ui, @internationalized/date, tailwind-variants, @lucide/svelte, svelte-sonner)
2. Run `npx shadcn init` (new-york style, zinc base)
3. Verify `components.json` and `src/lib/utils.ts` generated correctly
4. Ensure Argos theme colors in `.dark {}` block (should already be from Phase 1)
5. Remove dead palantir CSS classes (`.section-header`, `.metric-*`, `.glass-*` from app.html)
6. Run `npx shadcn add alert-dialog`
7. Replace 2 `alert()` calls in `src/routes/gsm-evil/+page.svelte` with AlertDialog
8. Verify: typecheck + lint + test:unit + build + visual comparison

### Phase 3: Theme Color Bridge (P3)

**Goal**: Replace hardcoded hex colors with theme-aware utility.

**Tasks**:

1. Create `src/lib/utils/theme-colors.ts` with `resolveThemeColor()`
2. Add unit tests for resolveThemeColor()
3. Update `src/lib/utils/signal-utils.ts` (6 hex values)
4. Update `src/lib/hackrf/spectrum.ts` (4 hex values)
5. Update `src/lib/tactical-map/utils/map-utils.ts` (7 hex values)
6. Update `src/lib/tactical-map/map-service.ts` (2 hex values)
7. Update `src/lib/utils/css-loader.ts`: change `isCriticalCSSLoaded()` from checking `--bg-primary === '#0a0a0a'` to checking `--background` for a non-empty value (the new variable contains `hsl(220 24% 7%)`, not a hex string)
8. Verify: typecheck + lint + test:unit + build + visual comparison

### Phase 4: Incremental Component Adoption (P4) — Future

**Goal**: Replace palantir CSS classes with shadcn components. NOT part of this implementation cycle — documented here for completeness.

**Order of adoption** (by impact):

1. `.data-table` (1 usage in 1 file) → shadcn `<Table>`
2. `.input-field` (3 usages in 1 file) → shadcn `<Input>`
3. `.badge-*` (1 palantir class usage in 1 file) → shadcn `<Badge>`
4. `.btn-*` (6 elements across 3 files using palantir btn classes) → shadcn `<Button>`

## Target app.css Structure

> **UPDATED 2026-02-15**: CSS variables use full `hsl()` wrapped values (not bare channels).
> `@theme inline` uses `var()` directly (not `hsl(var())`). Matches current shadcn-svelte convention.

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import './lib/styles/palantir-design-system.css';

@custom-variant dark (&:is(.dark *));

/* ---- Light Mode (convention only — never visible) ---- */
:root {
	--radius: 0.5rem;
	--background: hsl(0 0% 100%);
	--foreground: hsl(240 10% 4%);
	--card: hsl(0 0% 100%);
	--card-foreground: hsl(240 10% 4%);
	--popover: hsl(0 0% 100%);
	--popover-foreground: hsl(240 10% 4%);
	--primary: hsl(240 6% 10%);
	--primary-foreground: hsl(0 0% 98%);
	--secondary: hsl(240 5% 96%);
	--secondary-foreground: hsl(240 6% 10%);
	--muted: hsl(240 5% 96%);
	--muted-foreground: hsl(240 4% 46%);
	--accent: hsl(240 5% 96%);
	--accent-foreground: hsl(240 6% 10%);
	--destructive: hsl(0 84% 60%);
	--destructive-foreground: hsl(0 0% 98%);
	--border: hsl(240 6% 90%);
	--input: hsl(240 6% 90%);
	--ring: hsl(240 6% 10%);
	--chart-1: hsl(12 76% 61%);
	--chart-2: hsl(173 58% 39%);
	--chart-3: hsl(197 37% 24%);
	--chart-4: hsl(43 74% 66%);
	--chart-5: hsl(27 87% 67%);
	--chart-6: hsl(43 74% 66%);
}

/* ---- Dark Mode (Argos cyberpunk theme) ---- */
.dark {
	--background: hsl(220 24% 7%);
	--foreground: hsl(216 12% 92%);
	--card: hsl(222 16% 13%);
	--card-foreground: hsl(216 12% 92%);
	--popover: hsl(222 16% 13%);
	--popover-foreground: hsl(216 12% 92%);
	--primary: hsl(212 100% 64%);
	--primary-foreground: hsl(0 0% 100%);
	--secondary: hsl(224 13% 19%);
	--secondary-foreground: hsl(216 12% 92%);
	--muted: hsl(223 15% 10%);
	--muted-foreground: hsl(210 5% 63%);
	--accent: hsl(222 12% 16%);
	--accent-foreground: hsl(216 12% 92%);
	--destructive: hsl(0 91% 71%);
	--destructive-foreground: hsl(0 0% 100%);
	--border: hsl(222 10% 19%);
	--input: hsl(220 15% 12%);
	--ring: hsl(212 100% 64%);

	/* Chart colors */
	--chart-1: hsl(212 100% 64%);
	--chart-2: hsl(160 84% 39%);
	--chart-3: hsl(25 95% 53%);
	--chart-4: hsl(263 90% 76%);
	--chart-5: hsl(0 91% 71%);
	--chart-6: hsl(43 96% 56%);

	/* Argos custom tokens */
	--success: hsl(142 69% 58%);
	--success-foreground: hsl(220 24% 7%);
	--warning: hsl(43 96% 56%);
	--warning-foreground: hsl(220 24% 7%);
	--info: hsl(217 92% 68%);
	--info-foreground: hsl(220 24% 7%);
	--text-muted: hsl(213 4% 39%);

	/* Signal strength scale */
	--signal-critical: hsl(0 72% 51%);
	--signal-strong: hsl(25 95% 53%);
	--signal-good: hsl(43 96% 56%);
	--signal-fair: hsl(160 84% 39%);
	--signal-weak: hsl(212 72% 59%);

	/* Feature categories */
	--feature-rf: hsl(25 95% 53%);
	--feature-drone: hsl(189 95% 43%);
	--feature-radio: hsl(272 91% 65%);
}

/* ---- Theme mapping for Tailwind utilities ---- */
@theme inline {
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-accent: var(--accent);
	--color-accent-foreground: var(--accent-foreground);
	--color-destructive: var(--destructive);
	--color-destructive-foreground: var(--destructive-foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--color-chart-1: var(--chart-1);
	--color-chart-2: var(--chart-2);
	--color-chart-3: var(--chart-3);
	--color-chart-4: var(--chart-4);
	--color-chart-5: var(--chart-5);
	--color-chart-6: var(--chart-6);

	/* Argos custom colors */
	--color-success: var(--success);
	--color-success-foreground: var(--success-foreground);
	--color-warning: var(--warning);
	--color-warning-foreground: var(--warning-foreground);
	--color-info: var(--info);
	--color-info-foreground: var(--info-foreground);
	--color-text-muted: var(--text-muted);
	--color-signal-critical: var(--signal-critical);
	--color-signal-strong: var(--signal-strong);
	--color-signal-good: var(--signal-good);
	--color-signal-fair: var(--signal-fair);
	--color-signal-weak: var(--signal-weak);
	--color-feature-rf: var(--feature-rf);
	--color-feature-drone: var(--feature-drone);
	--color-feature-radio: var(--feature-radio);

	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
}

@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/typography";

@layer base {
	* {
		@apply border-border outline-ring/50;
	}

	button:not(:disabled),
	[role='button']:not(:disabled) {
		cursor: pointer;
	}

	body {
		@apply bg-background text-foreground;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}
}

@layer components {
	/* Glass effects (migrated from rgb(var()) to var() — CSS vars now contain full color values) */
	.glass-panel {
		@apply backdrop-blur-xl border;
		background-color: color-mix(in srgb, var(--card) 80%, transparent);
		border-color: color-mix(in srgb, var(--border) 40%, transparent);
	}

	.glass-panel-light {
		@apply backdrop-blur-md border;
		background-color: color-mix(in srgb, var(--card) 60%, transparent);
		border-color: color-mix(in srgb, var(--border) 30%, transparent);
	}

	.glass-button {
		@apply backdrop-blur-sm border transition-all duration-200;
		background-color: color-mix(in srgb, var(--secondary) 20%, transparent);
		border-color: color-mix(in srgb, var(--border) 40%, transparent);
	}
	.glass-button:hover {
		background-color: color-mix(in srgb, var(--secondary) 40%, transparent);
		border-color: color-mix(in srgb, var(--primary) 60%, transparent);
	}

	.glass-input {
		@apply backdrop-blur-sm border text-foreground focus:outline-hidden transition-all duration-200;
		background-color: color-mix(in srgb, var(--input) 60%, transparent);
		border-color: color-mix(in srgb, var(--border) 40%, transparent);
	}
	.glass-input:focus {
		background-color: color-mix(in srgb, var(--input) 80%, transparent);
		border-color: color-mix(in srgb, var(--primary) 60%, transparent);
	}
	.glass-input::placeholder {
		color: var(--text-muted);
	}

	/* Status indicators */
	.status-indicator {
		@apply w-2 h-2 rounded-full;
	}
	.status-connected {
		@apply bg-green-500 animate-pulse;
	}
	.status-disconnected {
		@apply bg-red-500;
	}
	.status-connecting {
		@apply bg-yellow-500 animate-pulse;
	}

	/* Brand styles */
	.hackrf-brand {
		color: var(--feature-rf) !important;
	}
	.sweep-brand {
		color: #ffffff !important;
	}

	/* Shadow effects */
	.shadow-red-glow {
		box-shadow: 0 0 16px color-mix(in srgb, var(--destructive) 30%, transparent);
	}
	.shadow-mono-glow {
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
	}

	/* Spectrum display */
	.spectrum-container {
		@apply bg-card rounded-xl border border-border p-6;
	}
	.signal-strength-bar {
		@apply h-full transition-all duration-300;
	}
}
```

## Complexity Tracking

> Violations that must be justified per Constitution

| Violation                                        | Why Needed                                                                                                                                                                                    | Simpler Alternative Rejected Because                                                                                                                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/utils.ts` (catch-all name, Art II §2.7) | shadcn CLI generates this file; all shadcn components import `cn` from `$lib/utils`. Renaming breaks the CLI's component generation.                                                          | Renaming to `src/lib/class-names.ts` and updating `components.json` aliases was considered but rejected because every `npx shadcn add` command would need manual path fixes. The file contains exactly one function with a clear purpose — it is not a generic catch-all. |
| Modifying config files (Art IX §9.3)             | Migration requires changes to `vite.config.ts`, `package.json`, deletion of `tailwind.config.js`, `postcss.config.js`. These are core infrastructure changes required by the TW v4 migration. | N/A — no alternative exists. Config changes are inherent to a framework upgrade. User approval required per §9.3.                                                                                                                                                         |
| Pre-existing hardcoded `#ffffff` (Art II §2.7)   | `.sweep-brand { color: #ffffff }` and `.shadow-mono-glow { box-shadow: rgba(255,255,255,0.2) }` in app.css use hardcoded white. These are migrated from existing code, not newly introduced.  | Converting to `var(--foreground)` was considered but rejected: sweep-brand requires pure white regardless of foreground color, and shadow-mono-glow needs a white glow effect. Both are legitimate pure-color constants, not theme-variable candidates.                   |
| shadcn barrel files (Art II §2.7)                | shadcn CLI generates `index.ts` in each component directory (`src/lib/components/ui/*/index.ts`). All shadcn components require imports via these files. No configuration option to disable.  | Importing from individual `.svelte` files is not supported by shadcn. Deleting `index.ts` after generation breaks all `npx shadcn add` commands and diverges from all documentation examples. Constitution updated (v2.1.0) to add shadcn exception.                      |

## Post-Migration Constitution Update

> **COMPLETED 2026-02-15** — Constitution updated to v2.1.0 per Art X §10.3 trigger #6 (Dependency change).
> Updated: Preamble (tailwind.config.js → src/app.css), Art II §2.7 (barrel file exception for shadcn, theme location), Art IV §4.1 (theme location), Art VI §6.2 (theme extension location).
