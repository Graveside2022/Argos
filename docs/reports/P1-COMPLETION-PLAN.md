# P1 Completion Plan - Remaining 001-audit-remediation Work

**Created:** 2026-02-14
**Status:** 40-50% of P1 scope incomplete (see 001-audit-remediation-ACTUAL-WORK-ANALYSIS.md)
**Branch:** 002-type-safety-remediation (or create new branch for P1 completion)

---

## Executive Summary

**Original Goal:** Replace 581 type assertions with Zod validation (42% → 60% compliance)

**Current Reality:**

- ✅ **Completed:** ~20-30% (foundation + high-priority endpoints)
- ⏳ **Remaining:** ~40-50% (database, stores, error handling, API endpoints)
- 📊 **Current Compliance:** 83% (higher than expected, suggests parallel work contributed)
- 🎯 **Target:** Complete remaining P1 tasks to achieve true runtime validation coverage

---

## Completed Work (2026-02-13 to 2026-02-14)

### ✅ Phase 1: Setup (T001-T009)

- Zod, Shadcn dependencies installed
- Benchmark scripts created
- E2E test specs created

### ✅ Phase 2: Foundation (T010-T017)

- Audit baseline captured
- Performance benchmarks run
- Backup branch created

### ✅ Phase 3 - Step 1: Common Schemas (T018-T023)

- 6 Zod schemas created: signal.ts, wifi.ts, api.ts, hackrf.ts, kismet.ts, gps.ts
- Commit: `9e4af31`

### ✅ Phase 3 - Step 2: API Endpoints (Partial - T024-T026, T030)

- HackRF sweep/status endpoints
- Kismet devices endpoint
- GSM Evil control endpoint
- Commits: `073eae4`, `b5ca871`, `d941151`, `95a5124`

### ✅ Phase 3 - Step 3: WebSocket Handlers (Partial - T031-T032)

- HackRF and Kismet message validation
- Commit: `1083216`

### ✅ Phase 3 - Step 6: Error Handling (Partial - T041-T042)

- Created src/lib/utils/validation-error.ts
- Console logging with full diagnostics
- User-friendly error message formatting
- Context-aware handling (user-action vs background)
- Commit: **PENDING** (2026-02-14 work)

### ✅ Phase 3 - Step 7: Documentation (T045-T047, T047A)

- Type assertion justification documented
- Runtime validation testing
- Commits: `cf297a5`, `51f65cd`

### ✅ Final Verification (T048-T053)

- Test suite passing
- TypeScript compilation successful
- ESLint passing
- Benchmarks run
- Audit completed
- PR created
- Commits: `ee83a24`

### ✅ Additional Work (2026-02-14 - Not in Original Plan)

- Created src/lib/schemas/hardware.ts (DetectedHardware validation)
- Created src/lib/schemas/kismet.ts (Kismet API responses)
- Created tests/lib/schemas/hardware.test.ts (27 tests)
- Fixed 5 type assertions in hardware detection
- Fixed 4-5 `any` usages in GSM Evil
- Fixed vitest.config.ts coverage generation
- Commit: `ab26d90`

---

## Remaining Work - Detailed Task Breakdown

### Priority 1: Complete Error Handling Infrastructure

**Why First:** All subsequent validation work depends on this foundation

#### T043: UI Toast Notifications ⏱️ 1-2 hours

**Status:** BLOCKED - Requires Shadcn toast component

**Dependencies:**

- Shadcn toast component must be installed first
- Command: `npx shadcn-svelte@latest add toast`

**Implementation:**

1. Install Shadcn toast component
2. Create toast store in `src/lib/stores/toast-store.ts`
3. Add `<Toaster />` component to root layout (`src/routes/+layout.svelte`)
4. Create wrapper function `showToast(message: string, type: 'error' | 'success' | 'info')`
5. Update validation-error.ts to accept toast function parameter
6. Test with manual validation error trigger

**Files to Create/Modify:**

- `src/lib/components/ui/toast.svelte` (from Shadcn)
- `src/lib/components/ui/toaster.svelte` (from Shadcn)
- `src/lib/stores/toast-store.ts` (new)
- `src/routes/+layout.svelte` (add Toaster component)
- `src/lib/utils/validation-error.ts` (already has toast integration, just needs testing)

**Verification:**

```bash
# Trigger validation error in browser DevTools
fetch('/api/hackrf/start-sweep', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ frequency: 9999 }) // Exceeds 6000 MHz max
})
# Expected: Toast notification appears with "frequency: Must be <= 6000"
```

**Commit:**

```bash
git add src/lib/components/ui/toast* src/lib/stores/toast-store.ts src/routes/+layout.svelte
git commit -m "feat(ui): T043 — add Shadcn toast notifications for validation errors

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### T044: Verify Background Validation Logging ⏱️ 30 minutes

**Status:** Ready (validation-error.ts supports this, just needs testing)

**Implementation:**

1. Identify background validation points (WebSocket message handlers, periodic hardware checks)
2. Verify they use `context: 'background'` or `context: 'websocket'`
3. Test that background failures log to console but don't show toasts
4. Document test results

**Test Cases:**

```typescript
// In WebSocket message handler (src/lib/server/websocket-server.ts)
const result = HackRFMessageSchema.safeParse(message);
if (!result.success) {
	handleValidationError(result.error, 'websocket', message);
	// Should log to console, NO toast
}

// In periodic hardware check
const deviceResult = DetectedHardwareSchema.safeParse(rawDevice);
if (!deviceResult.success) {
	handleValidationError(deviceResult.error, 'background', rawDevice);
	// Should log to console, NO toast
}
```

**Verification:**

```bash
# Monitor Docker logs while triggering background validation errors
docker logs -f argos-dev | grep "Zod Validation Error"
# Expected: Console logs appear, no UI toasts visible in browser
```

**Documentation:**
Create `docs/reports/2026-02-14/background-validation-test.md` with test results

**Commit:**

```bash
git add docs/reports/2026-02-14/background-validation-test.md
git commit -m "test(validation): T044 — verify background validation logging

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Priority 2: Database Query Validation (T034-T036)

**Why Next:** High-volume data flow, critical for data integrity

**Current State:**

- 0 of 3 files have Zod validation
- Database types defined in `src/lib/server/db/types.ts`
- No Zod imports in any `src/lib/server/db/*.ts` files

---

#### T034: Signal Database Queries ⏱️ 2-3 hours

**File:** `src/lib/server/db/signal-repository.ts`

**Step 1: Create Zod Schemas**

Create `src/lib/schemas/database.ts`:

```typescript
import { z } from 'zod';

/**
 * Database signal schema for runtime validation
 * Validates data returned from SQLite queries
 */
export const DbSignalSchema = z.object({
	id: z.number().int().positive().optional(),
	signal_id: z.string().min(1, 'Signal ID required'),
	device_id: z.string().optional(),
	timestamp: z.number().int().positive('Timestamp must be positive Unix time'),
	latitude: z.number().min(-90).max(90, 'Latitude must be -90 to 90'),
	longitude: z.number().min(-180).max(180, 'Longitude must be -180 to 180'),
	altitude: z.number().optional(),
	power: z.number().min(-120).max(0, 'Power must be -120 to 0 dBm'),
	frequency: z.number().min(1).max(6000, 'Frequency must be 1-6000 MHz'),
	bandwidth: z.number().positive().nullable().optional(),
	modulation: z.string().nullable().optional(),
	source: z.string().min(1, 'Source required'),
	metadata: z.string().optional() // JSON string
});

export type DbSignal = z.infer<typeof DbSignalSchema>;

// Array schema for bulk operations
export const DbSignalArraySchema = z.array(DbSignalSchema);
```

**Step 2: Add Validation to Repository Functions**

Modify `src/lib/server/db/signal-repository.ts`:

```typescript
import { DbSignalSchema, DbSignalArraySchema } from '$lib/schemas/database';
import { safeParseWithHandling } from '$lib/utils/validation-error';

// In insertSignal function, validate before return:
export function insertSignal(
	db: Database.Database,
	statements: Map<string, Database.Statement>,
	signal: SignalMarker
): DbSignal {
	// ... existing insert logic ...

	// Validate returned data
	const validated = safeParseWithHandling(
		DbSignalSchema,
		dbSignal,
		'background' // Database operations are background tasks
	);

	if (!validated) {
		throw new Error('Database returned invalid signal data');
	}

	return validated;
}

// In querySpatial function, validate results:
export function querySpatial(db: Database.Database, query: SpatialQuery): DbSignal[] {
	// ... existing query logic ...
	const results = stmt.all(params);

	// Validate all results
	const validated = safeParseWithHandling(DbSignalArraySchema, results, 'background');

	if (!validated) {
		console.error('Database query returned invalid signals, returning empty array');
		return [];
	}

	return validated;
}
```

**Step 3: Update All Query Functions**

Functions to update in signal-repository.ts:

- `insertSignal` ✓
- `updateSignal`
- `querySpatial` ✓
- `queryRecent`
- `queryByDevice`
- `queryByFrequency`
- `deleteOldSignals`

**Verification:**

```bash
npm run typecheck
npm run test:integration
# Check database operations still work correctly
```

**Commit:**

```bash
git add src/lib/schemas/database.ts src/lib/server/db/signal-repository.ts
git commit -m "refactor(db): T034 — add Zod validation to signal database queries

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### T035: Network Database Queries ⏱️ 1-2 hours

**File:** `src/lib/server/db/network-repository.ts`

**Step 1: Add Schema to database.ts**

```typescript
export const DbNetworkSchema = z.object({
	id: z.number().int().positive().optional(),
	network_id: z.string().min(1, 'Network ID required'),
	name: z.string().optional(),
	type: z.string().min(1, 'Network type required'),
	encryption: z.string().optional(),
	channel: z.number().int().min(1).max(165).optional(), // WiFi channels
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive(),
	center_lat: z.number().min(-90).max(90).optional(),
	center_lon: z.number().min(-180).max(180).optional(),
	radius: z.number().positive().optional()
});

export type DbNetwork = z.infer<typeof DbNetworkSchema>;
export const DbNetworkArraySchema = z.array(DbNetworkSchema);
```

**Step 2: Add Validation**

Follow same pattern as T034:

- Import schemas and validation helpers
- Add validation to all query functions
- Handle validation failures gracefully

**Functions to update:**

- `insertNetwork`
- `updateNetwork`
- `queryByType`
- `queryRecent`
- `querySpatial`

**Commit:**

```bash
git add src/lib/schemas/database.ts src/lib/server/db/network-repository.ts
git commit -m "refactor(db): T035 — add Zod validation to network database queries

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### T036: Device Database Queries ⏱️ 1-2 hours

**File:** `src/lib/server/db/device-service.ts`

**Step 1: Add Schema to database.ts**

```typescript
export const DbDeviceSchema = z.object({
	id: z.number().int().positive().optional(),
	device_id: z.string().min(1, 'Device ID required'),
	type: z.string().min(1, 'Device type required'),
	manufacturer: z.string().optional(),
	first_seen: z.number().int().positive(),
	last_seen: z.number().int().positive(),
	avg_power: z.number().min(-120).max(0).optional(),
	freq_min: z.number().min(1).max(6000).optional(),
	freq_max: z.number().min(1).max(6000).optional(),
	metadata: z.string().optional() // JSON string
});

export type DbDevice = z.infer<typeof DbDeviceSchema>;
export const DbDeviceArraySchema = z.array(DbDeviceSchema);
```

**Step 2: Add Validation**

Follow same pattern as T034-T035

**Functions to update:**

- `ensureDeviceExists`
- `updateDeviceFromSignal`
- `queryDevices`

**Commit:**

```bash
git add src/lib/schemas/database.ts src/lib/server/db/device-service.ts
git commit -m "refactor(db): T036 — add Zod validation to device database queries

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Priority 3: Store Validation (T037-T040)

**Why Next:** Client-side data integrity, affects UI reactivity

**Current State:**

- 0 of 4 stores have Zod validation
- Stores use TypeScript types but no runtime validation

---

#### T037-T040: Store Validation ⏱️ 4-6 hours total

**Pattern for All Stores:**

1. Import existing Zod schemas (signal, wifi, gps, hackrf)
2. Add validation on store updates
3. Log validation failures (background context)
4. Prevent invalid data from entering store

**Files to Update:**

- `src/lib/stores/signals.ts` (T037)
- `src/lib/stores/networks.ts` (T038)
- `src/lib/stores/gps.ts` (T039)
- `src/lib/stores/hackrf.ts` (T040)

**Example Pattern (signals.ts):**

```typescript
import { writable } from 'svelte/store';
import { SignalReadingSchema } from '$lib/types/signal';
import { safeParseWithHandling } from '$lib/utils/validation-error';

function createSignalStore() {
	const { subscribe, set, update } = writable<SignalReading[]>([]);

	return {
		subscribe,
		addSignal: (signal: unknown) => {
			// Validate before adding to store
			const validated = safeParseWithHandling(
				SignalReadingSchema,
				signal,
				'background' // Store updates are background operations
			);

			if (!validated) {
				console.error('Rejected invalid signal from store update');
				return;
			}

			update((signals) => [...signals, validated]);
		},
		setSignals: (signals: unknown[]) => {
			const validated = signals
				.map((s) => safeParseWithHandling(SignalReadingSchema, s, 'background'))
				.filter((s): s is SignalReading => s !== undefined);

			set(validated);
		},
		clear: () => set([])
	};
}

export const signalStore = createSignalStore();
```

**Verification for Each Store:**

```bash
npm run test:unit
# Verify stores still work in browser
```

**Commits (one per store):**

```bash
git add src/lib/stores/signals.ts
git commit -m "refactor(stores): T037 — add Zod validation to signal store

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Priority 4: Remaining API Endpoints (T027, T029, T033)

**Why Last:** Lower volume than database/stores, easier to complete

---

#### T027: Kismet Networks Endpoint ⏱️ 1 hour

**File:** `src/routes/api/kismet/networks/+server.ts`

**Implementation:**

1. Check if WifiNetwork schema exists (created in T019)
2. Add Zod validation to GET response
3. Handle validation failures with 500 error

**Pattern:**

```typescript
import { WifiNetworkSchema } from '$lib/types/wifi';
import { safeParseWithHandling } from '$lib/utils/validation-error';

export async function GET({ request }) {
	const networks = await getKismetNetworks();

	// Validate response data
	const validated = networks
		.map((n) => safeParseWithHandling(WifiNetworkSchema, n, 'api'))
		.filter((n) => n !== undefined);

	return json({ networks: validated });
}
```

**Commit:**

```bash
git add src/routes/api/kismet/networks/+server.ts
git commit -m "refactor(api): T027 — add Zod validation to Kismet networks endpoint

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### T029: USRP Power Endpoint ⏱️ 1 hour

**File:** `src/routes/api/usrp/power/+server.ts`

**Step 1: Create USRP Power Schema**

Add to `src/lib/types/usrp.ts` (or create if doesn't exist):

```typescript
import { z } from 'zod';

export const USRPPowerConfigSchema = z.object({
	gain: z.number().min(0).max(76, 'USRP gain must be 0-76 dB'),
	txPower: z.number().min(-20).max(20, 'TX power must be -20 to 20 dBm'),
	rxGain: z.number().min(0).max(76, 'RX gain must be 0-76 dB').optional()
});

export type USRPPowerConfig = z.infer<typeof USRPPowerConfigSchema>;
```

**Step 2: Add Validation to Endpoint**

**Commit:**

```bash
git add src/lib/types/usrp.ts src/routes/api/usrp/power/+server.ts
git commit -m "refactor(api): T029 — add Zod validation to USRP power endpoint

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

#### T033: GPS WebSocket Validation ⏱️ 1 hour

**File:** `src/lib/server/websocket-server.ts`

**Implementation:**

1. Check if GpsPosition schema exists (created in T020)
2. Add validation to GPS WebSocket message handler
3. Follow pattern from T031-T032 (HackRF, Kismet)

**Pattern:**

```typescript
import { GpsPositionSchema } from '$lib/types/gps';

// In GPS message handler
case 'gps':
  const validated = safeParseWithHandling(
    GpsPositionSchema,
    message.data,
    'websocket'
  );
  if (!validated) {
    ws.send(JSON.stringify({ error: 'Invalid GPS data format' }));
    break;
  }
  // Process validated data
  break;
```

**Commit:**

```bash
git add src/lib/server/websocket-server.ts
git commit -m "refactor(websocket): T033 — add Zod validation to GPS WebSocket handler

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Execution Timeline

### Session 1: Foundation (2-3 hours)

- ✅ T041-T042: Validation error utility (COMPLETE)
- T043: Shadcn toast installation + integration
- T044: Background validation testing

### Session 2: Database (4-6 hours)

- T034: Signal database validation
- T035: Network database validation
- T036: Device database validation
- Integration testing

### Session 3: Stores & APIs (4-6 hours)

- T037-T040: Store validation (4 stores)
- T027, T029, T033: Remaining API endpoints (3 endpoints)

### Session 4: Final Verification (2-3 hours)

- Run full test suite
- Performance benchmarks
- Constitutional audit
- Update documentation
- Create PR for P1 completion

**Total Estimated Time:** 12-18 hours of focused work

---

## Success Criteria

### Functional Requirements Met:

- ✅ FR-001: All type assertions replaced with Zod validation
- ✅ FR-002: Runtime type validation catches errors before undefined behavior
- ✅ FR-003: Zod schemas cover ~50-100 common types
- ✅ FR-004: Validation failures provide descriptive error messages
- ✅ FR-005: Errors logged to console with full diagnostics
- ✅ FR-006: User-initiated validation failures show UI toast notifications
- ✅ FR-007: Background validation failures log without UI interruption
- ✅ FR-008: TypeScript strict mode compilation maintained

### Acceptance Criteria Met:

- Database queries return validated data
- Stores reject invalid data
- API endpoints validate requests/responses
- WebSocket messages validated
- Error handling infrastructure complete
- All tests passing
- Performance within budget (<5ms validation overhead)

### Compliance Metrics:

- Type assertion count: 743 → <100 (target: eliminate all unsafe assertions)
- Article II (Code Quality): 70% → 90%+ (target from original plan)
- Overall Compliance: 83% → 90%+
- HIGH violations: 3 → 0

---

## File Checklist

### New Files to Create:

- [ ] `src/lib/schemas/database.ts` (DbSignal, DbNetwork, DbDevice schemas)
- [ ] `src/lib/types/usrp.ts` (USRP power config schema)
- [ ] `src/lib/stores/toast-store.ts` (toast state management)
- [ ] `src/lib/components/ui/toast.svelte` (from Shadcn)
- [ ] `src/lib/components/ui/toaster.svelte` (from Shadcn)
- [ ] `docs/reports/2026-02-14/background-validation-test.md` (T044 results)

### Files to Modify:

- [x] `src/lib/utils/validation-error.ts` (COMPLETE - T041-T042)
- [ ] `src/routes/+layout.svelte` (add Toaster component)
- [ ] `src/lib/server/db/signal-repository.ts` (T034)
- [ ] `src/lib/server/db/network-repository.ts` (T035)
- [ ] `src/lib/server/db/device-service.ts` (T036)
- [ ] `src/lib/stores/signals.ts` (T037)
- [ ] `src/lib/stores/networks.ts` (T038)
- [ ] `src/lib/stores/gps.ts` (T039)
- [ ] `src/lib/stores/hackrf.ts` (T040)
- [ ] `src/routes/api/kismet/networks/+server.ts` (T027)
- [ ] `src/routes/api/usrp/power/+server.ts` (T029)
- [ ] `src/lib/server/websocket-server.ts` (T033 - GPS handler)

---

## Risk Mitigation

### High Risk Items:

1. **Shadcn Toast Installation** (T043)
    - Risk: May conflict with existing UI code
    - Mitigation: Test in isolation first, verify no conflicts with current layout

2. **Database Validation Breaking Changes** (T034-T036)
    - Risk: Existing queries may return data that doesn't match schemas
    - Mitigation: Start with `safeParse` logging only, fix schema mismatches, then enforce validation

3. **Store Validation Breaking UI** (T037-T040)
    - Risk: Invalid data currently in use may break UI reactivity
    - Mitigation: Test each store independently, graceful degradation for invalid data

### Rollback Strategy:

- Each task has individual commit
- Can revert specific validation additions without affecting others
- Keep backup branch (001-audit-remediation-backup already exists)

---

## Post-Completion Tasks

### Documentation Updates:

- [ ] Update specs/001-audit-remediation/tasks.md with actual completion status
- [ ] Update CLAUDE.md to reflect new validation patterns
- [ ] Create migration guide for future Zod schema additions
- [ ] Document validation error handling patterns

### Final Verification:

- [ ] Run constitutional audit: `npx tsx scripts/run-audit.ts`
- [ ] Verify compliance ≥ 90%
- [ ] Verify 0 CRITICAL violations
- [ ] Verify 0 HIGH violations for type safety
- [ ] Run full test suite: `npm run test`
- [ ] Performance benchmark: `npx tsx scripts/benchmark-zod-validation.ts`
- [ ] Production smoke test on Raspberry Pi 5

### Deployment:

- [ ] Create PR: "Complete P1: Type Safety Validation (Remaining 40-50%)"
- [ ] Request code review
- [ ] Merge to main
- [ ] Deploy to NTC/JMRC field units
- [ ] Monitor for 1-2 weeks per original T053A evaluation checkpoint

---

## Notes

**Why P1 Was Incomplete:**
Based on forensic analysis, the original 001-audit-remediation work focused on:

- High-priority API endpoints (untrusted external data)
- WebSocket handlers (real-time streams)
- Foundation (schemas, infrastructure)

But skipped:

- Database validation (assumed better-sqlite3 returns correct types)
- Store validation (assumed TypeScript types sufficient)
- Error handling UI (Shadcn components not installed)

**Current State:**

- Foundation is solid (schemas, benchmarks, documentation)
- Need to complete the "last mile" of validation coverage
- Estimated 12-18 hours to achieve true P1 completion

**Reference Documents:**

- Full analysis: `docs/reports/001-audit-remediation-ACTUAL-WORK-ANALYSIS.md`
- Original spec: `specs/001-audit-remediation/spec.md`
- Original tasks: `specs/001-audit-remediation/tasks.md`
- Latest audit: `docs/reports/audit-2026-02-14-17-57-56.json`
