# Implementation Plan: GSM Evil Page — UI Modernization & Component Decomposition

**Branch**: `006-gsm-evil-modernization` | **Date**: 2026-02-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-gsm-evil-modernization/spec.md`

## Summary

Modernize and decompose the GSM Evil page (`/gsm-evil`) — a 2204-line monolithic Svelte file with 1107 lines of custom CSS — into a professionally structured component tree using the same shadcn-svelte component library established by spec 003. The work replaces all hand-crafted buttons, tables, badges, and status indicators with component library equivalents, extracts 6+ sub-components into `src/lib/components/gsm-evil/`, and reduces custom CSS to under 200 lines while preserving identical layout, functionality, and behavior.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode), Svelte 5.35.5, SvelteKit 2.22.3
**Primary Dependencies**: shadcn-svelte (Button, Table, Badge, AlertDialog — already installed), tailwind-variants, bits-ui, lucide-svelte
**Storage**: N/A — no database changes; `gsmEvilStore` uses localStorage persistence
**Testing**: Vitest (unit), Playwright (e2e); existing test: `tests/unit/utils/gsm-tower-utils.test.ts`
**Target Platform**: Raspberry Pi 5 (ARM64), Kali Linux 2025.4, Chromium browser
**Project Type**: Web (SvelteKit monorepo)
**Performance Goals**: No performance regression; <100ms UI interaction response; maintain 30fps during live frame updates
**Constraints**: Node.js heap ≤1024MB; no layout changes; no functionality changes; dark-mode only
**Scale/Scope**: Single page (`/gsm-evil`), 1 route file + 6 new component files + 1 existing store (unchanged)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                                    | Requirement                            | Status       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **I §1.1** Comprehension Lock              | Understand current state before code   | PASS         | Full inventory of +page.svelte (2204 lines), store (415 lines), types (54 lines), utils (217 lines) completed                                                                                                                                                                                                                                                                                                                  |
| **I §1.3** Codebase Inventory              | List files to modify + related files   | PASS         | See File Inventory below                                                                                                                                                                                                                                                                                                                                                                                                       |
| **II §2.2** Max file length 300 lines      | New components must be ≤300 lines      | PASS         | Each sub-component targets 50-200 lines                                                                                                                                                                                                                                                                                                                                                                                        |
| **II §2.7** No service layers/barrel files | No forbidden patterns                  | PASS         | Components import directly; shadcn barrel files are the documented exception                                                                                                                                                                                                                                                                                                                                                   |
| **II §2.7** No hardcoded colors            | All colors from theme                  | PENDING      | Current CSS has ~50 hardcoded hex values (#dc2626, #000, #fff, etc.) — all will be replaced with theme tokens. **Exception**: Signal quality colors (green-400, yellow-500, red-500) are domain-specific data visualization indicating signal strength semantics — these use Tailwind palette utilities, not theme accent variables, which is acceptable per §4.1 as they represent measurement data, not brand/accent colors. |
| **IV §4.1** Colors from theme              | Use Tailwind theme tokens              | PENDING      | Will replace hardcoded CSS with theme CSS custom properties and Tailwind utilities                                                                                                                                                                                                                                                                                                                                             |
| **IV §4.2** Reuse Before Create            | Search for existing implementations    | PASS         | Button, Table, Badge, AlertDialog already exist in `src/lib/components/ui/`; dashboard pattern established                                                                                                                                                                                                                                                                                                                     |
| **IV §4.3** All States                     | Handle empty/loading/error/etc.        | PASS         | Existing states preserved: empty scan, scanning, results, IMSI capture active, error dialog                                                                                                                                                                                                                                                                                                                                    |
| **IX §9.3** Permission Boundaries          | Route file modification needs approval | ACKNOWLEDGED | Will modify `src/routes/gsm-evil/+page.svelte` (route file — ASK FIRST tier); new files in `src/lib/components/` (ALLOWED tier)                                                                                                                                                                                                                                                                                                |
| **XII §12.1** Commit Per Task              | One commit per completed task          | PASS         | Plan structures work into committable units                                                                                                                                                                                                                                                                                                                                                                                    |

### File Inventory

**Files to modify:**

- `src/routes/gsm-evil/+page.svelte` (2204 lines → ~150 lines) — decompose into orchestrator

**Files to create:**

- `src/lib/components/gsm-evil/GsmHeader.svelte` — header section with logo, title, status, Start/Stop button
- `src/lib/components/gsm-evil/TowerTable.svelte` — IMSI tower table with sortable headers and expandable device rows
- `src/lib/components/gsm-evil/ScanResultsTable.svelte` — frequency scan results with quality badges
- `src/lib/components/gsm-evil/ScanConsole.svelte` — scan progress console output
- `src/lib/components/gsm-evil/LiveFramesConsole.svelte` — live GSM frame display
- `src/lib/components/gsm-evil/ErrorDialog.svelte` — thin wrapper around ui/alert-dialog

**Files with related functionality (not modified):**

- `src/lib/stores/gsm-evil-store.ts` (415 lines) — store remains unchanged, consumed via props
- `src/lib/types/gsm.ts` (54 lines) — types remain unchanged
- `src/lib/utils/gsm-tower-utils.ts` (217 lines) — utility functions remain unchanged
- `src/lib/data/carrier-mappings.ts` (809 lines) — carrier data remains unchanged
- `src/routes/api/gsm-evil/` — 7 API endpoints remain unchanged

**Existing reusable components (from spec 003):**

- `src/lib/components/ui/button/` — Button with variants: default, destructive, outline, secondary, ghost, link; sizes: default, sm, lg, icon
- `src/lib/components/ui/table/` — Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow
- `src/lib/components/ui/badge/` — Badge with variants: default, secondary, destructive, outline
- `src/lib/components/ui/alert-dialog/` — Full AlertDialog component set (Root, Content, Header, Title, Description, Footer, Action, Cancel)

## Project Structure

### Documentation (this feature)

```text
specs/006-gsm-evil-modernization/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (component interfaces)
├── quickstart.md        # Phase 1 output
├── checklists/          # Review checklists
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── routes/gsm-evil/
│   └── +page.svelte                    # MODIFY: Slim orchestrator (~150 lines)
├── lib/components/
│   ├── gsm-evil/                       # CREATE: New component directory
│   │   ├── GsmHeader.svelte            # Header: logo, title, status badges, Start/Stop
│   │   ├── TowerTable.svelte           # IMSI tower table with sort + expansion
│   │   ├── ScanResultsTable.svelte     # Frequency scan results + quality badges
│   │   ├── ScanConsole.svelte          # Scan progress console
│   │   ├── LiveFramesConsole.svelte    # Live GSM frame output
│   │   └── ErrorDialog.svelte          # Thin wrapper around ui/alert-dialog
│   └── ui/                             # EXISTING: shadcn components (unchanged)
│       ├── button/
│       ├── table/
│       ├── badge/
│       └── alert-dialog/
├── lib/stores/
│   └── gsm-evil-store.ts              # UNCHANGED: single source of truth
├── lib/types/
│   └── gsm.ts                          # UNCHANGED: shared types
└── lib/utils/
    └── gsm-tower-utils.ts              # UNCHANGED: tower grouping/sorting utils

tests/
└── unit/
    └── utils/
        └── gsm-tower-utils.test.ts     # EXISTING: keep passing
```

**Structure Decision**: Follow the established `src/lib/components/{feature}/` pattern used by `src/lib/components/dashboard/`. New GSM Evil components at `src/lib/components/gsm-evil/` per spec clarification.

## Component Architecture

### Current State (Monolithic)

```
+page.svelte (2204 lines)
├── <script> (lines 1-651): 14 functions, 20+ reactive variables, all business logic
├── Template (lines 652-1097): Header, Tower Table, Scan Results, Consoles, ErrorDialog
└── <style> (lines 1098-2204): 1107 lines of custom CSS with ~171 class definitions
```

### Target State (Decomposed)

```
+page.svelte (~150 lines) — Orchestrator
├── Imports: store, types, all 6 sub-components
├── Store subscriptions: $gsmEvilStore reactive bindings
├── Page-level state: imsiCaptureActive, errorDialog state
├── API functions: scanFrequencies, startIMSICapture, handleScanButton, fetchIMSIs, fetchRealFrames, checkActivity
├── Lifecycle: onMount (status check), onDestroy (cleanup intervals)
└── Template: Compose sub-components with props + event callbacks

GsmHeader.svelte (~80 lines)
├── Props: isActive, buttonText, imsiCaptureActive
├── Events: onscanbutton (click handler for start/stop)
├── Uses: Button (ghost for "Back to Console", default/destructive for Start/Stop)
└── Replaces: .header, .control-btn, .scan-btn-*, .back-btn-style CSS

TowerTable.svelte (~200 lines)
├── Props: groupedTowers, towerLocations, towerLookupAttempted, selectedFrequency
├── Internal state: sortColumn, sortDirection, expandedTowers
├── Functions: handleSort, toggleTowerExpansion, formatTimestamp (verify during T008 that formatTimestamp is only used by TowerTable — if also used by LiveFramesConsole, extract to shared utility instead)
├── Uses: Table components (Table, TableHeader, TableHead, TableBody, TableRow, TableCell), Button (ghost for sort headers), Badge
└── Replaces: .tower-*, .device-*, .header-sortable, .sort-indicator CSS

ScanResultsTable.svelte (~150 lines)
├── Props: scanResults, selectedFrequency
├── Events: onselect (frequency selection callback)
├── Uses: Table components, Badge (for quality + channel type), Button (outline for "Select")
└── Replaces: .frequency-table, .quality-badge, .channel-type, .select-btn CSS

ScanConsole.svelte (~60 lines)
├── Props: scanProgress, isScanning
├── No events (display-only)
├── Uses: Badge (for SCANNING.../COMPLETE status)
├── Behavior: Auto-scrolls to bottom on new scan progress entries (preserve existing behavior)
└── Replaces: .scan-progress-console, .console-* CSS

LiveFramesConsole.svelte (~70 lines)
├── Props: gsmFrames, activityStatus, capturedIMSIs, selectedFrequency
├── No events (display-only)
├── Behavior: Auto-scrolls to bottom on new frame entries (preserve existing behavior)
└── Replaces: .live-frames-console CSS (monospace styling kept as scoped CSS)

ErrorDialog.svelte (~30 lines)
├── Props: open (bindable), message
├── Uses: AlertDialog (Root, Content, Header, Title, Description, Footer, Action)
└── Replaces: inline AlertDialog usage in +page.svelte (already using shadcn)
```

### Props Flow

```
+page.svelte (store subscriptions + local state)
  │
  ├── GsmHeader
  │     ├── isActive: boolean (isScanning || imsiCaptureActive)
  │     ├── buttonText: string
  │     ├── imsiCaptureActive: boolean
  │     └── onscanbutton: () => void
  │
  ├── TowerTable (when imsiCaptureActive)
  │     ├── groupedTowers: TowerGroup[]
  │     ├── towerLocations: Record<string, TowerLocation>
  │     ├── towerLookupAttempted: Record<string, boolean>
  │     └── selectedFrequency: string
  │
  ├── ScanResultsTable (when !imsiCaptureActive)
  │     ├── scanResults: ScanResult[]
  │     ├── selectedFrequency: string
  │     └── onselect: (frequency: string) => void
  │
  ├── ScanConsole (when !imsiCaptureActive)
  │     ├── scanProgress: string[]
  │     └── isScanning: boolean
  │
  ├── LiveFramesConsole (when imsiCaptureActive)
  │     ├── gsmFrames: string[]
  │     ├── activityStatus: ActivityStatus
  │     ├── capturedIMSIs: IMSICapture[]
  │     └── selectedFrequency: string
  │
  └── ErrorDialog
        ├── open: boolean (bindable)
        └── message: string
```

## CSS Replacement Strategy

### Current CSS Breakdown (1107 lines)

| Category                                                             | Lines        | Replacement                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layout (container, header, flex)                                     | ~120         | Tailwind utilities (`flex`, `items-center`, `gap-*`, `p-*`)                                                                                                                                                  |
| Buttons (.control-btn, .scan-btn-\*, .back-btn-style, .select-btn)   | ~80          | shadcn Button (ghost, default, destructive, outline variants)                                                                                                                                                |
| Tables (.frequency-table, .tower-_, .device-_)                       | ~200         | shadcn Table components + Tailwind utilities                                                                                                                                                                 |
| Badges (.quality-badge, .channel-type, .status-indicator)            | ~100         | shadcn Badge (default, secondary, destructive, outline)                                                                                                                                                      |
| Console (.console-\*, .frame-line)                                   | ~80          | Scoped component CSS (monospace, dark bg — kept)                                                                                                                                                             |
| Typography (.gsm-brand, .evil-brand, .subtitle)                      | ~40          | Tailwind text utilities + scoped CSS for brand colors                                                                                                                                                        |
| Animations (@keyframes spin, blink, pulse)                           | ~30          | Tailwind `animate-spin` + scoped @keyframes. **Mapping**: `spin` → GsmHeader (scanning indicator), `blink` → LiveFramesConsole (activity indicator), `pulse` → GsmHeader (status badge). Verify during T024. |
| Utility class redefinitions (.flex, .items-center, .gap-3, .text-xs) | ~60          | DELETE — Tailwind already provides these                                                                                                                                                                     |
| Unused/dead CSS (.btn-settings, etc.)                                | ~40          | DELETE                                                                                                                                                                                                       |
| Colors (hardcoded #dc2626, #000, rgba)                               | scattered    | Replace with `text-destructive`, `bg-background`, theme tokens                                                                                                                                               |
| **Remaining (layout-specific, console mono)**                        | **~100-150** | **Keep as scoped component styles**                                                                                                                                                                          |

### Color Mapping (Hardcoded → Theme Tokens)

| Current                           | Replacement                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| `#dc2626` (red accents)           | `text-destructive` / `hsl(var(--destructive))`               |
| `#000` (backgrounds)              | `bg-background`                                              |
| `#fff` (text)                     | `text-foreground`                                            |
| `#9ca3af` (muted text)            | `text-muted-foreground`                                      |
| `rgba(255,0,0,0.2)` (red borders) | `border-destructive/20`                                      |
| `#22c55e` / green-400 (success)   | `text-green-400` (Tailwind — acceptable for signal quality)  |
| `#eab308` / yellow-500 (warning)  | `text-yellow-500` (Tailwind — acceptable for signal quality) |

**Note**: Signal quality colors (green/yellow/red for Excellent/Moderate/Weak) are domain-specific data visualization, not theme accent colors. Using Tailwind color utilities directly is acceptable per constitution — these represent signal strength semantics, not brand colors.

## Implementation Phases

### Phase 1: Component Extraction (Decomposition First)

Extract components one at a time from the monolith, keeping the existing CSS intact initially. Each extraction is independently verifiable — the page must render identically after each step.

**Order** (from least to most dependencies):

1. **ErrorDialog** — simplest, already uses shadcn AlertDialog, ~30 lines
2. **ScanConsole** — display-only, no events, simple props
3. **LiveFramesConsole** — display-only, no events, simple props
4. **GsmHeader** — has one event callback (onscanbutton), moderate complexity
5. **ScanResultsTable** — has one event callback (onselect), medium complexity
6. **TowerTable** — most complex: internal sort state, expansion state, formatTimestamp

Each extraction: create component file → move template + relevant CSS → add props interface → wire up in parent → verify identical rendering.

### Phase 2: Visual Modernization (Component Library Upgrade)

After decomposition, upgrade each component's internals to use shadcn primitives. This replaces custom CSS with component library equivalents.

**Order** (highest visual impact first):

1. **Buttons** (US1) — Replace .control-btn, .scan-btn-\*, .select-btn, .header-sortable with shadcn Button variants
2. **Tables** (US2) — Replace .frequency-table, .tower-\* with shadcn Table components
3. **Badges** (US3) — Replace .quality-badge, .channel-type, .status-indicator with shadcn Badge
4. **CSS Cleanup** (US5) — Remove all replaced CSS, verify <200 lines remain
5. **Theme Integration** (US6) — Replace remaining hardcoded colors with theme tokens, test all 8 palettes

### Phase 3: Verification & Polish

1. Run full verification workflow (typecheck → lint → test → build)
2. Visual comparison across all 8 palettes
3. Functional regression testing (scan start/stop, IMSI capture, tower expansion, frame display)
4. Performance spot-check (no memory regression, smooth scrolling)

## Risk Assessment

| Risk                                                 | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reactivity breaks during decomposition               | Extract one component at a time; verify after each step; store access only in parent page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CSS scoping conflicts after extraction               | Svelte scoped CSS follows the component; verify no :global() leaks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Table component doesn't support expandable rows      | shadcn Table is pure HTML table wrappers; expansion handled with {#if} blocks inside TowerTable — same pattern works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Sort state lost during decomposition                 | Sort state moves into TowerTable component as internal state — explicitly part of the design                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Badge variants insufficient for quality levels       | Badge component is a styled span — custom Tailwind classes can extend it for signal-strength-specific colors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Theme palette breaks GSM Evil branding (red #dc2626) | GSM Evil's red is the `destructive` theme color; brand identity preserved via `text-destructive`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **FR-006 150-line script target may be tight**       | Current script: 651 lines, 10 functions. After extracting 3 TowerTable functions (-64 lines), ~587 remain. The `scanFrequencies` function alone is 191 lines. **Strategy**: (1) extract `handleSort`/`toggleTowerExpansion`/`formatTimestamp` into TowerTable (-64 lines), (2) move reactive tower-grouping logic (~70 lines) + `expandedTowers`/`sortColumn`/`sortDirection` state into TowerTable, (3) move template-only reactive derivations into components where consumed. The API functions (`scanFrequencies`, `startIMSICapture`, `fetchRealFrames`, `checkActivity`, `fetchIMSIs`, `handleScanButton`, `fetchTowerLocation`) and lifecycle blocks must stay in the parent (~430 lines). **If 150 is not achievable without extracting API logic into a helper module**, the target will be adjusted to the actual achievable size during T009, with documented justification. |

## Complexity Tracking

### FR-006 Deviation: Script Section 534 Lines (Target: 150)

**Outcome**: The parent `+page.svelte` script section is 534 lines — exceeding the 150-line target. This was anticipated in the risk assessment above.

**Why 150 was not achievable**: The orchestrator contains 7 API functions (`scanFrequencies` at 191 lines, `startIMSICapture`, `fetchRealFrames`, `checkActivity`, `fetchIMSIs`, `handleScanButton`, `fetchTowerLocation`) plus reactive state derivations and lifecycle management. These functions orchestrate real-time SSE streaming, polling intervals, and store mutations — all of which depend on component-local state (`imsiCaptureActive`, `errorDialogOpen`, `gsmFrames`, `activityStatus`). Extracting them to a service module would require passing all this state as parameters, creating a complex bidirectional dependency that adds more complexity than it removes.

**What was achieved**: Template reduced from 445 lines to 30 lines. CSS reduced from 1107 lines to 7 lines (page-level). 6 sub-components extracted with clean props interfaces. All UI-only state (sort, expansion, formatting) moved to components. The script section is purely orchestration logic — no rendering or styling concerns remain.

**Recommendation**: Accept 534 as the practical minimum for this page's complexity. Further reduction requires extracting API logic into a `gsm-evil-service.ts` module — a separate refactoring effort.

> No other constitution violations requiring justification.
