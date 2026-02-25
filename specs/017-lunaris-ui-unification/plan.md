# Implementation Plan: Lunaris UI Unification

**Branch**: `017-lunaris-ui-unification` | **Date**: 2026-02-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/017-lunaris-ui-unification/spec.md`

## Summary

Replace the shadcn/oklch CSS foundation with Lunaris design tokens (hex-based), eliminate light mode, rewire font stacks to Fira Code (data) / Geist (chrome), replace 7 shadcn palettes with 13 MIL-STD accent themes, correct layout dimensions (280px panel, 40px bar), remove glass/blur effects, remove glow box-shadows on status dots, and fix all hardcoded color/font violations in components. Pure CSS + token refactor — no new components, no new API routes, no new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Svelte 5 runes, SvelteKit 2
**Primary Dependencies**: Tailwind CSS v4 (`@theme inline` mapping), shadcn-svelte (8 UI primitives), MapLibre GL
**Storage**: N/A (no data model changes)
**Testing**: Vitest (visual regression via pixelmatch), Playwright (E2E), browser DevTools (manual color verification)
**Target Platform**: Chromium on Raspberry Pi 5 (Kali Linux), 1920x1080
**Project Type**: Web (SvelteKit monolith)
**Performance Goals**: Initial load < 3s, < 200MB heap, no font-loading reflow
**Constraints**: < 200MB heap on RPi 5 (8GB RAM), self-hosted fonts (no CDN), dark mode only
**Scale/Scope**: ~35 component files to audit, 3 CSS files to rewrite, 1 store to rewire, 13 accent themes to define

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                         | Gate                                | Status     | Notes                                                                           |
| ------------------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| 1.1 Comprehension Lock          | End state understood                | PASS       | Spec defines exact token values from .pen file                                  |
| 1.2 Codebase Inventory          | Existing implementations audited    | PASS       | See Audit Findings below                                                        |
| 2.1 TypeScript Strict           | No `any` introduced                 | PASS       | CSS-only changes; theme-store.svelte.ts keeps strict types                      |
| 2.2 Modularity                  | Max 300 lines/file, max 50 lines/fn | PASS       | No new files expected to exceed limits                                          |
| 2.3 Naming                      | kebab-case files                    | PASS       | All existing files already kebab-case                                           |
| 2.5 Documentation               | JSDoc for public functions          | PASS       | Token comments in CSS fulfill this                                              |
| 2.6 Forbidden: No hardcoded hex | All hex via tokens                  | **TARGET** | This spec's primary goal                                                        |
| 2.6 Forbidden: No barrel files  | No index.ts                         | PASS       | Not applicable to CSS changes                                                   |
| 3.1 Test-First                  | Tests before implementation         | PASS       | Visual regression snapshots updated per phase                                   |
| 4.1 Design Language             | Lunaris design system               | **TARGET** | This spec's primary goal                                                        |
| 4.3 State Communication         | All 8 states handled                | DEFERRED   | Spec FR-020 addresses color+label pairing; full 8-state audit is P2 future work |
| 5.2 Load                        | Initial load < 3s                   | MONITOR    | Font loading strategy must not regress                                          |
| 5.3 Resources                   | < 200MB heap                        | MONITOR    | CSS-only changes — low risk                                                     |
| 6.3 Forbidden                   | No new packages                     | PASS       | Geist font self-hosted via @font-face, no npm package                           |
| 8.1 Security                    | No secrets in code                  | PASS       | CSS-only changes                                                                |

## Audit Findings (Pre-Implementation)

### Current Architecture (3-layer CSS problem)

```
Layer 1: src/app.css           — shadcn defaults (oklch colors, Inter font, light+dark mode)
Layer 2: palantir-design-system.css — bridge layer (--palantir-* aliases → shadcn vars with hex fallbacks)
Layer 3: dashboard.css         — layout tokens (--font-sans, --font-mono, --panel-width, --top-bar-height)
```

**Problem**: Layer 1 provides WRONG base values (oklch purple-warm palette, golden yellow primary). Layer 2 bridges to these wrong values. Layer 3 defines font stacks with wrong priority (SF Mono first, not Fira Code). Components inherit incorrect colors through every layer.

### Specific Violations Found

#### V1: Surface Colors (P0)

- `:root` (app.css:8-41): Full light mode block with oklch whites — must be removed entirely
- `.dark` (app.css:44-99): oklch purple-warm values — must be replaced with Lunaris hex tokens
- `--background`: Currently `oklch(0.141 0.005 285.823)` → Must be `#111111`
- `--card`: Currently `oklch(0.21 0.006 285.885)` → Must be `#1A1A1A`
- `--border`: Currently `oklch(1 0 0 / 10%)` (transparent!) → Must be `#2E2E2E` (solid)

#### V2: Accent Color (P0)

- `--primary` in `.dark`: `oklch(0.795 0.184 86.047)` (golden yellow) → Must be `#A8B8E0` (Blue ★)
- Bridge layer fallback: `#4a9eff` (saturated blue) → Must be `#A8B8E0`

#### V3: Font Stacks (P0)

- `app.css:263-267`: Body font is `'Inter', system-ui, -apple-system, sans-serif` → Must be `'Geist', system-ui, sans-serif`
- `dashboard.css:8-9`: `--font-sans` is `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto...` → Must be `'Geist', system-ui, sans-serif`
- `dashboard.css:10`: `--font-mono` is `'SF Mono', 'Fira Code'...` → Must be `'Fira Code', 'JetBrains Mono', monospace`
- No `--font-primary` or `--font-secondary` aliases exist yet

#### V4: Light Mode (P1)

- `app.css:7-41`: Full `:root` light mode block (33 lines) — must be removed
- All 7 palette overrides have both `:root[data-palette=...]` (light) AND `.dark[data-palette=...]` blocks — light mode blocks must be removed

#### V5: Palette System (P1)

- 7 shadcn palettes: blue, green, orange, red, rose, violet, yellow (app.css:106-195)
- Must be replaced with 13 Lunaris themes: Ash, Blue, Blush, Iron, Iris, Khaki, Mauve, Pewter, Plum, Rose, Sand, Silver, Violet
- Theme store (theme-store.svelte.ts) must be updated: `ThemePalette` type, `VALID_PALETTES` array, `applyPalette()` logic

#### V6: Semantic Colors (P2)

- `--success`: `hsl(142 69% 58%)` (vivid green ≈ #4ade80) → Must be `#8BBFA0`
- `--warning`: `hsl(43 96% 56%)` (vivid gold ≈ #fbbf24) → Must be `#D4A054`
- `--destructive`: `oklch(0.704 0.191 22.216)` → Must be `#FF5C33` (high-vis) with `#C45B4A` (desat) alias
- Status dot glow `box-shadow`es in palantir-design-system.css:154-175, 187, 196 → Must be removed (flat fills only)
- Status backgrounds: Must add `--success-bg: #222924`, `--warning-bg: #291C0F`, `--error-bg: #24100B`, `--info-bg: #222229`
- Bridge layer muted backgrounds use `rgba(74, 222, 128, 0.12)` etc. → Must be replaced with dark-tinted hex values

#### V7: Layout Dimensions (P2)

- `dashboard.css:12`: `--panel-width: 320px` → Must be `280px`
- `dashboard.css:13`: `--top-bar-height: 48px` → Must be `40px`
- `palantir-design-system.css:287`: `.tactical-sidebar` width `320px` → Must be `280px`

#### V8: Typography Scale (P2)

- Current scale in palantir-design-system.css: 11px, 12px, 14px, 16px, 18px, 24px, 30px
- Missing from Lunaris 6-step scale: 13px (brand), 10px (status), 9px (section headers)
- 14px, 16px, 18px, 30px not in Lunaris scale — keep as utility but define the 6-step as primary

#### V9: ARGOS Brand Mark (P2)

- TopStatusBar.svelte: `font-size: 15px` → Must be `14px`
- `letter-spacing: 0.14em` → Must be `2px`
- `color: var(--palantir-text-primary)` (white) → Must be `var(--primary)` (accent-colored)
- `font-weight: var(--font-weight-semibold)` → Correct (600), keep

#### V10: Hardcoded Fonts in Components (P3)

- `TowerPopup.svelte:88`: `font-family: monospace` (bare, no token)
- `AgentChatPanel.svelte:142`: `font-family: 'Menlo', 'Monaco', 'Courier New', monospace` (Mac-specific, no token)
- `ScanConsole.svelte:63`: `font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace` (non-Lunaris)
- `TerminalTabContent.svelte:182`: Font string includes SF Mono, Menlo, Monaco (acceptable for terminal — FiraCode Nerd Font is first)

#### V11: Glass/Blur Effects (P3)

- `app.css:273-309`: 5 glass-\* classes with `backdrop-filter: blur()` → Must be removed (Lunaris: opaque flat surfaces only)
- `DeviceOverlay.svelte:131`: `backdrop-filter: blur(8px)` → Must be removed
- Replace with opaque `var(--card)` backgrounds

#### V12: Hardcoded Hex Colors in Components (P3)

- `app.css:334`: `.sweep-brand { color: #ffffff !important }` → Must use token
- Multiple `rgba()` in palantir-design-system.css for muted backgrounds → Must use hex tokens
- Signal indicator glows use hardcoded `rgba()` → Must be removed

#### V13: Toggle Switch States

- shadcn-svelte Switch component — need to verify on/off colors match spec: on = `--primary`, off = `#2A2A2A`

## Project Structure

### Documentation (this feature)

```text
specs/017-lunaris-ui-unification/
├── plan.md              # This file
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: CSS token model (token→value mapping)
├── quickstart.md        # Phase 1: implementation quickstart guide
├── contracts/           # Phase 1: before/after token contracts
└── tasks.md             # Phase 2: implementation tasks
```

### Source Code (files modified — no new files except font @font-face)

```text
src/
├── app.css                              # REWRITE: Lunaris tokens, remove light mode, remove shadcn palettes
├── lib/
│   ├── styles/
│   │   ├── palantir-design-system.css   # REWRITE: bridge to new Lunaris base tokens
│   │   └── dashboard.css               # UPDATE: font stacks, panel width, bar height
│   ├── stores/
│   │   └── theme-store.svelte.ts        # UPDATE: 13 Lunaris palettes, new ThemePalette type
│   └── components/
│       └── dashboard/
│           ├── TopStatusBar.svelte       # UPDATE: brand mark (14px, 2px spacing, accent color)
│           ├── AgentChatPanel.svelte     # UPDATE: font-family → token
│           ├── map/TowerPopup.svelte     # UPDATE: font-family → token
│           ├── map/DeviceOverlay.svelte  # UPDATE: remove backdrop-filter
│           └── ... (audit remaining)     # UPDATE: any hardcoded hex/font violations
├── components/gsm-evil/
│   └── ScanConsole.svelte               # UPDATE: font-family → token
static/
└── fonts/
    └── geist/                           # ADD: Geist font files + @font-face CSS
```

**Structure Decision**: No new directories. All changes are in-place modifications to existing CSS and component files. The only new files are Geist font assets in `static/fonts/`.

## Implementation Phases

### Phase 1: Foundation — Token Rewrite (P0)

**Goal**: Replace the CSS foundation. All downstream components automatically inherit correct values.

1. **Obtain and install Geist font** — download woff2 files, create `static/fonts/geist/` and `@font-face` declarations
2. **Rewrite `app.css` `:root`** — remove light mode block, replace with single `:root` block using Lunaris hex tokens
3. **Rewrite `app.css` `.dark`** — merge into `:root` (dark-only), replace all oklch values with Lunaris hex
4. **Remove shadcn palette overrides** — delete all 7 `[data-palette=...]` blocks
5. **Add 13 Lunaris accent themes** — each only overrides `--primary`
6. **Remove glass-\* classes** — replace with opaque equivalents
7. **Update palantir-design-system.css** — rebind `--palantir-*` aliases to new base tokens, remove glow box-shadows
8. **Update dashboard.css** — font stacks (Fira Code first, Geist first), layout dimensions (280px, 40px)
9. **Update theme-store.svelte.ts** — new `ThemePalette` type with 13 themes, update `VALID_PALETTES`

### Phase 2: Component Fixes (P1-P3)

**Goal**: Fix all hardcoded violations in individual components.

10. **TopStatusBar brand mark** — 14px, 2px letter-spacing, accent color
11. **AgentChatPanel** — replace Mac font stack with `var(--font-primary)`
12. **TowerPopup** — replace bare `monospace` with `var(--font-primary)`
13. **ScanConsole** — replace Monaco/Menlo stack with `var(--font-primary)`
14. **DeviceOverlay** — remove backdrop-filter, use opaque background
15. **app.css sweep-brand** — replace `#ffffff !important` with token
16. **Status dot classes** — remove glow box-shadows, use flat fills
17. **Semantic status muted backgrounds** — replace rgba() with hex tokens
18. **Typography scale tokens** — add 13px, 10px, 9px to palantir-design-system.css
19. **Audit remaining components** — grep for any remaining bare hex/font violations

### Phase 3: Verification (P0-P3)

**Goal**: Prove compliance with spec success criteria.

20. **Visual regression tests** — screenshot comparison against .pen reference
21. **Token audit script** — grep-based verification of zero hardcoded hex/font violations
22. **Layout measurement** — DevTools verification of 280px/40px/48px dimensions
23. **Font loading test** — verify Fira Code and Geist load correctly, fallback graceful
24. **Performance check** — initial load < 3s, < 200MB heap on RPi 5

## Risk Assessment

| Risk                                                     | Impact | Mitigation                                                                                             |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| Geist font not available for self-hosting                | Medium | Geist is MIT-licensed via Vercel; woff2 files freely available                                         |
| oklch→hex conversion breaks Tailwind utilities           | High   | `@theme inline` maps CSS vars, not raw colors — changing var values is transparent                     |
| shadcn-svelte primitives depend on specific token names  | High   | Token NAMES stay the same (--background, --card, etc.) — only VALUES change                            |
| Palette migration breaks existing user preferences       | Low    | localStorage key stays 'argos-theme'; 'default' maps to Blue ★; old palette names gracefully fall back |
| Glass effects used by components beyond the 5 identified | Medium | Full grep audit completed — only 5 glass-\* usages + 1 DeviceOverlay                                   |

## Complexity Tracking

> No constitution violations requiring justification. All changes comply with existing articles.
