# Phase 5.4.13 -- File Size Enforcement: Execution Order and Final Verification

```
Document ID:    ARGOS-AUDIT-P5.4.13-EXECUTION-ORDER-VERIFICATION
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.13 -- Execution sequence, phase gates, and verification checklist
Risk Level:     LOW
Prerequisites:  All sub-tasks 5.4.0 through 5.4.12 authored and reviewed
Files Touched:  0 (orchestration document only)
Standards:      MISRA C:2012, CERT C Secure Coding, NASA/JPL Rule 2.4,
                Barr Group Embedded C Coding Standard Rule 1.3
Classification: CUI // FOUO
```

---

## 1. Purpose

This document defines the strict sequential execution order for all Phase 5.4
decomposition work. It provides pre-execution and post-execution phase gates, commit
message standards, and the final verification checklist that must pass before Phase 5.4
is marked COMPLETE.

---

## 2. Phase Gate: Pre-Execution

Before beginning any decomposition, execute ALL of the following checks. If any check
fails, STOP and resolve before proceeding.

```bash
# 1. Verify Phase 4 dead code removal is complete
git log --oneline | head -20  # confirm dead code removal commits present

# 2. Verify Phase 5.1 god page decomposition is complete
wc -l src/routes/tactical-map-simple/+page.svelte  # must be <500
wc -l src/routes/gsm-evil/+page.svelte              # must be <500
wc -l src/routes/rfsweep/+page.svelte               # must be <500
wc -l src/routes/hackrfsweep/+page.svelte            # must be <500

# 3. Verify Phase 5.2 deduplication is complete
ls src/lib/services/sdr-common/  # directory must exist with unified types

# 4. Verify Phase 5.3 shell consolidation is complete
# (Phase 5.3 is prerequisite per Phase 5.4.0)

# 5. Baseline: count files >300 lines BEFORE this phase
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 300 {print}' | wc -l
# Record this number for comparison in post-execution gate

# 6. Baseline: count files >500 lines BEFORE this phase
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 500 {print}' | wc -l

# 7. Baseline: run tests
npm run test 2>&1 | tail -20
# Record pass/fail count for regression comparison

# 8. Baseline: type check
npx tsc --noEmit 2>&1 | grep -c "error"
# Record error count (must be 0 or known pre-existing)

# 9. Baseline: build
npm run build 2>&1 | tail -5
# Must succeed
```

---

## 3. Execution Order

Strict sequential execution. Each tier completes fully before the next begins. Within
each tier, files are ordered by directory to minimize context-switching during execution.

### 3.1 Tier 1 Execution (7 files, estimated ~1 day)

**One commit per file. Each commit must pass `npx tsc --noEmit` and `npm run build`.**

| Order | Sub-Task | File                            | Commit Message                                           |
| ----- | -------- | ------------------------------- | -------------------------------------------------------- |
| 1     | 5.4.1    | `toolHierarchy.ts`              | `refactor: split toolHierarchy into category modules`    |
| 2     | 5.4.2    | `KismetDashboardOverlay.svelte` | `refactor: extract KismetDashboardOverlay subcomponents` |
| 3     | 5.4.3    | `redesign/+page.svelte`         | `refactor: decompose redesign page into sections`        |
| 4     | 5.4.4    | `DashboardMap.svelte`           | `refactor: extract DashboardMap services and controls`   |
| 5     | 5.4.5    | `AirSignalOverlay.svelte`       | `refactor: extract RF detection and rendering services`  |
| 6     | 5.4.6    | `rtl-433/+page.svelte`          | `refactor: decompose RTL-433 page into components`       |
| 7     | 5.4.7    | `TopStatusBar.svelte`           | `refactor: extract status bar indicator components`      |

**Tier 1 Gate:** After all 7 commits, verify:

```bash
# Zero files >1,000 lines remaining
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 1000 {print}' | wc -l
# Expected: 0
```

---

### 3.2 Tier 2 Execution (23 files, estimated ~3 days)

**One commit per file. Execute by directory cluster.**

| Order | Sub-Task | Directory Cluster       | Files                                                     | Commit Pattern                             |
| ----- | -------- | ----------------------- | --------------------------------------------------------- | ------------------------------------------ |
| 8-10  | 5.4.8    | `server/kismet/`        | device_intelligence, security_analyzer, kismet_controller | `refactor(kismet): decompose {file}`       |
| 11    | 5.4.9    | `server/mcp/`           | dynamic-server                                            | `refactor(mcp): extract tool handlers`     |
| 12-13 | 5.4.10   | `server/kismet/`        | types, webSocketManager                                   | `refactor(kismet): split {file}`           |
| 14-16 | 5.4.10   | `services/kismet/`      | deviceManager, kismetService                              | `refactor(kismet): decompose {file}`       |
| 17-19 | 5.4.10   | `services/map/`         | droneDetection, signalFiltering, signalInterpolation      | `refactor(map): decompose {file}`          |
| 20    | 5.4.9    | `services/recovery/`    | errorRecovery                                             | `refactor(recovery): extract strategies`   |
| 21    | 5.4.10   | `services/monitoring/`  | systemHealth                                              | `refactor(monitoring): extract collectors` |
| 22-24 | 5.4.9    | `components/`           | MissionControl, SignalFilterControls, AgentChatPanel      | `refactor(ui): decompose {component}`      |
| 25-27 | 5.4.9    | `components/dashboard/` | OverviewPanel, TerminalPanel                              | `refactor(dashboard): decompose {panel}`   |
| 28-30 | 5.4.9    | `routes/`               | droneid, kismet, wifite, +page                            | `refactor: decompose {route} page`         |

**Tier 2 Gate:** After all Tier 2 commits, verify:

```bash
# Zero files >500 lines remaining (except documented exceptions)
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 500 {print}' | wc -l
# Expected: 0 or only documented exceptions from Phase 5.4.0 Section 7
```

---

### 3.3 Tier 3 Execution (selective, estimated ~2 days)

**Execute only files marked DECOMPOSE (not ACCEPT or DEFERRED). Up to 3 files per commit
when changes are trivial extractions within the same directory.**

| Order | Sub-Task | Action                     | Files                                                                               |
| ----- | -------- | -------------------------- | ----------------------------------------------------------------------------------- |
| 31-35 | 5.4.11   | Server decompositions      | cleanupService, wireshark, dbOptimizer, kismetProxy, wifite/processManager          |
| 36-40 | 5.4.11   | Service decompositions     | signalDatabase, dataStreamManager, heatmapService, hackrfService, networkAnalyzer   |
| 41-45 | 5.4.11   | Service decompositions     | signalProcessor, signalClustering, timeWindowFilter                                 |
| 46-50 | 5.4.12   | Component decompositions   | SpectrumAnalysis, DevicesPanel, ServiceControl, SpectrumChart, frontendToolExecutor |
| 51-53 | 5.4.12   | Route/store decompositions | api/agent/tools, drone store                                                        |
| 54    | 5.4.11   | Server tools               | agent/frontend-tools, agent/tools                                                   |

---

## 4. Commit Message Format

All commits follow this format:

```
refactor(scope): decompose {OriginalFile} into {N} modules

- Extract {Module1}: {brief description}
- Extract {Module2}: {brief description}
- Original file reduced from {X} to {Y} lines
- Barrel re-export preserves all existing import paths
- No logic changes, structural only
```

**Scope values:** `kismet`, `hackrf`, `map`, `dashboard`, `drone`, `mcp`, `db`, `agent`,
`recovery`, `monitoring`, `streaming`, `wifite`, `gsm` -- or omit for cross-cutting changes.

---

## 5. Phase Gate: Post-Execution

After ALL tiers are complete, execute the full verification suite:

```bash
# 1. Count files >300 lines AFTER this phase
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 300 {print}' | wc -l
# Target: <30 (down from ~85 in scope)

# 2. Count files >500 lines (hard limit)
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 500 {print}' | wc -l
# Target: 0 (excluding documented exceptions for pure data files)

# 3. Count files >1,000 lines
find src/ -name "*.ts" -o -name "*.svelte" | xargs wc -l | \
  awk '$1 > 1000 {print}' | wc -l
# Target: 0 (unconditional)

# 4. Full type check
npx tsc --noEmit 2>&1 | grep -c "error"
# Target: 0

# 5. Build verification
npm run build 2>&1 | tail -5
# Target: successful build

# 6. Test regression
npm run test 2>&1 | tail -20
# Target: zero regressions from pre-execution baseline

# 7. No broken imports (spot check)
grep -r "from '\.\." src/ --include="*.ts" --include="*.svelte" | \
  grep -v node_modules | grep -v ".svelte-kit" | head -20
# Manually verify sample of relative imports resolve

# 8. No circular dependencies introduced
npx madge --circular src/ 2>&1 | tail -10
# Target: no new circular dependencies

# 9. Lint check
npm run lint 2>&1 | tail -20
# Target: only pre-existing warnings (no new errors)

# 10. Runtime smoke test
npm run dev &
sleep 10
curl -s http://localhost:5173 | head -5
# Target: page loads without crash
kill %1
```

---

## 6. Verification Checklist

Each decomposition commit MUST pass ALL of the following checks before merge:

### 6.1 Structural Verification

- [ ] No new file exceeds 500 lines (300-line target, 500-line hard limit)
- [ ] No function exceeds 60 lines (NASA/JPL Rule 2.4)
- [ ] Original file is either deleted or reduced to an orchestrator/barrel <200 lines
- [ ] All new files have appropriate TypeScript strict mode compliance
- [ ] No circular imports introduced (verify with `madge --circular src/`)

### 6.2 Functional Verification

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes (or only pre-existing warnings)
- [ ] All existing import paths resolve (grep for old import path, verify zero matches
      or proper re-exports)
- [ ] Runtime smoke test: `npm run dev` starts without crash

### 6.3 Behavioral Preservation

- [ ] No logic changes -- decomposition is STRUCTURAL ONLY
- [ ] Function signatures unchanged (same parameters, same return types)
- [ ] Export surface unchanged (all previously exported symbols still exported)
- [ ] Store subscriptions unchanged (no new stores, no removed stores)
- [ ] WebSocket message handlers unchanged

### 6.4 Security Verification

- [ ] No secrets exposed during file splitting (grep for API keys, tokens, passwords)
- [ ] No new files with overly permissive exports (avoid `export *` from internal modules)
- [ ] File permissions unchanged (`ls -la` on new files)
- [ ] No commented-out code in new files (MISRA C:2012 Dir 4.4)

---

## 7. Risk Mitigations

### 7.1 Barrel Re-Export Strategy

**Risk:** Breaking existing import paths when moving files into subdirectories.

**Mitigation:** Every decomposed module MUST provide a barrel `index.ts` that re-exports
the full public API of the original file. Existing importers can use either:

- The barrel path: `import { fn } from './module'` (resolves to `./module/index.ts`)
- Direct submodule: `import { fn } from './module/submodule'`

**Implementation Pattern:**

```typescript
// src/lib/services/map/droneDetection/index.ts
export { matchSignature, type SignatureMatch } from './signatureMatching';
export { identifyProtocol, type ProtocolResult } from './protocolIdentifier';
export { triangulatePosition } from './triangulation';
export { generateAlert, type DroneAlert } from './alertGenerator';
```

### 7.2 One File Per Commit

**Risk:** Large refactoring commits that are difficult to review, bisect, or revert.

**Mitigation:** Each Tier 1 and Tier 2 file decomposition is a single atomic commit.
Tier 3 files may be batched by directory (up to 3 files per commit) when the changes
are trivial extractions.

### 7.3 Test Coverage Gate

**Risk:** Decomposition introduces subtle import resolution bugs that pass type checking
but fail at runtime.

**Mitigation:** Before decomposing any file:

1. Run existing tests to establish baseline: `npm run test 2>&1 | tail -20`
2. After decomposition, re-run same tests. Zero regression tolerance.
3. If the file has no test coverage, add a minimal import-resolution test:

```typescript
// tests/unit/decomposition/{module}.test.ts
import { describe, it, expect } from 'vitest';
import * as module from '$lib/services/map/droneDetection';

describe('droneDetection barrel export', () => {
	it('exports all public symbols', () => {
		expect(module.matchSignature).toBeDefined();
		expect(module.identifyProtocol).toBeDefined();
		expect(module.triangulatePosition).toBeDefined();
		expect(module.generateAlert).toBeDefined();
	});
});
```

### 7.4 Handling Svelte Component Decomposition

**Risk:** Svelte components share reactive state via `$:` declarations, context API
(`setContext`/`getContext`), and slot forwarding. Naive extraction breaks reactivity.

**Mitigation:**

1. Props down, events up. Extracted child components receive data as props and emit
   changes via `createEventDispatcher()` or callback props.
2. Shared reactive state stays in the parent and is passed down. Do NOT create new
   stores for component-internal state.
3. Context API usage: if the parent uses `setContext`, all children that call
   `getContext` for the same key MUST remain in the same component tree.
4. Slot content: if the original component uses `<slot>`, the orchestrator parent
   retains the slot and passes content to the appropriate child.

### 7.5 Handling Service Singletons

**Risk:** Services using `globalThis` singleton pattern (per memory leak fixes) may
break if the module boundary changes.

**Mitigation:** The `globalThis` singleton guard MUST remain in the barrel `index.ts`,
not in submodules. Submodules export factory functions or classes. The barrel creates
and caches the singleton:

```typescript
// src/lib/services/map/droneDetection/index.ts
import { DroneDetectionService } from './service';

const GLOBAL_KEY = '__droneDetection__';

export function getDroneDetectionService(): DroneDetectionService {
	if (!(globalThis as any)[GLOBAL_KEY]) {
		(globalThis as any)[GLOBAL_KEY] = new DroneDetectionService();
	}
	return (globalThis as any)[GLOBAL_KEY];
}
```

### 7.6 Circular Dependency Prevention

**Risk:** Decomposing a large file into multiple smaller files in the same directory
can introduce circular imports when the extracted modules reference each other.

**Mitigation:**

1. Identify the dependency DAG BEFORE splitting. Draw which functions call which.
2. Types go in a dedicated `types.ts` file that has ZERO imports from sibling modules.
3. If A depends on B and B depends on A, introduce an interface in `types.ts` that
   both depend on, breaking the cycle.
4. Post-decomposition verification:

```bash
npx madge --circular src/lib/services/map/droneDetection/
# Must return: "No circular dependency found"
```

---

## 8. Success Criteria

This phase is COMPLETE when ALL of the following are true:

| #   | Criterion                                                               | Verification Command                                               |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Zero files >1,000 lines in `src/`                                       | `find src/ ... \| awk '$1 > 1000' \| wc -l` returns 0              |
| 2   | Zero files >500 lines except documented exceptions (Section 7 of 5.4.0) | `find src/ ... \| awk '$1 > 500' \| wc -l` returns 0 or exceptions |
| 3   | Files >300 lines reduced to <30                                         | `find src/ ... \| awk '$1 > 300' \| wc -l` returns <30             |
| 4   | `npx tsc --noEmit` returns zero errors                                  | `npx tsc --noEmit 2>&1 \| grep -c "error"` returns 0               |
| 5   | `npm run build` succeeds                                                | Exit code 0                                                        |
| 6   | `npm run test` passes with zero regressions                             | Same pass count as pre-execution baseline                          |
| 7   | All Tier 1 and Tier 2 files decomposed per plans                        | Manual review of commit history                                    |
| 8   | All barrel re-exports verified                                          | `grep` for old import paths returns zero matches                   |
| 9   | `npx madge --circular src/` reports zero new cycles                     | No new circular dependencies                                       |
| 10  | Every commit follows one-file-per-commit (T1/T2) or batch (T3)          | `git log --oneline` review                                         |

---

## 9. Naming Conventions for Extracted Modules

| Pattern                   | Convention                         | Example                                        |
| ------------------------- | ---------------------------------- | ---------------------------------------------- |
| Svelte subcomponent       | PascalCase matching parent prefix  | `KismetDashboardOverlay/DeviceTypeIcon.svelte` |
| TypeScript service module | camelCase matching function domain | `droneDetection/signatureMatching.ts`          |
| Types file                | `types.ts` in module directory     | `droneDetection/types.ts`                      |
| Barrel re-export          | `index.ts` in module directory     | `droneDetection/index.ts`                      |
| Pure data file            | descriptive camelCase              | `tools/rf-tools.ts`                            |
| Utility functions         | `{domain}Utils.ts`                 | `kismetOverlayUtils.ts`                        |
| Constants file            | `constants.ts` in module directory | `security_analyzer/constants.ts`               |

---

## 10. Dependency Graph Notation

Before decomposing any Tier 1 or Tier 2 file, draw the internal dependency graph using
this notation:

```
[Module A] --imports--> [Module B]
[Module A] --calls--> [Function C]
[Module A] --reads--> [Store D]
[Module A] --emits--> [Event E]
```

Verify the graph is a DAG (directed acyclic graph). If cycles exist, resolve them
BEFORE beginning extraction by introducing an interface in `types.ts`.

---

## 11. Revision History

| Version | Date       | Change                                                    |
| ------- | ---------- | --------------------------------------------------------- |
| 1.0     | 2026-02-08 | Initial decomposition from Phase 5.4 monolithic document. |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.13 -- File Size Enforcement: Execution Order and Final Verification
```
