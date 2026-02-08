# Phase 5.5.1 -- Critical God Store Decomposition

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.1                                                               |
| **Phase**            | 5.5.1                                                                            |
| **Title**            | Critical God Store Decomposition (CRITICAL-01, CRITICAL-05, CRITICAL-10)         |
| **Risk Level**       | LOW -- all decompositions are internal refactors with no public API changes      |
| **Prerequisites**    | Phase 5.5.0 (Assessment) complete                                                |
| **Estimated Effort** | 2 hours                                                                          |
| **Files Touched**    | 3 existing files refactored, 9 new files created (3 store directories x 3 files) |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7       |
| **Audit Date**       | 2026-02-08                                                                       |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                              |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                            |

---

## 1. Objective

Decompose three "God Store" factory functions that exceed 150 lines. All three share the identical anti-pattern: a single `createXStore()` function containing 6-14 inline action handler implementations. The extraction pattern is identical for all three: move action handlers to a sibling `*Actions.ts` file, reduce the store factory to thin delegations.

---

## 2. Function Inventory

| ID          | Lines | File                             | Line Start | Function             | Anti-Pattern | Sub-functions to Extract |
| ----------- | ----- | -------------------------------- | ---------- | -------------------- | ------------ | ------------------------ |
| CRITICAL-01 | 318   | `src/lib/stores/gsmEvilStore.ts` | 70         | `createGSMEvilStore` | God Store    | 14 action handlers       |
| CRITICAL-05 | 191   | `src/lib/stores/rtl433Store.ts`  | 61         | `createRTL433Store`  | God Store    | 8 action handlers        |
| CRITICAL-10 | 154   | `src/lib/stores/kismet.ts`       | 20         | `createKismetStore`  | God Store    | 7 action handlers        |

---

## 3. Decomposition Pattern

All three functions use the **Store Action Extraction** pattern (Pattern 5 in Phase 5.5.13).

**Structural rule**: The store creation function (writable declaration, derived stores, subscribe setup) stays in the store file. Action handler implementations move to a sibling `*Actions.ts` file. The store file imports and delegates to the action file.

**Closure variable handling**: Store action handlers typically close over the `update`, `set`, and `subscribe` functions from the writable store. When extracted to a separate file, these closures must be passed as explicit parameters. All extracted action functions receive `update: (fn: Updater<State>) => void` as their first parameter.

**Import path stability**: Create a barrel re-export at the original path for one release cycle:

```typescript
// src/lib/stores/gsmEvilStore.ts (becomes barrel)
export { gsmEvilStore, type GSMEvilState } from './gsm-evil/gsmEvilStore';
```

After all consumers have been updated, delete the barrel file.

---

## 4. CRITICAL-01: `createGSMEvilStore` (318 lines)

**Location**: `src/lib/stores/gsmEvilStore.ts:70`
**Current size**: 318 lines
**Root cause**: Store factory function contains 14 action handler implementations inline. Each action (startScan, stopScan, updateFrequency, setARFCN, fetchIMSIs, checkHealth, ...) is implemented as a multi-line closure within the single `createGSMEvilStore` function body.

### 4.1 New File Structure

```
src/lib/stores/gsm-evil/
  gsmEvilActions.ts       -- 14 exported action functions
  gsmEvilStore.ts         -- store creation (delegates to actions)
  index.ts                -- barrel re-export
```

### 4.2 Extracted Functions (in `gsmEvilActions.ts`)

| Function Name                         | Estimated Lines | Responsibility                  |
| ------------------------------------- | --------------- | ------------------------------- |
| `startGSMScan(update, state)`         | 25-35           | Initiate GSM frequency scan     |
| `stopGSMScan(update, state)`          | 10-15           | Abort running scan              |
| `updateScanFrequency(update, freq)`   | 15-20           | Change target frequency         |
| `setTargetARFCN(update, arfcn)`       | 10-15           | Set ARFCN channel               |
| `fetchCapturedIMSIs(update)`          | 20-30           | Retrieve IMSI list from backend |
| `performHealthCheck(update)`          | 20-30           | Check GSM Evil process health   |
| `updateScanProgress(update, data)`    | 10-15           | Update progress state from SSE  |
| `handleScanResult(update, result)`    | 15-20           | Process individual scan result  |
| `resetScanState(update)`              | 5-10            | Reset store to initial state    |
| `toggleAutoScan(update, enabled)`     | 10-15           | Enable/disable auto-scanning    |
| `updateConfiguration(update, config)` | 15-20           | Apply new scan configuration    |
| `handleError(update, error)`          | 10-15           | Centralized error state handler |
| `exportResults(state)`                | 15-20           | Format scan results for export  |
| `importConfiguration(update, config)` | 10-15           | Load saved scan configuration   |

### 4.3 Post-Decomposition Structure

**`createGSMEvilStore` target size**: 40-50 lines (store declaration + 14 one-line delegations).

```typescript
// src/lib/stores/gsm-evil/gsmEvilStore.ts (40 lines)
import { startGSMScan, stopGSMScan, fetchCapturedIMSIs /* ... */ } from './gsmEvilActions';

export function createGSMEvilStore() {
	const { subscribe, set, update } = writable<GSMEvilState>(initialState);

	return {
		subscribe,
		startScan: (freq: number) => startGSMScan(update, freq),
		stopScan: () => stopGSMScan(update),
		fetchIMSIs: () => fetchCapturedIMSIs(update)
		// ... one-line delegations for each action ...
	};
}
```

### 4.4 Verification

```bash
# Function size check
python3 scripts/audit-function-sizes-v2.py src/lib/stores/gsm-evil/gsmEvilStore.ts
# TARGET: 0 functions >60 lines

# No action function exceeds 60 lines
python3 scripts/audit-function-sizes-v2.py src/lib/stores/gsm-evil/gsmEvilActions.ts
# TARGET: 0 functions >60 lines

# Build verification
npm run build
npm run typecheck
```

### 4.5 Test Requirements

| Extracted Function   | Test Cases Required                                  | Coverage Target      |
| -------------------- | ---------------------------------------------------- | -------------------- |
| `startGSMScan`       | Valid frequency, invalid frequency, already scanning | 90% line coverage    |
| `stopGSMScan`        | Running scan, no active scan                         | 80% line coverage    |
| `fetchCapturedIMSIs` | Success response, error response, empty list         | 90% line coverage    |
| `performHealthCheck` | Healthy, degraded, offline                           | 100% branch coverage |
| `handleScanResult`   | Valid result, malformed result                       | 90% line coverage    |
| `handleError`        | Network error, timeout, unknown error                | 100% branch coverage |

Test file: `tests/unit/decomposition/gsmEvilStore/gsmEvilActions.test.ts`

---

## 5. CRITICAL-05: `createRTL433Store` (191 lines)

**Location**: `src/lib/stores/rtl433Store.ts:61`
**Current size**: 191 lines
**Root cause**: Identical anti-pattern to CRITICAL-01. Store factory function contains 8-10 action handler implementations inline.

### 5.1 New File Structure

```
src/lib/stores/rtl433/
  rtl433Actions.ts      -- 8 exported action functions
  rtl433Store.ts        -- store creation (delegates to actions)
  index.ts              -- barrel re-export
```

### 5.2 Extracted Functions (in `rtl433Actions.ts`)

| Function Name                          | Estimated Lines | Responsibility                     |
| -------------------------------------- | --------------- | ---------------------------------- |
| `startRTL433Listener(update)`          | 20-30           | Start RTL-433 capture process      |
| `stopRTL433Listener(update)`           | 10-15           | Stop capture process               |
| `handleSignalReceived(update, signal)` | 15-25           | Process incoming decoded signal    |
| `updateDeviceList(update, devices)`    | 15-20           | Refresh known device list          |
| `applyFrequencyFilter(update, filter)` | 10-15           | Set frequency filter parameters    |
| `exportCapturedSignals(state)`         | 15-20           | Format captured signals for export |
| `clearCapturedSignals(update)`         | 5-10            | Reset captured signal buffer       |
| `handleRTL433Error(update, error)`     | 10-15           | Error state handler                |

### 5.3 Post-Decomposition Structure

**`createRTL433Store` target size**: 30-40 lines.

### 5.4 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/stores/rtl433/rtl433Store.ts
python3 scripts/audit-function-sizes-v2.py src/lib/stores/rtl433/rtl433Actions.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

### 5.5 Test Requirements

| Extracted Function      | Test Cases Required                              | Coverage Target      |
| ----------------------- | ------------------------------------------------ | -------------------- |
| `startRTL433Listener`   | Success start, already running, device not found | 90% line coverage    |
| `handleSignalReceived`  | Valid signal, malformed signal, duplicate signal | 90% line coverage    |
| `applyFrequencyFilter`  | Valid range, out-of-range, null filter           | 100% branch coverage |
| `exportCapturedSignals` | Non-empty list, empty list                       | 80% line coverage    |

Test file: `tests/unit/decomposition/rtl433Store/rtl433Actions.test.ts`

---

## 6. CRITICAL-10: `createKismetStore` (154 lines)

**Location**: `src/lib/stores/kismet.ts:20`
**Current size**: 154 lines
**Root cause**: Same "God Store" anti-pattern as CRITICAL-01 and CRITICAL-05. Store factory contains 6-8 inline action handlers.

### 6.1 New File Structure

```
src/lib/stores/kismet/
  kismetActions.ts      -- 7 exported action functions
  kismetStore.ts        -- store creation (delegates to actions)
  index.ts              -- barrel re-export
```

### 6.2 Extracted Functions (in `kismetActions.ts`)

| Function Name                        | Estimated Lines | Responsibility                              |
| ------------------------------------ | --------------- | ------------------------------------------- |
| `fetchDevices(update)`               | 20-30           | Fetch device list from Kismet API           |
| `startKismetService(update)`         | 15-25           | Start Kismet process via API                |
| `stopKismetService(update)`          | 10-15           | Stop Kismet process                         |
| `updateDeviceFilter(update, filter)` | 10-15           | Apply device type/signal filter             |
| `handleDeviceUpdate(update, device)` | 15-20           | Process incoming device data from WebSocket |
| `refreshAlerts(update)`              | 15-20           | Fetch and update Kismet alerts              |
| `handleKismetError(update, error)`   | 10-15           | Error state handler                         |

### 6.3 Post-Decomposition Structure

**`createKismetStore` target size**: 30-40 lines.

### 6.4 Verification

```bash
python3 scripts/audit-function-sizes-v2.py src/lib/stores/kismet/kismetStore.ts
python3 scripts/audit-function-sizes-v2.py src/lib/stores/kismet/kismetActions.ts
# TARGET: 0 functions >60 lines in both files

npm run build && npm run typecheck
```

### 6.5 Test Requirements

| Extracted Function   | Test Cases Required                            | Coverage Target      |
| -------------------- | ---------------------------------------------- | -------------------- |
| `fetchDevices`       | Success response, empty device list, API error | 90% line coverage    |
| `startKismetService` | Success, already running, permission denied    | 90% line coverage    |
| `handleDeviceUpdate` | New device, updated device, malformed data     | 90% line coverage    |
| `handleKismetError`  | Network error, timeout, process crash          | 100% branch coverage |

Test file: `tests/unit/decomposition/kismetStore/kismetActions.test.ts`

---

## 7. Cross-Phase Notes

- **Phase 5.3 (Store-Service Boundary)**: The extracted action functions in `*Actions.ts` files use `fetch()` to call API endpoints. They do NOT import server-side modules. This maintains the store-service boundary enforced by Phase 5.3.
- **Phase 5.4 (File Size)**: Each new directory contains 3 files, all well under 300 lines. No file-size violations introduced.
- **Phase 4.2 (Type Deduplication)**: Store state types (`GSMEvilState`, `RTL433State`, `KismetState`) remain unchanged. No new type definitions are created.

---

## 8. Execution Order

1. Decompose `createGSMEvilStore` (largest, 318 lines) -- establishes the pattern
2. Decompose `createRTL433Store` (191 lines) -- apply same pattern
3. Decompose `createKismetStore` (154 lines) -- apply same pattern
4. Update all import paths referencing the original store files
5. Create barrel re-exports at original paths
6. Run full verification suite

**Commit strategy**: One commit per store decomposition (3 commits total).

```
refactor(phase-5.5): decompose createGSMEvilStore (318 -> 40 lines)
refactor(phase-5.5): decompose createRTL433Store (191 -> 35 lines)
refactor(phase-5.5): decompose createKismetStore (154 -> 35 lines)
```

---

## 9. Risk Mitigations

### 9.1 Store Action Extraction -- Closure Variable Access

Store action handlers typically close over the `update`, `set`, and `subscribe` functions from the writable store. When extracted to a separate file, these closures must be passed as explicit parameters.

All extracted action functions receive `update: (fn: Updater<State>) => void` as their first parameter. This is the minimal interface needed to modify store state. The `subscribe` function is NOT passed to action handlers (actions write, they do not read via subscription).

### 9.2 Import Path Stability

Create a barrel re-export at the original path for one release cycle:

```typescript
// src/lib/stores/gsmEvilStore.ts (becomes barrel)
export { gsmEvilStore, type GSMEvilState } from './gsm-evil/gsmEvilStore';
```

After all consumers have been updated (verified with `grep -rn "stores/gsmEvilStore" src/`), delete the barrel file.

---

**END OF DOCUMENT**
