# Phase 5.2.5: API Route Unification

| Field         | Value                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Document ID   | ARGOS-AUDIT-P5.2.5-2026-02-08                                                  |
| Phase         | 5.2 -- Service Layer Refactoring                                               |
| Title         | API Route Unification -- HackRF/USRP Endpoint Consolidation                    |
| Risk Level    | MEDIUM                                                                         |
| Prerequisites | Phase-5.2.1 (BaseSdrApi exists), Phase-5.2.4 (sweepManager decomposition done) |
| Files Touched | ~20 (10 new route files, ~10 frontend callers updated)                         |
| Standards     | CERT ERR50-CPP, NASA/JPL Rule 31, OWASP API Security Top 10                    |
| Audit Date    | 2026-02-08                                                                     |

---

## 1. Objective

Replace two parallel API route trees (`api/hackrf/` and `api/rf/`) with a single unified
`api/sdr/[device]/` route tree that accepts a device route parameter. This eliminates
device-switching logic scattered across 6+ endpoints and ensures all SDR operations flow
through the unified `BaseSdrApi` subclasses created in Task 5.2.1.

> **REGRADE CORRECTION (2026-02-08)**: This task was added based on the Phase 5 Final Audit
> Report finding that the service layer deduplication (Tasks 5.2.1-5.2.4) leaves the API
> route duplication layer unaddressed.

---

## 2. Current State

Two parallel API route trees serve overlapping functionality:

| Route Tree    | Files    | Endpoints    | Lines | Purpose                                                                             |
| ------------- | -------- | ------------ | ----- | ----------------------------------------------------------------------------------- |
| `api/hackrf/` | 16 files | 15 endpoints | ~918  | HackRF-only operations                                                              |
| `api/rf/`     | 6 files  | 6 endpoints  | ~623  | Device-agnostic operations (imports BOTH sweepManagers, switches on `device` param) |

### 2.1 Overlap Analysis

| Endpoint          | `api/hackrf/`               | `api/rf/`                   | Shared Logic                                     |
| ----------------- | --------------------------- | --------------------------- | ------------------------------------------------ |
| Start sweep       | `start-sweep/+server.ts`    | `start-sweep/+server.ts`    | ~90% -- identical config parsing, validation     |
| Stop sweep        | `stop-sweep/+server.ts`     | `stop-sweep/+server.ts`     | ~95% -- identical stop flow                      |
| Data stream (SSE) | `data-stream/+server.ts`    | `data-stream/+server.ts`    | ~80% -- SSE setup identical, data format differs |
| Status            | `status/+server.ts`         | `status/+server.ts`         | ~85% -- identical shape, device-specific fields  |
| Emergency stop    | `emergency-stop/+server.ts` | `emergency-stop/+server.ts` | ~95% -- identical flow                           |

**Problem:** After Task 5.2.1 creates `BaseSdrApi`, the route handlers will still contain
device-switching logic (`if (device === 'hackrf') { ... } else if (device === 'usrp') { ... }`)
in the `api/rf/` routes, and the `api/hackrf/` routes will bypass the unified API entirely.

---

## 3. Unified Route Structure

Replace both route trees with a single `api/sdr/` tree that accepts a `device` route
parameter:

```
api/sdr/[device]/start-sweep/+server.ts     POST   Start sweep for device
api/sdr/[device]/stop-sweep/+server.ts      POST   Stop sweep for device
api/sdr/[device]/data-stream/+server.ts     GET    SSE data stream for device
api/sdr/[device]/status/+server.ts          GET    Device status
api/sdr/[device]/emergency-stop/+server.ts  POST   Emergency stop for device
api/sdr/[device]/health/+server.ts          GET    Health check
api/sdr/[device]/cycle-status/+server.ts    GET    Frequency cycle status
api/sdr/[device]/test-device/+server.ts     POST   Device connectivity test
api/sdr/[device]/reset-state/+server.ts     POST   Reset device state
api/sdr/[device]/cleanup/+server.ts         POST   Force cleanup
```

---

## 4. Device Parameter Validation

Device parameter validation at the route level, ensuring fail-closed behavior:

```typescript
// src/routes/api/sdr/[device]/deviceValidator.ts (or layout.server.ts)
const VALID_DEVICES = ['hackrf', 'usrp'] as const;
type SdrDevice = (typeof VALID_DEVICES)[number];

export function validateDevice(params: { device: string }): SdrDevice {
	if (!VALID_DEVICES.includes(params.device as SdrDevice)) {
		throw error(400, `Invalid device: ${params.device}. Valid: ${VALID_DEVICES.join(', ')}`);
	}
	return params.device as SdrDevice;
}
```

---

## 5. Device Registry

```typescript
// src/lib/services/sdr-common/registry.ts
import type { BaseSdrApi } from './BaseSdrApi';
import { HackRFApi } from '../hackrf/api';
import { UsrpApi } from '../usrp/usrp-api';

const registry = new Map<string, BaseSdrApi>([
	['hackrf', new HackRFApi()],
	['usrp', new UsrpApi()]
]);

export function getSdrApi(device: string): BaseSdrApi {
	const api = registry.get(device);
	if (!api) throw new Error(`No SDR API registered for device: ${device}`);
	return api;
}
```

---

## 6. Route Handler Pattern

Each unified route handler delegates to the `BaseSdrApi` subclass resolved by device type:

```typescript
// src/routes/api/sdr/[device]/start-sweep/+server.ts
import { json, error } from '@sveltejs/kit';
import { validateDevice } from '../deviceValidator';
import { getSdrApi } from '$lib/services/sdr-common/registry';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const device = validateDevice(params);
	const api = getSdrApi(device); // Returns HackRFApi or UsrpApi instance
	const config = await request.json();

	// Input validation (shared across devices)
	if (!config.freqStartHz || !config.freqEndHz) {
		throw error(400, 'Missing required fields: freqStartHz, freqEndHz');
	}

	const result = await api.startSweep(config);
	return json(result);
};
```

---

## 7. Migration Strategy

### Step 1: Create Unified Routes

Create the `api/sdr/[device]/` route tree with unified handlers that delegate to
`BaseSdrApi` subclasses via the device registry.

### Step 2: Add Backward-Compatible Redirects

Add redirect stubs in `api/hackrf/` and `api/rf/` that forward to `api/sdr/hackrf/` and
`api/sdr/{device}/` respectively. This preserves backward compatibility during migration.

### Step 3: Update Frontend Callers

Update all frontend callers (`hackrfService.ts`, `usrp-api.ts`, store fetch calls) to use
`api/sdr/{device}/` endpoints.

### Step 4: Delete Old Routes

After verifying zero traffic to old routes (via server logs), delete `api/hackrf/` and
`api/rf/` route trees.

---

## 8. Implementation Steps

| Step | Action                                          | Verification                                                                                       |
| ---- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1    | Create `src/routes/api/sdr/[device]/` directory | `ls src/routes/api/sdr/\[device\]/`                                                                |
| 2    | Create `deviceValidator.ts` with validation     | `npx tsc --noEmit` on the file                                                                     |
| 3    | Create `registry.ts` in sdr-common              | `npx tsc --noEmit src/lib/services/sdr-common/registry.ts`                                         |
| 4    | Create unified route handlers (10 endpoints)    | `ls src/routes/api/sdr/\[device\]/**/+server.ts \| wc -l` returns 10                               |
| 5    | Add backward-compatible redirects in api/hackrf | `grep -rn "redirect\|forward" src/routes/api/hackrf/ --include="*.ts"`                             |
| 6    | Add backward-compatible redirects in api/rf     | `grep -rn "redirect\|forward" src/routes/api/rf/ --include="*.ts"`                                 |
| 7    | Update frontend callers to use api/sdr/         | `grep -rn "api/hackrf/" src/lib/ --include="*.ts" --include="*.svelte"` returns 0 (only redirects) |
| 8    | Run full type check                             | `npm run typecheck` exits 0                                                                        |
| 9    | Run lint                                        | `npm run lint` exits 0                                                                             |
| 10   | (DEFERRED) Delete old routes after traffic dies | `rm -rf src/routes/api/hackrf/ src/routes/api/rf/` -- only after log verification                  |

---

## 9. Verification Commands

```bash
# 1. Unified routes exist
ls src/routes/api/sdr/\[device\]/

# 2. No route exceeds 300 lines
wc -l src/routes/api/sdr/\[device\]/**/+server.ts

# 3. Device parameter validated in all handlers
grep -rn "validateDevice" src/routes/api/sdr/ --include="*.ts" | wc -l
# Expected: matches number of route handlers

# 4. Old routes have redirects (temporary)
grep -rn "redirect\|forward" src/routes/api/hackrf/ src/routes/api/rf/ --include="*.ts"

# 5. Registry returns correct device instances
grep -rn "getSdrApi" src/routes/api/sdr/ --include="*.ts" | wc -l
# Expected: matches number of route handlers that need API access

# 6. TypeScript compilation
npm run typecheck

# 7. Lint
npm run lint
```

---

## 10. Line Count Targets

| Component                              | Before | After                 |
| -------------------------------------- | ------ | --------------------- |
| `api/hackrf/` route files              | ~918   | 0 (deleted, deferred) |
| `api/rf/` route files                  | ~623   | 0 (deleted, deferred) |
| `api/sdr/[device]/` unified routes     | 0      | ~500                  |
| `sdr-common/registry.ts`               | 0      | ~15                   |
| `deviceValidator.ts`                   | 0      | ~15                   |
| **Net reduction (after old deletion)** |        | **~1,011 lines**      |

---

## 11. Effort Estimate

| Step                                         | Effort        |
| -------------------------------------------- | ------------- |
| Create unified route handlers (10 endpoints) | 3 hours       |
| Create device registry + validator           | 1 hour        |
| Add backward-compatible redirects            | 1 hour        |
| Update frontend callers                      | 2 hours       |
| Delete old routes (after verification)       | 0.5 hours     |
| **Total**                                    | **7.5 hours** |

---

## 12. Test Specifications

| Module                | Test File                                     | Test Type   | Minimum Tests |
| --------------------- | --------------------------------------------- | ----------- | ------------- |
| API Route Unification | `tests/integration/routes/sdr-routes.test.ts` | Integration | 5             |

**Required test cases:**

1. Device parameter validation: invalid device returns 400
2. Start-sweep via unified route delegates to correct device API
3. Backward-compatible redirect: `api/hackrf/status` redirects to `api/sdr/hackrf/status`
4. Invalid device returns 400 response with descriptive message
5. SSE stream initiation via unified route returns correct content-type

---

## 13. Risk Assessment

| Risk                                              | Severity | Mitigation                                                                 |
| ------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| Frontend callers miss update (still hit old URLs) | MEDIUM   | Backward-compatible redirects in old routes handle transition              |
| Device parameter injection                        | LOW      | Allowlist validation via VALID_DEVICES constant; not interpolated in shell |
| SSE stream behavior changes across devices        | MEDIUM   | SSE setup is identical; only data parsing differs (handled by subclass)    |
| Old route deletion premature                      | LOW      | Deletion is deferred step; only done after log verification                |

---

## 14. Standards Compliance

| Standard           | Requirement               | How This Task Complies                                     |
| ------------------ | ------------------------- | ---------------------------------------------------------- |
| CERT ERR50-CPP     | Structured error handling | validateDevice throws typed error with descriptive message |
| NASA/JPL Rule 31   | Single responsibility     | Each route handler: validate, delegate, respond            |
| OWASP API Security | Input validation          | Device parameter allowlist-validated at route boundary     |

---

## 15. Rollback Strategy

This task produces one atomic Git commit. Rollback:

```bash
git revert <commit-hash>
```

The revert removes the `api/sdr/[device]/` directory, `registry.ts`, and
`deviceValidator.ts`. The backward-compatible redirects in `api/hackrf/` and `api/rf/`
are also reverted, restoring the original direct handlers. No database or schema changes
are involved.

**Important**: If frontend callers have already been updated to use `api/sdr/` URLs,
the revert must also revert those frontend changes. This is why the commit must be atomic
(include both route changes and frontend caller updates).

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |
