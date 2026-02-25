# Research: Lunaris UI Unification

**Feature**: 017-lunaris-ui-unification
**Date**: 2026-02-24
**Status**: Complete

## R1: oklch → Hex Conversion Strategy

**Decision**: Replace all oklch values in `app.css` with hex equivalents from the Lunaris spec.

**Rationale**: The spec provides exact hex values from the `.pen` file's rendered nodes (verified via Pencil MCP `batch_get` with `resolveVariables: true`). No conversion calculation is needed — the hex values are authoritative.

**Alternatives considered**:

- Convert oklch mathematically to hex → Rejected: rounding errors introduce deltaE drift; spec already provides exact values
- Use HSL intermediary → Rejected: adds complexity for no benefit; hex is simpler and directly from spec
- Keep oklch for some tokens → Rejected: mixed color spaces create confusion; full replacement is cleaner

**Key mapping** (oklch → Lunaris hex):

| Token         | Current oklch              | Lunaris hex |
| ------------- | -------------------------- | ----------- |
| --background  | oklch(0.141 0.005 285.823) | #111111     |
| --card        | oklch(0.21 0.006 285.885)  | #1A1A1A     |
| --border      | oklch(1 0 0 / 10%)         | #2E2E2E     |
| --primary     | oklch(0.795 0.184 86.047)  | #A8B8E0     |
| --foreground  | oklch(0.985 0 0)           | #FFFFFF     |
| --secondary   | oklch(0.274 0.006 286.033) | #2E2E2E     |
| --muted       | oklch(0.274 0.006 286.033) | #2E2E2E     |
| --destructive | oklch(0.704 0.191 22.216)  | #FF5C33     |

## R2: Tailwind v4 `@theme inline` Compatibility

**Decision**: Token value changes are transparent to Tailwind utilities.

**Rationale**: The `@theme inline` block in `app.css:198-246` maps Tailwind color utilities to CSS variables (`--color-background: var(--background)`). Changing the underlying CSS variable values does NOT require any Tailwind config changes. Utilities like `bg-background`, `text-primary`, `border-border` continue to work — they just resolve to different hex values.

**Verified**: The mapping uses `var()` references, not raw values. All 35+ Tailwind color utilities will automatically inherit the new Lunaris values.

**Risk**: None. This is the exact use case `@theme inline` was designed for.

## R3: shadcn-svelte Primitive Compatibility

**Decision**: shadcn-svelte primitives (Button, Input, Select, Switch, etc.) will work without modification.

**Rationale**: shadcn-svelte components reference CSS variables by name (`--background`, `--primary`, `--border`, etc.). We are changing VALUES not NAMES. The 8 shadcn-svelte component families (35 files) in `src/lib/components/ui/` will automatically inherit the new Lunaris colors.

**One exception**: The Switch component needs verification that its on/off states use `--primary` / `#2A2A2A` as the spec requires. shadcn-svelte Switch typically uses `--primary` for checked state already.

## R4: Geist Font Self-Hosting

**Decision**: Self-host Geist woff2 files in `static/fonts/geist/`.

**Rationale**:

- Geist is MIT-licensed (Vercel), freely distributable
- RPi 5 is deployed in field environments with no guaranteed internet access → CDN is not viable
- woff2 is the only format needed (all target browsers support it)
- Fira Code is already self-hosted at `static/fonts/firacode-nerd-font.css`

**Files needed**: `Geist-Regular.woff2`, `Geist-Medium.woff2`, `Geist-SemiBold.woff2` (3 weights cover all use cases)

**@font-face pattern**: Follow existing `static/fonts/firacode-nerd-font.css` pattern.

**Font loading strategy**: Both fonts declared in CSS with `font-display: swap` to prevent invisible text during load. Fallback chain ensures no layout shift: Fira Code → JetBrains Mono → monospace; Geist → system-ui → sans-serif.

## R5: Palette Migration Strategy

**Decision**: Replace 7 shadcn palettes with 13 Lunaris themes. Default changes from `'default'` (oklch yellow) to `'blue'` (Lunaris Blue ★ #A8B8E0).

**Rationale**: The Lunaris spec defines 13 MIL-STD-1472-safe accent themes. Each only overrides `--primary` — all other tokens (surfaces, text, semantic status) remain constant.

**Migration path for existing user preferences**:

- localStorage key `argos-theme` stays the same
- Old palette values (`'default'`, `'green'`, `'orange'`, `'red'`, `'yellow'`) are not in the new VALID_PALETTES list
- `validateParsed()` in theme-store.svelte.ts already falls back to `DEFAULT_STATE.palette` for unrecognized values
- DEFAULT_STATE.palette changes from `'default'` to `'blue'`
- Net effect: users with old palette prefs gracefully migrate to Blue ★

**New ThemePalette type**:

```typescript
export type ThemePalette =
	| 'ash'
	| 'blue'
	| 'blush'
	| 'iron'
	| 'iris'
	| 'khaki'
	| 'mauve'
	| 'pewter'
	| 'plum'
	| 'rose'
	| 'sand'
	| 'silver'
	| 'violet';
```

**CSS implementation**: Each theme is a `[data-palette='name']` selector that only sets `--primary`:

```css
[data-palette='ash'] {
	--primary: #aeaeb4;
}
[data-palette='blue'] {
	--primary: #a8b8e0;
}
/* ... 11 more */
```

Since there is no light mode, each palette needs only ONE CSS rule (not the current two per palette).

## R6: Glass Effect Replacement

**Decision**: Remove all `backdrop-filter: blur()` and glass-\* classes. Replace with opaque `var(--card)` backgrounds.

**Rationale**: Lunaris spec explicitly states "opaque flat surfaces only — no glass/blur effects, no backdrop-filter." The `.pen` file contains zero frosted/glass elements.

**Components affected**:

1. `app.css:273-309` — 5 glass-\* utility classes (glass-panel, glass-panel-light, glass-button, glass-input + hover/focus)
2. `DeviceOverlay.svelte:131` — `backdrop-filter: blur(8px)`

**Replacement pattern**: `background: var(--card)` with `border: 1px solid var(--border)`. For inputs: `background: var(--input)`.

**Risk**: Low. Glass effects are a visual style choice, not functional. The opaque alternatives provide the same structural separation.

## R7: Status Dot Glow Removal

**Decision**: Remove all `box-shadow` glow effects from status indicators and signal indicators.

**Rationale**: Lunaris spec: "no glow box-shadows on status dots." The `.pen` file uses flat solid fills for all status/signal indicators.

**Specific removals** (all in palantir-design-system.css):

- `.signal-critical` box-shadow (line 154)
- `.signal-strong` box-shadow (line 159)
- `.signal-good` box-shadow (line 164)
- `.signal-fair` box-shadow (line 169)
- `.signal-weak` box-shadow (line 174)
- `.status-dot-online` box-shadow (line 187)
- `.status-dot-warning` box-shadow (line 196)
- `.accent-glow` and `.accent-glow-strong` classes (lines 200-206)

Also in `app.css`:

- `.shadow-red-glow` (line 338-340)
- `.shadow-mono-glow` (line 342-344)

**Keep**: `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4)` on popovers/dropdowns — this is the Lunaris standard drop shadow for floating containers.

## R8: Border Transparency → Solid Hex

**Decision**: Convert all `rgba()` / `oklch(... / NN%)` borders to solid `#2E2E2E`.

**Rationale**: Lunaris spec: "Borders throughout Lunaris are solid #2E2E2E (opaque), not alpha-transparent."

**Current violations**:

- `app.css:60`: `--border: oklch(1 0 0 / 10%)` — transparent white
- `palantir-design-system.css:25-27`: Fallback borders use `rgba(255, 255, 255, 0.06/0.1/0.15)` — three transparency tiers

**Replacement**: Single solid border color `#2E2E2E` for all three tiers. The subtle/default/strong distinction is unnecessary in Lunaris — it uses a single border weight.

## R9: Typography Scale Gap Analysis

**Decision**: Add 3 missing sizes (13px, 10px, 9px) to the token system. Keep existing sizes as utilities.

**Current scale** (palantir-design-system.css:73-79):

- `--text-xs`: 11px
- `--text-sm`: 12px
- `--text-base`: 14px
- `--text-lg`: 16px
- `--text-xl`: 18px
- `--text-2xl`: 24px
- `--text-3xl`: 30px

**Lunaris 6-step scale**:

- 24px (hero metrics) — exists as `--text-2xl`
- 13px (brand text) — MISSING
- 12px (secondary data) — exists as `--text-sm`
- 11px (primary data rows) — exists as `--text-xs`
- 10px (status text) — MISSING
- 9px (section headers, UPPERCASE + letter-spacing 1.2+) — MISSING

**New tokens**:

```css
--text-brand: 0.8125rem; /* 13px */
--text-status: 0.625rem; /* 10px */
--text-section: 0.5625rem; /* 9px */
```

**14px brand mark exception**: The ARGOS brand mark uses 14px — this is a documented brand-tier exemption per spec, using the existing `--text-base` token.

## R10: Component-Level Font Audit

**Decision**: All font violations fall into 3 categories with a single fix pattern.

| Category                         | Files                                     | Fix                                                                 |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Bare monospace (no token)        | TowerPopup.svelte                         | `font-family: var(--font-primary, monospace)`                       |
| Mac-specific stack (no token)    | AgentChatPanel.svelte, ScanConsole.svelte | `font-family: var(--font-primary, monospace)`                       |
| Already using `var(--font-mono)` | ~25 components                            | Rename references from `--font-mono` to `--font-primary` (or alias) |

**Decision on naming**: Keep `--font-mono` as the CSS var name (it's used by ~25 components and matches Tailwind convention). Add `--font-primary` as an alias: `--font-primary: var(--font-mono)`. Similarly, `--font-secondary: var(--font-sans)`. This avoids a mass rename while providing the Lunaris-specified token names.

**Terminal font exception**: `TerminalTabContent.svelte:182` uses `'FiraCode Nerd Font'` as first choice — this is correct for terminal rendering and should be kept. The SF Mono/Menlo/Monaco fallbacks in that string should be removed though.

## R11: `--primary-foreground` Value

**Decision**: `--primary-foreground` = `#111111` (deepest black).

**Rationale**: When text sits on an accent-colored background (e.g., a primary button), it needs maximum contrast against the desaturated pastel accent. The Lunaris spec defines `--primary-foreground: #111111`.

**Impact**: shadcn-svelte Button with `variant="default"` uses `bg-primary text-primary-foreground`. Currently this is light text on yellow → changes to dark text on pale blue. This is correct per Lunaris.

## R12: Progress Bar Track Color

**Decision**: Add `--bar-track: #1E1E1E` token.

**Rationale**: Spec FR-022 requires progress bar tracks to use a neutral dark gray with no hue tint, ensuring visual correctness across all 13 accent themes. Currently no dedicated track token exists.

## R13: Toggle Switch Verification

**Decision**: Verify and fix shadcn-svelte Switch on/off colors.

**Rationale**: Spec FR-025 requires on = `--primary` (accent), off = `#2A2A2A`. shadcn-svelte Switch uses `--primary` for checked state by default. The unchecked state uses `--input` which is currently `oklch(1 0 0 / 15%)` — must verify it maps to `#2A2A2A` after token rewrite, or add explicit `--switch-off: #2A2A2A`.

## R14: Popover Shadow Standard

**Decision**: Standardize all popover/dropdown shadows to `0 4px 16px #00000040`.

**Rationale**: Spec FR-024. Currently most dropdowns already use `0 4px 16px rgba(0, 0, 0, 0.4)` which is equivalent. PanelContainer uses `2px 0 8px rgba(0, 0, 0, 0.3)` — this is a side-panel shadow, which is acceptable as a non-popover structural shadow.
