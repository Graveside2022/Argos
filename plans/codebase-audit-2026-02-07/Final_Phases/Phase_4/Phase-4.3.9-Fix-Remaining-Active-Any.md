# Phase 4.3.9: Fix Remaining Active `any`

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL30-C (declare variable with correct type), CERT EXP39-C (do not access via incompatible pointer), CERT ERR00-C (consistent error handling), BARR-C Rule 1.3 (braces), NASA/JPL Rule 14 (check return values), MISRA C 2012 Rule 11.3 (cast between pointer types)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Phase**        | 4 -- Type Safety Hardening                                                              |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                                           |
| **Task ID**      | 4.3.9                                                                                   |
| **Title**        | Fix Remaining Active `any` (Not Covered by Tasks 4.3.0-4.3.7)                           |
| **Status**       | PLANNED                                                                                 |
| **Risk Level**   | MEDIUM -- Broad scope across many files; same patterns as earlier tasks                 |
| **Duration**     | 90 minutes                                                                              |
| **Dependencies** | Tasks 4.3.0-4.3.7 (apply same patterns established in earlier tasks)                    |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation -- must finish before 4.3.8)           |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                                                  |
| **Commit**       | `fix(types): eliminate remaining any across server, service, route, and test files`     |
| **Standards**    | CERT DCL30-C, CERT EXP39-C, CERT ERR00-C, BARR-C Rule 1.3, NASA/JPL Rule 14, MISRA 11.3 |

---

## Objective

Fix all remaining `any` occurrences not explicitly addressed in Tasks 4.3.0-4.3.7. These files have `any` types that follow the same patterns established in earlier tasks. Apply the same replacement strategies.

**Result**: ~34 `any` removed across ~25 files.

---

## Current State Assessment

### Category Breakdown (Total 214)

| Category                          |   Count | Status                   |
| --------------------------------- | ------: | ------------------------ |
| `leaflet.d.ts`                    |      19 | Task 4.3.0 (delete file) |
| Dead code (Phase 4.1 auto-remove) |      10 | Phase 4.1                |
| Active code (Tasks 4.3.1-4.3.7)   |     151 | Tasks 4.3.1-4.3.7        |
| **Remaining active (this task)**  |  **34** | **This task (4.3.9)**    |
| **TOTAL**                         | **214** |                          |

---

## Execution Steps

### Server Files (~13 entries)

| File                                                           | Line(s) | Current             | Replacement                             |
| -------------------------------------------------------------- | ------- | ------------------- | --------------------------------------- |
| `src/lib/server/agent/tools.ts`                                | 200     | `input_schema: any` | `input_schema: Record<string, unknown>` |
| `src/lib/server/agent/tools.ts`                                | 217     | `input_schema: any` | `input_schema: Record<string, unknown>` |
| `src/lib/server/agent/tools.ts`                                | 261     | `context?: any`     | `context?: Record<string, unknown>`     |
| `src/lib/server/agent/tool-execution/adapters/http-adapter.ts` | 59      | `let data: any`     | `let data: unknown`                     |
| `src/lib/server/agent/tool-execution/adapters/mcp-adapter.ts`  | 152     | `let data: any`     | `let data: unknown`                     |
| `src/lib/server/agent/tool-execution/detection/detector.ts`    | 150     | `category: any`     | `category: Record<string, unknown>`     |
| `src/lib/server/gnuradio/spectrum_analyzer.ts`                 | 75      | `performance?: any` | `performance?: Record<string, unknown>` |
| `src/lib/server/usrp/sweepManager.ts`                          | 11      | `details?: any`     | `details?: Record<string, unknown>`     |
| `src/lib/server/usrp/sweepManager.ts`                          | 395     | `data?: any`        | `data?: unknown`                        |
| `src/lib/server/websockets.ts`                                 | 93      | `data: any`         | `data: unknown`                         |
| `src/lib/server/websockets.ts`                                 | 113     | `data: any`         | `data: unknown`                         |
| `src/lib/server/websockets.ts`                                 | 125     | `message: any`      | `message: Record<string, unknown>`      |
| `src/lib/server/wireshark.ts`                                  | 357     | `data: any`         | `data: Record<string, unknown>`         |

#### Execution for Server Files

For each entry in the table above:

1. Open the file at the specified line
2. Replace `: any` with the replacement type from the table
3. If `Record<string, unknown>` causes downstream property access errors, narrow with appropriate interface
4. If `unknown` causes downstream access errors, add type narrowing (e.g., `if (typeof data === 'object' && data !== null)`)
5. Run `npx tsc --noEmit` to verify

**Example** -- `src/lib/server/agent/tools.ts` line 200:

```typescript
// BEFORE
input_schema: any;

// AFTER
input_schema: Record<string, unknown>;
```

**Example** -- `src/lib/server/websockets.ts` line 93:

```typescript
// BEFORE
data: any;

// AFTER
data: unknown;
```

---

### Service Files (~7 entries)

| File                                                      | Line(s) | Current                 | Replacement                                         |
| --------------------------------------------------------- | ------- | ----------------------- | --------------------------------------------------- |
| `src/lib/services/hackrfsweep/signalService.ts`           | 32      | `data: any`             | `data: SpectrumData` (import from hackrf/types)     |
| `src/lib/services/localization/coral/CoralAccelerator.ts` | 21      | `(result: any) => void` | `(result: unknown) => void`                         |
| `src/lib/services/localization/HybridRSSILocalizer.ts`    | 63      | `coralResult: any`      | `coralResult: Record<string, unknown>`              |
| `src/lib/services/tactical-map/hackrfService.ts`          | 28, 64  | `let currentState: any` | `let currentState: HackRFState` (import from store) |
| `src/lib/services/tactical-map/kismetService.ts`          | 136     | `let currentState: any` | `let currentState: KismetState` (import from store) |
| `src/lib/services/tactical-map/mapService.ts`             | 7, 12   | `L: any`                | `L: typeof import('leaflet') \| null`               |
| `src/lib/services/usrp/api.ts`                            | 7, 99   | `(data: any) => void`   | `(data: SpectrumData) => void`                      |

#### Execution for Service Files

**Example** -- `src/lib/services/hackrfsweep/signalService.ts` line 32:

```typescript
// BEFORE
data: any;

// AFTER
import type { SpectrumData } from '$lib/server/hackrf/types';
data: SpectrumData;
```

**Example** -- `src/lib/services/tactical-map/mapService.ts` lines 7, 12:

```typescript
// BEFORE
let L: any;

// AFTER
let L: typeof import('leaflet') | null = null;
```

**Example** -- `src/lib/services/tactical-map/hackrfService.ts` lines 28, 64:

```typescript
// BEFORE
let currentState: any;

// AFTER
import type { HackRFState } from '$lib/stores/tactical-map/hackrfStore';
let currentState: HackRFState;
```

---

### Route/Page Files (~17 entries)

| File                                                            | Line(s)             | Current                                   | Replacement                                                   |
| --------------------------------------------------------------- | ------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `src/routes/api/agent/tools/+server.ts`                         | 39, 157, 263, 282   | `(d: any)`                                | `(d: KismetDeviceRaw)` (same interface as Task 4.3.2)         |
| `src/routes/api/agent/tools/+server.ts`                         | 356                 | `queryParams: any[]`                      | `queryParams: unknown[]`                                      |
| `src/routes/api/rf/status/+server.ts`                           | 96                  | `let status: any`                         | `let status: Record<string, unknown>`                         |
| `src/routes/api/wifite/targets/+server.ts`                      | 8, 13, 18, 26, 35   | `(d: any)` / `(a: any, b: any)`           | Define `WifiteTarget` interface                               |
| `src/routes/droneid/+page.svelte`                               | 132, 183            | `data: any`                               | Define `RemoteIDData` interface                               |
| `src/routes/gsm-evil/+page.svelte`                              | 35, 893, 1178, 1193 | Various `any`                             | Use `ScanResult` from gsmEvilStore, `Record<string, unknown>` |
| `src/routes/tactical-map-simple/+page.svelte`                   | 614, 666            | `storeState: any`, `tower: any`           | Import store types                                            |
| `src/routes/tactical-map-simple/integration-example.svelte`     | 18, 21              | `map: any`, `marker: any`                 | `Map \| null`, `Marker \| null` from leaflet                  |
| `src/routes/tactical-map-simple/rssi-integration.ts`            | 13                  | `heatmapLayer: any`                       | `Layer \| null` from leaflet                                  |
| `src/routes/wifite/+page.svelte`                                | 20, 50, 51, 172     | Various `any`                             | Define `WifiteState` and `WifiteTarget` interfaces            |
| `src/lib/components/hackrfsweep/signal/SignalAnalyzer.svelte`   | 28                  | `data: any`                               | `data: SpectrumData`                                          |
| `src/lib/components/map/AirSignalOverlay.svelte`                | 207                 | `data: any`                               | `data: SpectrumData`                                          |
| `src/lib/components/tactical-map/hackrf/SignalProcessor.svelte` | 26                  | `L: any`                                  | `typeof import('leaflet') \| null`                            |
| `src/lib/components/tactical-map/kismet/DeviceManager.svelte`   | 17                  | `L: any`                                  | `typeof import('leaflet') \| null`                            |
| `src/lib/components/tactical-map/map/MapContainer.svelte`       | 8                   | `map: any`                                | `map: import('leaflet').Map`                                  |
| `src/lib/components/tactical-map/system/SystemInfoPopup.svelte` | 37                  | `userMarker?: any`                        | `userMarker?: import('leaflet').Marker`                       |
| `src/lib/components/dashboard/frontendToolExecutor.ts`          | 33, 352             | `customMarkers: any[]`, `parameters: any` | `Marker[]`, `Record<string, unknown>`                         |

#### Execution for Route/Page Files

**Example** -- `src/routes/api/agent/tools/+server.ts` lines 39, 157, 263, 282:

```typescript
// BEFORE
devices.filter((d: any) => ...

// AFTER -- reuse KismetDeviceRaw from Task 4.3.2
devices.filter((d: KismetDeviceRaw) => ...
```

**Example** -- `src/routes/api/wifite/targets/+server.ts`:

```typescript
// Define interface at top of file
interface WifiteTarget {
    bssid: string;
    ssid?: string;
    channel?: number;
    encryption?: string;
    power?: number;
    clients?: number;
    [key: string]: unknown;
}

// BEFORE (lines 8, 13, 18, 26, 35)
(d: any) => ...
(a: any, b: any) => ...

// AFTER
(d: WifiteTarget) => ...
(a: WifiteTarget, b: WifiteTarget) => ...
```

**Example** -- `src/routes/droneid/+page.svelte` lines 132, 183:

```typescript
// Define interface
interface RemoteIDData {
	id?: string;
	latitude?: number;
	longitude?: number;
	altitude?: number;
	speed?: number;
	heading?: number;
	timestamp?: string;
	operator?: string;
	[key: string]: unknown;
}
```

**Example** -- Leaflet components (MapContainer, SystemInfoPopup, etc.):

```typescript
// BEFORE
let L: any;
let map: any;

// AFTER
let L: typeof import('leaflet') | null = null;
let map: import('leaflet').Map | null = null;
```

---

### Test Files (Lower Priority, ~3 entries)

| File                                               | Line(s) | Current             | Replacement                  |
| -------------------------------------------------- | ------- | ------------------- | ---------------------------- |
| `tests/integration/agent-tool-integration.test.ts` | 162     | `error: any`        | `error: unknown`             |
| `tests/integration/agent-tool-integration.test.ts` | 195     | `param: any`        | `param: unknown`             |
| `tests/unit/services/hackrf/hackrfService.test.ts` | 291     | `dataPoints: any[]` | `dataPoints: SpectrumData[]` |

#### Execution for Test Files

```typescript
// BEFORE (line 162)
error: any

// AFTER
error: unknown

// BEFORE (line 291)
dataPoints: any[]

// AFTER
import type { SpectrumData } from '$lib/server/hackrf/types';
dataPoints: SpectrumData[]
```

---

## Verification Checklist (7 Steps)

### Step 1: Zero `any` Remaining

```bash
# Must return 0
grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' \
  --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' \
  src/ tests/ | grep -v '// .*any' | wc -l
```

### Step 2: Zero `eslint-disable` for `no-explicit-any`

```bash
# Must return 0
grep -rn 'eslint-disable.*no-explicit-any' --include='*.ts' --include='*.svelte' \
  --exclude-dir=node_modules --exclude-dir=.svelte-kit src/ | wc -l
```

### Step 3: TypeScript Compiles Clean

```bash
npx tsc --noEmit 2>&1 | tail -5
# Expected: no errors
```

### Step 4: ESLint Passes

```bash
npm run lint 2>&1 | tail -10
# Expected: 0 errors, 0 warnings for no-explicit-any
```

### Step 5: Tests Pass

```bash
npm run test:unit 2>&1 | tail -10
# Expected: all tests pass
```

### Step 6: Leaflet.d.ts Deleted

```bash
ls src/types/leaflet.d.ts 2>&1
# Expected: No such file or directory
```

### Step 7: ESLint Config Updated

```bash
grep 'no-explicit-any' config/eslint.config.js
# Expected: 'error' (not 'warn')
```

---

## Risk Assessment

### HIGH RISK Changes

| Change                             | Risk                                            | Mitigation                                                         |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| Deleting `leaflet.d.ts`            | Type conflicts with `@types/leaflet`            | Run `npx tsc --noEmit` immediately; rollback if errors             |
| Changing `gsmEvilStore` IMSI types | Downstream consumers may pass incompatible data | Grep all `.setCapturedIMSIs` / `.addCapturedIMSI` call sites       |
| Typing `data-stream` handlers      | EventEmitter callback signatures must match     | Verify `sweepManager.on('spectrumData', ...)` accepts the new type |

### MEDIUM RISK Changes

| Change                           | Risk                                              | Mitigation                                                  |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Wigletotak `null` initial values | Runtime `null` access if `onMount` not yet called | Guard calls with `if (wigleStore)` checks (already present) |
| RTL-433 `globalThis` declaration | Other files may also set `rtl433Output`           | Grep for all `rtl433Output` references                      |
| `catch (e: unknown)` changes     | Must update property access to use type narrowing | Always use `(e as Error).message` or `instanceof`           |

### LOW RISK Changes

| Change                                 | Risk                                 | Mitigation                             |
| -------------------------------------- | ------------------------------------ | -------------------------------------- |
| `Record<string, unknown>` replacements | May need property access adjustments | Type checker will flag at compile time |
| Leaflet `Layer`/`Marker` types         | Already provided by `@types/leaflet` | Standard type, well-tested             |
| ESLint rule upgrade to `error`         | Will block CI if any `any` remains   | Do this LAST after all fixes verified  |

---

## Rollback Strategy

### Per-Task Rollback

Each task modifies an independent set of files. If a task introduces compile errors that cannot be resolved within 30 minutes:

1. Revert that task's files: `git checkout -- <files>`
2. Re-add `any` with a `// TODO(phase-4.3): eliminate any` comment
3. Continue with remaining tasks
4. File a follow-up issue for the skipped task

### Full Rollback

```bash
git stash
# or
git reset --soft HEAD~1  # if already committed
```

### Canary Verification

After each file group, run:

```bash
npx tsc --noEmit 2>&1 | wc -l
```

If the error count increases from the baseline, stop and investigate before proceeding. Record the baseline error count before starting:

```bash
npx tsc --noEmit 2>&1 | wc -l > /tmp/tsc-baseline.txt
```

---

## Standards Traceability

| Standard          | Rule         | Applicability                                                     |
| ----------------- | ------------ | ----------------------------------------------------------------- |
| CERT DCL30-C      | Correct type | All `any` replaced with specific types or `unknown`               |
| CERT EXP39-C      | Ptr compat   | `as unknown as T` replaces `as any` for double casts              |
| CERT ERR00-C      | Error types  | `catch (e: unknown)` with `instanceof` for error narrowing        |
| BARR-C Rule 1.3   | Braces       | All new interfaces use proper brace structure                     |
| NASA/JPL Rule 14  | Return vals  | JSON.parse and fetch results typed, preventing unvalidated access |
| MISRA C 2012 11.3 | Cast rules   | Every cast goes through `unknown` or to a specific interface      |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Section 11 (Remaining Active `any`)
- **Depends on**: All prior tasks 4.3.0-4.3.7 (establishes patterns and interfaces to reuse)
- **Reuses interfaces from**:
    - Task 4.3.2: `KismetDeviceRaw` (for `api/agent/tools/+server.ts`)
    - Task 4.3.1: `SpectrumData` import (for signalService, usrp/api, SignalAnalyzer, AirSignalOverlay)
    - Task 4.3.0: `@types/leaflet` (for all Leaflet type imports)
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (must complete before ESLint escalation)
- **Includes risk assessment from**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) Sections 12-14
