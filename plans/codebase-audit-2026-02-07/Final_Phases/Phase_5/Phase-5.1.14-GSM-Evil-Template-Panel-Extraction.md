# Phase 5.1.14 -- GSM Evil: Extract Template Panels

| Field             | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| **Phase**         | 5.1.14                                                     |
| **Title**         | GSM Evil: Extract Template Panels                          |
| **Risk Level**    | LOW                                                        |
| **Prerequisites** | Phase 5.1.10-5.1.13 complete (service functions available) |
| **Files Touched** | 6 (1 modified, 5 created)                                  |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 14, Barr C Ch. 8      |
| **Audit Date**    | 2026-02-08                                                 |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect        |

---

## 1. Objective

Extract the template section (296 lines) of the GSM Evil god page into 5 dedicated
Svelte components. Each component receives data via props from the orchestrator page,
following the single-responsibility principle. This is a UI decomposition with low
behavioral risk.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Template Section      | Estimated Lines   | Content                         |
| --------------------- | ----------------- | ------------------------------- |
| Template block total  | 296 (L1325-L1620) | All template markup             |
| Scan Results panel    | ~80               | Frequency scan results display  |
| Tower Table panel     | ~60               | Cell tower classification table |
| IMSI Capture panel    | ~50               | Live IMSI capture display       |
| Frame Console panel   | ~40               | Raw GSM frame log               |
| Progress/Status panel | ~30               | Scan progress bar and status    |
| Controls panel        | ~36               | Scan/capture control buttons    |

**Total lines to extract**: ~296

---

## 3. Implementation Steps

### Step 1: Create the 5 Component Files

Create components at `src/lib/components/gsm-evil/`:

```bash
mkdir -p src/lib/components/gsm-evil/
```

**Component 1**: `ScanResultsPanel.svelte` (~80 lines)

```svelte
<!-- src/lib/components/gsm-evil/ScanResultsPanel.svelte -->
<script lang="ts">
	export let scanResults: FrequencyResult[];
	export let selectedFrequency: number | null;
	// ... props from god page scan results section
</script>

<!-- Template extracted from L1325-L1404 region -->
```

**Component 2**: `TowerTable.svelte` (~60 lines)

```svelte
<!-- src/lib/components/gsm-evil/TowerTable.svelte -->
<script lang="ts">
	export let towerGroups: TowerGroup[];
	// ... props
</script>

<!-- Template extracted from tower table section -->
```

**Component 3**: `IMSICapturePanel.svelte` (~50 lines)

```svelte
<!-- src/lib/components/gsm-evil/IMSICapturePanel.svelte -->
<script lang="ts">
	export let capturedIMSIs: CapturedIMSI[];
	export let captureActive: boolean;
	// ... props
</script>

<!-- Template extracted from IMSI capture section -->
```

**Component 4**: `FrameConsole.svelte` (~40 lines)

```svelte
<!-- src/lib/components/gsm-evil/FrameConsole.svelte -->
<script lang="ts">
	export let frames: RealFrame[];
	// ... props
</script>

<!-- Template extracted from frame console section -->
```

**Component 5**: `ScanProgress.svelte` (~30 lines)

```svelte
<!-- src/lib/components/gsm-evil/ScanProgress.svelte -->
<script lang="ts">
	export let progress: number;
	export let status: string;
	export let isScanning: boolean;
	// ... props
</script>

<!-- Template extracted from progress/status section -->
```

### Step 2: Replace Template Sections in God Page

Replace the template content in `+page.svelte` with component composition:

```svelte
<script>
	import ScanResultsPanel from '$lib/components/gsm-evil/ScanResultsPanel.svelte';
	import TowerTable from '$lib/components/gsm-evil/TowerTable.svelte';
	import IMSICapturePanel from '$lib/components/gsm-evil/IMSICapturePanel.svelte';
	import FrameConsole from '$lib/components/gsm-evil/FrameConsole.svelte';
	import ScanProgress from '$lib/components/gsm-evil/ScanProgress.svelte';
</script>

<!-- Template becomes component composition: -->
<ScanProgress {progress} {status} {isScanning} />
<ScanResultsPanel {scanResults} {selectedFrequency} on:select={handleFrequencySelect} />
<TowerTable {towerGroups} />
<IMSICapturePanel {capturedIMSIs} {captureActive} />
<FrameConsole {frames} />
```

### Step 3: Props Interface Design

For each component, identify the exact props by examining which variables from the
god page's `<script>` block are referenced in the corresponding template section.
Each prop should be typed explicitly (no `any`).

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify components exist:
ls src/lib/components/gsm-evil/*.svelte
# Expected: 5 files (ScanResultsPanel, TowerTable, IMSICapturePanel, FrameConsole, ScanProgress)

# Verify total component lines:
wc -l src/lib/components/gsm-evil/*.svelte
# Expected: ~260-296 total

# Verify components imported in page:
grep -c 'components/gsm-evil' src/routes/gsm-evil/+page.svelte
# Expected: >= 5

# Verify template section reduced:
# The page template should now be primarily component composition
# (fewer raw HTML elements, more <ComponentName ... /> tags)

# Build verification:
npm run typecheck
npm run build
```

---

## 5. Risk Assessment

| Risk                                     | Severity | Likelihood | Mitigation                                                  |
| ---------------------------------------- | -------- | ---------- | ----------------------------------------------------------- |
| Props interface mismatch                 | MEDIUM   | MEDIUM     | TypeScript typecheck catches prop type errors               |
| Event forwarding broken                  | MEDIUM   | LOW        | Use Svelte `on:event` forwarding or `createEventDispatcher` |
| Style scoping affects extracted template | LOW      | MEDIUM     | Component inherits parent styles via @import or :global     |
| Reactive data flow interrupted           | MEDIUM   | LOW        | Props receive reactive store values from parent             |

**Overall risk**: LOW. Template panel extraction is a UI reorganization. Each
component receives data via props and emits events for user interactions. The
logical behavior remains in the orchestrator page.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                                  |
| --------------------- | ------------------------------------- | --------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | All Svelte components pass `npm run typecheck`                  |
| NASA/JPL Rule 14      | Minimize function complexity          | Each panel is a focused, single-responsibility component        |
| Barr C Ch. 8          | Each module shall have a header       | Each `.svelte` file is a self-contained module with typed props |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -rf src/lib/components/gsm-evil/
```

Single commit, single revert.

---

_Phase 5.1.14 -- GSM Evil: Extract Template Panels_
_Execution priority: 9 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -296 lines from god page (distributed across 5 new components)_
