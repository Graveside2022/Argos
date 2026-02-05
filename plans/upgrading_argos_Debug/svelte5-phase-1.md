# Svelte 5 Migration - Phase 1 (Simple Components)

**Duration:** 5-7 days (20-30 hours)
**Components:** 10 simple components
**Complexity:** Simple (0-3 props, minimal reactivity)
**Goal:** Validate migration approach with straightforward components

---

## Overview

Phase 1 migrates 10 simple components to validate the migration patterns established in Phase 0. These components have minimal props, simple reactive logic, and straightforward store subscriptions.

**Success Criteria:**

- All 10 components migrated to Svelte 5 runes
- Component tests created for each
- No functionality broken
- Migration workflow validated
- Team confident in approach

---

## Git Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout feature/svelte5-migration
git tag phase-1-start
```

---

## Component 1: GPSStatusOverlay.svelte

### Task 1.1: Read and Analyze Component

**File:** `src/lib/components/dashboard/GPSStatusOverlay.svelte`

**Subtask 1.1.1: Locate and read file**

```bash
cat src/lib/components/dashboard/GPSStatusOverlay.svelte
```

**Subtask 1.1.2: Identify current patterns**
Expected patterns:

- Store subscription to gpsStore
- Display GPS status (Fix, No Fix, accuracy, satellites)
- Minimal or no props
- Simple reactive statements

**Subtask 1.1.3: Create migration plan**
Document in checklist:

- [ ] Props: Likely 0-1 props
- [ ] Reactive statements: 1-2 for status text
- [ ] Store subscriptions: 1 (gpsStore)
- [ ] Side effects: None expected
- [ ] Complexity: SIMPLE

---

### Task 1.2: Create Git Checkpoint

```bash
git add src/lib/components/dashboard/GPSStatusOverlay.svelte
git commit -m "checkpoint: GPSStatusOverlay before Svelte 5 migration"
git tag pre-migrate-gpsstatusoverlay
```

---

### Task 1.3: Migrate Component

**Subtask 1.3.1: Convert store subscription**

**Expected Before:**

```typescript
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';
import { onDestroy } from 'svelte';

let gpsData = null;
const unsub = gpsStore.subscribe((value) => {
	gpsData = value;
});

onDestroy(unsub);
```

**After:**

```typescript
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

let gpsData = $derived($gpsStore);
```

**Subtask 1.3.2: Convert reactive statements**

**Expected Before:**

```typescript
$: statusText = gpsData?.status.hasGPSFix ? 'GPS Fixed' : 'No Fix';
$: accuracyText = gpsData?.status.accuracy ? `±${gpsData.status.accuracy.toFixed(1)}m` : 'Unknown';
```

**After:**

```typescript
let statusText = $derived(gpsData?.status.hasGPSFix ? 'GPS Fixed' : 'No Fix');
let accuracyText = $derived(
	gpsData?.status.accuracy ? `±${gpsData.status.accuracy.toFixed(1)}m` : 'Unknown'
);
```

**Subtask 1.3.3: Update imports**

Remove `onDestroy` if no longer used:

```typescript
// BEFORE
import { onDestroy } from 'svelte';

// AFTER (remove if not used elsewhere)
// No onDestroy import needed
```

---

### Task 1.4: Verify Migration

**Subtask 1.4.1: Type check**

```bash
npm run typecheck
# Should pass with zero errors
```

**Subtask 1.4.2: Run verification script**

```bash
./scripts/verify-migration.sh src/lib/components/dashboard/GPSStatusOverlay.svelte
```

**Expected output:**

- ✅ No 'export let' found
- ✅ No reactive statements found
- ✅ No manual subscriptions found
- ✅ Using $derived
- ✅ No type errors

**Subtask 1.4.3: Manual testing**

```bash
npm run dev
# Navigate to dashboard
# Verify GPS status overlay displays correctly
```

**Test checklist:**

- [ ] Overlay appears in dashboard
- [ ] Status text shows "GPS Fixed" or "No Fix"
- [ ] Accuracy text displays correctly
- [ ] Updates when GPS state changes
- [ ] No console errors
- [ ] No console warnings

---

### Task 1.5: Create Component Tests

**Subtask 1.5.1: Create test file**

**File:** `tests/unit/components/dashboard/GPSStatusOverlay.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import GPSStatusOverlay from '$lib/components/dashboard/GPSStatusOverlay.svelte';
import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

describe('GPSStatusOverlay - Svelte 5', () => {
	beforeEach(() => {
		gpsStore.set({
			position: { lat: 0, lon: 0, alt: 0 },
			status: {
				hasGPSFix: false,
				accuracy: 0,
				speed: 0,
				heading: 0,
				satellites: 0
			}
		});
	});

	it('renders without GPS fix', () => {
		const { getByText } = render(GPSStatusOverlay);
		expect(getByText(/No Fix/i)).toBeTruthy();
	});

	it('shows GPS fixed when available', async () => {
		const { getByText } = render(GPSStatusOverlay);

		gpsStore.update((s) => ({
			...s,
			status: { ...s.status, hasGPSFix: true, accuracy: 5 }
		}));

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(getByText(/GPS Fixed/i)).toBeTruthy();
	});

	it('displays accuracy when available', async () => {
		const { getByText } = render(GPSStatusOverlay);

		gpsStore.update((s) => ({
			...s,
			status: { ...s.status, accuracy: 12.5 }
		}));

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(getByText(/±12.5m/i)).toBeTruthy();
	});
});
```

**Subtask 1.5.2: Run tests**

```bash
npm run test -- tests/unit/components/dashboard/GPSStatusOverlay.test.ts
```

**Expected:** All tests pass

---

### Task 1.6: Commit Migration

```bash
git add src/lib/components/dashboard/GPSStatusOverlay.svelte \
        tests/unit/components/dashboard/GPSStatusOverlay.test.ts

git commit -m "feat(svelte5): migrate GPSStatusOverlay to runes

- Convert gpsStore subscription to \$derived
- Convert reactive statements to \$derived
- Remove onDestroy cleanup
- Add component tests

Verified:
- Type checking passes
- All tests pass
- GPS status displays correctly
- Updates reactively

Component 1/10 in Phase 1 complete"

git tag post-migrate-gpsstatusoverlay
```

---

## Component 2: ToolCard.svelte

### Task 2.1: Read and Analyze Component

**File:** `src/lib/components/dashboard/shared/ToolCard.svelte`

**Subtask 2.1.1: Read file**

```bash
cat src/lib/components/dashboard/shared/ToolCard.svelte | head -50
```

**Subtask 2.1.2: Document current state**
Already analyzed:

- **7 props** (lines 4-11): name, description, icon, status, count, canOpen, showControls, externalUrl
- **3 reactive statements** (lines 19-21): isRunning, isTransitioning, statusLabel
- **Event dispatchers**: start, stop, open
- **Complexity**: Simple

---

### Task 2.2: Create Git Checkpoint

```bash
git add src/lib/components/dashboard/shared/ToolCard.svelte
git commit -m "checkpoint: ToolCard before Svelte 5 migration"
git tag pre-migrate-toolcard
```

---

### Task 2.3: Migrate Component

**Subtask 2.3.1: Convert props**

**Before (Lines 4-11):**

```typescript
export let name: string;
export let description: string = '';
export let icon: string;
export let status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
export let count: number | null = null;
export let canOpen: boolean = true;
export let showControls: boolean = true;
export let externalUrl: string | null = null;
```

**After:**

```typescript
let {
	name,
	description = '',
	icon,
	status = 'stopped',
	count = null,
	canOpen = true,
	showControls = true,
	externalUrl = null
}: {
	name: string;
	description?: string;
	icon: string;
	status?: 'stopped' | 'starting' | 'running' | 'stopping';
	count?: number | null;
	canOpen?: boolean;
	showControls?: boolean;
	externalUrl?: string | null;
} = $props();
```

**Subtask 2.3.2: Convert reactive statements**

**Before (Lines 19-21):**

```typescript
$: isRunning = status === 'running';
$: isTransitioning = status === 'starting' || status === 'stopping';
$: statusLabel =
	status === 'starting'
		? 'Starting...'
		: status === 'stopping'
			? 'Stopping...'
			: status === 'running'
				? 'Running'
				: 'Stopped';
```

**After:**

```typescript
let isRunning = $derived(status === 'running');
let isTransitioning = $derived(status === 'starting' || status === 'stopping');
let statusLabel = $derived(
	status === 'starting'
		? 'Starting...'
		: status === 'stopping'
			? 'Stopping...'
			: status === 'running'
				? 'Running'
				: 'Stopped'
);
```

**Subtask 2.3.3: Verify event dispatchers unchanged**

Event dispatchers don't change in Svelte 5:

```typescript
// These stay the same
const dispatch = createEventDispatcher<{
	start: void;
	stop: void;
	open: void;
}>();
```

---

### Task 2.4: Verify Migration

**Subtask 2.4.1: Type check**

```bash
npm run typecheck
```

**Subtask 2.4.2: Run verification script**

```bash
./scripts/verify-migration.sh src/lib/components/dashboard/shared/ToolCard.svelte
```

**Subtask 2.4.3: Manual testing**

```bash
npm run dev
# Navigate to Tools Panel
```

**Test checklist:**

- [ ] Tool cards render in Tools Panel
- [ ] Status indicator shows correct state
- [ ] Start/Stop buttons work
- [ ] Count badge displays when running
- [ ] Event dispatch works (start, stop, open)
- [ ] Status transitions animate correctly
- [ ] All button states work (disabled, enabled)

---

### Task 2.5: Create Component Tests

**File:** `tests/unit/components/dashboard/shared/ToolCard.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ToolCard from '$lib/components/dashboard/shared/ToolCard.svelte';

describe('ToolCard - Svelte 5', () => {
	it('renders with required props', () => {
		const { getByText } = render(ToolCard, {
			props: {
				name: 'Test Tool',
				icon: 'test-icon'
			}
		});
		expect(getByText('Test Tool')).toBeTruthy();
	});

	it('shows status indicator based on status prop', () => {
		const { container, rerender } = render(ToolCard, {
			props: {
				name: 'Test Tool',
				icon: 'test-icon',
				status: 'running'
			}
		});

		expect(container.querySelector('.status-running')).toBeTruthy();

		rerender({ status: 'stopped' });
		expect(container.querySelector('.status-stopped')).toBeTruthy();
	});

	it('displays count badge when running', () => {
		const { getByText } = render(ToolCard, {
			props: {
				name: 'Test Tool',
				icon: 'test-icon',
				status: 'running',
				count: 42
			}
		});
		expect(getByText('42')).toBeTruthy();
	});

	it('emits start event when start button clicked', async () => {
		const { component, getByText } = render(ToolCard, {
			props: {
				name: 'Test Tool',
				icon: 'test-icon',
				status: 'stopped'
			}
		});

		const startHandler = vi.fn();
		component.$on('start', startHandler);

		const startButton = getByText('Start');
		await fireEvent.click(startButton);

		expect(startHandler).toHaveBeenCalledTimes(1);
	});

	it('shows transitioning state correctly', () => {
		const { container } = render(ToolCard, {
			props: {
				name: 'Test Tool',
				icon: 'test-icon',
				status: 'starting'
			}
		});

		expect(container.querySelector('.status-transitioning')).toBeTruthy();
	});
});
```

**Run tests:**

```bash
npm run test -- tests/unit/components/dashboard/shared/ToolCard.test.ts
```

---

### Task 2.6: Commit Migration

```bash
git add src/lib/components/dashboard/shared/ToolCard.svelte \
        tests/unit/components/dashboard/shared/ToolCard.test.ts

git commit -m "feat(svelte5): migrate ToolCard to runes

- Convert 7 props to \$props() with proper TypeScript types
- Convert 3 reactive statements to \$derived
- Event dispatchers unchanged (Svelte 5 compatible)
- Add comprehensive component tests

Verified:
- All props work correctly
- Status indicator updates
- Event dispatch functional
- All button states work

Component 2/10 in Phase 1 complete"

git tag post-migrate-toolcard
```

---

## Component 3: SignalStrengthMeter.svelte

### Task 3.1: Read and Analyze Component

**File:** `src/lib/components/map/SignalStrengthMeter.svelte`

**Current State:**

- **3 props**: power (dBm), showLabel, compact
- **4 reactive statements**: strengthPercent, strengthColor, textColor, qualityLabel
- **Complexity**: Simple calculations

---

### Task 3.2: Create Git Checkpoint

```bash
git add src/lib/components/map/SignalStrengthMeter.svelte
git commit -m "checkpoint: SignalStrengthMeter before Svelte 5 migration"
git tag pre-migrate-signalstrengthmeter
```

---

### Task 3.3: Migrate Component

**Subtask 3.3.1: Convert props**

**Before:**

```typescript
export let power: number; // in dBm
export let showLabel = true;
export let compact = false;
```

**After:**

```typescript
let {
	power,
	showLabel = true,
	compact = false
}: {
	power: number;
	showLabel?: boolean;
	compact?: boolean;
} = $props();
```

**Subtask 3.3.2: Convert reactive statements**

**Before:**

```typescript
$: strengthPercent = Math.max(0, Math.min(100, ((power + 100) / 70) * 100));

$: strengthColor = (() => {
	if (power >= -50) return 'bg-red-500';
	if (power >= -60) return 'bg-orange-500';
	if (power >= -70) return 'bg-yellow-500';
	if (power >= -80) return 'bg-green-500';
	return 'bg-blue-500';
})();

$: textColor = (() => {
	if (power >= -50) return 'text-red-600';
	if (power >= -60) return 'text-orange-600';
	if (power >= -70) return 'text-yellow-600';
	if (power >= -80) return 'text-green-600';
	return 'text-blue-600';
})();

$: qualityLabel = (() => {
	if (power >= -50) return 'Excellent';
	if (power >= -60) return 'Good';
	if (power >= -70) return 'Fair';
	if (power >= -80) return 'Weak';
	return 'Poor';
})();
```

**After:**

```typescript
let strengthPercent = $derived(Math.max(0, Math.min(100, ((power + 100) / 70) * 100)));

let strengthColor = $derived.by(() => {
	if (power >= -50) return 'bg-red-500';
	if (power >= -60) return 'bg-orange-500';
	if (power >= -70) return 'bg-yellow-500';
	if (power >= -80) return 'bg-green-500';
	return 'bg-blue-500';
});

let textColor = $derived.by(() => {
	if (power >= -50) return 'text-red-600';
	if (power >= -60) return 'text-orange-600';
	if (power >= -70) return 'text-yellow-600';
	if (power >= -80) return 'text-green-600';
	return 'text-blue-600';
});

let qualityLabel = $derived.by(() => {
	if (power >= -50) return 'Excellent';
	if (power >= -60) return 'Good';
	if (power >= -70) return 'Fair';
	if (power >= -80) return 'Weak';
	return 'Poor';
});
```

---

### Task 3.4: Verify Migration

```bash
npm run typecheck
./scripts/verify-migration.sh src/lib/components/map/SignalStrengthMeter.svelte
npm run dev
```

**Test checklist:**

- [ ] Signal meter displays
- [ ] Color changes based on power level
- [ ] Progress bar width updates correctly
- [ ] Label shows/hides based on showLabel prop
- [ ] Compact mode works
- [ ] Quality label correct for each power range

---

### Task 3.5: Create Tests & Commit

**File:** `tests/unit/components/map/SignalStrengthMeter.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SignalStrengthMeter from '$lib/components/map/SignalStrengthMeter.svelte';

describe('SignalStrengthMeter - Svelte 5', () => {
	it('renders with power value', () => {
		const { container } = render(SignalStrengthMeter, {
			props: { power: -50 }
		});
		expect(container.querySelector('.signal-meter')).toBeTruthy();
	});

	it('shows excellent quality for strong signal', () => {
		const { getByText } = render(SignalStrengthMeter, {
			props: { power: -45 }
		});
		expect(getByText('Excellent')).toBeTruthy();
	});

	it('calculates strength percentage correctly', () => {
		const { container } = render(SignalStrengthMeter, {
			props: { power: -65 }
		});
		// -65 dBm should be 50%
		const progressBar = container.querySelector('.progress-bar');
		expect(progressBar).toBeTruthy();
	});

	it('hides label when showLabel is false', () => {
		const { container } = render(SignalStrengthMeter, {
			props: { power: -50, showLabel: false }
		});
		expect(container.querySelector('.quality-label')).toBeFalsy();
	});
});
```

```bash
npm run test -- tests/unit/components/map/SignalStrengthMeter.test.ts

git add src/lib/components/map/SignalStrengthMeter.svelte \
        tests/unit/components/map/SignalStrengthMeter.test.ts

git commit -m "feat(svelte5): migrate SignalStrengthMeter to runes

- Convert 3 props to \$props()
- Convert 4 reactive statements to \$derived/\$derived.by()
- Color and quality calculations preserved

Component 3/10 in Phase 1 complete"

git tag post-migrate-signalstrengthmeter
```

---

## Components 4-10: Condensed Instructions

Following the same pattern established above, migrate the remaining 7 components:

### Component 4: DeviceAcquireButton.svelte

**File:** `src/lib/components/hardware/DeviceAcquireButton.svelte`
**Pattern:** 3 props, 1 store subscription → `$derived($hardwareStatus)`
**Time:** 2-3 hours

### Component 5: StatusIndicator.svelte

**Pattern:** Simple props, LED display logic
**Time:** 1-2 hours

### Component 6: GeometricBackground.svelte

**Pattern:** Visual only, likely no props
**Time:** 1 hour

### Component 7: ConnectionStatus.svelte

**Pattern:** 1-2 props, connection display
**Time:** 1-2 hours

### Component 8: SpectrumLink.svelte

**Pattern:** Navigation component
**Time:** 1 hour

### Component 9: KismetDashboardButton.svelte

**Pattern:** Button component, 1-2 props
**Time:** 1 hour

### Component 10: SignalTypeIndicator.svelte

**Pattern:** Display component, 2-3 props
**Time:** 1-2 hours

---

## Phase 1 Workflow Template

For each remaining component, follow this exact workflow:

### Step 1: Analyze (30 min)

1. Read component file
2. Count props, reactive statements, subscriptions
3. Fill out migration checklist
4. Identify test scenarios

### Step 2: Checkpoint (2 min)

```bash
git tag pre-migrate-[component-name]
```

### Step 3: Migrate (60 min)

1. Convert props → `$props()`
2. Convert `$:` → `$derived()` or `$derived.by()`
3. Convert subscriptions → `$derived($store)`
4. Remove `onDestroy`

### Step 4: Verify (30 min)

```bash
npm run typecheck
./scripts/verify-migration.sh [component-path]
npm run dev  # Manual testing
```

### Step 5: Test (45 min)

1. Create test file
2. Test props
3. Test reactive behavior
4. Test user interactions
5. Run `npm run test`

### Step 6: Commit (5 min)

```bash
git add [component] [test-file]
git commit -m "feat(svelte5): migrate [Component] to runes"
git tag post-migrate-[component-name]
```

---

## Phase 1 Completion Checklist

After all 10 components:

```bash
# Verify no Svelte 4 patterns in Phase 1 components
grep -r "export let" \
  src/lib/components/dashboard/GPSStatusOverlay.svelte \
  src/lib/components/dashboard/shared/ToolCard.svelte \
  src/lib/components/map/SignalStrengthMeter.svelte \
  src/lib/components/hardware/DeviceAcquireButton.svelte \
  # ... (all 10 components)

# Should return: 0 results

# Run full verification
npm run typecheck
npm run test
npm run lint

# Git checkpoint
git tag phase-1-complete

# Count commits
git log --oneline phase-1-start..phase-1-complete | wc -l
# Should be approximately 30 commits (3 per component: checkpoint, migration, tag)
```

---

## Phase 1 Summary

**Completed:**

- ✅ 10 simple components migrated
- ✅ Component tests created
- ✅ Migration patterns validated
- ✅ Workflow established
- ✅ Team confident in approach

**Total Time:** 20-30 hours (5-7 days)

**Success Metrics:**

- ✅ All components use Svelte 5 runes
- ✅ Zero `export let` in migrated components
- ✅ All tests pass
- ✅ No console warnings
- ✅ Performance maintained

**Ready for Phase 2?** See `svelte5-phase-2.md`
