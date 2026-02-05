# Svelte 5 Migration - Phase 3 (Complex Hardware Integration)

**Duration:** 10-14 days (120-180 hours)
**Components:** 30 performance-critical components
**Complexity:** WebSocket state, canvas rendering, real-time updates
**Goal:** Migrate hardware integration without performance regressions

---

## Overview

Phase 3 is the most technically challenging phase:

- **Performance-critical** rendering (60 FPS requirement)
- **Canvas operations** (SpectrumChart)
- **WebSocket state** management
- **Large data arrays** (thousands of samples)
- **Real-time updates** (GPS, spectrum analysis)
- **Complex intervals** with cleanup

**Critical Requirement:** ZERO performance regressions. Benchmark before and after.

---

## Git Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout feature/svelte5-migration
git tag phase-3-start
```

---

## Category A: HackRF Spectrum Components (15 components)

### Component 1: TimeWindowControl.svelte (COMPLEX EXAMPLE)

This demonstrates the most complex patterns in Phase 3.

#### Task 1.1: Read and Analyze Component

**File:** `src/lib/components/hackrf/TimeWindowControl.svelte`
**Lines:** 319
**Complexity:** HIGH

**Current Patterns:**

- No props (accesses service singleton)
- 2 reactive statements (lines 29-32, 103-111)
- Interval management with cleanup (lines 103-111, 113-122)
- onMount/onDestroy lifecycle

---

#### Task 1.2: Create Performance Baseline

**Subtask 1.2.1: Benchmark current performance**

```bash
npm run dev
# Navigate to HackRF page
# Open Chrome DevTools → Performance tab
# Record 30 seconds of interaction
# Note:
# - Average FPS
# - JS execution time
# - Memory usage
```

**Document baseline:**

```
BASELINE (Svelte 4):
- FPS: [record actual]
- JS execution: [record actual] ms/frame
- Memory: [record actual] MB
- Interval fires: every 5 seconds
```

---

#### Task 1.3: Create Git Checkpoint

```bash
git add src/lib/components/hackrf/TimeWindowControl.svelte
git commit -m "checkpoint: TimeWindowControl before Svelte 5 migration"
git tag pre-migrate-timewindowcontrol
```

---

#### Task 1.4: Migrate Local State

**Subtask 1.4.1: Convert configuration state**

**Before (Lines 19-23):**

```typescript
let windowDuration = 30;
let fadeStartPercent = 60;
let maxSignalAge = 45;
let autoRemoveOld = true;
let showAdvanced = false;
let selectedPreset: string = 'drone';
```

**After:**

```typescript
let windowDuration = $state(30);
let fadeStartPercent = $state(60);
let maxSignalAge = $state(45);
let autoRemoveOld = $state(true);
let showAdvanced = $state(false);
let selectedPreset = $state<string>('drone');
```

---

#### Task 1.5: Convert Reactive Statements

**Subtask 1.5.1: Convert preset data lookup**

**Before (Lines 29-32):**

```typescript
$: selectedPresetData =
	selectedPreset && presets[selectedPreset as keyof typeof presets]
		? presets[selectedPreset as keyof typeof presets]
		: null;
```

**After:**

```typescript
let selectedPresetData = $derived(
	selectedPreset && presets[selectedPreset as keyof typeof presets]
		? presets[selectedPreset as keyof typeof presets]
		: null
);
```

---

#### Task 1.6: Convert Interval Management (CRITICAL)

This is the most important part - interval with cleanup.

**Subtask 1.6.1: Replace reactive interval with $effect**

**Before (Lines 103-111):**

```typescript
let autoRemoveInterval: NodeJS.Timeout | null = null;

$: if (autoRemoveOld) {
	if (autoRemoveInterval) clearInterval(autoRemoveInterval);
	autoRemoveInterval = setInterval(() => {
		timeWindowFilter.clearOlderThan(maxSignalAge);
	}, 5000);
} else if (autoRemoveInterval) {
	clearInterval(autoRemoveInterval);
	autoRemoveInterval = null;
}
```

**After:**

```typescript
$effect(() => {
	if (!autoRemoveOld) return;

	const interval = setInterval(() => {
		timeWindowFilter.clearOlderThan(maxSignalAge);
	}, 5000);

	// Cleanup function - runs before next effect or on unmount
	return () => clearInterval(interval);
});
```

**Key Changes:**

1. Remove `autoRemoveInterval` variable (not needed)
2. Early return if `autoRemoveOld` is false
3. Use local `interval` const
4. Return cleanup function
5. Effect automatically tracks `autoRemoveOld` and `maxSignalAge`

**Subtask 1.6.2: Remove onDestroy cleanup**

**Before (Lines 113-122):**

```typescript
onMount(() => {
	applyPreset('drone');
});

onDestroy(() => {
	if (autoRemoveInterval) {
		clearInterval(autoRemoveInterval);
	}
});
```

**After:**

```typescript
import { onMount } from 'svelte'; // Keep onMount

onMount(() => {
	applyPreset('drone');
});

// onDestroy NO LONGER NEEDED - $effect cleanup handles it
```

---

#### Task 1.7: Verify Interval Behavior

**Subtask 1.7.1: Test interval starts/stops correctly**

```bash
npm run dev
# Navigate to HackRF TimeWindowControl

# Test 1: Toggle auto-remove
# - Check "Auto-remove old signals"
# - Verify console logs show cleanup every 5 seconds
# - Uncheck "Auto-remove old signals"
# - Verify cleanup stops

# Test 2: Change maxSignalAge
# - Set to 30 seconds
# - Verify interval continues
# - Set to 60 seconds
# - Verify interval continues with new value

# Test 3: Unmount component
# - Navigate away from page
# - Verify interval stops (no memory leak)
# - Navigate back
# - Verify interval starts again
```

---

#### Task 1.8: Performance Benchmark

**Subtask 1.8.1: Measure after migration**

```bash
# Same steps as baseline
# Record performance metrics
```

**Compare:**

```
AFTER MIGRATION (Svelte 5):
- FPS: [should be ≥ baseline]
- JS execution: [should be ≤ baseline]
- Memory: [should be ≤ baseline + 5%]
- Interval fires: every 5 seconds (unchanged)
```

**Acceptance Criteria:**

- ✅ FPS ≥ baseline FPS
- ✅ No memory leaks (stable over 5 minutes)
- ✅ Interval cleanup verified

---

#### Task 1.9: Create Tests

**File:** `tests/unit/components/hackrf/TimeWindowControl.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import TimeWindowControl from '$lib/components/hackrf/TimeWindowControl.svelte';

describe('TimeWindowControl - Svelte 5', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders with default values', () => {
		const { getByText } = render(TimeWindowControl);
		expect(getByText(/Time Window/i)).toBeTruthy();
	});

	it('starts auto-remove interval when enabled', async () => {
		const { getByLabelText } = render(TimeWindowControl);
		const clearSpy = vi.spyOn(global, 'setInterval');

		const checkbox = getByLabelText(/Auto-remove old/i);
		await fireEvent.click(checkbox);

		expect(clearSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
	});

	it('clears interval when auto-remove disabled', async () => {
		const { getByLabelText } = render(TimeWindowControl);

		// Enable
		const checkbox = getByLabelText(/Auto-remove old/i);
		await fireEvent.click(checkbox);

		const clearSpy = vi.spyOn(global, 'clearInterval');

		// Disable
		await fireEvent.click(checkbox);

		expect(clearSpy).toHaveBeenCalled();
	});

	it('cleans up interval on unmount', async () => {
		const { getByLabelText, unmount } = render(TimeWindowControl);

		// Enable auto-remove
		const checkbox = getByLabelText(/Auto-remove old/i);
		await fireEvent.click(checkbox);

		const clearSpy = vi.spyOn(global, 'clearInterval');

		// Unmount component
		unmount();

		expect(clearSpy).toHaveBeenCalled();
	});

	it('applies preset configuration', async () => {
		const { getByText } = render(TimeWindowControl);

		const dronePreset = getByText(/Drone/i);
		await fireEvent.click(dronePreset);

		// Verify values updated (check sliders/inputs)
		expect(getByText(/30/)).toBeTruthy(); // Duration
	});
});
```

---

#### Task 1.10: Commit Migration

```bash
git add src/lib/components/hackrf/TimeWindowControl.svelte \
        tests/unit/components/hackrf/TimeWindowControl.test.ts

git commit -m "feat(svelte5): migrate TimeWindowControl to runes

- Convert config state to \$state
- Convert reactive statements to \$derived
- Migrate interval management to \$effect with cleanup
- Remove onDestroy (replaced by \$effect cleanup)
- Add comprehensive tests with timer mocks

Performance verified:
- FPS maintained: [X] fps
- Memory stable: [X] MB
- Interval cleanup confirmed
- No leaks over 5 minute test

Complexity: HIGH (319 lines, interval management)
Component 1/30 in Phase 3 complete"

git tag post-migrate-timewindowcontrol
```

---

### Component 2: SpectrumChart.svelte (PERFORMANCE CRITICAL)

This is the most performance-critical component in the entire codebase.

#### Task 2.1: Analyze Component

**File:** `src/lib/components/hackrf/SpectrumChart.svelte`
**Requirement:** 60 FPS canvas rendering
**Pattern:** Canvas + requestAnimationFrame

---

#### Task 2.2: Create Performance Baseline

**Subtask 2.2.1: Measure rendering performance**

```bash
npm run dev
# Start HackRF sweep
# Open Chrome DevTools → Performance
# Record 10 seconds
```

**Document:**

```
BASELINE:
- FPS during sweep: [actual] (must be ≥ 60)
- Frame render time: [actual] ms (must be < 16.67ms)
- Dropped frames: [actual] (should be 0)
- Memory per frame: [actual] KB
```

---

#### Task 2.3: Migrate Component

**Subtask 2.3.1: Convert props**

**Before:**

```typescript
export let spectrumData: Float32Array;
export let fftSize: number;
export let centerFreq: number;
export let sampleRate: number;
```

**After:**

```typescript
let {
	spectrumData,
	fftSize,
	centerFreq,
	sampleRate
}: {
	spectrumData: Float32Array;
	fftSize: number;
	centerFreq: number;
	sampleRate: number;
} = $props();
```

**Subtask 2.3.2: Convert canvas rendering to $effect**

**Before:**

```typescript
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let animationFrame: number;

$: if (canvas && spectrumData) {
	renderSpectrum(spectrumData, fftSize, centerFreq);
}

function renderSpectrum(data: Float32Array, fft: number, freq: number) {
	if (animationFrame) {
		cancelAnimationFrame(animationFrame);
	}

	animationFrame = requestAnimationFrame(() => {
		// Canvas drawing code...
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		// ... draw spectrum ...
	});
}
```

**After:**

```typescript
let canvas = $state<HTMLCanvasElement | undefined>();
let ctx = $state<CanvasRenderingContext2D | null>(null);

// Initialize canvas context once
$effect(() => {
	if (!canvas) return;

	ctx = canvas.getContext('2d');
	if (!ctx) return;

	// Configure canvas properties
	ctx.imageSmoothingEnabled = false;
	ctx.lineWidth = 1;
});

// Render spectrum on data changes
$effect(() => {
	if (!canvas || !ctx || !spectrumData) return;

	const frame = requestAnimationFrame(() => {
		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Draw spectrum (existing logic)
		const width = canvas.width;
		const height = canvas.height;
		const binWidth = width / fftSize;

		ctx.beginPath();
		ctx.strokeStyle = '#00ff00';

		for (let i = 0; i < fftSize; i++) {
			const x = i * binWidth;
			const y = height - (spectrumData[i] + 100) * (height / 100);

			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}

		ctx.stroke();
	});

	// Cleanup: cancel frame if effect re-runs
	return () => cancelAnimationFrame(frame);
});
```

**Key Optimizations:**

1. Canvas context initialized once (not every frame)
2. `requestAnimationFrame` properly cleaned up
3. Effect tracks: `canvas`, `ctx`, `spectrumData`, `fftSize`
4. Single effect for rendering (cleaner)

---

#### Task 2.4: Performance Verification

**Subtask 2.4.1: Benchmark after migration**

```bash
# Same test as baseline
# Must meet ALL criteria:
```

**Acceptance Criteria:**

- ✅ FPS ≥ 60 during sweep
- ✅ Frame time ≤ 16ms
- ✅ Zero dropped frames
- ✅ Memory stable (no leaks)
- ✅ Smooth visual rendering

**Subtask 2.4.2: Stress test**

```bash
# Test with highest sample rate
# Test with fast sweep rate
# Run for 5 minutes continuously
# Verify no degradation
```

---

#### Task 2.5: Commit Migration

```bash
git commit -m "feat(svelte5): migrate SpectrumChart to runes (PERFORMANCE CRITICAL)

- Convert props to \$props()
- Migrate canvas rendering to \$effect
- Optimize: canvas context initialized once
- Proper requestAnimationFrame cleanup
- Add performance tests

Performance verified:
- FPS: 60 (maintained)
- Frame time: <16ms
- Zero dropped frames
- Memory stable over 5 minutes

CRITICAL: 60 FPS requirement MET
Component 2/30 in Phase 3 complete"

git tag post-migrate-spectrumchart
```

---

## Remaining HackRF Components (13)

Components 3-15 follow similar patterns. Key components:

### Component 3: TimedSignalDisplay.svelte

**Pattern:** Time-based rendering with performance requirements
**Time:** 5 hours

### Component 4: SignalAgeVisualization.svelte

**Pattern:** Visual indicators with state updates
**Time:** 4 hours

### Component 5: AnalysisTools.svelte

**Pattern:** Analysis controls with state
**Time:** 4 hours

### Components 6-15: Standard HackRF Controls

**Components:**

- SweepControl.svelte
- FrequencyConfig.svelte
- HackRFHeader.svelte
- MobileMenu.svelte
- StatusDisplay.svelte
- SignalAnalyzer.svelte
- FrequencyList.svelte
- FrequencyControls.svelte
- SignalAnalysisDisplay.svelte
- SweepControls.svelte

**Average:** 3-4 hours each

---

## Category B: Tactical Map Components (11 components)

### Complex Pattern: GPSPositionManager.svelte

**Migration Pattern:**

```typescript
// GPS store subscription
let gpsData = $derived($gpsStore);

// Position tracking
let currentPosition = $derived.by(() => ({
	lat: gpsData.position.lat,
	lon: gpsData.position.lon,
	accuracy: gpsData.status.accuracy
}));

// Map update effect
$effect(() => {
	if (map && currentPosition.lat !== 0) {
		map.setCenter([currentPosition.lon, currentPosition.lat]);
	}
});
```

### Remaining Tactical Map Components:

- GPSStatusBar.svelte
- MapContainer.svelte
- MarkerManager.svelte
- HackRFController.svelte
- SignalProcessor.svelte
- FrequencySearch.svelte
- KismetController.svelte
- DeviceManager.svelte
- SystemInfoPopup.svelte
- CompanionLauncher.svelte

**Average:** 4-5 hours each

---

## Category C: Specialized Components (4 components)

- MissionControl.svelte (Drone)
- FlightPathVisualization.svelte (Drone)
- BettercapDashboard.svelte

**Average:** 5-6 hours each

---

## Phase 3 Workflow Template

For each performance-critical component:

### Step 1: Performance Baseline (30 min)

1. Measure FPS, frame time, memory
2. Document baseline metrics
3. Identify performance requirements

### Step 2: Analyze (60 min)

1. Read component thoroughly
2. Identify performance-critical sections
3. Plan optimization opportunities

### Step 3: Checkpoint (2 min)

```bash
git tag pre-migrate-[component-name]
```

### Step 4: Migrate (90 min)

1. Convert props
2. Convert state
3. Migrate effects with cleanup
4. Optimize rendering logic

### Step 5: Performance Test (45 min)

1. Measure post-migration
2. Compare to baseline
3. Profile with DevTools
4. Stress test

### Step 6: Optimize if Needed (30 min)

1. If performance < baseline, optimize
2. Check unnecessary re-renders
3. Verify effect dependencies

### Step 7: Verify (30 min)

```bash
npm run typecheck
./scripts/verify-migration.sh [component]
```

### Step 8: Test (60 min)

- Unit tests
- Performance tests
- Integration tests

### Step 9: Commit (5 min)

```bash
git commit -m "feat(svelte5): migrate [Component] to runes

Performance verified: [metrics]"
```

**Total per component:** 4-6 hours

---

## Phase 3 Completion Checklist

```bash
# Verify migration
grep -r "export let" src/lib/components/hackrf/
# Should return: 0

# Performance suite
npm run test:performance

# All components benchmarked
# Create performance report:
cat > PERFORMANCE_REPORT.md << EOF
# Phase 3 Performance Report

## HackRF Components
- SpectrumChart: 60 FPS ✅
- TimeWindowControl: No leaks ✅
... (all components)

## Benchmarks
Baseline vs After Migration
- Average FPS: [before] → [after]
- Memory: [before] → [after]
EOF

git tag phase-3-complete
```

---

## Phase 3 Summary

**Completed:**

- ✅ 30 complex hardware components migrated
- ✅ Performance requirements met (60 FPS)
- ✅ Canvas rendering optimized
- ✅ Interval management with proper cleanup
- ✅ WebSocket integration working
- ✅ Zero memory leaks confirmed

**Total Time:** 120-180 hours (10-14 days)

**Performance Results:**

- All benchmarks meet or exceed baseline
- No regressions detected
- Memory usage stable
- 60 FPS maintained during spectrum sweep

**Ready for Phase 4?** See `svelte5-phase-4.md` for route pages.
