# Research: GSM Evil Page — UI Modernization & Component Decomposition

**Date**: 2026-02-16 | **Status**: Complete

## Research Questions & Findings

### RQ-1: What is the exact structure of the monolithic +page.svelte?

**Decision**: The file has 3 clear sections that map to the decomposition plan.

**Findings**:

- **Script section** (lines 1-651): 14 functions, 20+ reactive variables
    - Imports: `onDestroy`, `onMount`, `tick`, `AlertDialog`, `mccToCountry`, `mncToCarrier`, `gsmEvilStore`, `FrequencyTestResult`, `groupIMSIsByTower`, `sortTowers`
    - Key functions: `handleScanButton` (lines 236-282), `scanFrequencies` (lines 381-571), `startIMSICapture` (lines 346-379), `fetchIMSIs` (lines 638-650), `fetchRealFrames` (lines 573-618), `checkActivity` (lines 620-636), `handleSort` (lines 134-143), `toggleTowerExpansion` (lines 146-154), `formatTimestamp` (lines 157-201), `fetchTowerLocation` (lines 204-222)
    - Lifecycle: `onMount` (lines 284-335) checks GSM status and resumes polling; `onDestroy` (lines 337-344) cleans up intervals
- **Template section** (lines 652-1097): Header, Tower Table, Scan Results Table, Scan Console, Live Frames Console, ErrorDialog
- **Style section** (lines 1098-2204): 1107 lines, ~171 CSS class definitions

**Rationale**: Script analysis reveals functions naturally group by component responsibility — sort/expand functions belong to TowerTable, format/display functions belong to their respective display components, and API/lifecycle functions stay in the parent page.

### RQ-2: Which shadcn-svelte components are available and how are they used?

**Decision**: All 4 required component families (Button, Table, Badge, AlertDialog) are already installed.

**Findings**:

- **Button** (`src/lib/components/ui/button/button.svelte`): Uses `tailwind-variants` (tv). Variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon, icon-sm, icon-lg. Supports `href` for anchor-style buttons.
- **Table** (`src/lib/components/ui/table/`): 8 sub-components: Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow. Pure HTML table wrappers with Tailwind styling.
- **Badge** (`src/lib/components/ui/badge/badge.svelte`): Uses `tailwind-variants`. Variants: default, secondary, destructive, outline. Renders as `<span>` or `<a>` based on href prop.
- **AlertDialog** (`src/lib/components/ui/alert-dialog/`): 11 sub-components. Already imported and used in the GSM Evil page (lines 5, 1086-1096).

**Rationale**: No new dependencies needed. The existing component library covers all use cases.

### RQ-3: How does the dashboard use these components (reference pattern)?

**Decision**: Follow the dashboard's established pattern — components in a feature directory, CSS custom properties for theming.

**Findings**:

- Dashboard components at `src/lib/components/dashboard/` include: `TopStatusBar.svelte`, `IconRail.svelte`, `PanelContainer.svelte`, `ResizableBottomPanel.svelte`, `TerminalPanel.svelte`, plus feature-specific panels in `panels/` and shared components in `shared/`
- Dashboard components use scoped `<style>` blocks with CSS custom properties (`var(--palantir-*)`) rather than Tailwind utilities for layout-specific styles
- The theme system uses CSS custom properties defined in `src/app.css` — all `--palantir-*` variables are theme-aware
- Dashboard components do NOT import stores directly — they receive data as props from the page orchestrator
- The `ToolCategoryCard.svelte` component demonstrates the pattern: `interface Props`, `$props()`, scoped styles using `var(--palantir-*)` tokens

**Rationale**: This confirms the props-down pattern for sub-components and validates using CSS custom properties for layout-specific styles that components don't cover.

### RQ-4: What CSS can be safely deleted vs. must be preserved?

**Decision**: ~900-950 lines can be deleted; ~100-150 lines of layout/console styles will be kept as scoped component CSS.

**Findings**:

- **Safe to delete** (~60 lines): Utility class redefinitions (`.flex`, `.items-center`, `.gap-3`, `.text-xs`, etc.) — Tailwind already provides these
- **Safe to delete** (~40 lines): Unused CSS (`.btn-settings`, commented rules)
- **Replaced by components** (~380 lines): Button, table, badge, and status indicator classes
- **Replaced by Tailwind** (~120 lines): Layout utilities converted to utility classes
- **Must keep** (~80 lines): Console styling (monospace font, dark background, line coloring), brand typography (`.gsm-brand`, `.evil-brand`), and animations (`@keyframes spin`, `blink`, `pulse`)
- **Must keep** (~70 lines): Layout-specific grid/flex patterns that components don't cover (`.gsm-evil-container`, `.frequency-panel-compact`, `.frequency-container`)

**Alternatives considered**:

- Convert ALL CSS to Tailwind utilities — rejected because console monospace styling and brand typography are cleaner in scoped CSS
- Keep CSS as-is and only decompose — rejected because spec requires CSS reduction to <200 lines

### RQ-5: How should the Svelte 5 component interfaces be structured?

**Decision**: Use Svelte 5 `$props()` with TypeScript interfaces. Events via callback props (not Svelte events).

**Findings**:

- The existing codebase uses Svelte 4 reactive syntax (`$:`) in the GSM Evil page — this will be preserved in the parent page to minimize changes
- New sub-components will use Svelte 5 `$props()` pattern (consistent with shadcn components)
- Event handling: Use callback props (`onscanbutton: () => void`) instead of Svelte `dispatch` — this is the Svelte 5 pattern used by shadcn components
- Bindable props: `ErrorDialog.open` should use `$bindable()` for two-way binding

**Rationale**: Matching the Svelte 5 patterns already established by the shadcn components ensures consistency and future-proofing.

### RQ-6: What existing tests must keep passing?

**Decision**: One existing test file (`gsm-tower-utils.test.ts`) must pass throughout. No component tests exist currently.

**Findings**:

- `tests/unit/utils/gsm-tower-utils.test.ts` — tests for `groupIMSIsByTower` and `sortTowers` utilities
- No existing component tests for the GSM Evil page
- Test setup at `tests/setup.ts` mocks WebSocket, fetch, localStorage, Canvas, ResizeObserver, IntersectionObserver
- Verification workflow: `npm run typecheck && npm run lint && npm run test:unit && npm run build`

**Rationale**: The utility tests validate the data transformation layer that remains unchanged. Component tests are not in scope for this spec (would be a separate task per constitution testing standards).

### RQ-7: What API endpoints does the GSM Evil page consume?

**Decision**: 7 API endpoints — all remain unchanged. UI modernization is frontend-only.

**Findings**:

- `GET /api/gsm-evil/status` — Check if GSM processes are running
- `POST /api/gsm-evil/control` — Start/stop GSM Evil (`{action: 'start'|'stop', frequency}`)
- `POST /api/gsm-evil/intelligent-scan` — Quick frequency scan
- `POST /api/gsm-evil/intelligent-scan-stream` — SSE streaming scan with real-time progress
- `GET /api/gsm-evil/imsi` — Fetch captured IMSIs
- `GET /api/gsm-evil/activity` — Check activity status (packet count, frequency)
- `GET /api/gsm-evil/live-frames` — Fetch live GSM frames
- `POST /api/gsm-evil/tower-location` — Lookup tower location via OpenCellID

**Rationale**: All API calls remain in the parent page — sub-components receive data via props and emit events. No API contract changes needed.
