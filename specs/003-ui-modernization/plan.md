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
├── (20 Svelte files)                    # MODIFY: text-primary→text-foreground, etc.

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
    - `.dark` block (Argos theme HSL values — see research.md R5)
    - `@custom-variant dark (&:is(.dark *))`
    - `@theme inline` block mapping CSS vars to Tailwind colors
    - `@plugin "@tailwindcss/forms"` + `@plugin "@tailwindcss/typography"`
    - `@layer base` with border-color fix, cursor-pointer fix
    - `@layer components` with glass effects (migrated from rgb() to hsl())
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

**Critical path**: Tasks 2→3→4→5 must be sequential. Task 6-7 can parallel with 5. Tasks 8-9 after 5. Task 10-11 last.

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
7. Update `src/lib/utils/css-loader.ts` (1 hex check)
8. Verify: typecheck + lint + test:unit + build + visual comparison

### Phase 4: Incremental Component Adoption (P4) — Future

**Goal**: Replace palantir CSS classes with shadcn components. NOT part of this implementation cycle — documented here for completeness.

**Order of adoption** (by impact):

1. `.data-table` (1 usage) → shadcn `<Table>`
2. `.input-field` (3 usages) → shadcn `<Input>`
3. `.badge-*` (1 usage) → shadcn `<Badge>`
4. `.btn-*` (20 usages) → shadcn `<Button>`

### Phase 5: Theme Switcher (P5) — Future

**Goal**: Add a theme color palette selector and dark/light mode toggle to the Settings panel. Operator can customize the app's color scheme without affecting layouts or functionality.

**Depends on**: Phase 1-3 complete (unified CSS variable system + shadcn installed). Phase 4 (component adoption) is independent — theme switcher works regardless of whether palantir classes are replaced with shadcn components, because both systems consume the same CSS variables.

**Tasks** (high-level, to be detailed in tasks.md when implementation begins):

1. Create 8 palette definition files (Blue, Green, Orange, Red, Rose, Violet, Yellow, Zinc) — each is a JS object mapping all ~30+ CSS variable names to HSL values for both dark and light mode
2. Source standard shadcn variable values from the shadcn-svelte themes page; extend with Argos-custom tokens (signal, feature, chart) harmonized to each palette
3. Create `src/lib/stores/dashboard/theme-store.ts` — Svelte store managing active palette name + mode (dark/light), persists to `localStorage`
4. Add FOUC-prevention script to `app.html` — reads `localStorage` before first paint and applies saved palette/mode
5. Install shadcn `<Select>` and `<Switch>` components for the settings UI
6. Implement theme section in `SettingsPanel.svelte` — palette dropdown with color swatches + dark/light toggle
7. Wire theme store to CSS variable application — on change, iterate palette object and call `document.documentElement.style.setProperty()` for each variable
8. Wire mode toggle to `class="dark"` on `<html>` element
9. Update `resolveThemeColor()` to re-resolve colors when theme changes (invalidate cached hex values)
10. Verify: all routes render correctly with each palette in both dark and light modes, no layout shifts, no broken features

**Key files**:

```text
src/lib/stores/dashboard/theme-store.ts          # CREATE: palette + mode store
src/lib/themes/palettes.ts                       # CREATE: 8 palette definitions
src/lib/components/dashboard/panels/SettingsPanel.svelte  # MODIFY: add theme section
src/app.html                                     # MODIFY: add FOUC-prevention script
src/lib/utils/theme-colors.ts                    # MODIFY: invalidate cache on theme change
src/lib/components/ui/select/                    # CREATE: shadcn Select component
src/lib/components/ui/switch/                    # CREATE: shadcn Switch component
```

**Design reference**: `docs/prompts/Prompt - UI Construction.md` — the UI Feature Construction Engine provides the HCI research-backed methodology for building the settings panel UI (Tier 0: Requirements, Tier 3: Component Selection, Tier 4: Interaction Design)

## Target app.css Structure

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import './lib/styles/palantir-design-system.css';

@custom-variant dark (&:is(.dark *));

/* ---- Light Mode (convention only — never visible) ---- */
:root {
	--background: 0 0% 100%;
	--foreground: 240 10% 4%;
	--card: 0 0% 100%;
	--card-foreground: 240 10% 4%;
	--popover: 0 0% 100%;
	--popover-foreground: 240 10% 4%;
	--primary: 240 6% 10%;
	--primary-foreground: 0 0% 98%;
	--secondary: 240 5% 96%;
	--secondary-foreground: 240 6% 10%;
	--muted: 240 5% 96%;
	--muted-foreground: 240 4% 46%;
	--accent: 240 5% 96%;
	--accent-foreground: 240 6% 10%;
	--destructive: 0 84% 60%;
	--destructive-foreground: 0 0% 98%;
	--border: 240 6% 90%;
	--input: 240 6% 90%;
	--ring: 240 6% 10%;
	--radius: 0.5rem;
	--chart-1: 12 76% 61%;
	--chart-2: 173 58% 39%;
	--chart-3: 197 37% 24%;
	--chart-4: 43 74% 66%;
	--chart-5: 27 87% 67%;
}

/* ---- Dark Mode (Argos cyberpunk theme) ---- */
.dark {
	--background: 220 24% 7%;
	--foreground: 216 12% 92%;
	--card: 222 16% 13%;
	--card-foreground: 216 12% 92%;
	--popover: 222 16% 13%;
	--popover-foreground: 216 12% 92%;
	--primary: 212 100% 64%;
	--primary-foreground: 0 0% 100%;
	--secondary: 224 13% 19%;
	--secondary-foreground: 216 12% 92%;
	--muted: 223 15% 10%;
	--muted-foreground: 210 5% 63%;
	--accent: 222 12% 16%;
	--accent-foreground: 216 12% 92%;
	--destructive: 0 91% 71%;
	--destructive-foreground: 0 0% 100%;
	--border: 222 10% 19%;
	--input: 220 15% 12%;
	--ring: 212 100% 64%;
	--radius: 0.5rem;

	/* Chart colors */
	--chart-1: 212 100% 64%;
	--chart-2: 160 84% 39%;
	--chart-3: 25 95% 53%;
	--chart-4: 263 90% 76%;
	--chart-5: 0 91% 71%;

	/* Argos custom tokens */
	--success: 142 69% 58%;
	--success-foreground: 220 24% 7%;
	--warning: 43 96% 56%;
	--warning-foreground: 220 24% 7%;
	--info: 217 92% 68%;
	--info-foreground: 220 24% 7%;
	--text-muted: 213 4% 39%;

	/* Signal strength scale */
	--signal-critical: 0 72% 51%;
	--signal-strong: 25 95% 53%;
	--signal-good: 43 96% 56%;
	--signal-fair: 160 84% 39%;
	--signal-weak: 212 72% 59%;

	/* Feature categories */
	--feature-rf: 25 95% 53%;
	--feature-drone: 189 95% 43%;
	--feature-radio: 272 91% 65%;
}

/* ---- Theme mapping for Tailwind utilities ---- */
@theme inline {
	--color-background: hsl(var(--background));
	--color-foreground: hsl(var(--foreground));
	--color-card: hsl(var(--card));
	--color-card-foreground: hsl(var(--card-foreground));
	--color-popover: hsl(var(--popover));
	--color-popover-foreground: hsl(var(--popover-foreground));
	--color-primary: hsl(var(--primary));
	--color-primary-foreground: hsl(var(--primary-foreground));
	--color-secondary: hsl(var(--secondary));
	--color-secondary-foreground: hsl(var(--secondary-foreground));
	--color-muted: hsl(var(--muted));
	--color-muted-foreground: hsl(var(--muted-foreground));
	--color-accent: hsl(var(--accent));
	--color-accent-foreground: hsl(var(--accent-foreground));
	--color-destructive: hsl(var(--destructive));
	--color-destructive-foreground: hsl(var(--destructive-foreground));
	--color-border: hsl(var(--border));
	--color-input: hsl(var(--input));
	--color-ring: hsl(var(--ring));
	--color-chart-1: hsl(var(--chart-1));
	--color-chart-2: hsl(var(--chart-2));
	--color-chart-3: hsl(var(--chart-3));
	--color-chart-4: hsl(var(--chart-4));
	--color-chart-5: hsl(var(--chart-5));

	/* Argos custom colors */
	--color-success: hsl(var(--success));
	--color-success-foreground: hsl(var(--success-foreground));
	--color-warning: hsl(var(--warning));
	--color-warning-foreground: hsl(var(--warning-foreground));
	--color-info: hsl(var(--info));
	--color-info-foreground: hsl(var(--info-foreground));
	--color-signal-critical: hsl(var(--signal-critical));
	--color-signal-strong: hsl(var(--signal-strong));
	--color-signal-good: hsl(var(--signal-good));
	--color-signal-fair: hsl(var(--signal-fair));
	--color-signal-weak: hsl(var(--signal-weak));
	--color-feature-rf: hsl(var(--feature-rf));
	--color-feature-drone: hsl(var(--feature-drone));
	--color-feature-radio: hsl(var(--feature-radio));

	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--radius-xl: calc(var(--radius) + 4px);
}

@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/typography";

@layer base {
	*,
	::after,
	::before,
	::backdrop {
		border-color: var(--color-border);
	}

	button,
	[role='button'],
	[type='button'],
	[type='submit'],
	[type='reset'],
	select {
		cursor: pointer;
	}

	body {
		background-color: hsl(var(--background));
		color: hsl(var(--foreground));
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}
}

@layer components {
	/* Glass effects (migrated from rgb() to hsl()) */
	.glass-panel {
		@apply backdrop-blur-xl border;
		background-color: color-mix(in srgb, hsl(var(--card)) 80%, transparent);
		border-color: color-mix(in srgb, hsl(var(--border)) 40%, transparent);
	}

	.glass-panel-light {
		@apply backdrop-blur-md border;
		background-color: color-mix(in srgb, hsl(var(--card)) 60%, transparent);
		border-color: color-mix(in srgb, hsl(var(--border)) 30%, transparent);
	}

	.glass-button {
		@apply backdrop-blur-sm border transition-all duration-200;
		background-color: color-mix(in srgb, hsl(var(--secondary)) 20%, transparent);
		border-color: color-mix(in srgb, hsl(var(--border)) 40%, transparent);
	}
	.glass-button:hover {
		background-color: color-mix(in srgb, hsl(var(--secondary)) 40%, transparent);
		border-color: color-mix(in srgb, hsl(var(--primary)) 60%, transparent);
	}

	.glass-input {
		@apply backdrop-blur-sm border text-foreground focus:outline-none transition-all duration-200;
		background-color: color-mix(in srgb, hsl(var(--input)) 60%, transparent);
		border-color: color-mix(in srgb, hsl(var(--border)) 40%, transparent);
	}
	.glass-input:focus {
		background-color: color-mix(in srgb, hsl(var(--input)) 80%, transparent);
		border-color: color-mix(in srgb, hsl(var(--primary)) 60%, transparent);
	}
	.glass-input::placeholder {
		color: hsl(var(--text-muted));
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
		color: hsl(var(--feature-rf)) !important;
	}
	.sweep-brand {
		color: #ffffff !important;
	}

	/* Shadow effects */
	.shadow-red-glow {
		box-shadow: 0 0 16px hsl(var(--destructive) / 0.3);
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
