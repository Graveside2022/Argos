# Svelte 5 Migration - Phase 2 (Medium Complexity)

**Duration:** 7-10 days (75-100 hours)
**Components:** 25 medium complexity components
**Complexity:** Multiple props, complex filtering, store integration
**Goal:** Migrate components with significant reactive logic

---

## Overview

Phase 2 targets components with:

- Multiple props (4-8 props)
- Complex filtering and sorting logic
- Multiple store subscriptions
- Form state management
- Event handling chains

These components demonstrate the power of `$derived.by()` and `$effect` for complex scenarios.

---

## Git Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout feature/svelte5-migration
git tag phase-2-start
```

---

## Category A: Dashboard Components (8 components)

### Component 1: DevicesPanel.svelte (COMPLEX EXAMPLE)

This is the most complex component in Phase 2 - use it as the template for others.

#### Task 1.1: Read and Analyze Component

**File:** `src/lib/components/dashboard/panels/DevicesPanel.svelte`
**Lines:** 415
**Complexity:** HIGH

**Subtask 1.1.1: Document current patterns**

```bash
# Read file and document structure
cat src/lib/components/dashboard/panels/DevicesPanel.svelte | head -100
```

**Expected patterns:**

- No props (uses context)
- 1 reactive statement with COMPLEX logic (lines 60-87)
    - Array filtering
    - Map iteration
    - Complex sorting (3 sort modes)
    - String searching
- Multiple local state variables (lines 11-17):
    - searchQuery
    - whitelistInput
    - sortColumn
    - sortDirection
    - selectedMAC
    - hiddenBands
- 1 store subscription (kismetStore)

---

#### Task 1.2: Create Git Checkpoint

```bash
git add src/lib/components/dashboard/panels/DevicesPanel.svelte
git commit -m "checkpoint: DevicesPanel before Svelte 5 migration"
git tag pre-migrate-devicespanel
```

---

#### Task 1.3: Migrate Local State Variables

**Subtask 1.3.1: Convert mutable state to $state**

**Before (Lines 11-17):**

```typescript
let searchQuery = "";
let whitelistInput = "";
let whitelistedMACs: string[] = [];
let sortColumn: "mac" | "rssi" | "type" = "rssi";
let sortDirection: "asc" | "desc" = "desc";
let selectedMAC: string | null = null;
let hiddenBands = new Set<string>();
```

**After:**

```typescript
let searchQuery = $state("");
let whitelistInput = $state("");
let whitelistedMACs = $state<string[]>([]);
let sortColumn = $state<"mac" | "rssi" | "type">("rssi");
let sortDirection = $state<"asc" | "desc">("desc");
let selectedMAC = $state<string | null>(null);
let hiddenBands = $state(new Set<string>());
```

**Rationale:** These are local mutable state that users interact with (search, sort, selection).

---

#### Task 1.4: Convert Store Subscription

**Subtask 1.4.1: Replace manual subscription with $derived**

**Before (Line 3):**

```typescript
import { kismetStore } from "$lib/stores/tactical-map/kismetStore";
// Likely has: $: data = $kismetStore; or manual subscribe
```

**After:**

```typescript
import { kismetStore } from "$lib/stores/tactical-map/kismetStore";

let kismetData = $derived($kismetStore);
```

---

#### Task 1.5: Convert Complex Reactive Statement

**Subtask 1.5.1: Migrate filtering/sorting logic to $derived.by()**

**Before (Lines 60-87):**

```typescript
$: devices = (() => {
	const all = Array.from($kismetStore.devices.values());
	const q = searchQuery.toLowerCase().trim();

	return all
		.filter((d) => {
			const rssi = d.signal?.last_signal ?? -100;
			const band = getSignalBandKey(rssi);
			if (hiddenBands.has(band)) return false;
			if (!q) return true;
			const mac = (d.mac || "").toLowerCase();
			const ssid = (d.ssid || "").toLowerCase();
			const mfr = (d.manufacturer || d.manuf || "").toLowerCase();
			return mac.includes(q) || ssid.includes(q) || mfr.includes(q);
		})
		.sort((a, b) => {
			let cmp = 0;
			if (sortColumn === "mac") {
				cmp = (a.mac || "").localeCompare(b.mac || "");
			} else if (sortColumn === "rssi") {
				cmp =
					(b.signal?.last_signal ?? -100) -
					(a.signal?.last_signal ?? -100);
			} else if (sortColumn === "type") {
				const order: Record<string, number> = { ap: 0, client: 1 };
				cmp = (order[a.type] ?? 2) - (order[b.type] ?? 2);
			}
			return sortDirection === "asc" ? cmp : -cmp;
		});
})();
```

**After:**

```typescript
let devices = $derived.by(() => {
	const all = Array.from(kismetData.devices.values());
	const q = searchQuery.toLowerCase().trim();

	return all
		.filter((d) => {
			const rssi = d.signal?.last_signal ?? -100;
			const band = getSignalBandKey(rssi);
			if (hiddenBands.has(band)) return false;
			if (!q) return true;
			const mac = (d.mac || "").toLowerCase();
			const ssid = (d.ssid || "").toLowerCase();
			const mfr = (d.manufacturer || d.manuf || "").toLowerCase();
			return mac.includes(q) || ssid.includes(q) || mfr.includes(q);
		})
		.sort((a, b) => {
			let cmp = 0;
			if (sortColumn === "mac") {
				cmp = (a.mac || "").localeCompare(b.mac || "");
			} else if (sortColumn === "rssi") {
				cmp =
					(b.signal?.last_signal ?? -100) -
					(a.signal?.last_signal ?? -100);
			} else if (sortColumn === "type") {
				const order: Record<string, number> = { ap: 0, client: 1 };
				cmp = (order[a.type] ?? 2) - (order[b.type] ?? 2);
			}
			return sortDirection === "asc" ? cmp : -cmp;
		});
});
```

**Key Changes:**

1. `$: devices = (() => {})()` → `let devices = $derived.by(() => {})`
2. `$kismetStore.devices` → `kismetData.devices`
3. Automatically tracks: `kismetData`, `searchQuery`, `sortColumn`, `sortDirection`, `hiddenBands`

---

#### Task 1.6: Update Functions

**Subtask 1.6.1: Verify function updates work with $state**

Functions that modify `$state` work as-is, but need reactivity trigger:

**Before:**

```typescript
function toggleBand(key: string) {
	if (hiddenBands.has(key)) {
		hiddenBands.delete(key);
	} else {
		hiddenBands.add(key);
	}
	hiddenBands = hiddenBands; // Trigger Svelte 4 reactivity
}
```

**After:**

```typescript
function toggleBand(key: string) {
	if (hiddenBands.has(key)) {
		hiddenBands.delete(key);
	} else {
		hiddenBands.add(key);
	}
	// Create new Set to trigger $state reactivity
	hiddenBands = new Set(hiddenBands);
}
```

**Subtask 1.6.2: Verify sorting function**

```typescript
function handleSort(col: "mac" | "rssi" | "type") {
	if (sortColumn === col) {
		sortDirection = sortDirection === "asc" ? "desc" : "asc";
	} else {
		sortColumn = col;
		sortDirection = col === "mac" ? "asc" : "desc";
	}
	// No changes needed - $state automatically reactive
}
```

---

#### Task 1.7: Verify Migration

**Subtask 1.7.1: Type check**

```bash
npm run typecheck
```

**Subtask 1.7.2: Run verification script**

```bash
./scripts/verify-migration.sh src/lib/components/dashboard/panels/DevicesPanel.svelte
```

**Subtask 1.7.3: Manual testing**

```bash
npm run dev
# Navigate to Devices Panel
```

**Test checklist:**

- [ ] Device list displays
- [ ] Search filtering works (MAC, SSID, manufacturer)
- [ ] Band filtering works (click band chips to hide/show)
- [ ] Column sorting works (MAC, RSSI, Type)
- [ ] Sort direction toggles (asc/desc)
- [ ] Row selection works (click row)
- [ ] Map flyTo works when clicking device
- [ ] Whitelist add/remove works
- [ ] Performance: Smooth with 200+ devices

**Subtask 1.7.4: Performance test**

```bash
# Add many devices to Kismet
# Verify no lag when typing in search
# Verify no lag when sorting
# Profile in Chrome DevTools
```

---

#### Task 1.8: Create Component Tests

**File:** `tests/unit/components/dashboard/panels/DevicesPanel.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/svelte";
import { fireEvent } from "@testing-library/dom";
import DevicesPanel from "$lib/components/dashboard/panels/DevicesPanel.svelte";
import { kismetStore } from "$lib/stores/tactical-map/kismetStore";

describe("DevicesPanel - Svelte 5", () => {
	beforeEach(() => {
		// Setup mock Kismet data
		kismetStore.set({
			status: "running",
			devices: new Map([
				[
					"AA:BB:CC:DD:EE:FF",
					{
						mac: "AA:BB:CC:DD:EE:FF",
						ssid: "TestNetwork",
						type: "ap",
						signal: { last_signal: -50 },
						manufacturer: "Apple",
					},
				],
				[
					"11:22:33:44:55:66",
					{
						mac: "11:22:33:44:55:66",
						ssid: "SecondNetwork",
						type: "ap",
						signal: { last_signal: -70 },
						manufacturer: "Samsung",
					},
				],
			]),
			stats: { total: 2, active: 2 },
		});
	});

	it("renders device list", () => {
		const { container } = render(DevicesPanel);
		expect(container.querySelectorAll(".device-row").length).toBe(2);
	});

	it("filters devices by search query", async () => {
		const { container, getByPlaceholderText } = render(DevicesPanel);

		const searchInput = getByPlaceholderText(/search/i);
		await fireEvent.input(searchInput, { target: { value: "test" } });

		// Should show only TestNetwork
		expect(container.querySelectorAll(".device-row").length).toBe(1);
		expect(container.textContent).toContain("TestNetwork");
	});

	it("sorts devices by MAC address", async () => {
		const { container, getByText } = render(DevicesPanel);

		const macHeader = getByText(/MAC Address/i);
		await fireEvent.click(macHeader);

		const rows = container.querySelectorAll(".device-row");
		expect(rows[0].textContent).toContain("11:22:33:44:55:66");
		expect(rows[1].textContent).toContain("AA:BB:CC:DD:EE:FF");
	});

	it("filters devices by signal band", async () => {
		const { container, getByText } = render(DevicesPanel);

		// Click to hide "excellent" band (-50 dBm)
		const excellentChip = getByText(/excellent/i);
		await fireEvent.click(excellentChip);

		// Should show only SecondNetwork (-70 dBm)
		expect(container.querySelectorAll(".device-row").length).toBe(1);
		expect(container.textContent).toContain("SecondNetwork");
	});

	it("selects device on row click", async () => {
		const { container } = render(DevicesPanel);

		const firstRow = container.querySelector(".device-row");
		await fireEvent.click(firstRow!);

		expect(firstRow?.classList.contains("selected")).toBe(true);
	});
});
```

---

#### Task 1.9: Commit Migration

```bash
git add src/lib/components/dashboard/panels/DevicesPanel.svelte \
        tests/unit/components/dashboard/panels/DevicesPanel.test.ts

git commit -m "feat(svelte5): migrate DevicesPanel to runes

- Convert local state to \$state (search, sort, selection)
- Convert Kismet store subscription to \$derived
- Convert complex filtering/sorting to \$derived.by()
- Update Set mutation to trigger reactivity
- Add comprehensive component tests

Complexity: HIGH (415 lines, complex filtering)
Verified:
- Search filtering works
- Band filtering works
- Column sorting works (3 modes)
- Row selection works
- Performance maintained with 200+ devices

Component 1/25 in Phase 2 complete"

git tag post-migrate-devicespanel
```

---

## Remaining Dashboard Components (7 components)

### Component 2: PanelContainer.svelte

**Pattern:** Panel layout management, context provider
**Time:** 3 hours

### Component 3: TopStatusBar.svelte

**Pattern:** Multiple store subscriptions (GPS, hardware, system)
**Time:** 3 hours

### Component 4: IconRail.svelte

**Pattern:** Navigation with active state tracking
**Time:** 2 hours

### Component 5: LayersPanel.svelte

**Pattern:** Layer toggle controls with store
**Time:** 3 hours

### Component 6: ToolsPanel.svelte

**Pattern:** Tools list with status from multiple stores
**Time:** 3 hours

### Component 7: OverviewPanel.svelte

**Pattern:** System overview with stats aggregation
**Time:** 3 hours

### Component 8: SettingsPanel.svelte

**Pattern:** Form state with validation
**Time:** 4 hours

---

## Category B: Map Components (12 components)

### Complex Pattern: SignalList.svelte

#### Task: Migrate SignalList

**File:** `src/lib/components/map/SignalList.svelte`
**Pattern:** Filterable list with sorting

**Migration Pattern:**

```typescript
// Local state
let searchFilter = $state("");
let sortMode = $state<"time" | "strength" | "frequency">("time");
let selectedSignal = $state<string | null>(null);

// Store subscription
let signalsData = $derived($signalsStore);

// Complex derived list
let filteredSignals = $derived.by(() => {
	return signalsData
		.filter((s) => s.name.includes(searchFilter))
		.sort((a, b) => {
			if (sortMode === "time") return b.timestamp - a.timestamp;
			if (sortMode === "strength") return b.strength - a.strength;
			return a.frequency - b.frequency;
		});
});
```

### Remaining Map Components (11):

- MapControls.svelte
- SignalDetailPanel.svelte
- SignalInfoCard.svelte
- SignalFilterControls.svelte
- TimeFilterControls.svelte
- RSSILocalizationControls.svelte
- AirSignalOverlay.svelte
- BettercapOverlay.svelte
- BTLEOverlay.svelte
- KismetDashboardOverlay.svelte
- MapLegend.svelte

**Average time per component:** 3 hours

---

## Category C: Kismet Components (5 components)

### Component: DeviceList.svelte (Similar to DevicesPanel)

**Pattern:** Complex device list with filtering

```typescript
// State
let filterMode = $state<"all" | "ap" | "client">("all");
let minRSSI = $state(-100);

// Store
let devices = $derived($kismetStore.devices);

// Filtered
let filteredDevices = $derived.by(() => {
	return Array.from(devices.values()).filter((d) => {
		if (filterMode !== "all" && d.type !== filterMode) return false;
		if (d.signal.last_signal < minRSSI) return false;
		return true;
	});
});
```

### Remaining Kismet Components (4):

- AlertsPanel.svelte (3 hours)
- MapView.svelte (4 hours)
- ServiceControl.svelte (3 hours)
- StatisticsPanel.svelte (3 hours)

---

## Phase 2 Workflow Template

For each component in Phase 2:

### Step 1: Analyze (45 min)

1. Read component (200-400 lines)
2. Identify local state (often 5-10 variables)
3. Identify stores (often 2-3)
4. Identify complex reactive logic
5. Plan migration approach

### Step 2: Checkpoint (2 min)

```bash
git tag pre-migrate-[component-name]
```

### Step 3: Migrate State (30 min)

1. Convert local variables to `$state()`
2. Add proper TypeScript types
3. Verify mutability needs

### Step 4: Migrate Stores (20 min)

1. Convert subscriptions to `$derived($store)`
2. Remove `onDestroy` cleanup

### Step 5: Migrate Reactive Logic (60 min)

1. Convert simple `$:` to `$derived()`
2. Convert complex `$:` to `$derived.by()`
3. Ensure explicit `return` in `$derived.by()`

### Step 6: Update Functions (30 min)

1. Check Set/Map mutations
2. Update to trigger `$state` reactivity
3. Verify event handlers unchanged

### Step 7: Verify (45 min)

```bash
npm run typecheck
./scripts/verify-migration.sh [component]
npm run dev  # Extensive manual testing
```

### Step 8: Performance Test (30 min)

- Test with large datasets
- Profile with Chrome DevTools
- Verify no excessive re-renders

### Step 9: Test (60 min)

- Create comprehensive tests
- Test filtering logic
- Test sorting logic
- Test user interactions

### Step 10: Commit (5 min)

```bash
git commit -m "feat(svelte5): migrate [Component] to runes"
git tag post-migrate-[component-name]
```

**Total per component:** 3-4 hours

---

## Phase 2 Completion Checklist

```bash
# Verify no Svelte 4 patterns
grep -r "export let" \
  src/lib/components/dashboard/panels/ \
  src/lib/components/map/ \
  src/lib/components/kismet/

# Should return: 0 results

# Verify all use Svelte 5
grep -r "\$derived\|\$state" \
  src/lib/components/dashboard/panels/ \
  src/lib/components/map/ \
  src/lib/components/kismet/

# Should return: many results

# Run full suite
npm run typecheck
npm run test
npm run lint

# Performance test
# Load dashboard with 500+ Kismet devices
# Verify smooth performance

# Git checkpoint
git tag phase-2-complete
```

---

## Phase 2 Summary

**Completed:**

- ✅ 25 medium complexity components migrated
- ✅ Complex filtering patterns work with $derived.by()
- ✅ Form state management with $state validated
- ✅ Multiple store subscriptions consolidated
- ✅ Performance maintained with large datasets

**Total Time:** 75-100 hours (7-10 days)

**Key Learnings:**

- `$derived.by()` perfect for complex filtering/sorting
- `$state` handles mutable state elegantly
- Set/Map mutations need new instances for reactivity
- Performance excellent even with complex derivations

**Ready for Phase 3?** See `svelte5-phase-3.md` for complex hardware integration.
