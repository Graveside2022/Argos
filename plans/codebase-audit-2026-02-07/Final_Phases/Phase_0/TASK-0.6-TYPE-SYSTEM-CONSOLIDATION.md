# Task 0.6: Type System Consolidation and Boundary Violation Fix

**Execution Order**: Step 4 (after Tasks 0.2, 0.3, 0.4)
**Prerequisites**: Tasks 0.2, 0.3, 0.4 COMPLETE. All files at final locations with kebab-case names.
**Blocks**: Task 0.5 (barrel exports depend on type files existing)
**Risk Level**: MEDIUM -- Type extraction touches many files but no logic changes.
**Commit Message**: `refactor: consolidate type system, fix 30 type-only boundary violations`

---

## Rationale

Type definitions are scattered across 13+ locations. 30 type-only imports cross architectural boundaries because types live in the wrong layer. Extracting types to `$lib/types/` eliminates all 30 type-only boundary violations in a single pass.

---

## Boundary Violation Inventory (52 total, verified 2026-02-08)

| Category                   | CRITICAL (Value)             | MEDIUM (Type-only) | Phase 0.2 Scope                                 |
| -------------------------- | ---------------------------- | ------------------ | ----------------------------------------------- |
| Server -> Stores           | 0                            | 3                  | FIX (extract types)                             |
| Stores -> Server           | 0                            | 3                  | FIX (extract types)                             |
| Services -> Stores (value) | **28** (verified 2026-02-08) | 0                  | DOCUMENT ONLY (Phase 5)                         |
| Services -> Stores (type)  | 0                            | 14                 | FIX (extract types)                             |
| Services -> Routes         | 1                            | 0                  | FIX (Task 0.2 -- DONE)                          |
| Stores -> Services         | 1                            | 0                  | FIX (lazy import)                               |
| Server -> Services         | 3                            | 2                  | DOCUMENT ONLY (Phase 5)                         |
| API Routes -> Stores       | 0                            | 3                  | FIX (extract types)                             |
| Svelte Pages -> Server     | 0                            | 2                  | FIX (extract types)                             |
| **TOTAL**                  | **33**                       | **27**             | **FIX: 27 type + 2 value. DOCUMENT: 34 value.** |

---

## Subtask 0.6.1: Extract SignalMarker to $lib/types/signals.ts

**Impact**: Fixes 17 type-only violations in one operation.

`SignalMarker` is imported by:

- 3 server/db files (from `$lib/stores/map/signals`)
- 10 services/map files (from `$lib/stores/map/signals`)
- 2 services/db files (from `$lib/stores/map/signals`)
- 3 API routes (from `$lib/stores/map/signals`)

**Fix** (execute in order):

1. Copy the `SignalMarker` interface definition from `src/lib/stores/map/signals.ts` to `src/lib/types/signals.ts` (create file if it does not exist; if it exists, append the interface)
2. Update ALL 18 files to import from `$lib/types/signals` instead of `$lib/stores/map/signals`
3. In `src/lib/stores/map/signals.ts`, replace the local interface definition with a re-export from `$lib/types/signals` to maintain backward compatibility

**Files to update** (post-rename kebab-case names):

```
src/lib/server/db/geo.ts
src/lib/server/db/signal-repository.ts
src/lib/server/db/database.ts
src/lib/services/map/signal-filtering.ts
src/lib/services/map/network-analyzer.ts
src/lib/services/map/drone-detection.ts
src/lib/services/map/heatmap-service.ts
src/lib/services/map/map-utils.ts
src/lib/services/map/contour-generator.ts
src/lib/services/map/signal-clustering.ts
src/lib/services/map/ai-pattern-detector.ts
src/lib/services/db/data-access-layer.ts
src/lib/services/db/signal-database.ts
src/routes/api/signals/batch/+server.ts
src/routes/api/signals/+server.ts
src/routes/api/test-db/+server.ts
```

**NOTE**: Some of these files may have been deleted in Phase 0.1. Verify existence before updating.

---

## Subtask 0.6.2: Extract Store-Resident Types to $lib/types/

**3 stores-to-server type violations** (types defined in server, imported by stores):

| Store File                        | Type Imported                                        | Source                        | Target                    |
| --------------------------------- | ---------------------------------------------------- | ----------------------------- | ------------------------- |
| `stores/bettercap-store.ts`       | `BettercapWiFiAP, BettercapBLEDevice, BettercapMode` | `$lib/server/bettercap/types` | `$lib/types/bettercap.ts` |
| `stores/wifite-store.ts`          | `AttackMode`                                         | `$lib/server/wifite/types`    | `$lib/types/wifite.ts`    |
| `stores/packet-analysis-store.ts` | `NetworkPacket`                                      | `$lib/server/wireshark`       | `$lib/types/wireshark.ts` |

**Fix**: For each type:

1. Move the type/interface definition to `$lib/types/<domain>.ts`
2. Update the store to import from `$lib/types/`
3. Update the server file to re-export from `$lib/types/` (backward compat)
4. Search for any other importers and update them

**2 Svelte pages-to-server type violations**:

| Page File                    | Type Imported | Source                     | Target                                       |
| ---------------------------- | ------------- | -------------------------- | -------------------------------------------- |
| `routes/wifite/+page.svelte` | `AttackMode`  | `$lib/server/wifite/types` | `$lib/types/wifite.ts` (already moved above) |

**Additional type-only violations to fix**:

| File                                          | Type Imported                                | Source                                  | Target                  |
| --------------------------------------------- | -------------------------------------------- | --------------------------------------- | ----------------------- |
| `services/drone/flight-path-analyzer.ts`      | `FlightPoint, SignalCapture, AreaOfInterest` | `$lib/stores/drone`                     | `$lib/types/drone.ts`   |
| `services/tactical-map/cell-tower-service.ts` | `LeafletMap`                                 | `$lib/stores/tactical-map/map-store`    | `$lib/types/map.ts`     |
| `services/tactical-map/system-service.ts`     | `SystemInfo`                                 | `$lib/stores/tactical-map/system-store` | `$lib/types/system.ts`  |
| `server/db/database.ts`                       | `NetworkNode, NetworkEdge`                   | `$lib/services/map/network-analyzer`    | `$lib/types/network.ts` |
| `server/db/network-repository.ts`             | `NetworkNode, NetworkEdge`                   | `$lib/services/map/network-analyzer`    | `$lib/types/network.ts` |

**NOTE**: Some files above may have been deleted in Phase 0.1 or renamed in 0.3. Verify existence at execution time.

---

## Subtask 0.6.3: Extract Inline Types from God Page

The `tactical-map-simple/+page.svelte` (3,978 lines) defines inline interfaces:

- `GPSPositionData` (lines ~18-28)
- `GPSApiResponse` (lines ~30-36)
- `SystemInfo` (lines ~39-70)
- `KismetDevicesResponse` (lines ~74-76)
- `LeafletIcon`, `LeafletLibrary`, `LeafletMap`, `LeafletTileLayer`, `LeafletMarker`, `LeafletCircle`, `LeafletCircleMarker` (lines ~84-120)

**Action**:

1. Extract `GPSPositionData` and `GPSApiResponse` to `src/lib/types/gps.ts` (create new file)
2. Extract `SystemInfo` to `src/lib/types/system.ts` (may already exist from 0.6.2)
3. Extract Leaflet interfaces to `src/lib/types/map.ts` (may already exist from 0.6.2)
4. Update the God Page to import these types from `$lib/types/`
5. Add all new files to the types barrel (`src/lib/types/index.ts`)

---

## Subtask 0.6.4: Document Value Import Violations (NOT Fixed in Phase 0.2)

**33 CRITICAL value import violations are OUT OF SCOPE for Phase 0.2.** Create file: `src/lib/BOUNDARY-VIOLATIONS.md` documenting all 33 for Phase 5 reference.

**28 Services -> Stores VALUE imports** (services directly calling `store.set()` and `get(store)`):

| #   | Service File                                | Store Imported                                               | Impact                          |
| --- | ------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| 1   | `services/websocket/hackrf.ts`              | `stores/hackrf` (6 exports)                                  | Service WRITES to store         |
| 2   | `services/websocket/kismet.ts`              | `stores/kismet`, `stores/connection`                         | Service WRITES to store         |
| 3   | `services/hackrfsweep/signal-service.ts`    | `stores/hackrfsweep/signal-store`, `display-store`, `hackrf` | Service READS + WRITES          |
| 4   | `services/hackrfsweep/display-service.ts`   | `stores/hackrfsweep/display-store`                           | Service WRITES to store         |
| 5   | `services/hackrfsweep/control-service.ts`   | `stores/hackrfsweep/control-store`, `frequency-store`        | Service WRITES to store         |
| 6   | `services/hackrfsweep/frequency-service.ts` | `stores/hackrfsweep/frequency-store`                         | Service WRITES to store         |
| 7   | `services/tactical-map/hackrf-service.ts`   | `stores/hackrf`, `stores/tactical-map/hackrf-store`          | Service READS + WRITES          |
| 8   | `services/tactical-map/gps-service.ts`      | `stores/tactical-map/gps-store`                              | Service WRITES to store         |
| 9   | `services/tactical-map/map-service.ts`      | `stores/tactical-map/map-store`, `gps-store`                 | Service WRITES to store         |
| 10  | `services/tactical-map/system-service.ts`   | `stores/tactical-map/system-store`                           | Service WRITES to store         |
| 11  | `services/tactical-map/kismet-service.ts`   | `stores/tactical-map/kismet-store`                           | Service WRITES to store         |
| 12  | `services/hackrf/api.ts`                    | `stores/hackrf`                                              | Service WRITES to store         |
| 13  | `services/hackrf/usrp-api.ts`               | `stores/hackrf`                                              | Service WRITES to store         |
| 14  | `services/map/kismet-rssi-service.ts`       | `stores/tactical-map/gps-store`                              | Service READS via `get()`       |
| 15  | `services/wigletotak/wigle-service.ts`      | `stores/wigletotak/wigle-store`                              | Service WRITES to store         |
| 16  | `services/websocket/example-usage.ts`       | Multiple stores (6 imports)                                  | Example file, still a violation |
| 17  | `services/hackrf/hackrf-service.ts`         | `stores/hackrf`                                              | Service WRITES to store         |
| 18  | `services/hackrf/signal-processor.ts`       | `stores/hackrf`                                              | Service READS + WRITES          |
| 19  | `services/hackrf/sweep-analyzer.ts`         | `stores/hackrf`                                              | Service READS from store        |
| 20  | `services/hackrf/time-window-filter.ts`     | `stores/hackrf`                                              | Service READS from store        |
| 21  | `services/hackrf/usrp-api.ts`               | `stores/hackrf`                                              | Service WRITES to store         |
| 22  | `services/map/heatmap-service.ts`           | `stores/tactical-map/gps-store`                              | Service READS via `get()`       |
| 23  | `services/map/signal-filtering.ts`          | `stores/map/signals`                                         | Service READS from store        |
| 24  | `services/map/network-analyzer.ts`          | `stores/map/signals`                                         | Service READS from store        |
| 25  | `services/map/drone-detection.ts`           | `stores/drone`                                               | Service READS from store        |
| 26  | `services/db/signal-database.ts`            | `stores/map/signals`                                         | Service READS from store        |
| 27  | `services/db/data-access-layer.ts`          | `stores/map/signals`                                         | Service READS from store        |
| 28  | `services/localization/rssi-localizer.ts`   | `stores/tactical-map/gps-store`                              | Service READS via `get()`       |

**3 Server -> Services VALUE imports**:

| #   | Server File                      | Service Imported                                                                     |
| --- | -------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | `server/hackrf/sweep-manager.ts` | `ProcessManager, FrequencyCycler, BufferManager, ErrorTracker` from services/hackrf/ |
| 2   | `server/usrp/sweep-manager.ts`   | `ProcessManager, BufferManager` from services/usrp/                                  |

**1 Stores -> Services VALUE import**:

| #   | Store File       | Service Imported                   |
| --- | ---------------- | ---------------------------------- |
| 1   | `stores/usrp.ts` | `usrpAPI` from `services/usrp/api` |

**Phase 5 will address these by**: Inverting service-to-store dependencies using callback patterns, event emitters, or return-value-based approaches.

---

## Subtask 0.6.5: Fix Stores-to-Services Circular Dependency

**File**: `src/lib/stores/usrp.ts` line 2
**Issue**: `import { usrpAPI } from '$lib/services/usrp/api'` at module scope creates store-to-service coupling.

**Fix**: Move the import inside the function that uses it (lazy import pattern):

```typescript
// BEFORE (module scope -- eagerly loaded):
import { usrpAPI } from '$lib/services/usrp/api';

export function startSweep() {
	usrpAPI.start();
}

// AFTER (lazy -- loaded on first use):
let _api: typeof import('$lib/services/usrp/api').usrpAPI | null = null;

async function getAPI() {
	if (!_api) {
		const mod = await import('$lib/services/usrp/api');
		_api = mod.usrpAPI;
	}
	return _api;
}

export async function startSweep() {
	const api = await getAPI();
	api.start();
}
```

**NOTE**: This changes the function signature from sync to async. All callers must be updated to `await` the result. Run `grep -rn "startSweep\|usrpStore" src/ --include="*.ts" --include="*.svelte"` to find all callers.

---

## Subtask 0.6.6: Verify No Duplicate Type Definitions Remain

```bash
grep -rn "interface SignalMarker" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface SpectrumData" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface KismetDevice" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface SystemInfo" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface NetworkNode" src/ --include="*.ts" | grep -v "node_modules"
grep -rn "interface AttackMode\|type AttackMode" src/ --include="*.ts" | grep -v "node_modules"
```

Each type must appear in exactly ONE canonical location (`$lib/types/`) plus any re-exports.

---

## Verification Gate

```bash
npm run typecheck   # Must pass

# No server imports from stores (type or value):
grep -rn "from '\$lib/stores" src/lib/server/ --include="*.ts" | wc -l  # Must be 0

# No stores imports from server (type or value):
grep -rn "from '\$lib/server" src/lib/stores/ --include="*.ts" | wc -l  # Must be 0

# No API routes importing from stores:
grep -rn "from '\$lib/stores" src/routes/api/ --include="*.ts" | wc -l  # Must be 0

# Services-to-stores TYPE imports eliminated (value imports remain, documented):
grep -rn "import type.*from '\$lib/stores" src/lib/services/ --include="*.ts" | wc -l  # Must be 0

# Boundary violation doc exists:
test -f src/lib/BOUNDARY-VIOLATIONS.md && echo "PASS" || echo "FAIL"
```

---

## Rollback

If verification gate fails: `git checkout -- .` to discard unstaged changes. If commit was already made: `git revert HEAD`.
