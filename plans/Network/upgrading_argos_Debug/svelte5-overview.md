# Svelte 5 Migration - Overview & Strategy

## Executive Summary

**Scope:** Migrate all 116 Svelte components from Svelte 4 to Svelte 5 runes
**Duration:** 6-10 weeks (33-48 working days)
**Complexity:** Simple → Complex (phased progression)
**Approach:** Incremental migration with zero functionality breakage

## Current State

### Component Inventory

- **Total Components**: 116
- **Svelte 5 Adoption**: 1 component partially migrated (DashboardMap.svelte)
- **Svelte 4 Patterns**: 39 components use `export let` props
- **Reactive Statements**: Heavy use of `$:` throughout codebase
- **Store Subscriptions**: Manual `subscribe()` with `onDestroy` cleanup
- **Test Coverage**: No component tests exist (will add during migration)

### Component Categories

1. **Dashboard Views** (13): Status bars, panels, navigation
2. **Map Components** (12): Signal overlays, controls, geospatial displays
3. **Hardware Integration** (3): HackRF, USRP, hardware status
4. **HackRF/Spectrum** (18): Real-time spectrum analysis, performance-critical
5. **Kismet** (7): WiFi scanning, device management
6. **Tactical Map** (11): GPS, map controls, marker management
7. **Route Pages** (30+): Full-page views, forms, tool integrations
8. **Utilities** (20+): Buttons, cards, indicators, navigation

## Svelte 5 Migration Patterns

### Pattern 1: Props

```svelte
<!-- BEFORE (Svelte 4) -->
<script lang="ts">
  export let name: string;
  export let count: number = 0;
</script>

<!-- AFTER (Svelte 5) -->
<script lang="ts">
  let { name, count = 0 }: {
    name: string;
    count?: number;
  } = $props();
</script>
```

### Pattern 2: Reactive Statements

```svelte
<!-- BEFORE (Svelte 4) -->
<script lang="ts">
  export let count: number;
  $: doubled = count * 2;
</script>

<!-- AFTER (Svelte 5) -->
<script lang="ts">
  let { count }: { count: number } = $props();
  let doubled = $derived(count * 2);
</script>
```

### Pattern 3: Store Subscriptions

```svelte
<!-- BEFORE (Svelte 4) -->
<script lang="ts">
  import { myStore } from '$lib/stores/myStore';
  import { onDestroy } from 'svelte';

  let data = null;
  const unsub = myStore.subscribe(value => {
    data = value;
  });

  onDestroy(unsub);
</script>

<!-- AFTER (Svelte 5) -->
<script lang="ts">
  import { myStore } from '$lib/stores/myStore';

  let data = $derived($myStore);
</script>
```

### Pattern 4: Side Effects

```svelte
<!-- BEFORE (Svelte 4) -->
<script lang="ts">
  export let isRunning: boolean;

  $: if (isRunning) {
    startPolling();
  } else {
    stopPolling();
  }
</script>

<!-- AFTER (Svelte 5) -->
<script lang="ts">
  let { isRunning }: { isRunning: boolean } = $props();

  $effect(() => {
    if (isRunning) {
      startPolling();
    } else {
      stopPolling();
    }
  });
</script>
```

See `svelte5-patterns.md` for complete pattern reference.

## 5-Phase Implementation Strategy

### Phase 0: Foundation & Proof of Concept (3-5 days)

**Goal:** Complete DashboardMap.svelte migration, establish testing infrastructure

**Deliverables:**

- ✅ DashboardMap.svelte fully migrated (already 50% done)
- ✅ Component test template created
- ✅ Migration verification script
- ✅ Migration checklist template
- ✅ Pattern reference guide

**Key Component:**

- `src/lib/components/dashboard/DashboardMap.svelte` (1,152 lines)

### Phase 1: Simple Components (5-7 days)

**Goal:** Migrate 10 simple components to validate approach

**Complexity:** Simple (0-3 props, minimal reactivity)

**Components:**

1. GPSStatusOverlay.svelte
2. ToolCard.svelte
3. SignalStrengthMeter.svelte
4. DeviceAcquireButton.svelte
5. StatusIndicator.svelte
6. GeometricBackground.svelte
7. ConnectionStatus.svelte
8. SpectrumLink.svelte
9. KismetDashboardButton.svelte
10. SignalTypeIndicator.svelte

**Workflow per component:** 2-3 hours

- Read & analyze (30 min)
- Migrate (60 min)
- Test (30 min)
- Create tests (45 min)

### Phase 2: Medium Complexity Dashboard/Map (7-10 days)

**Goal:** Migrate 25 components with moderate complexity

**Complexity:** Medium (multiple props, complex filtering, store integration)

**Categories:**

- **Dashboard Components** (8): Panels, controls, status displays
- **Map Components** (12): Overlays, filters, geospatial displays
- **Kismet Components** (5): Device lists, service controls

**Key Complex Component:**

- `src/lib/components/dashboard/panels/DevicesPanel.svelte` (415 lines)
    - Complex filtering and sorting
    - Multiple store subscriptions
    - Heavy reactive logic

**Workflow per component:** 3-4 hours

### Phase 3: Complex Hardware Integration (10-14 days)

**Goal:** Migrate 30 components with performance-critical rendering

**Complexity:** High (WebSocket state, canvas rendering, real-time updates)

**Categories:**

- **HackRF Spectrum** (15): Real-time spectrum analysis
- **Tactical Map** (11): GPS, hardware controllers
- **Specialized** (4): Drone, companion tools

**Performance-Critical Components:**

- `TimeWindowControl.svelte` - Heavy reactive logic with intervals
- `SpectrumChart.svelte` - 60 FPS canvas rendering
- `SignalAnalysisDisplay.svelte` - Large data arrays

**Performance Requirements:**

- 60 FPS spectrum rendering maintained
- No memory leaks
- Smooth animations
- Efficient array updates

**Workflow per component:** 4-6 hours (includes benchmarking)

### Phase 4: Route Pages & Forms (5-7 days)

**Goal:** Migrate 50 route pages and form components

**Complexity:** Mixed (simple layouts to complex tool integrations)

**Categories:**

- **Simple Pages** (10): Home, layouts, test pages
- **Complex Pages** (12): HackRF, Kismet, GSM Evil main views
- **WigleToTAK Components** (6): Settings, filters, configuration
- **Test/Debug Pages** (8): Development utilities

**Form State Pattern:**

```typescript
// Local mutable state for forms
let takServer = $state("");
let takPort = $state(8087);
let takEnabled = $state(false);

// Computed configuration
let settings = $derived({
	takServer,
	takPort,
	takEnabled,
});
```

**Workflow per page:** 1-3 hours

### Phase 5: Final Cleanup & Optimization (3-5 days)

**Goal:** Verification, optimization, documentation

**Tasks:**

1. Run full test suite
2. Performance optimization
3. Code quality checks
4. Migration report
5. Final verification

## Git Workflow

### Initial Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout -b feature/svelte5-migration
git tag pre-svelte5-migration
```

### Per-Component Workflow

```bash
# Before migration
git add [component]
git commit -m "checkpoint: [component] before Svelte 5 migration"
git tag pre-migrate-[component-name]

# After migration
npm run typecheck
npm run test
./scripts/verify-migration.sh [component]

git add [component] [test-file]
git commit -m "feat(svelte5): migrate [component] to runes"
git tag post-migrate-[component-name]
```

### Per-Phase Checkpoints

```bash
git tag phase-[N]-complete
```

### Rollback Strategy

```bash
# Rollback single component
git reset --hard pre-migrate-[component-name]

# Rollback entire phase
git reset --hard phase-[N-1]-complete

# Rollback everything
git reset --hard pre-svelte5-migration
```

## Success Criteria

### Quantitative

- ✅ All 116 components migrated to Svelte 5 runes
- ✅ Zero `export let` patterns remain
- ✅ Zero `$:` reactive statements remain (replaced with `$derived`)
- ✅ Zero manual store subscriptions with `onDestroy` cleanup
- ✅ All TypeScript compilation succeeds
- ✅ All tests pass
- ✅ Component tests added for all migrated components

### Qualitative

- ✅ All functionality preserved (no regressions)
- ✅ Performance benchmarks met or exceeded
- ✅ Code is more maintainable (consistent patterns)
- ✅ No console warnings in dev mode
- ✅ Team trained on Svelte 5 patterns

## Timeline

### Phase 0 (Days 1-5): Foundation

- Complete DashboardMap.svelte
- Create testing infrastructure
- Establish migration patterns
- **Checkpoint:** Phase 0 complete

### Phase 1 (Days 6-12): Simple Components

- 10 simple components @ 2-3 hours each = 20-30 hours
- **Checkpoint:** Phase 1 complete (11 components total)

### Phase 2 (Days 13-22): Medium Complexity

- 25 medium components @ 3-4 hours each = 75-100 hours
- **Checkpoint:** Phase 2 complete (36 components total)

### Phase 3 (Days 23-36): Complex Hardware

- 30 complex components @ 4-6 hours each = 120-180 hours
- **Checkpoint:** Phase 3 complete (66 components total)

### Phase 4 (Days 37-43): Route Pages

- 50 route pages @ 1-3 hours each = 50-150 hours
- **Checkpoint:** Phase 4 complete (116 components total)

### Phase 5 (Days 44-48): Cleanup

- Testing, optimization, documentation
- **Checkpoint:** Migration complete

**Total Duration:** 44-48 days (6.5-9.5 weeks)

## Risk Mitigation

### Risk: Breaking Critical Hardware Integration

**Mitigation:**

- Test with real hardware (HackRF connected)
- Separate branch for testing
- Rollback script ready
- Incremental testing after each component

### Risk: Performance Regression

**Mitigation:**

- Benchmark before and after
- Chrome DevTools profiling
- 60 FPS requirement for spectrum rendering
- Load testing with 1000+ devices

### Risk: Subtle Reactivity Bugs

**Mitigation:**

- Component tests verify reactive behavior
- Manual testing of all interactions
- Svelte DevTools to inspect dependencies
- Code review of complex `$derived` logic

### Risk: Store Subscription Pattern Changes

**Mitigation:**

- Document all patterns before migration
- Test store updates trigger re-renders
- Verify cleanup with mount/unmount cycles
- Check for subscription leaks

## Tools & Resources

### Migration Tools

**Verification Script:** `scripts/verify-migration.sh`

```bash
./scripts/verify-migration.sh src/lib/components/dashboard/DashboardMap.svelte
```

**Test Template:** `tests/unit/components/dashboard/DashboardMap.test.ts`

**Checklist:** `.claude/migration-checklist.md`

**Pattern Reference:** `docs/svelte5-migration-patterns.md`

### Testing Infrastructure

```bash
# Type check
npm run typecheck

# Unit tests
npm run test

# Component tests
npm run test -- src/lib/components

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

## Common Pitfalls

### Pitfall 1: Using `$effect` for Derived Values

```typescript
// ❌ WRONG
let doubled = $state(0);
$effect(() => {
	doubled = count * 2;
});

// ✅ CORRECT
let doubled = $derived(count * 2);
```

### Pitfall 2: Forgetting `return` in `$derived.by()`

```typescript
// ❌ WRONG
let result = $derived.by(() => {
	const x = compute();
	x; // Missing return!
});

// ✅ CORRECT
let result = $derived.by(() => {
	const x = compute();
	return x;
});
```

### Pitfall 3: Mutating Derived Values

```typescript
// ❌ WRONG
let list = $derived([...items]);
list.push(newItem); // Error!

// ✅ CORRECT
let extended = $derived([...list, newItem]);
```

### Pitfall 4: Not Cleaning Up Effects

```typescript
// ❌ WRONG
$effect(() => {
  const interval = setInterval(() => { ... }, 1000);
  // No cleanup!
});

// ✅ CORRECT
$effect(() => {
  const interval = setInterval(() => { ... }, 1000);
  return () => clearInterval(interval);
});
```

See `svelte5-patterns.md` for complete pitfall reference.

## Next Steps

1. **Read Pattern Reference**: `cat plans/svelte5-patterns.md`
2. **Start Phase 0**: `cat plans/svelte5-phase-0.md`
3. **Create Branch**: `git checkout -b feature/svelte5-migration`
4. **Begin Migration**: Start with DashboardMap.svelte

---

**Ready to begin?** Start with Phase 0:

```bash
cat plans/svelte5-phase-0.md
```

**Need pattern reference?** Read the guide:

```bash
cat plans/svelte5-patterns.md
```
