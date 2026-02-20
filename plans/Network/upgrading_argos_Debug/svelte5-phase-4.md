# Svelte 5 Migration - Phase 4 (Route Pages & Forms)

**Duration:** 5-7 days (50-70 hours)
**Components:** 50+ route page components
**Complexity:** Mixed (simple layouts to complex tool integrations)
**Goal:** Migrate all page-level components

---

## Overview

Phase 4 migrates route pages and form components:

- **Simple pages** (layouts, home, test pages)
- **Complex tool pages** (HackRF, Kismet, GSM Evil)
- **Form-heavy pages** (WigleToTAK settings)
- **Test/debug pages** (development utilities)

**Key Pattern:** Pages typically have MORE local state, FEWER props than components.

---

## Git Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout feature/svelte5-migration
git tag phase-4-start
```

---

## Category A: Simple Route Pages (10 pages)

### Task A: Migrate Simple Pages

**Components:**

1. `/routes/+page.svelte` - Home page
2. `/routes/+layout.svelte` - Root layout
3. `/routes/tactical-map-simple/+page.svelte`
4. `/routes/pagermon/+page.svelte`
5. `/routes/wifite/+page.svelte`
6. `/routes/test-hackrf-stop/+page.svelte`
7. `/routes/test/+page.svelte`
8. `/routes/test-simple/+page.svelte`
9. `/routes/urh/+page.svelte`
10. `/routes/bettercap/+page.svelte`

**Common Pattern:**

```typescript
// BEFORE
<script lang="ts">
  import Component from '$lib/components/Component.svelte';
  import { someStore } from '$lib/stores/someStore';

  $: data = $someStore;
</script>

// AFTER
<script lang="ts">
  import Component from '$lib/components/Component.svelte';
  import { someStore } from '$lib/stores/someStore';

  let data = $derived($someStore);
</script>
```

**Workflow per page:**

1. Read page (50-100 lines typical)
2. Identify store subscriptions
3. Convert `$:` to `$derived`
4. Test navigation works
5. Commit

**Time:** 1 hour per page = 10 hours total

---

## Category B: Complex Tool Pages (12 pages)

### Component 1: hackrfsweep/+page.svelte

#### Task 1.1: Analyze Page

**File:** `/routes/hackrfsweep/+page.svelte`
**Lines:** ~13,000+ (includes embedded styles)
**Complexity:** HIGH

**Current Patterns:**

- Multiple local state variables
- HackRF service integration
- Form controls (frequency, gain, etc.)
- Sweep control logic

---

#### Task 1.2: Migrate Local State

**Subtask 1.2.1: Convert form state to $state**

**Before:**

```typescript
let centerFreq = 915000000;
let bandwidth = 20000000;
let gain = 20;
let sweepMode: "manual" | "auto" = "manual";
let isRunning = false;
```

**After:**

```typescript
let centerFreq = $state(915000000);
let bandwidth = $state(20000000);
let gain = $state(20);
let sweepMode = $state<"manual" | "auto">("manual");
let isRunning = $state(false);
```

---

#### Task 1.3: Convert Store Subscriptions

**Before:**

```typescript
import { hackrfStore } from "$lib/stores/hackrfStore";
$: status = $hackrfStore.status;
$: sweepData = $hackrfStore.sweepData;
```

**After:**

```typescript
import { hackrfStore } from "$lib/stores/hackrfStore";
let hackrfData = $derived($hackrfStore);
let status = $derived(hackrfData.status);
let sweepData = $derived(hackrfData.sweepData);
```

---

#### Task 1.4: Convert Form Computed Values

**Before:**

```typescript
$: frequencyMHz = centerFreq / 1000000;
$: isValidConfig = centerFreq > 0 && bandwidth > 0 && gain >= 0 && gain <= 47;
```

**After:**

```typescript
let frequencyMHz = $derived(centerFreq / 1000000);
let isValidConfig = $derived(
	centerFreq > 0 && bandwidth > 0 && gain >= 0 && gain <= 47,
);
```

---

#### Task 1.5: Verify Page

**Subtask 1.5.1: Manual testing**

```bash
npm run dev
# Navigate to /hackrfsweep
```

**Test checklist:**

- [ ] Page loads without errors
- [ ] Form controls work (sliders, inputs)
- [ ] Start/Stop buttons functional
- [ ] Sweep visualization displays
- [ ] Status updates correctly
- [ ] Configuration saves/loads
- [ ] Emergency stop works
- [ ] Navigation works (back to home)

---

#### Task 1.6: Commit Migration

```bash
git add src/routes/hackrfsweep/+page.svelte

git commit -m "feat(svelte5): migrate hackrfsweep page to runes

- Convert form state to \$state
- Convert HackRF store subscription to \$derived
- Convert computed values to \$derived
- All functionality preserved

Verified:
- Form controls work
- Sweep start/stop functional
- Status updates correctly
- Navigation works

Page 1/12 complex pages in Phase 4 complete"

git tag post-migrate-hackrfsweep-page
```

---

### Component 2: usrpsweep/+page.svelte

**Pattern:** Similar to hackrfsweep
**Time:** 2-3 hours

---

### Component 3: kismet/+page.svelte

**Pattern:** Kismet service integration, device display
**Time:** 2-3 hours

---

### Component 4: gsm-evil/+page.svelte

**Pattern:** GSM service integration, IMSI display
**Time:** 2-3 hours

---

### Remaining Complex Pages (8):

- gsm-evil/LocalIMSIDisplay.svelte (2 hours)
- gsm-evil/IMSIDisplay.svelte (2 hours)
- droneid/+page.svelte (2 hours)
- wigletotak/+page.svelte (3 hours)
- rtl-433/+page.svelte (2 hours)
- tempestsdr/+page.svelte (2 hours)
- btle/+page.svelte (2 hours)
- viewspectrum/+page.svelte (2 hours)

**Total:** 24-36 hours

---

## Category C: WigleToTAK Form Components (6 components)

### Component Pattern: TAKSettingsCard.svelte

#### Task: Migrate Form Card

**File:** `/routes/wigletotak/TAKSettingsCard.svelte`
**Pattern:** Form with validation

**Migration:**

```typescript
// Form state (all $state)
let takServer = $state("");
let takPort = $state(8087);
let takEnabled = $state(false);
let takUsername = $state("");
let takPassword = $state("");

// Validation (computed)
let isValidServer = $derived(
	takServer.trim().length > 0 && takPort > 0 && takPort < 65536,
);

let canConnect = $derived(isValidServer && takUsername.trim().length > 0);

// Settings object (computed)
let settings = $derived({
	server: takServer,
	port: takPort,
	enabled: takEnabled,
	username: takUsername,
	password: takPassword,
});

// Form handlers (unchanged)
function handleSubmit() {
	if (canConnect) {
		saveSettings(settings);
	}
}
```

---

### Remaining WigleToTAK Components (5):

- AntennaSettingsCard.svelte (2 hours)
- AnalysisModeCard.svelte (2 hours)
- BlacklistCard.svelte (2 hours)
- WhitelistCard.svelte (2 hours)
- DirectoryCard.svelte (2 hours)

**Total:** 12 hours

---

## Category D: Test/Debug Pages (8 pages)

**Components:**

- test-time-filter/+page.svelte
- test-db-client/+page.svelte
- test-map/+page.svelte
- redesign/+page.svelte
- kismet-dashboard/+page.svelte
- tactical-map-simple/integration-example.svelte

**Pattern:** Simple testing pages, minimal migration needed
**Time:** 1 hour each = 8 hours

---

## Phase 4 Form State Patterns

### Pattern 1: Simple Input

```typescript
// Input binding
let name = $state('');

// In template (UNCHANGED)
<input bind:value={name} />
```

### Pattern 2: Number Input with Validation

```typescript
let port = $state(8087);
let isValidPort = $derived(port > 0 && port < 65536);

<input type="number" bind:value={port} class:error={!isValidPort} />
```

### Pattern 3: Checkbox/Radio

```typescript
let enabled = $state(false);
let mode = $state<'auto' | 'manual'>('auto');

<input type="checkbox" bind:checked={enabled} />
<input type="radio" bind:group={mode} value="auto" />
```

### Pattern 4: Multi-Field Form Object

```typescript
// Individual fields
let server = $state("");
let port = $state(8087);
let username = $state("");

// Computed object
let config = $derived({
	server,
	port,
	username,
});

// Submit
function handleSubmit() {
	api.save(config);
}
```

### Pattern 5: Form with Validation Chain

```typescript
let email = $state("");
let password = $state("");
let confirmPassword = $state("");

let isValidEmail = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
let passwordsMatch = $derived(password === confirmPassword);
let canSubmit = $derived(
	isValidEmail && password.length >= 8 && passwordsMatch,
);
```

---

## Phase 4 Workflow Template

For each page:

### Step 1: Analyze (15 min)

1. Read page structure
2. Identify local state (forms, UI state)
3. Identify store subscriptions
4. Identify computed values

### Step 2: Checkpoint (2 min)

```bash
git tag pre-migrate-[page-name]
```

### Step 3: Migrate State (30 min)

1. Convert form fields to `$state()`
2. Convert UI state to `$state()`

### Step 4: Migrate Stores (15 min)

1. Convert subscriptions to `$derived()`

### Step 5: Migrate Computed (20 min)

1. Convert `$:` to `$derived()`
2. Add validation logic

### Step 6: Verify (30 min)

```bash
npm run typecheck
npm run dev
# Test all page functionality
```

### Step 7: Test Navigation (15 min)

- Test routing works
- Test page load/unload
- Test browser back/forward

### Step 8: Commit (5 min)

```bash
git commit -m "feat(svelte5): migrate [page] to runes"
```

**Total per simple page:** 1-1.5 hours
**Total per complex page:** 2-3 hours
**Total per form component:** 2 hours

---

## Phase 4 Completion Checklist

```bash
# Verify no Svelte 4 in pages
grep -r "export let" src/routes/ | grep -v "node_modules"
# Should return: 0 (routes rarely have props)

# Verify all routes load
npm run dev
# Navigate through all pages:
# - Home
# - HackRF Sweep
# - USRP Sweep
# - Kismet
# - GSM Evil
# - WigleToTAK
# - etc.

# Check navigation
# - All routes accessible
# - Browser back/forward works
# - No console errors

# Run tests
npm run test:e2e  # End-to-end navigation tests

# Git checkpoint
git tag phase-4-complete
```

---

## Phase 4 Summary

**Completed:**

- ✅ 50+ route pages migrated
- ✅ Form state management with $state working
- ✅ All navigation functional
- ✅ Complex tool pages operational
- ✅ Settings forms validated

**Total Time:** 50-70 hours (5-7 days)

**Breakdown:**

- Simple pages: 10 hours (10 pages)
- Complex pages: 24-36 hours (12 pages)
- Form components: 12 hours (6 components)
- Test pages: 8 hours (8 pages)

**Key Learnings:**

- Form state with $state is elegant
- Validation with $derived is clean
- Page-level state simpler than components
- Navigation unchanged (SvelteKit compatible)

**Ready for Phase 5?** See `svelte5-phase-5.md` for final cleanup.
