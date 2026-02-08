# Phase 5.1.16 -- Sweep: Create Shared Sweep Components

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| **Phase**         | 5.1.16                                                                      |
| **Title**         | Sweep: Create Shared Sweep Components                                       |
| **Risk Level**    | MEDIUM                                                                      |
| **Prerequisites** | Phase 5.1.17 complete (shared service and adapter interface created)        |
| **Files Touched** | 9 (2 modified, 7 created)                                                   |
| **Standards**     | MISRA C:2023 Rule 1.1, MISRA C:2023 Dir 4.4, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                                  |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                         |

---

## 1. Objective

Create 7 shared Svelte components that replace the duplicated template sections in
both `rfsweep/+page.svelte` and `hackrfsweep/+page.svelte`. Both pages implement
the same sweep workflow with device-specific API calls -- the 10 identically-named
functions confirm structural equivalence. The correct decomposition is a shared
component library parameterized by a device adapter interface, NOT per-page
decomposition (which would maintain the duplication).

**This step REQUIRES Phase 5.1.17** (shared service + adapter interface) to be complete
first, because the components consume the adapter types and service functions.

---

## 2. Current State

**Source files**:

- `src/routes/rfsweep/+page.svelte` (2,245 lines) -- USRP device
- `src/routes/hackrfsweep/+page.svelte` (1,830 lines) -- HackRF device

### 2.1 10 Identically-Named Functions (Duplicated)

`addFrequency`, `startCycling`, `stopCycling`, `startLocalTimer`, `stopLocalTimer`,
`resetDisplays`, `removeFrequency`, `openSpectrumAnalyzer`, `updateSignalStrength`,
`updateSignalIndicator`

### 2.2 Near-Identical Reactive Blocks

`$spectrumData`, `$sweepStatus`, `$cycleStatus`, `$connectionStatus`

### 2.3 Device-Specific Differences

- HackRF uses `hackrfAPI`, rfsweep uses `usrpAPI`
- HackRF tolerance is 50 MHz, USRP tolerance is 100 MHz
- rfsweep has `measureUSRPPower` (67 lines) -- USRP-only
- Spectrum path: `/viewspectrum` (HackRF) vs `/viewspectrum?device=usrp` (USRP)

---

## 3. Implementation Steps

### Step 1: Create Component Directory

```bash
mkdir -p src/lib/components/sweep/
```

### Step 2: Create 7 Shared Components

**Component 1**: `FrequencyList.svelte` (~80 lines)

```svelte
<!-- src/lib/components/sweep/FrequencyList.svelte -->
<script lang="ts">
	import type { FrequencyEntry } from '$lib/services/sweep/types';
	import { createEventDispatcher } from 'svelte';

	export let frequencies: FrequencyEntry[];
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		add: { frequency: string };
		remove: { id: number };
	}>();
</script>

<!-- Frequency list with add/remove buttons -->
<!-- Replaces template sections in both pages -->
```

**Component 2**: `SweepControls.svelte` (~60 lines)

```svelte
<!-- src/lib/components/sweep/SweepControls.svelte -->
<script lang="ts">
	import type { SweepDeviceAdapter } from '$lib/services/sweep/types';
	import { createEventDispatcher } from 'svelte';

	export let adapter: SweepDeviceAdapter;
	export let isConnected: boolean;
	export let isSweeping: boolean;

	const dispatch = createEventDispatcher<{
		start: void;
		stop: void;
		reconnect: void;
		spectrum: void;
	}>();
</script>

<!-- Start/Stop/Reconnect/SpectrumAnalyzer buttons -->
```

**Component 3**: `ConnectionStatus.svelte` (~40 lines)

```svelte
<!-- src/lib/components/sweep/ConnectionStatus.svelte -->
<script lang="ts">
	export let status: string;
	export let errorMessage: string;
	export let deviceName: string;
</script>

<!-- Connection status banner with error messages -->
```

**Component 4**: `SignalGauge.svelte` (~60 lines)

```svelte
<!-- src/lib/components/sweep/SignalGauge.svelte -->
<script lang="ts">
	export let signalStrength: number;
	export let unit: string = 'dBm';
</script>

<!-- Signal strength gauge + dB readout -->
```

**Component 5**: `CycleStatusCard.svelte` (~50 lines)

```svelte
<!-- src/lib/components/sweep/CycleStatusCard.svelte -->
<script lang="ts">
	export let timer: string;
	export let progress: number;
	export let currentFrequency: string;
	export let isCycling: boolean;
</script>

<!-- Timer, progress bar, current frequency -->
```

**Component 6**: `SignalAnalysisCard.svelte` (~50 lines)

```svelte
<!-- src/lib/components/sweep/SignalAnalysisCard.svelte -->
<script lang="ts">
	export let detectedFrequency: number | null;
	export let frequencyOffset: number | null;
	export let signalLevel: number | null;
</script>

<!-- Detected freq, offset, dB level -->
```

**Component 7**: `SweepHeader.svelte` (~30 lines)

```svelte
<!-- src/lib/components/sweep/SweepHeader.svelte -->
<script lang="ts">
	export let deviceName: string;
	export let healthStatus: string;
</script>

<!-- Page title, device label, health status -->
```

### Step 3: Replace Template Sections in Both Pages

Update `rfsweep/+page.svelte`:

```svelte
<script>
	import FrequencyList from '$lib/components/sweep/FrequencyList.svelte';
	import SweepControls from '$lib/components/sweep/SweepControls.svelte';
	import ConnectionStatus from '$lib/components/sweep/ConnectionStatus.svelte';
	import SignalGauge from '$lib/components/sweep/SignalGauge.svelte';
	import CycleStatusCard from '$lib/components/sweep/CycleStatusCard.svelte';
	import SignalAnalysisCard from '$lib/components/sweep/SignalAnalysisCard.svelte';
	import SweepHeader from '$lib/components/sweep/SweepHeader.svelte';
</script>

<SweepHeader deviceName={adapter.deviceName} {healthStatus} />
<ConnectionStatus {status} {errorMessage} deviceName={adapter.deviceName} />
<FrequencyList {frequencies} on:add={handleAddFreq} on:remove={handleRemoveFreq} />
<SweepControls {adapter} {isConnected} {isSweeping} on:start on:stop on:spectrum />
<SignalGauge {signalStrength} />
<CycleStatusCard {timer} {progress} {currentFrequency} {isCycling} />
<SignalAnalysisCard {detectedFrequency} {frequencyOffset} {signalLevel} />
```

Repeat the same pattern for `hackrfsweep/+page.svelte`.

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify all 7 components exist:
ls src/lib/components/sweep/*.svelte | wc -l
# Expected: 7

# Verify total component lines:
wc -l src/lib/components/sweep/*.svelte
# Expected: ~370 total

# Verify components imported in both pages:
grep -c 'components/sweep' src/routes/rfsweep/+page.svelte
# Expected: >= 7

grep -c 'components/sweep' src/routes/hackrfsweep/+page.svelte
# Expected: >= 7

# Verify template sections replaced (raw HTML element count reduced):
grep -c '<div\|<span\|<button\|<input' src/routes/rfsweep/+page.svelte
# Expected: significantly fewer than before (template is now component composition)

# Build verification:
npm run typecheck
npm run build
```

---

## 5. Template Lines Replaced

| Page        | Template Before | Template After | Reduction |
| ----------- | --------------- | -------------- | --------- |
| rfsweep     | 903 lines       | ~100 lines     | -89%      |
| hackrfsweep | 862 lines       | ~100 lines     | -88%      |
| **Total**   | 1,765 lines     | ~200 lines     | -89%      |

**Net new component lines**: ~370 (shared across both pages)

---

## 6. Risk Assessment

| Risk                                              | Severity | Likelihood | Mitigation                                                 |
| ------------------------------------------------- | -------- | ---------- | ---------------------------------------------------------- |
| Component prop interface mismatches both pages    | MEDIUM   | MEDIUM     | Design props from intersection of both pages' data shapes  |
| Event forwarding breaks page behavior             | MEDIUM   | LOW        | Use createEventDispatcher with typed events                |
| Reactive `$:` blocks broken by component boundary | MEDIUM   | MEDIUM     | Move reactive logic to service layer (Phase 5.1.17)        |
| Style class names differ between pages            | LOW      | MEDIUM     | Shared CSS file (Phase 5.1.19) resolves naming differences |

**Overall risk**: MEDIUM. The primary challenge is designing a prop interface that
works for both HackRF and USRP pages while accommodating the device-specific
differences through the adapter pattern.

---

## 7. Standards Compliance

| Standard              | Requirement                                    | How This Sub-Task Satisfies It                                  |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | All Svelte components pass `npm run typecheck`                  |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | Duplicated template code eliminated via shared components       |
| NASA/JPL Rule 14      | Minimize function complexity                   | Each component is single-responsibility                         |
| Barr C Ch. 8          | Each module shall have a header                | Each `.svelte` file is a self-contained module with typed props |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/rfsweep/+page.svelte
git checkout -- src/routes/hackrfsweep/+page.svelte
rm -rf src/lib/components/sweep/
```

Single commit, single revert.

---

_Phase 5.1.16 -- Sweep: Create Shared Sweep Components_
_Execution priority: 11 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -1,765 template lines replaced with ~370 shared component lines_
