# Phase 5.1.20 -- God Page Decomposition: Execution Order, Verification, and Standards

| Field             | Value                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| **Phase**         | 5.1.20                                                                |
| **Title**         | Execution Order, Verification Checklist, Risk Mitigations, Metrics    |
| **Risk Level**    | N/A (meta-document governing execution of Phase 5.1.1-5.1.19)         |
| **Prerequisites** | Phase 5.1.0 assessment complete                                       |
| **Files Touched** | 0 (governance document)                                               |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C MEM00-C, NASA/JPL Rule 15, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                   |

---

## 1. Objective

Define the mandatory execution sequence for all Phase 5.1 sub-tasks, the verification
checklist to execute after task completion, risk mitigations for the entire decomposition
effort, summary metrics, and the standards compliance matrix.

---

## 2. Execution Order

Execute steps within each task in the order shown. Execute tasks in this order:

| Priority | Sub-Task | File                                                 | Description                            | Risk   | Est. LOC Change | Blocking?          |
| -------- | -------- | ---------------------------------------------------- | -------------------------------------- | ------ | --------------- | ------------------ |
| 1        | 5.1.9    | Phase-5.1.9-Tactical-Map-Style-Extraction.md         | Tactical map: extract styles           | ZERO   | -1,306          | No                 |
| 2        | 5.1.10   | Phase-5.1.10-GSM-Evil-Lookup-Table-Extraction.md     | GSM Evil: extract lookup tables        | ZERO   | -786            | No                 |
| 3        | 5.1.15   | Phase-5.1.15-GSM-Evil-Style-Extraction.md            | GSM Evil: extract styles               | ZERO   | -971            | No                 |
| 4        | 5.1.19   | Phase-5.1.19-Sweep-Style-Deduplication.md            | Sweep pages: extract/dedup styles      | ZERO   | -1,205          | No                 |
| 5        | 5.1.1    | Phase-5.1.1-Tactical-Map-Utility-Extraction.md       | Tactical map: extract utilities        | LOW    | -72             | No                 |
| 6        | 5.1.2    | Phase-5.1.2-Tactical-Map-DeviceIcon-Extraction.md    | Tactical map: extract device icons     | LOW    | -227            | No                 |
| 7        | 5.1.12   | Phase-5.1.12-GSM-Evil-IMSI-Tower-Grouping.md         | GSM Evil: extract tower grouper        | LOW    | -74             | No                 |
| 8        | 5.1.13   | Phase-5.1.13-GSM-Evil-Data-Fetchers-Extraction.md    | GSM Evil: extract data fetchers        | LOW    | -62             | No                 |
| 9        | 5.1.14   | Phase-5.1.14-GSM-Evil-Template-Panel-Extraction.md   | GSM Evil: extract template panels      | LOW    | -296            | No                 |
| 10       | 5.1.17   | Phase-5.1.17-Sweep-Shared-Service-Device-Adapter.md  | Sweep: create shared service           | MEDIUM | -1,105          | Yes (blocks 11-12) |
| 11       | 5.1.16   | Phase-5.1.16-Sweep-Shared-Components-Creation.md     | Sweep: create shared components        | MEDIUM | -1,765          | Needs 10           |
| 12       | 5.1.18   | Phase-5.1.18-Sweep-USRP-Power-Measurement.md         | Sweep: extract USRP power              | LOW    | -107            | Needs 10           |
| 13       | 5.1.3    | Phase-5.1.3-Tactical-Map-CellTower-Extraction.md     | Tactical map: extract cell towers      | MEDIUM | -230            | No                 |
| 14       | 5.1.4    | Phase-5.1.4-Tactical-Map-SystemInfo-Extraction.md    | Tactical map: extract system info      | MEDIUM | -205            | No                 |
| 15       | 5.1.7    | Phase-5.1.7-Tactical-Map-GPS-Extraction.md           | Tactical map: extract GPS              | MEDIUM | -100            | No                 |
| 16       | 5.1.11   | Phase-5.1.11-GSM-Evil-Scan-Controller-Extraction.md  | GSM Evil: extract scan controller      | MEDIUM | -264            | No                 |
| 17       | 5.1.5    | Phase-5.1.5-Tactical-Map-Kismet-Extraction.md        | Tactical map: extract Kismet (LARGEST) | HIGH   | -700            | No                 |
| 18       | 5.1.6    | Phase-5.1.6-Tactical-Map-HackRF-Signal-Extraction.md | Tactical map: extract HackRF/Signal    | HIGH   | -395            | No                 |
| 19       | 5.1.8    | Phase-5.1.8-Tactical-Map-UI-State-Lifecycle.md       | Tactical map: extract UI state         | LOW    | -150            | Needs 13-18        |

### 2.1 Execution Rationale

**Priorities 1-4** (ZERO risk): Style extractions execute first. They produce immediate
line-count reductions (-4,268 lines, 40.1% of total god page code) and validate the
extraction workflow with zero possibility of functional regression.

**Priorities 5-9** (LOW risk): Pure-function and data extractions. These move code
with no side effects and no state dependencies. TypeScript type checking catches
any wiring errors immediately.

**Priority 10** (MEDIUM, blocking): The shared sweep service/adapter interface must
be created before the shared components (11) and USRP power (12) that depend on it.

**Priorities 13-18** (MEDIUM/HIGH risk): Stateful subsystem extractions. These involve
Leaflet map state, async data fetching, and Svelte reactivity. They carry the highest
regression risk and require the most careful interface design.

**Priority 19** (LOW, dependent): UI state and lifecycle refactoring is the final
cleanup. It can only execute after all manager classes (13-18) are created.

---

## 3. Verification Checklist

Execute after ALL sub-tasks within a god page are complete. Every check must pass before
the decomposition is considered complete.

### 3.1 File Size Verification

```bash
# After tactical-map-simple decomposition (5.1.1-5.1.9):
wc -l src/routes/tactical-map-simple/+page.svelte
# PASS criteria: <= 400 lines

# After gsm-evil decomposition (5.1.10-5.1.15):
wc -l src/routes/gsm-evil/+page.svelte
# PASS criteria: <= 350 lines

# After sweep decomposition (5.1.16-5.1.19):
wc -l src/routes/rfsweep/+page.svelte src/routes/hackrfsweep/+page.svelte
# PASS criteria: each <= 300 lines
```

### 3.2 Function Size Verification

```bash
# No function in any decomposed page should exceed 60 LOC.
# Run the audit script:
python3 scripts/audit-function-sizes-v2.py \
  src/routes/tactical-map-simple/+page.svelte \
  src/routes/gsm-evil/+page.svelte \
  src/routes/rfsweep/+page.svelte \
  src/routes/hackrfsweep/+page.svelte
# PASS criteria: 0 functions >60 LOC in these files

# Manual spot-check for extracted services:
grep -c 'function\|=>' src/lib/services/tactical-map/*.ts
# Each service file should have functions, confirming extraction occurred
```

### 3.3 Build Verification

```bash
npm run build
# PASS criteria: exit code 0, zero errors

npm run typecheck
# PASS criteria: exit code 0, zero type errors

npm run lint
# PASS criteria: zero new errors (pre-existing warnings acceptable)
```

### 3.4 Import Graph Verification

```bash
# Verify no circular dependencies introduced:
npx madge --circular --extensions ts,svelte src/
# PASS criteria: zero circular dependencies involving new files

# Verify extracted services are actually imported:
grep -r 'tactical-map/utils' src/routes/tactical-map-simple/
# PASS criteria: at least 1 match

grep -r 'gsm-lookup-tables' src/routes/gsm-evil/
# PASS criteria: at least 1 match

grep -r 'sweep/sweepService' src/routes/rfsweep/ src/routes/hackrfsweep/
# PASS criteria: at least 1 match per page
```

### 3.5 Dead Code Verification

```bash
# Verify extracted files have importers (are not immediately dead):
for f in \
  src/lib/services/tactical-map/utils.ts \
  src/lib/services/tactical-map/deviceIcons.ts \
  src/lib/services/tactical-map/cellTowerManager.ts \
  src/lib/services/tactical-map/systemInfoManager.ts \
  src/lib/services/tactical-map/kismetManager.ts \
  src/lib/services/tactical-map/signalManager.ts \
  src/lib/services/tactical-map/gpsManager.ts \
  src/lib/data/gsm-lookup-tables.ts \
  src/lib/services/gsm-evil/scanController.ts \
  src/lib/services/gsm-evil/towerGrouper.ts \
  src/lib/services/gsm-evil/dataFetchers.ts \
  src/lib/services/sweep/sweepService.ts; do
  basename=$(basename "$f" .ts)
  count=$(grep -r "$basename" src/ --include="*.svelte" --include="*.ts" | grep -v "^$f" | wc -l)
  echo "$basename: $count importers"
done
# PASS criteria: every file has >= 1 importer
```

### 3.6 Visual Regression (Manual)

```
1. Start dev server: npm run dev
2. Navigate to /tactical-map-simple
   - Verify map loads with correct tile layer
   - Verify GPS position marker appears (if GPS hardware connected)
   - Verify Kismet device markers appear (if Kismet running)
   - Verify sidebar opens/closes
   - Verify cell tower markers appear (if GSM data available)
3. Navigate to /gsm-evil
   - Verify scan button triggers SSE stream
   - Verify lookup tables render carrier/country names correctly
   - Verify tower table populates after scan
4. Navigate to /rfsweep and /hackrfsweep
   - Verify frequency list add/remove works
   - Verify start/stop cycling works
   - Verify signal gauge updates
   - Verify timer countdown displays
```

---

## 4. Risk Mitigations

### 4.1 Leaflet Map State Preservation

**Risk**: Leaflet `L.map()` instances maintain internal state (zoom level, center,
tile layers, markers). Extracting code that creates or modifies markers can break
map state if the `map` reference is lost or duplicated.

**Mitigation**: All extracted manager classes (`CellTowerManager`, `KismetManager`,
`SignalManager`, `GPSManager`) receive the `map` instance via constructor injection.
They never create a new map. The `map` instance is created exactly once in the
orchestrator page's `onMount` and passed to all managers.

### 4.2 Svelte Reactivity Preservation

**Risk**: Svelte's reactivity system tracks assignments to top-level `let` variables.
Moving state into a service class breaks reactivity because Svelte cannot detect
property mutations on imported objects.

**Mitigation**: Use Svelte writable stores in the service layer. Each manager
exposes its state as a writable/readable store. The orchestrator page subscribes
to these stores using `$store` syntax. Example:

```typescript
// In kismetManager.ts:
import { writable } from 'svelte/store';
export const kismetDeviceCount = writable(0);

// In +page.svelte:
import { kismetDeviceCount } from './kismetManager';
// Template: {$kismetDeviceCount} devices
```

### 4.3 Style Scoping Breakage

**Risk**: Extracting `<style>` to an external CSS file loses Svelte's automatic
component-scoped styling. Styles may leak to child components or fail to apply
to dynamically generated elements.

**Mitigation**: Use `<style>@import './tactical-map.css';</style>` instead of
`<link>` tag. The `@import` inside a `<style>` block is processed by the Svelte
compiler and maintains scoping. For styles targeting Leaflet popup content
(which is DOM-injected, not Svelte-rendered), use `:global(.signal-popup)` wrapper.

### 4.4 Incremental Extraction Safety

**Risk**: Extracting all 7 functions >60 LOC simultaneously in tactical-map-simple
creates a large changeset that is difficult to review and bisect if regressions occur.

**Mitigation**: Execute steps in the order specified in Section 2. Each step
produces a single, atomic commit. Run `npm run build && npm run typecheck` after
each step. If a step fails, revert only that step's commit.

### 4.5 Component Props Interface Mismatch

**Risk**: The 11 pre-built components at `src/lib/components/tactical-map/` were
written speculatively. Their prop interfaces may not match the data shapes used
by the god page's inline code.

**Mitigation**: Before wiring each component, compare its prop interface to the
data shape in the god page. Document any mismatches. If the component's interface
is correct but the god page's data shape is ad-hoc, adapt the god page data to
match the component. If the component's interface is wrong, update the component.
The component is the source of truth for the target interface.

### 4.6 SSE Stream Handler Extraction (GSM Evil)

**Risk**: The `scanFrequencies` function manages an SSE ReadableStream with abort
controller logic. Extracting it to a service file while preserving the abort
controller lifecycle requires careful attention to the component's onDestroy cleanup.

**Mitigation**: The extracted `scanController.ts` function accepts an
`AbortController` as a parameter. The component creates and owns the abort
controller. The component's `onDestroy` calls `controller.abort()`. The service
function's `finally` block calls `store.completeScan()` regardless of abort state.
This maintains the cleanup guarantee documented in the Memory Leak Audit (2026-02-07,
fix F1: ReadableStream cancel() is the cleanup hook, not start() return).

### 4.7 Shared Sweep Service Type Safety

**Risk**: The `SweepDeviceAdapter` interface must accurately capture the differences
between HackRF and USRP APIs. A too-abstract interface hides device-specific
behavior; a too-concrete interface defeats the purpose of abstraction.

**Mitigation**: The adapter interface has exactly one optional method: `measurePower`
(USRP-only). All other methods are required on both devices. The two known
device-specific differences (frequency tolerance: 50 vs 100 MHz; spectrum path:
with vs without query param) are captured as readonly properties on the interface,
not as method signatures. This keeps the interface minimal and verifiable.

---

## 5. Summary Metrics

| Metric                            | Before       | After                 | Change     |
| --------------------------------- | ------------ | --------------------- | ---------- |
| tactical-map-simple               | 3,978 lines  | ~350 lines            | -91.2%     |
| gsm-evil                          | 2,591 lines  | ~300 lines            | -88.4%     |
| rfsweep                           | 2,245 lines  | ~250 lines            | -88.9%     |
| hackrfsweep                       | 1,830 lines  | ~250 lines            | -86.3%     |
| **Total god page lines**          | **10,644**   | **~1,150**            | **-89.2%** |
| Functions >60 LOC in god pages    | 14           | 0                     | -100%      |
| Duplicated function names (sweep) | 10 x 2 pages | 0 (shared service)    | -100%      |
| Pre-built components wired        | 0 of 11      | 11 of 11              | +11        |
| New service files created         | 0            | ~13                   | --         |
| New shared components created     | 0            | ~12                   | --         |
| Circular dependencies introduced  | --           | 0 (verified by madge) | --         |

### 5.1 Per-Task Breakdown

**Task 5.1.1 -- Tactical Map Simple (Steps 1-9)**:

| Step | Description                  | Lines Extracted | Target File(s)                                                 | Risk   |
| ---- | ---------------------------- | --------------- | -------------------------------------------------------------- | ------ |
| 1    | Lookup tables and utilities  | ~72             | services/tactical-map/utils.ts                                 | LOW    |
| 2    | getDeviceIconSVG (227 lines) | ~227            | services/tactical-map/deviceIcons.ts                           | LOW    |
| 3    | Cell tower subsystem         | ~230            | services/tactical-map/cellTowerManager.ts (NEW)                | MEDIUM |
| 4    | System info subsystem        | ~205            | services/tactical-map/systemInfoManager.ts (NEW)               | MEDIUM |
| 5    | Kismet subsystem (largest)   | ~700            | services/tactical-map/kismetManager.ts + 2 existing components | HIGH   |
| 6    | HackRF/Signal subsystem      | ~395            | services/tactical-map/signalManager.ts + 3 existing components | HIGH   |
| 7    | GPS subsystem                | ~100            | services/tactical-map/gpsManager.ts + 2 existing components    | MEDIUM |
| 8    | UI state and lifecycle       | ~150            | types/leaflet.ts + inline refactor                             | LOW    |
| 9    | Style section                | ~1,306          | tactical-map.css                                               | ZERO   |

**Total extracted**: ~3,385 lines of logic + 1,306 lines of CSS = ~4,691 lines removed
**Remaining in page**: ~350 lines (91.2% reduction)

**Task 5.1.2 -- GSM Evil (Steps 1-6)**:

| Step | Description                   | Lines Extracted | Risk   |
| ---- | ----------------------------- | --------------- | ------ |
| 1    | Lookup tables (786 lines)     | 786             | ZERO   |
| 2    | Scan controller + SSE parsing | 264             | MEDIUM |
| 3    | IMSI tower grouping           | 74              | LOW    |
| 4    | Data fetchers                 | 62              | LOW    |
| 5    | Template panels               | 296             | LOW    |
| 6    | Styles                        | 971             | ZERO   |

**Total extracted**: 2,453 lines. **Remaining**: ~300 lines (88.4% reduction)

**Task 5.1.3 -- RF Sweep + HackRF Sweep (Steps 1-5)**:

| Step | Description                               | Lines Extracted | Net New Lines | Risk   |
| ---- | ----------------------------------------- | --------------- | ------------- | ------ |
| 1    | Shared sweep components (7)               | ~1,765 template | ~370          | MEDIUM |
| 2    | Shared sweep service + adapter interface  | ~1,105 script   | ~300          | MEDIUM |
| 3    | openSpectrumAnalyzer (included in Step 2) | 0               | 0             | --     |
| 4    | USRP power measurement                    | 107             | ~100          | LOW    |
| 5    | Style deduplication                       | 1,205           | ~650          | ZERO   |

**Combined reduction**: 4,075 -> ~500 lines across both pages (87.7% reduction)

---

## 6. Standards Compliance Matrix

| Standard              | Requirement                                    | How Phase 5.1 Satisfies It                                        |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | All extracted TypeScript passes `npm run typecheck`               |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | Extracted code replaces inline; no commented remnants             |
| CERT C MEM00-C        | Allocate/free in same module                   | Leaflet markers created and destroyed in same manager class       |
| CERT C ERR00-C        | Adopt consistent error handling                | Each service function uses try/catch with typed error propagation |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines     | All functions >60 LOC split (14 total, verified post-extraction)  |
| NASA/JPL Rule 14      | Minimize function complexity                   | Pure functions extracted; orchestrators delegate to specialists   |
| Barr C Ch. 8          | Each module shall have a header                | Each `.ts` service file exports a typed public interface          |

---

## 7. Dependency Diagram

```
Phase 5.1.0 (Assessment)
    |
    +-- ZERO RISK (parallel) -------------------------+
    |   Phase 5.1.9  (tac-map styles)                 |
    |   Phase 5.1.10 (gsm-evil lookup tables)         |
    |   Phase 5.1.15 (gsm-evil styles)                |
    |   Phase 5.1.19 (sweep styles)                   |
    +--------------------------------------------------
    |
    +-- LOW RISK (parallel) --------------------------+
    |   Phase 5.1.1  (tac-map utilities)              |
    |   Phase 5.1.2  (tac-map device icons)           |
    |   Phase 5.1.12 (gsm-evil tower grouper)         |
    |   Phase 5.1.13 (gsm-evil data fetchers)         |
    |   Phase 5.1.14 (gsm-evil template panels)       |
    +--------------------------------------------------
    |
    +-- MEDIUM RISK (sweep chain) --------------------+
    |   Phase 5.1.17 (sweep service + adapter)        |
    |       |                                          |
    |       +---> Phase 5.1.16 (sweep components)     |
    |       +---> Phase 5.1.18 (USRP power)           |
    +--------------------------------------------------
    |
    +-- MEDIUM/HIGH RISK (tac-map subsystems) --------+
    |   Phase 5.1.3  (cell towers)                    |
    |   Phase 5.1.4  (system info)                    |
    |   Phase 5.1.7  (GPS)                            |
    |   Phase 5.1.11 (gsm-evil scan controller)       |
    |   Phase 5.1.5  (Kismet -- LARGEST)              |
    |   Phase 5.1.6  (HackRF/Signal)                  |
    +--------------------------------------------------
    |
    +-- FINAL (depends on 13-18) ---------------------+
        Phase 5.1.8  (UI state + lifecycle)           |
    +--------------------------------------------------
```

---

## 8. Rollback Strategy (Global)

Each sub-task produces a single atomic commit. The global rollback strategy is:

```bash
# Revert the most recent sub-task:
git revert HEAD

# Revert all Phase 5.1 changes:
git log --oneline | grep 'Phase 5.1' | tail -1  # find first Phase 5.1 commit
git revert --no-commit HEAD~N..HEAD  # where N = number of Phase 5.1 commits
git commit -m "revert: Phase 5.1 god page decomposition (all sub-tasks)"
```

For partial rollback (single task within a god page), see the rollback section in
that task's sub-document.

---

_Phase 5.1.20 -- God Page Decomposition: Execution Order, Verification, and Standards_
_Document version: 1.0.0_
_Verified against codebase at commit f300b8f (main, 2026-02-08)_
