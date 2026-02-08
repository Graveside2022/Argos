# Phase 4.3.1: Fix High-Value Targets (Top Active Files)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT ERR00-C (consistent error handling), CERT STR50-CPP (guarantee null-terminated strings), BARR-C Rule 1.3 (braces shall always be used), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                          |
| ---------------- | ------------------------------------------------------------------------------ |
| **Phase**        | 4 -- Type Safety Hardening                                                     |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                                  |
| **Task ID**      | 4.3.1                                                                          |
| **Title**        | Fix High-Value Targets (Top Active Files)                                      |
| **Status**       | PLANNED                                                                        |
| **Risk Level**   | HIGH -- EventEmitter callback signatures must match; downstream consumers      |
| **Duration**     | 45 minutes                                                                     |
| **Dependencies** | None (independent of other 4.3.x tasks)                                        |
| **Blocks**       | Phase 4.3.5 (Remaining `as any` casts -- some overlap with high-value targets) |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                                         |
| **Commit**       | `fix(types): eliminate any from high-value RF/GSM data stream targets`         |
| **Standards**    | CERT ERR00-C, CERT STR50-CPP, BARR-C Rule 1.3, NASA/JPL Rule 14                |

---

## Objective

Fix the 3 highest-concentration active `any` files (excluding files cross-referenced to other tasks). Total: 23 `any` removed from 3 files.

**NOTE**: The original Task 4.3.2 covered 5 files (38 `any`), but:

- **4.3.2b** (`DirectoryCard.svelte`, 8 `any`) is covered in [Phase 4.3.3](Phase-4.3.3-Fix-Wigletotak-Pattern.md) (Wigletotak pattern)
- **4.3.2c** (`rtl-433/control/+server.ts`, 7 `any`) is covered in [Phase 4.3.6](Phase-4.3.6-Fix-RTL433-Global-Casts.md) (RTL-433 global casts)

This file covers: 4.3.2a (11 `any`), 4.3.2d (6 `any`), 4.3.2e (6 `any`) = **23 `any`**.

---

## Current State Assessment

| File                                                | `any` Count | Lines Affected                           |
| --------------------------------------------------- | :---------: | ---------------------------------------- |
| `src/routes/api/rf/data-stream/+server.ts`          |     11      | 17-19, 37, 48, 72, 81, 95, 100, 126, 135 |
| `src/routes/api/gsm-evil/tower-location/+server.ts` |      6      | 7, 119-123                               |
| `src/lib/stores/gsmEvilStore.ts`                    |      6      | 42, 44, 222, 233, 246, 253               |
| **Total**                                           |   **23**    |                                          |

---

## Execution Steps

### Section A: `src/routes/api/rf/data-stream/+server.ts` (11 `any`)

This SSE endpoint has 3 handler type signatures repeated for USRP and HackRF branches.

#### Step A1: Define Interfaces for Event Payloads

**BEFORE** (lines 17-19):

```typescript
let dataHandler: ((data: any) => void) | null = null;
let errorHandler: ((error: any) => void) | null = null;
let statusHandler: ((status: any) => void) | null = null;
```

**AFTER**:

```typescript
import type { SpectrumData } from '$lib/server/hackrf/types';

interface SweepDataEvent {
	frequency?: number;
	power?: number;
	powerValues?: number[];
	startFreq?: number;
	endFreq?: number;
	timestamp?: string;
}

interface SweepErrorEvent {
	message?: string;
	code?: string;
}

interface SweepStatusEvent {
	state?: string;
	message?: string;
	[key: string]: unknown;
}

let dataHandler: ((data: SweepDataEvent) => void) | null = null;
let errorHandler: ((error: SweepErrorEvent) => void) | null = null;
let statusHandler: ((status: SweepStatusEvent) => void) | null = null;
```

#### Step A2: Remove Unnecessary `as any` Cast

**BEFORE** (line 37):

```typescript
if ((usrpStatus as any).isRunning) {
```

**AFTER** -- `getStatus()` already returns `{ isRunning: boolean }`:

```typescript
if (usrpStatus.isRunning) {
```

The `UsrpSweepManager.getStatus()` method (line 284 of `src/lib/server/usrp/sweepManager.ts`) returns `SweepStatus & { isRunning: boolean }`. The cast is unnecessary.

#### Step A3: Fix Callback Parameters

Lines 48, 72, 81, 95, 100, 126, 135 -- all become typed via the interfaces above. The `_: any` at line 100 becomes `_: number`:

**BEFORE** (line 100):

```typescript
? data.powerValues.map((_: any, index: number) => {
```

**AFTER**:

```typescript
? data.powerValues.map((_: number, index: number) => {
```

#### Verification A:

```bash
grep -n ': any\|as any' src/routes/api/rf/data-stream/+server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'data-stream'
# Expected: 0 errors
```

---

### Section B: `src/routes/api/gsm-evil/tower-location/+server.ts` (6 `any`)

#### Step B1: Fix Index Signature

**BEFORE** (line 7):

```typescript
const sampleTowers: { [key: string]: any } = {
```

**AFTER**:

```typescript
interface SampleTower {
    lat: number;
    lon: number;
    range: number;
    city: string;
}
const sampleTowers: Record<string, SampleTower> = {
```

#### Step B2: Fix `result as any` Casts (5 occurrences)

The `result` comes from `stmt.get()` which returns `unknown` from better-sqlite3.

**BEFORE** (lines 119-123):

```typescript
lat: (result as any).lat,
lon: (result as any).lon,
range: (result as any).range || 1000,
samples: (result as any).samples || 1,
lastUpdated: (result as any).updated,
```

**AFTER** -- define the row shape and cast once:

```typescript
interface TowerRow {
    lat: number;
    lon: number;
    range: number | null;
    created: string;
    updated: string;
    samples: number | null;
}

// At line 44 where stmt.get is called:
result = stmt.get(mcc, mnc, lac, ci) as TowerRow | undefined;

// Then lines 119-123 become (no casts needed):
lat: result.lat,
lon: result.lon,
range: result.range || 1000,
samples: result.samples || 1,
lastUpdated: result.updated,
```

#### Verification B:

```bash
grep -n ': any\|as any' src/routes/api/gsm-evil/tower-location/+server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'tower-location'
# Expected: 0 errors
```

---

### Section C: `src/lib/stores/gsmEvilStore.ts` (6 `any`)

#### Step C1: Define Interfaces

**BEFORE** (lines 42, 44):

```typescript
capturedIMSIs: any[];
towerLocations: { [key: string]: any };
```

**AFTER**:

```typescript
interface CapturedIMSI {
    imsi: string;
    timestamp: string;
    frequency?: string;
    mcc?: string;
    mnc?: string;
    lac?: string;
    ci?: string;
    [key: string]: unknown;
}

interface TowerLocation {
    lat: number;
    lon: number;
    range: number;
    city?: string;
    source?: string;
    samples?: number;
    lastUpdated?: string;
}

// In GSMEvilState:
capturedIMSIs: CapturedIMSI[];
towerLocations: Record<string, TowerLocation>;
```

#### Step C2: Fix Function Parameters

**BEFORE** (line 222):

```typescript
setCapturedIMSIs: (imsis: any[]) =>
```

**AFTER**:

```typescript
setCapturedIMSIs: (imsis: CapturedIMSI[]) =>
```

**BEFORE** (line 233):

```typescript
addCapturedIMSI: (imsi: any) =>
```

**AFTER**:

```typescript
addCapturedIMSI: (imsi: CapturedIMSI) =>
```

#### Step C3: Fix Tower Management Parameters

**BEFORE** (line 246):

```typescript
setTowerLocations: (locations: { [key: string]: any }) =>
```

**AFTER**:

```typescript
setTowerLocations: (locations: Record<string, TowerLocation>) =>
```

**BEFORE** (line 253):

```typescript
updateTowerLocation: (key: string, location: any) =>
```

**AFTER**:

```typescript
updateTowerLocation: (key: string, location: TowerLocation) =>
```

#### Verification C:

```bash
grep -n ': any\|as any' src/lib/stores/gsmEvilStore.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'gsmEvilStore'
# Expected: 0 errors
```

---

## Final Verification

```bash
# All 3 files clean
grep -n ': any\|as any' \
  src/routes/api/rf/data-stream/+server.ts \
  src/routes/api/gsm-evil/tower-location/+server.ts \
  src/lib/stores/gsmEvilStore.ts
# Expected: 0 matches

# TypeScript compiles
npx tsc --noEmit 2>&1 | grep -E 'data-stream|tower-location|gsmEvilStore'
# Expected: 0 errors

# Downstream consumers still compile (gsmEvilStore consumers)
grep -rln 'setCapturedIMSIs\|addCapturedIMSI\|setTowerLocations\|updateTowerLocation' --include='*.ts' --include='*.svelte' src/
# Note: verify each call site still compiles after type narrowing
```

---

## Risk Assessment

| Risk                                      | Likelihood | Impact | Mitigation                                                         |
| ----------------------------------------- | ---------- | ------ | ------------------------------------------------------------------ |
| Changing `gsmEvilStore` IMSI types        | MEDIUM     | HIGH   | Grep all `.setCapturedIMSIs` / `.addCapturedIMSI` call sites       |
| Typing `data-stream` handlers             | MEDIUM     | HIGH   | Verify `sweepManager.on('spectrumData', ...)` accepts the new type |
| `tower-location` stmt.get() type mismatch | LOW        | MEDIUM | Single-point cast with `TowerRow` interface; field-level verify    |

---

## Rollback Strategy

Per-file rollback:

```bash
git checkout -- src/routes/api/rf/data-stream/+server.ts
git checkout -- src/routes/api/gsm-evil/tower-location/+server.ts
git checkout -- src/lib/stores/gsmEvilStore.ts
```

---

## Standards Traceability

| Standard         | Rule        | Applicability                                                      |
| ---------------- | ----------- | ------------------------------------------------------------------ |
| CERT ERR00-C     | Error types | SweepErrorEvent replaces untyped error callbacks                   |
| CERT STR50-CPP   | String ops  | CapturedIMSI ensures IMSI string field is explicitly typed         |
| BARR-C Rule 1.3  | Braces      | All new interfaces use proper brace structure                      |
| NASA/JPL Rule 14 | Return vals | `stmt.get()` return typed as `TowerRow \| undefined`, null-checked |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.2 (sections 4.3.2a, 4.3.2d, 4.3.2e)
- **4.3.2b** cross-referenced to: [Phase 4.3.3](Phase-4.3.3-Fix-Wigletotak-Pattern.md) (Wigletotak pattern)
- **4.3.2c** cross-referenced to: [Phase 4.3.6](Phase-4.3.6-Fix-RTL433-Global-Casts.md) (RTL-433 global casts)
- **Blocks**: [Phase 4.3.5](Phase-4.3.5-Fix-Remaining-As-Any-Casts.md) (some `as any` casts overlap)
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (ESLint escalation)
