# Svelte 5 Migration - Phases 1-5 Summary

This file provides condensed guidance for Phases 1-5. Each phase follows the same patterns established in Phase 0.

---

## Phase 1: Simple Components (5-7 days, 10 components)

**Pattern:** Follow Phase 0 DashboardMap approach

### Components List:

1. **GPSStatusOverlay.svelte** - Display-only GPS status
2. **ToolCard.svelte** (7 props, 3 reactive) - Simple card component
3. **SignalStrengthMeter.svelte** (3 props, 4 reactive) - Progress bar
4. **DeviceAcquireButton.svelte** (3 props, 1 subscription) - Hardware button
5. **StatusIndicator.svelte** - Status LED
6. **GeometricBackground.svelte** - Visual only
7. **ConnectionStatus.svelte** - Connection display
8. **SpectrumLink.svelte** - Navigation
9. **KismetDashboardButton.svelte** - Button
10. **SignalTypeIndicator.svelte** - Type badge

### Workflow Per Component (2-3 hours):

1. **Read** (30 min): Understand functionality
2. **Migrate** (60 min):
    - Props: `export let` → `$props()`
    - Reactive: `$:` → `$derived()`
    - Stores: `subscribe()` → `$derived($store)`
3. **Test** (30 min): Manual + automated
4. **Create tests** (45 min): Component test file

### Example: ToolCard.svelte

**Before:**

```typescript
export let name: string;
export let status: 'stopped' | 'running' = 'stopped';
$: isRunning = status === 'running';
```

**After:**

```typescript
let {
	name,
	status = 'stopped'
}: {
	name: string;
	status?: 'stopped' | 'running';
} = $props();

let isRunning = $derived(status === 'running');
```

**Verification:**

```bash
./scripts/verify-migration.sh src/lib/components/dashboard/shared/ToolCard.svelte
npm run test -- tests/unit/components/dashboard/shared/ToolCard.test.ts
```

---

## Phase 2: Medium Complexity (7-10 days, 25 components)

**Focus:** Complex filtering, multiple stores, event handling

### Key Component: DevicesPanel.svelte (415 lines)

**Pattern - Complex Filtering:**

```typescript
// BEFORE:
$: devices = (() => {
  const all = Array.from($kismetStore.devices.values());
  return all
    .filter(d => /* complex filter */)
    .sort((a, b) => /* complex sort */);
})();

// AFTER:
let kismetData = $derived($kismetStore);
let devices = $derived.by(() => {
  const all = Array.from(kismetData.devices.values());
  return all
    .filter(d => /* complex filter */)
    .sort((a, b) => /* complex sort */);
});
```

**Pattern - Form State:**

```typescript
// Local mutable state
let searchQuery = $state('');
let sortColumn = $state<'mac' | 'rssi'>('rssi');

// Computed from state
let filteredDevices = $derived(devices.filter((d) => d.mac.includes(searchQuery)));
```

### Component Categories:

- **Dashboard Components** (8): PanelContainer, TopStatusBar, IconRail, etc.
- **Map Components** (12): MapControls, SignalDetailPanel, filters, etc.
- **Kismet Components** (5): DeviceList, AlertsPanel, ServiceControl

**Workflow:** 3-4 hours per component

---

## Phase 3: Complex Hardware Integration (10-14 days, 30 components)

**Focus:** Performance-critical rendering, WebSocket state, canvas operations

### Performance-Critical Pattern:

**TimeWindowControl.svelte** - Intervals with cleanup:

```typescript
// BEFORE:
let interval: NodeJS.Timeout | null = null;
$: if (autoRemove) {
	interval = setInterval(() => cleanup(), 5000);
}
onDestroy(() => clearInterval(interval));

// AFTER:
$effect(() => {
	if (!autoRemove) return;

	const interval = setInterval(() => cleanup(), 5000);
	return () => clearInterval(interval);
});
```

**SpectrumChart.svelte** - Canvas rendering (60 FPS requirement):

```typescript
let { spectrumData }: { spectrumData: Float32Array } = $props();
let canvas = $state<HTMLCanvasElement | undefined>();

$effect(() => {
	if (!canvas || !spectrumData) return;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const frame = requestAnimationFrame(() => {
		renderSpectrum(ctx, spectrumData);
	});

	return () => cancelAnimationFrame(frame);
});
```

### Component Categories:

- **HackRF Spectrum** (15): Real-time analysis, canvas rendering
- **Tactical Map** (11): GPS, hardware controllers
- **Specialized** (4): Drone, companion tools

**Key Requirements:**

- Maintain 60 FPS
- No memory leaks
- Canvas optimization
- Efficient array updates

**Workflow:** 4-6 hours per component (includes benchmarking)

---

## Phase 4: Route Pages & Forms (5-7 days, 50 components)

**Focus:** Page-level components, form state, navigation

### Pattern - Form State:

```typescript
// Local form state
let takServer = $state('');
let takPort = $state(8087);
let takEnabled = $state(false);

// Computed settings object
let settings = $derived({
	takServer,
	takPort,
	takEnabled
});

// Form handlers (unchanged)
function handleSubmit() {
	saveSettings(settings);
}
```

### Component Categories:

- **Simple Pages** (10): Home, layouts, test pages (1 hour each)
- **Complex Pages** (12): HackRF, Kismet, GSM Evil (2-3 hours each)
- **WigleToTAK** (6): Settings, filters (2 hours each)
- **Test/Debug** (8): Development utilities (1 hour each)

**Note:** Route pages typically simpler than components (less props, more local state)

---

## Phase 5: Final Cleanup & Optimization (3-5 days)

### Tasks:

**1. Comprehensive Testing:**

```bash
npm run test:all
npm run test:e2e
npm run test:visual
npm run test:performance
```

**2. Performance Optimization:**

- Profile with Svelte DevTools
- Optimize `$derived` vs `$derived.by()` usage
- Check for memory leaks
- Review `$effect` cleanup functions

**3. Code Quality:**

```bash
npm run lint:fix
npm run typecheck
# Review all console warnings
```

**4. Final Verification:**

```bash
# Should return 0:
grep -r "export let" src/lib/components | wc -l
grep -r "^\s*\$:" src/lib/components | wc -l
grep -r "onDestroy.*subscribe" src/lib/components | wc -l
```

**5. Migration Report:**
Create `MIGRATION_REPORT.md` documenting:

- Components migrated (116)
- Issues encountered
- Performance comparisons
- Lessons learned

---

## Common Patterns Reference

### Props Migration

```typescript
// Simple
export let name: string;
→ let { name }: { name: string } = $props();

// With default
export let count = 0;
→ let { count = 0 }: { count?: number } = $props();
```

### Reactive Migration

```typescript
// Simple
$: doubled = count * 2;
→ let doubled = $derived(count * 2);

// Complex
$: result = (() => { /* ... */ return x; })();
→ let result = $derived.by(() => { /* ... */ return x; });
```

### Store Migration

```typescript
// Read-only
const unsub = store.subscribe(v => data = v);
→ let data = $derived($store);

// With side effect
const unsub = store.subscribe(v => { data = v; doSomething(); });
→ let data = $derived($store);
   $effect(() => { doSomething(); });
```

### Side Effect Migration

```typescript
// Simple
$: if (x) { doSomething(); }
→ $effect(() => { if (x) { doSomething(); } });

// With cleanup
$: { const i = setInterval(...); ... }
onDestroy(() => clearInterval(i));
→ $effect(() => {
    const i = setInterval(...);
    return () => clearInterval(i);
  });
```

---

## Success Criteria Summary

**Phase 1:**
✅ 10 simple components migrated
✅ Testing patterns established
✅ Fast workflow validated

**Phase 2:**
✅ 25 medium components migrated
✅ Complex filtering patterns work
✅ Form state management validated

**Phase 3:**
✅ 30 complex components migrated
✅ Performance benchmarks met (60 FPS)
✅ No memory leaks
✅ Canvas rendering optimized

**Phase 4:**
✅ 50 route pages migrated
✅ Form state patterns work
✅ Navigation functional

**Phase 5:**
✅ All 116 components migrated
✅ Zero Svelte 4 patterns remain
✅ All tests pass
✅ Performance maintained
✅ Documentation complete

---

## Total Timeline

**Phase 0:** 3-5 days (Foundation)
**Phase 1:** 5-7 days (Simple)
**Phase 2:** 7-10 days (Medium)
**Phase 3:** 10-14 days (Complex)
**Phase 4:** 5-7 days (Routes)
**Phase 5:** 3-5 days (Cleanup)

**Total:** 33-48 days (6.5-9.5 weeks)

---

## Quick Reference Links

- **Patterns:** `svelte5-patterns.md`
- **Phase 0 Detailed:** `svelte5-phase-0.md`
- **Verification:** `./scripts/verify-migration.sh`
- **Checklist:** `.claude/migration-checklist.md`

---

**Note:** This summary file condenses Phases 1-5. Phase 0 (`svelte5-phase-0.md`) contains the comprehensive line-by-line approach that applies to all phases. Follow the same detailed pattern for each component.
