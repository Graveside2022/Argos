# Phase 4.3: `any` Type Elimination

**Phase**: 4.3 of 4.x (Type Safety Hardening)
**Priority**: HIGH -- `any` defeats TypeScript's entire value proposition
**Depends on**: Phase 4.1 (Dead Code Removal) must complete first
**Estimated effort**: 6-8 hours
**Risk level**: MEDIUM (behavioral changes possible if types reveal latent bugs)
**Last verified**: 2026-02-08

---

## 1. Current State Assessment

### Verified Metrics

| Metric                                       | Count     | Verification Command                                                                                                                                           |
| -------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total `any` occurrences (`: any` + `as any`) | 214       | `grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ \| wc -l`  |
| `any` in `.d.ts` files (leaflet.d.ts)        | 19        | `grep -c ': any\|as any' src/types/leaflet.d.ts`                                                                                                               |
| Unique files containing `any`                | 70        | `grep -rln ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ \| wc -l` |
| `as any` casts                               | 30        | `grep -rn 'as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/ \| wc -l`         |
| `eslint-disable` for `no-explicit-any`       | 8         | `grep -rn 'eslint-disable.*no-explicit-any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/`                   |
| `@ts-ignore` / `@ts-expect-error`            | 0 in src/ | `grep -rn '@ts-ignore\|@ts-expect-error' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/`                      |
| ESLint `no-explicit-any` setting             | `warn`    | `grep -n 'no-explicit-any' config/eslint.config.js` (line 74)                                                                                                  |
| `@types/leaflet` version installed           | 1.9.20    | `npm ls @types/leaflet`                                                                                                                                        |

### Automatic Removal via Phase 4.1 (Dead Code)

The following dead files contain `any` and will be deleted in Phase 4.1. Their `any` counts
are excluded from the active work in this plan:

| Dead File                                                    | `any` Count | Reason Dead                                  |
| ------------------------------------------------------------ | ----------- | -------------------------------------------- |
| `src/lib/server/mcp/registry-integration.ts`                 | 4           | Only in dead barrel, zero external importers |
| `src/lib/services/tactical-map/cellTowerService.ts`          | 3           | Zero imports anywhere                        |
| `src/lib/services/localization/coral/CoralAccelerator.v2.ts` | 2           | Backup file, never imported                  |
| `src/lib/services/websocket/example-usage.ts`                | 1           | Example code, never imported                 |
| **Total dead**                                               | **10**      |                                              |

**IMPORTANT -- Verification Audit Correction (2026-02-08)**: The original version of this
table listed 5 Kismet server files (device_intelligence.ts, security_analyzer.ts,
kismet_controller.ts, device_tracker.ts, fusion_controller.ts) as dead code containing
65 `any`. The Phase 4.1 false positive analysis (FINAL-VERIFICATION-AUDIT.md Section 2.2)
confirmed these 5 files are **ALIVE** -- they are imported through transitive chains
(`kismet_controller.ts` -> `fusion_controller.ts` -> API routes). Their 55 `any` occurrences
are addressed in Task 4.3.9 below.

### Active `any` After Dead Code Removal

214 total - 10 dead - 19 leaflet.d.ts = **185 `any` in active code** requiring manual fixes.

### Category Breakdown (Active Code Only)

| Category                        | Count | Description                                   |
| ------------------------------- | ----- | --------------------------------------------- |
| Function parameters (`: any`)   | ~58   | Callback params, handler args, device objects |
| Variable declarations (`: any`) | ~25   | Let/const with `any` type                     |
| `as any` casts                  | 30    | Type assertion bypasses                       |
| `any[]` array types             | 24    | Untyped arrays                                |
| Index signatures `{[key]: any}` | 3     | Dynamic object shapes                         |
| Return type annotations         | 3     | Functions returning `any`                     |
| Generic `<any>`                 | 0     | None in active code                           |

---

## 2. Execution Order (Dependency Graph)

```
Task 4.3.1: Delete leaflet.d.ts          [no dependencies, 19 any removed]
     |
Task 4.3.2: High-value targets           [no dependencies, 17 any removed]
     |
Task 4.3.3: MCP dynamic-server.ts        [no dependencies, 6 any removed]
     |
Task 4.3.4: Wigletotak pattern            [no dependencies, 29 any removed]
     |
Task 4.3.5: Store any types               [no dependencies, 3 any removed]
     |
Task 4.3.6: Remaining as any casts        [after 4.3.2, ~15 any removed]
     |
Task 4.3.7: RTL-433 global casts          [no dependencies, 7 any removed]
     |
Task 4.3.9: Kismet server cluster         [after Phase 4.2, 55 any removed] ** NEW **
     |
Task 4.3.8: eslint-disable cleanup        [after all above, 8 directives removed]
```

Tasks 4.3.1 through 4.3.5 are independent and can be parallelized.
Task 4.3.6 must follow 4.3.2 (some `as any` casts overlap with high-value targets).
Task 4.3.9 depends on Phase 4.2 (canonical KismetDevice type) and Phase 4.5 Task 4.5.1
(KismetDevice index signature). It addresses the 55 `any` in 5 Kismet server files
originally misclassified as dead code.
Task 4.3.8 must be last (directives protect code that earlier tasks fix).

---

## 3. Task 4.3.1: Delete Custom `leaflet.d.ts`

**File**: `src/types/leaflet.d.ts` (166 lines, 19 `any`)
**Action**: DELETE the file entirely
**Rationale**: `@types/leaflet@1.9.20` is already installed and provides complete, accurate
type definitions. The custom file is a subset copy with weaker types (19 `any` where the
official package has proper types).

### Pre-check

Verify `@types/leaflet` is installed and provides the same symbols:

```bash
npm ls @types/leaflet
# Expected: @types/leaflet@1.9.20

# Verify official types cover Map, tileLayer, marker, etc.
node -e "const t = require.resolve('@types/leaflet'); console.log(t)"
```

### Execution

```bash
rm src/types/leaflet.d.ts
```

### Post-check: Verify No Compile Errors

```bash
npx tsc --noEmit 2>&1 | head -30
```

If compile errors arise from imports referencing the deleted module, check whether
`src/lib/types/leaflet-extensions.d.ts` needs adjustment (this file extends Leaflet types,
not replaces them).

### Conflict resolution

If any file explicitly imports from `../../types/leaflet.d.ts` (unlikely -- `.d.ts` files
are typically ambient), update the import to reference `leaflet` directly:

```typescript
// BEFORE (if found)
import type { Map } from '../../types/leaflet';

// AFTER
import type { Map } from 'leaflet';
```

**Verification command**:

```bash
grep -rn "from.*types/leaflet" --include='*.ts' --include='*.svelte' src/
# Expected: 0 results (or only leaflet-extensions.d.ts)
```

**Result**: 19 `any` removed, 166 lines deleted.

---

## 4. Task 4.3.2: Fix High-Value Targets (Top 5 Active Files)

These 5 files contain the highest concentration of `any` in active code. Total: 38 `any`.

### 4.3.2a: `src/routes/api/rf/data-stream/+server.ts` (11 `any`)

This SSE endpoint has 3 handler type signatures repeated for USRP and HackRF branches.

**Current code** (lines 17-19):

```typescript
let dataHandler: ((data: any) => void) | null = null;
let errorHandler: ((error: any) => void) | null = null;
let statusHandler: ((status: any) => void) | null = null;
```

**Fix**: Define interfaces for the event payloads.

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

**Line 37** -- `(usrpStatus as any).isRunning`:

```typescript
// BEFORE (line 37)
if ((usrpStatus as any).isRunning) {

// AFTER -- getStatus() already returns { isRunning: boolean }
if (usrpStatus.isRunning) {
```

The `UsrpSweepManager.getStatus()` method (line 284 of `src/lib/server/usrp/sweepManager.ts`)
returns `SweepStatus & { isRunning: boolean }`. The cast is unnecessary.

**Lines 48, 72, 81, 95, 100, 126, 135** -- callback parameters:
All become typed via the interfaces above. The `_: any` at line 100 becomes `_: number`:

```typescript
// BEFORE (line 100)
? data.powerValues.map((_: any, index: number) => {

// AFTER
? data.powerValues.map((_: number, index: number) => {
```

**Verification**:

```bash
grep -n ': any\|as any' src/routes/api/rf/data-stream/+server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'data-stream'
# Expected: 0 errors
```

### 4.3.2b: `src/lib/components/wigletotak/directory/DirectoryCard.svelte` (8 `any`)

Covered in Task 4.3.4 (Wigletotak pattern). See that section.

### 4.3.2c: `src/routes/api/rtl-433/control/+server.ts` (7 `any`)

Covered in Task 4.3.7 (RTL-433 global casts). See that section.

### 4.3.2d: `src/routes/api/gsm-evil/tower-location/+server.ts` (6 `any`)

**Line 7** -- sample towers index signature:

```typescript
// BEFORE (line 7)
const sampleTowers: { [key: string]: any } = {

// AFTER
interface SampleTower {
    lat: number;
    lon: number;
    range: number;
    city: string;
}
const sampleTowers: Record<string, SampleTower> = {
```

**Lines 119-123** -- `result as any` casts (5 occurrences):
The `result` comes from `stmt.get()` which returns `unknown` from better-sqlite3.

```typescript
// BEFORE (lines 119-123)
lat: (result as any).lat,
lon: (result as any).lon,
range: (result as any).range || 1000,
samples: (result as any).samples || 1,
lastUpdated: (result as any).updated,

// AFTER -- define the row shape and cast once
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

**Verification**:

```bash
grep -n ': any\|as any' src/routes/api/gsm-evil/tower-location/+server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'tower-location'
# Expected: 0 errors
```

### 4.3.2e: `src/lib/stores/gsmEvilStore.ts` (6 `any`)

**Lines 42, 44** -- interface fields:

```typescript
// BEFORE (lines 42, 44)
capturedIMSIs: any[];
towerLocations: { [key: string]: any };

// AFTER
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

**Lines 222, 233** -- function parameters:

```typescript
// BEFORE (line 222)
setCapturedIMSIs: (imsis: any[]) =>

// AFTER
setCapturedIMSIs: (imsis: CapturedIMSI[]) =>

// BEFORE (line 233)
addCapturedIMSI: (imsi: any) =>

// AFTER
addCapturedIMSI: (imsi: CapturedIMSI) =>
```

**Lines 246, 253** -- tower management:

```typescript
// BEFORE (line 246)
setTowerLocations: (locations: { [key: string]: any }) =>

// AFTER
setTowerLocations: (locations: Record<string, TowerLocation>) =>

// BEFORE (line 253)
updateTowerLocation: (key: string, location: any) =>

// AFTER
updateTowerLocation: (key: string, location: TowerLocation) =>
```

**Verification**:

```bash
grep -n ': any\|as any' src/lib/stores/gsmEvilStore.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'gsmEvilStore'
# Expected: 0 errors
```

---

## 5. Task 4.3.3: Fix MCP `dynamic-server.ts` (6 `any`)

**File**: `src/lib/server/mcp/dynamic-server.ts`

All 6 occurrences are `(d: any)` in `.filter()` and `.map()` callbacks operating on
Kismet device arrays from `data.devices`.

**Lines 51, 58, 67, 105, 184, 197**:

```typescript
// BEFORE (repeated pattern, e.g. line 51)
devices = devices.filter((d: any) => {

// AFTER -- define the device shape once at top of file
interface KismetDeviceRaw {
    mac?: string;
    macaddr?: string;
    ssid?: string;
    name?: string;
    signalStrength?: number;
    signal?: { last_signal?: number };
    manufacturer?: string;
    manuf?: string;
    type?: string;
    deviceType?: string;
    encryption?: string;
    crypt?: string;
    channel?: number | null;
    frequency?: number | null;
    packets?: number;
    dataPackets?: number;
    lastSeen?: string;
    last_time?: string;
    firstSeen?: string;
    first_time?: string;
    location?: unknown;
}

// Then all callbacks become:
devices = devices.filter((d: KismetDeviceRaw) => {
```

This single interface definition replaces all 6 `any` occurrences. The interface uses
optional properties to match the shape accessed by the mapping code.

**Verification**:

```bash
grep -n ': any\|as any' src/lib/server/mcp/dynamic-server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'dynamic-server'
# Expected: 0 errors
```

**Result**: 6 `any` removed.

---

## 6. Task 4.3.4: Fix Wigletotak Pattern (5 Components, Same Fix)

Five components and one page share an identical anti-pattern: dynamically imported modules
typed as `any` because the imports happen at runtime inside `onMount`.

### Affected Files

| File                                                                | `any` Count | Lines            |
| ------------------------------------------------------------------- | ----------- | ---------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte`      | 8           | 6-10, 13, 25, 44 |
| `src/lib/components/wigletotak/settings/AnalysisModeCard.svelte`    | 6           | 6-10, 37         |
| `src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte` | 6           | 6-10, 39         |
| `src/lib/components/wigletotak/settings/TAKSettingsCard.svelte`     | 6           | 6-10, 41         |
| `src/routes/wigletotak/+page.svelte`                                | 3           | 6-7, 38          |
| **Total**                                                           | **29**      |                  |

### Root Cause

All files follow the same pattern:

```typescript
let wigleStore: any;
let _wigleActions: any;
let wigleService: any;
let logInfo: any;
let logError: any;
```

These are dynamically imported inside `onMount` to prevent SSR issues. The types exist in
the imported modules.

### Fix Pattern (Apply Identically to All 5 Components)

**Step 1**: Import types statically (types are erased at compile time, safe for SSR):

```typescript
import type { Writable } from 'svelte/store';
import type { WigleState } from '$lib/stores/wigletotak/wigleStore';
import type { logInfo as LogInfoFn, logError as LogErrorFn } from '$lib/utils/logger';
```

Note: The `wigleService` module needs its export types checked. If it exports an object,
use `typeof import(...)`.

**Step 2**: Type the variables using the imports:

```typescript
// BEFORE
let wigleStore: any;
let _wigleActions: any;
let wigleService: any;
let logInfo: any;
let logError: any;

// AFTER
let wigleStore: Writable<WigleState> | null = null;
let _wigleActions: typeof import('$lib/stores/wigletotak/wigleStore').wigleActions | null = null;
let wigleService: typeof import('$lib/services/wigletotak/wigleService').wigleService | null = null;
let logInfo: typeof LogInfoFn | null = null;
let logError: typeof LogErrorFn | null = null;
```

**Step 3**: Fix subscribe callback type:

```typescript
// BEFORE (e.g., DirectoryCard.svelte:44)
wigleStore.subscribe((state: any) => {

// AFTER
wigleStore.subscribe((state: WigleState) => {
```

**Step 4**: For `DirectoryCard.svelte` specifically, fix the additional `any` types:

```typescript
// BEFORE (line 13)
let directorySettings: any = $state({

// AFTER
let directorySettings: DirectorySettings = $state({

// BEFORE (line 25)
let wigleFiles: any[] = $state(directorySettings.wigleFiles);

// AFTER
let wigleFiles: string[] = $state(directorySettings.wigleFiles);
```

The `DirectorySettings` interface is already exported from
`src/lib/stores/wigletotak/wigleStore.ts` (line 19).

### Verification (Run for Each File)

```bash
# After fixing each component:
grep -n ': any\|as any' src/lib/components/wigletotak/directory/DirectoryCard.svelte
grep -n ': any\|as any' src/lib/components/wigletotak/settings/AnalysisModeCard.svelte
grep -n ': any\|as any' src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte
grep -n ': any\|as any' src/lib/components/wigletotak/settings/TAKSettingsCard.svelte
grep -n ': any\|as any' src/routes/wigletotak/+page.svelte
# Expected: 0 matches each

npx tsc --noEmit 2>&1 | grep -i 'wigle'
# Expected: 0 errors
```

**Result**: 29 `any` removed.

---

## 7. Task 4.3.5: Fix Store `any` Types

### 7a: `src/lib/stores/rtl433Store.ts` (line 25)

```typescript
// BEFORE (line 25)
[key: string]: any; // Allow for any additional signal data

// AFTER
[key: string]: string | number | boolean | null | undefined;
```

This is an index signature in the `CapturedSignal` interface. RTL-433 JSON signals have
dynamic keys but values are always primitives (string, number, boolean, null).

### 7b: `src/lib/stores/tactical-map/hackrfStore.ts` (line 101)

```typescript
// BEFORE (line 101)
export const addSignalMarker = (signalId: string, marker: any) => {

// AFTER
import type { Marker } from 'leaflet';
export const addSignalMarker = (signalId: string, marker: Marker) => {
```

If the marker can also be a CircleMarker or Layer:

```typescript
import type { Layer } from 'leaflet';
export const addSignalMarker = (signalId: string, marker: Layer) => {
```

### 7c: `src/lib/stores/tactical-map/kismetStore.ts` (line 90)

```typescript
// BEFORE (line 90)
export const addKismetDeviceMarker = (mac: string, marker: any) => {

// AFTER
import type { Layer } from 'leaflet';
export const addKismetDeviceMarker = (mac: string, marker: Layer) => {
```

### Verification

```bash
grep -n ': any\|as any' src/lib/stores/rtl433Store.ts src/lib/stores/tactical-map/hackrfStore.ts src/lib/stores/tactical-map/kismetStore.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep -E 'rtl433Store|hackrfStore|kismetStore'
# Expected: 0 errors
```

**Result**: 3 `any` removed (remaining store `any` are in gsmEvilStore, handled in 4.3.2e).

---

## 8. Task 4.3.6: Fix Remaining `as any` Casts

After Tasks 4.3.2-4.3.5, the following `as any` casts remain. Each requires individual
treatment because the cast hides a different type mismatch.

### 8a: `src/lib/server/kismet/kismetProxy.ts` (lines 287, 387)

```typescript
// BEFORE (line 287)
const signal = raw['kismet.device.base.signal'] as any;

// AFTER -- Kismet dot-notation JSON has nested objects
interface KismetSignalData {
	'kismet.common.signal.last_signal'?: number;
	'kismet.common.signal.last_noise'?: number;
	'kismet.common.signal.min_signal'?: number;
	'kismet.common.signal.max_signal'?: number;
	[key: string]: unknown;
}
const signal = raw['kismet.device.base.signal'] as KismetSignalData | undefined;

// BEFORE (line 387)
const location = raw['kismet.device.base.location'] as any;

// AFTER
interface KismetLocationData {
	'kismet.common.location.avg_lat'?: number;
	'kismet.common.location.avg_lon'?: number;
	'kismet.common.location.avg_alt'?: number;
	'kismet.common.location.fix'?: number;
	[key: string]: unknown;
}
const location = raw['kismet.device.base.location'] as KismetLocationData | undefined;
```

### 8b: `src/lib/services/hackrf/usrp-api.ts` (line 141)

```typescript
// BEFORE (line 141)
const rawData = JSON.parse(event.data as string) as any;

// AFTER -- the data is parsed into SpectrumData shape (used on lines 145-149)
import type { SpectrumData } from '$lib/server/hackrf/types';

interface RawSpectrumSSE {
	frequencies?: number[];
	power?: number[];
	power_levels?: number[];
	start_freq?: number;
	stop_freq?: number;
	center_freq?: number;
	peak_freq?: number;
	peak_power?: number;
	timestamp?: string;
	device?: string;
}
const rawData: RawSpectrumSSE = JSON.parse(event.data as string);
```

### 8c: `src/lib/services/websocket/base.ts` (line 71)

```typescript
// BEFORE (line 71)
this.ws = new (global.WebSocket as any)(this.config.url, this.config.protocols);

// AFTER -- the global WebSocket constructor type is correct, cast to specific constructor
this.ws = new (global.WebSocket as { new (url: string, protocols?: string | string[]): WebSocket })(
	this.config.url,
	this.config.protocols
);
```

Alternatively, if this is too verbose:

```typescript
// Simpler alternative
this.ws = new (global.WebSocket as typeof WebSocket)(this.config.url, this.config.protocols);
```

### 8d: `src/lib/services/map/mapUtils.ts` (line 29)

```typescript
// BEFORE (line 29)
const L = (window as any as LeafletWindow).L;

// AFTER -- LeafletWindow is already defined above line 29
const L = (window as unknown as LeafletWindow).L;
```

Using `unknown` as the intermediate cast is the correct TypeScript pattern for
double-casting. `any` is never needed as an intermediate.

### 8e: `src/lib/utils/cssLoader.ts` (line 47)

```typescript
// BEFORE (line 47)
(link as any).fetchPriority = options.priority;

// AFTER -- fetchPriority is a standard property, use HTMLLinkElement extension
(link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = options.priority;
```

### 8f: `src/routes/api/cell-towers/nearby/+server.ts` (line 73)

```typescript
// BEFORE (line 73)
towers: (rows as any[]).map((r) => ({

// AFTER -- define the row shape from the SQL query
interface CellTowerRow {
    radio: string;
    mcc: number;
    net: number;
    area: number;
    cell: number;
    lat: number;
    lon: number;
    range: number;
    samples: number;
    created: number;
    updated: number;
}
towers: (rows as CellTowerRow[]).map((r) => ({
```

### 8g: `src/routes/api/gsm-evil/scan/+server.ts` (line 54)

```typescript
// BEFORE (line 54)
} catch (testError: any) {

// AFTER
} catch (testError: unknown) {
```

Note: `catch (e: any)` should always be `catch (e: unknown)`. If properties are accessed,
use `(testError as Error).message`.

### 8h: `src/routes/api/gsm-evil/test-db/+server.ts` (line 12)

```typescript
// BEFORE (line 12)
const results: any = {};

// AFTER
const results: Record<string, unknown> = {};
```

### 8i: `src/routes/api/debug/spectrum-data/+server.ts` (line 14)

```typescript
// BEFORE (line 14)
const manager = sweepManager as any;

// AFTER -- access the needed properties via the public interface
// If debug routes are deleted in Phase 4.1 (dead code), skip this fix.
// Otherwise, use the SweepManager's public API or define the debug interface.
```

Note: The dead code audit flagged `src/routes/api/debug/` as test routes that should be
removed. If Phase 4.1 deletes these, this fix is unnecessary.

### 8j: `src/routes/api/debug/usrp-test/+server.ts` (lines 64, 74)

```typescript
// BEFORE (lines 64, 74)
const processManager = (sweepManager as any).processManager;
logs.push(`\nSSE Emitter set: ${!!(sweepManager as any).sseEmitter}`);
```

Same as 8i: if debug routes survive Phase 4.1, cast to a specific interface:

```typescript
interface SweepManagerInternals {
	processManager?: unknown;
	sseEmitter?: unknown;
}
const processManager = (sweepManager as unknown as SweepManagerInternals).processManager;
```

### 8k: `src/lib/components/bettercap/BettercapDashboard.svelte` (lines 17-18, 81)

```typescript
// BEFORE (lines 17-18)
wifiAPs: [] as any[],
bleDevices: [] as any[],

// AFTER -- define device shapes
interface BettercapAP {
    mac: string;
    hostname?: string;
    alias?: string;
    vendor?: string;
    frequency?: number;
    channel?: number;
    rssi?: number;
    encryption?: string;
    clients?: unknown[];
    [key: string]: unknown;
}

interface BettercapBLEDevice {
    mac: string;
    name?: string;
    vendor?: string;
    rssi?: number;
    [key: string]: unknown;
}

wifiAPs: [] as BettercapAP[],
bleDevices: [] as BettercapBLEDevice[],

// BEFORE (line 81)
onclick={() => (selectedMode = mode.value as any)}

// AFTER -- selectedMode and mode.value should share a type
// Check what selectedMode's type is and ensure mode.value matches.
// If mode.value is string but selectedMode expects a union:
onclick={() => (selectedMode = mode.value as typeof selectedMode)}
```

### 8l: `src/lib/components/wigletotak/filter/BlacklistCard.svelte` (line 44)

```typescript
// BEFORE (line 44)
logError('Failed to add to blacklist:', error as any);

// AFTER
logError('Failed to add to blacklist:', {
	error: error instanceof Error ? error.message : String(error)
});
```

### 8m: `src/lib/components/wigletotak/filter/WhitelistCard.svelte` (line 26)

```typescript
// BEFORE (line 26)
logError('Failed to add to whitelist:', error as any);

// AFTER
logError('Failed to add to whitelist:', {
	error: error instanceof Error ? error.message : String(error)
});
```

### 8n: `src/routes/btle/+page.svelte` (line 16)

```typescript
// BEFORE (line 16)
packets: [] as any[],

// AFTER
interface BTLEPacket {
    mac: string;
    name?: string;
    rssi?: number;
    type?: string;
    data?: string;
    timestamp?: string;
    [key: string]: unknown;
}
packets: [] as BTLEPacket[],
```

### 8o: `src/routes/pagermon/+page.svelte` (line 13)

```typescript
// BEFORE (line 13)
let state = { running: false, frequency: 152000000, messages: [] as any[], messageCount: 0 };

// AFTER
interface PagerMessage {
	id?: number;
	address?: string;
	message?: string;
	timestamp?: string;
	[key: string]: unknown;
}
let state = {
	running: false,
	frequency: 152000000,
	messages: [] as PagerMessage[],
	messageCount: 0
};
```

### Verification

```bash
grep -rn 'as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/
# Expected: 0 matches (after all tasks complete)
npx tsc --noEmit 2>&1 | head -20
# Expected: 0 errors
```

---

## 9. Task 4.3.7: Fix RTL-433 Global Casts

**File**: `src/routes/api/rtl-433/control/+server.ts`

### Problem

7 `any` occurrences, all related to storing data on the Node.js `global` object without
type declarations:

| Line | Code                                                                   |
| ---- | ---------------------------------------------------------------------- |
| 10   | `let rtl433Process: any = null;`                                       |
| 107  | `(global as any).rtl433Output = (global as any).rtl433Output \|\| [];` |
| 108  | `(global as any).rtl433Output.push({`                                  |
| 114  | `if ((global as any).rtl433Output.length > 100) {`                     |
| 115  | `(global as any).rtl433Output.shift();`                                |
| 127  | `(global as any).rtl433Output = (global as any).rtl433Output \|\| [];` |
| 128  | `(global as any).rtl433Output.push({`                                  |

### Fix

**Step 1**: Create a global type declaration. Add to `src/app.d.ts` (create if it does not
exist):

```typescript
// src/app.d.ts

// See https://kit.svelte.dev/docs/types#app
declare global {
	// RTL-433 global state
	var rtl433Output: Array<{ timestamp: string; data: string }> | undefined;
}

export {};
```

If `src/app.d.ts` already exists, append the `var rtl433Output` declaration inside the
existing `declare global` block.

**Step 2**: Type the process variable:

```typescript
// BEFORE (line 10)
let rtl433Process: any = null;

// AFTER
import type { ChildProcess } from 'child_process';
let rtl433Process: ChildProcess | null = null;
```

`ChildProcess` is the return type of `spawn()` from the `child_process` module, already
imported on line 3.

**Step 3**: Replace all `(global as any).rtl433Output` with `globalThis.rtl433Output`:

```typescript
// BEFORE (lines 107-108)
(global as any).rtl433Output = (global as any).rtl433Output || [];
(global as any).rtl433Output.push({

// AFTER
globalThis.rtl433Output = globalThis.rtl433Output || [];
globalThis.rtl433Output.push({

// BEFORE (lines 114-115)
if ((global as any).rtl433Output.length > 100) {
    (global as any).rtl433Output.shift();

// AFTER
if (globalThis.rtl433Output && globalThis.rtl433Output.length > 100) {
    globalThis.rtl433Output.shift();

// BEFORE (lines 127-128)
(global as any).rtl433Output = (global as any).rtl433Output || [];
(global as any).rtl433Output.push({

// AFTER
globalThis.rtl433Output = globalThis.rtl433Output || [];
globalThis.rtl433Output.push({
```

### Verification

```bash
grep -n ': any\|as any' src/routes/api/rtl-433/control/+server.ts
# Expected: 0 matches
npx tsc --noEmit 2>&1 | grep 'rtl-433'
# Expected: 0 errors
```

**Result**: 7 `any` removed.

---

## 10. Task 4.3.9: Fix Kismet Server Cluster `any` (55 occurrences, 5 files)

**Added by verification audit 2026-02-08 (BLOCKER-1 resolution)**

These 5 files were originally classified as dead code but are confirmed ALIVE via transitive
import chains (`kismet_controller.ts` -> `fusion_controller.ts` -> API routes). They contain
55 `any` occurrences in security-critical WiFi threat assessment code.

### File Inventory

| #   | File                                           | `any` Count | Primary Pattern                                                      |
| --- | ---------------------------------------------- | :---------: | -------------------------------------------------------------------- |
| 1   | `src/lib/server/kismet/security_analyzer.ts`   |     27      | Kismet API response objects typed as `any` in analysis functions     |
| 2   | `src/lib/server/kismet/device_intelligence.ts` |     22      | Device classification callbacks and parsed JSON from Kismet REST API |
| 3   | `src/lib/server/kismet/kismet_controller.ts`   |      3      | Controller method parameters accepting untyped device payloads       |
| 4   | `src/lib/server/kismet/device_tracker.ts`      |      2      | Device state update parameters                                       |
| 5   | `src/lib/server/kismet/fusion_controller.ts`   |      1      | Merged data pipeline output                                          |
|     | **TOTAL**                                      |   **55**    |                                                                      |

### 10.1 `security_analyzer.ts` (27 `any`)

**Root Cause**: The security analyzer processes raw Kismet device objects using `any` for
the entire device parameter in analysis functions. The Kismet REST API returns JSON with
dot-notation keys (`kismet.device.base.signal`, `dot11.device`, etc.).

**Fix Strategy**: Use the `KismetDevice` type from `src/lib/server/kismet/types.ts` (the
canonical type per Phase 4.2) for all device parameters. For Kismet dot-notation field
access, use the index signature `[key: string]: unknown` that Phase 4.5 Task 4.5.1 adds
to the KismetDevice interface.

```typescript
// BEFORE (repeated pattern across ~27 occurrences)
function analyzeEncryption(device: any): SecurityAssessment {

// AFTER
import type { KismetDevice } from './types';
function analyzeEncryption(device: KismetDevice): SecurityAssessment {
```

For callback parameters and array operations:

```typescript
// BEFORE
devices.filter((d: any) => d.encryption !== 'WPA3');

// AFTER
devices.filter((d: KismetDevice) => d.encryption !== 'WPA3');
```

For dot-notation field access that returns `unknown` from the index signature:

```typescript
// BEFORE
const signal = device['kismet.device.base.signal'] as any;

// AFTER
const signal = device['kismet.device.base.signal'] as KismetSignalData | undefined;
// KismetSignalData defined in Task 4.3.6 Section 8a
```

### 10.2 `device_intelligence.ts` (22 `any`)

**Root Cause**: Device classification functions accept raw Kismet device objects and parsed
JSON data with `any` typing. Classification results and callback parameters are untyped.

**Fix Strategy**: Same as 10.1 -- use `KismetDevice` for device parameters. For
classification result objects, define a local `ClassificationResult` interface:

```typescript
interface ClassificationResult {
	category: string;
	confidence: number;
	indicators: string[];
	threatLevel?: 'low' | 'medium' | 'high' | 'critical';
	details?: Record<string, unknown>;
}
```

For JSON-parsed data from Kismet REST responses:

```typescript
// BEFORE
const parsed: any = JSON.parse(responseText);

// AFTER
const parsed: Record<string, unknown> = JSON.parse(responseText);
// Or use Zod schema from Phase 4.4 Task 4.4.8 if available
```

### 10.3 `kismet_controller.ts` (3 `any`)

**Fix**: Replace `any` device parameters with `KismetDevice`:

```typescript
// BEFORE
async processDevice(device: any): Promise<void> {

// AFTER
async processDevice(device: KismetDevice): Promise<void> {
```

### 10.4 `device_tracker.ts` (2 `any`)

**Fix**: Replace `any` state update parameters:

```typescript
// BEFORE
updateDeviceState(mac: string, state: any): void {

// AFTER
interface DeviceState {
    lastSeen: string;
    signalStrength?: number;
    location?: { lat: number; lon: number };
    [key: string]: unknown;
}
updateDeviceState(mac: string, state: DeviceState): void {
```

### 10.5 `fusion_controller.ts` (1 `any`)

**Fix**: Type the merged data pipeline output:

```typescript
// BEFORE
const mergedData: any = { ...deviceData, ...signalData };

// AFTER
const mergedData: Record<string, unknown> = { ...deviceData, ...signalData };
```

### 10.6 Dependencies

Task 4.3.9 depends on:

- Phase 4.2 (KismetDevice canonical type must exist)
- Phase 4.5 Task 4.5.1 (KismetDevice index signature for dot-notation access)

Task 4.3.9 should execute AFTER Tasks 4.3.1-4.3.7 but BEFORE Task 4.3.8 (eslint-disable
cleanup cannot happen until all `any` is eliminated).

### 10.7 Verification

```bash
# Per-file verification
grep -n ': any\|as any' src/lib/server/kismet/security_analyzer.ts
grep -n ': any\|as any' src/lib/server/kismet/device_intelligence.ts
grep -n ': any\|as any' src/lib/server/kismet/kismet_controller.ts
grep -n ': any\|as any' src/lib/server/kismet/device_tracker.ts
grep -n ': any\|as any' src/lib/server/kismet/fusion_controller.ts
# Expected: 0 matches each

npx tsc --noEmit 2>&1 | grep -E 'security_analyzer|device_intelligence|kismet_controller|device_tracker|fusion_controller'
# Expected: 0 errors
```

**Result**: 55 `any` removed from security-critical Kismet server code.

---

## 11. Task 4.3.8: Remove `eslint-disable` Directives for `no-explicit-any`

After all `any` types are eliminated, the 8 `eslint-disable` directives are unnecessary.

### Directive Locations

| #   | File                                                | Line | Directive                                                     |
| --- | --------------------------------------------------- | ---- | ------------------------------------------------------------- |
| 1   | `src/routes/rtl-433/+page.svelte`                   | 11   | `eslint-disable-line @typescript-eslint/no-explicit-any`      |
| 2   | `src/routes/rtl-433/+page.svelte`                   | 302  | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 3   | `src/lib/services/tactical-map/cellTowerService.ts` | 5    | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 4   | `src/lib/services/tactical-map/cellTowerService.ts` | 24   | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 5   | `src/lib/services/tactical-map/cellTowerService.ts` | 26   | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 6   | `src/lib/services/tactical-map/cellTowerService.ts` | 28   | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 7   | `src/lib/services/hackrf/usrp-api.ts`               | 140  | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |
| 8   | `src/lib/services/websocket/base.ts`                | 70   | `eslint-disable-next-line @typescript-eslint/no-explicit-any` |

**IMPORTANT**: Directives 3-6 are in `src/lib/services/tactical-map/cellTowerService.ts`,
which is flagged as dead code in Phase 4.1. If that file is deleted, only 4 directives
remain to remove (1, 2, 7, 8).

### Execution

For each surviving file, delete the comment line containing the directive. Then fix the
`any` on the following line (or same line for `disable-line`).

**Example** -- `src/routes/rtl-433/+page.svelte` line 11:

```typescript
// BEFORE (line 11)
let capturedSignals: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

// AFTER (define CapturedSignal interface at top of script, or import from rtl433Store)
import type { CapturedSignal } from '$lib/stores/rtl433Store';
let capturedSignals: CapturedSignal[] = [];
```

**Example** -- `src/routes/rtl-433/+page.svelte` line 302-303:

```typescript
// BEFORE (lines 302-303)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatSignalData(signal: any) {

// AFTER
function formatSignalData(signal: CapturedSignal) {
```

### Final ESLint Config Change

After all `any` is eliminated, upgrade the lint rule from `warn` to `error`:

**File**: `config/eslint.config.js`, line 74:

```javascript
// BEFORE
'@typescript-eslint/no-explicit-any': 'warn',

// AFTER
'@typescript-eslint/no-explicit-any': 'error',
```

### Verification

```bash
grep -rn 'eslint-disable.*no-explicit-any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit src/
# Expected: 0 matches

grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/
# Expected: 0 matches

npm run lint 2>&1 | grep 'no-explicit-any'
# Expected: 0 warnings, 0 errors
```

---

## 11. Remaining Active `any` (Not Covered Above)

The following files have `any` occurrences not explicitly addressed in Tasks 4.3.2-4.3.7.
Apply the same patterns:

### Server Files

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

### Service Files

| File                                                      | Line(s) | Current                 | Replacement                                         |
| --------------------------------------------------------- | ------- | ----------------------- | --------------------------------------------------- |
| `src/lib/services/hackrfsweep/signalService.ts`           | 32      | `data: any`             | `data: SpectrumData` (import from hackrf/types)     |
| `src/lib/services/localization/coral/CoralAccelerator.ts` | 21      | `(result: any) => void` | `(result: unknown) => void`                         |
| `src/lib/services/localization/HybridRSSILocalizer.ts`    | 63      | `coralResult: any`      | `coralResult: Record<string, unknown>`              |
| `src/lib/services/tactical-map/hackrfService.ts`          | 28, 64  | `let currentState: any` | `let currentState: HackRFState` (import from store) |
| `src/lib/services/tactical-map/kismetService.ts`          | 136     | `let currentState: any` | `let currentState: KismetState` (import from store) |
| `src/lib/services/tactical-map/mapService.ts`             | 7, 12   | `L: any`                | `L: typeof import('leaflet') \| null`               |
| `src/lib/services/usrp/api.ts`                            | 7, 99   | `(data: any) => void`   | `(data: SpectrumData) => void`                      |

### Route/Page Files

| File                                                            | Line(s)             | Current                                   | Replacement                                                   |
| --------------------------------------------------------------- | ------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `src/routes/api/agent/tools/+server.ts`                         | 39, 157, 263, 282   | `(d: any)`                                | `(d: KismetDeviceRaw)` (same interface as Task 4.3.3)         |
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

### Test Files (Lower Priority)

| File                                               | Line(s) | Current             | Replacement                  |
| -------------------------------------------------- | ------- | ------------------- | ---------------------------- |
| `tests/integration/agent-tool-integration.test.ts` | 162     | `error: any`        | `error: unknown`             |
| `tests/integration/agent-tool-integration.test.ts` | 195     | `param: any`        | `param: unknown`             |
| `tests/unit/services/hackrf/hackrfService.test.ts` | 291     | `dataPoints: any[]` | `dataPoints: SpectrumData[]` |

**Verification for all remaining**:

```bash
grep -rn ': any\|as any' --include='*.ts' --include='*.svelte' --exclude-dir=node_modules --exclude-dir=.svelte-kit --exclude='*.d.ts' src/ tests/
# Expected: 0 matches
```

---

## 12. Risk Assessment

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

## 13. Verification Checklist

Run these commands after completing ALL tasks:

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

## 14. Rollback Strategy

### Per-Task Rollback

Each task modifies an independent set of files. If a task introduces compile errors that
cannot be resolved within 30 minutes:

1. Revert that task's files: `git checkout -- <files>`
2. Re-add `any` with a `// TODO(phase-4.3): eliminate any` comment
3. Continue with remaining tasks
4. File a follow-up issue for the skipped task

### Full Rollback

If the entire phase must be reverted:

```bash
git stash
# or
git reset --soft HEAD~1  # if already committed
```

### Canary Verification

After each task, run:

```bash
npx tsc --noEmit 2>&1 | wc -l
```

If the error count increases from the baseline, stop and investigate before proceeding.
Record the baseline error count before starting:

```bash
npx tsc --noEmit 2>&1 | wc -l > /tmp/tsc-baseline.txt
```

---

## Appendix: Summary Scorecard

| Task                            | `any` Removed                     | Files Changed | Status            |
| ------------------------------- | --------------------------------- | ------------- | ----------------- |
| 4.3.1 Delete leaflet.d.ts       | 19                                | 1 deleted     | PENDING           |
| 4.3.2 High-value targets        | 17                                | 3             | PENDING           |
| 4.3.3 MCP dynamic-server        | 6                                 | 1             | PENDING           |
| 4.3.4 Wigletotak pattern        | 29                                | 5             | PENDING           |
| 4.3.5 Store any types           | 3                                 | 3             | PENDING           |
| 4.3.6 Remaining as any casts    | ~15                               | ~10           | PENDING           |
| 4.3.7 RTL-433 global casts      | 7                                 | 1 + app.d.ts  | PENDING           |
| **4.3.9 Kismet server cluster** | **55**                            | **5**         | **PENDING (NEW)** |
| 4.3.8 eslint-disable cleanup    | 0 (directives)                    | 4 + config    | PENDING           |
| Section 11 remaining            | ~34                               | ~25           | PENDING           |
| Phase 4.1 auto-removal          | 10                                | deleted       | PENDING           |
| **TOTAL**                       | **~195 manual + 19 leaflet.d.ts** |               |                   |

**Accounting**: 214 total = 19 (leaflet.d.ts, Task 4.3.1) + 10 (dead code auto-removal,
Phase 4.1) + 185 (active code, Tasks 4.3.2-4.3.9 + Section 11). Every `any` has an
assigned work item. No double-counting.
