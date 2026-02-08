# Phase 4.2.1: Create Sweep-Manager Shared Types for HackRF/USRP

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 8.2 (Type Compatibility)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                       |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                             |
| **Task ID**      | 4.2.1                                                                 |
| **Title**        | Create Sweep-Manager Shared Types for HackRF/USRP                     |
| **Status**       | PLANNED                                                               |
| **Risk Level**   | LOW (type-only extraction, compile-time verified)                     |
| **Duration**     | 20 minutes                                                            |
| **Dependencies** | Phase-4.2.0 (Audit Divergent Fields -- reference document)            |
| **Blocks**       | Phase-4.2.2 (Canonical Type Barrel references sweep-manager/types.ts) |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                     |
| **Commit**       | `refactor: extract shared sweep-manager types for HackRF/USRP`        |

---

## Objective

Extract the 5 identical HackRF/USRP type definitions (ProcessState, ProcessConfig, BufferState, BufferConfig, ParsedLine) into a single shared file at `src/lib/services/sweep-manager/types.ts`. Update all 4 consumer files to import from the shared location.

---

## Current State Assessment

| Metric                | Value                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Duplicate types       | 5 (ProcessState, ProcessConfig, BufferState, BufferConfig, ParsedLine) |
| Copy count per type   | 2 (HackRF copy + USRP copy)                                            |
| Total lines to delete | ~44 (definitions in 4 files)                                           |
| Files to modify       | 4 (2 ProcessManagers + 2 BufferManagers)                               |
| Files to create       | 1 (`src/lib/services/sweep-manager/types.ts`)                          |
| Field divergence      | NONE (all copies are field-for-field identical)                        |

### Source Locations (current duplicates)

| Type          | HackRF Location                                                      | USRP Location                                                      |
| ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| ProcessState  | `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts:6`  | `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts:4`  |
| ProcessConfig | `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts:13` | `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts:11` |
| BufferState   | `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:4`    | `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:4`    |
| BufferConfig  | `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:12`   | `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:12`   |
| ParsedLine    | `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts:18`   | `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts:18`   |

---

## Execution Steps

### Step 1: Create `src/lib/services/sweep-manager/types.ts`

Create the directory `src/lib/services/sweep-manager/` if it does not exist, then create the file with the following exact content:

```typescript
// src/lib/services/sweep-manager/types.ts
// Shared types for HackRF and USRP sweep manager implementations.

import type { ChildProcess } from 'node:child_process';
import type { SpectrumData } from '$lib/server/hackrf/types';

export interface ProcessState {
	sweepProcess: ChildProcess | null;
	sweepProcessPgid: number | null;
	actualProcessPid: number | null;
	processStartTime: number | null;
}

export interface ProcessConfig {
	detached: boolean;
	stdio: ('pipe' | 'inherit' | 'ignore')[];
	timeout?: number;
	startupTimeoutMs?: number;
}

export interface BufferState {
	stdoutBuffer: string;
	maxBufferSize: number;
	bufferOverflowCount: number;
	lineCount: number;
	totalBytesProcessed: number;
}

export interface BufferConfig {
	maxBufferSize?: number;
	maxLineLength?: number;
	overflowThreshold?: number;
}

export interface ParsedLine {
	data: SpectrumData | null;
	isValid: boolean;
	rawLine: string;
	parseError?: string;
}
```

### Step 2: Update HackRF ProcessManager

**File**: `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts`

**Delete lines 6-18** (ProcessState and ProcessConfig interface definitions).

**Add import** at top of file (after existing imports):

```typescript
import type { ProcessState, ProcessConfig } from '$lib/services/sweep-manager/types';
```

### Step 3: Update USRP ProcessManager

**File**: `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`

**Delete lines 4-18** (ProcessState and ProcessConfig interface definitions).

**Add import** at top of file (after existing imports):

```typescript
import type { ProcessState, ProcessConfig } from '$lib/services/sweep-manager/types';
```

### Step 4: Update HackRF BufferManager

**File**: `src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts`

**Delete lines 4-25** (BufferState, BufferConfig, and ParsedLine interface definitions).

**Add import** at top of file (after existing imports):

```typescript
import type { BufferState, BufferConfig, ParsedLine } from '$lib/services/sweep-manager/types';
```

### Step 5: Update USRP BufferManager

**File**: `src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts`

**Delete lines 4-25** (BufferState, BufferConfig, and ParsedLine interface definitions).

**Add import** at top of file (after existing imports):

```typescript
import type { BufferState, BufferConfig, ParsedLine } from '$lib/services/sweep-manager/types';
```

---

## Verification

**Command 1 -- File created**:

```bash
test -f src/lib/services/sweep-manager/types.ts && echo "EXISTS" || echo "MISSING"
```

**Expected**: `EXISTS`

**Command 2 -- TypeScript compiles**:

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected**: 0 errors from sweep-manager files.

**Command 3 -- Exactly 1 definition per type**:

```bash
for type in ProcessState ProcessConfig BufferState BufferConfig ParsedLine; do
  count=$(grep -rn "export.*interface ${type} " --include="*.ts" src/ | wc -l)
  echo "${type}: ${count} definitions (expected 1)"
done
```

**Expected**: Each type shows exactly 1 definition (in `sweep-manager/types.ts`).

**Command 4 -- No leftover definitions in consumer files**:

```bash
grep -n "export interface ProcessState\|export interface ProcessConfig\|export interface BufferState\|export interface BufferConfig\|export interface ParsedLine" \
  src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts \
  src/lib/services/usrp/sweep-manager/process/ProcessManager.ts \
  src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts \
  src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts
```

**Expected**: 0 results.

**Command 5 -- Imports added**:

```bash
grep -n "from.*sweep-manager/types" \
  src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts \
  src/lib/services/usrp/sweep-manager/process/ProcessManager.ts \
  src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts \
  src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts
```

**Expected**: 4 results (one per file).

---

## Risk Assessment

| Risk                                    | Likelihood | Impact | Mitigation                                                       |
| --------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| Import path resolution fails            | LOW        | LOW    | `$lib/services/` is a standard SvelteKit alias; compile verifies |
| Field mismatch between HackRF/USRP copy | NONE       | --     | Verified identical in Phase-4.2.0 audit                          |
| SpectrumData import in shared types     | LOW        | LOW    | `$lib/server/hackrf/types` is already a stable import path       |

---

## Rollback Strategy

### Per-file rollback

```bash
git checkout -- src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts
git checkout -- src/lib/services/usrp/sweep-manager/process/ProcessManager.ts
git checkout -- src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts
git checkout -- src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts
rm -f src/lib/services/sweep-manager/types.ts
rmdir src/lib/services/sweep-manager/ 2>/dev/null
```

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "extract shared sweep-manager types" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                     |
| ---------------- | -------------------------- | ------------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | 5 types consolidated from 2 definitions each to 1 |
| NASA/JPL Rule 15 | Single Point of Definition | All sweep-manager types defined in one file       |
| BARR-C Rule 1.3  | No Duplicate Definitions   | HackRF/USRP copies eliminated                     |
| MISRA Rule 8.2   | Type Compatibility         | All copies verified field-identical before merge  |

---

## Cross-References

- **Depends on**: Phase-4.2.0 (Audit Divergent Fields)
- **Blocks**: Phase-4.2.2 (Canonical Type Barrel references `sweep-manager/types.ts`)
- **Related**: Phase-4.2.4 through Phase-4.2.7 (other duplicate replacement batches)

---

## Execution Tracking

| Subtask | Description                          | Status  | Started | Completed | Verified By |
| ------- | ------------------------------------ | ------- | ------- | --------- | ----------- |
| 4.2.1.1 | Create sweep-manager/types.ts        | PENDING | --      | --        | --          |
| 4.2.1.2 | Update HackRF ProcessManager imports | PENDING | --      | --        | --          |
| 4.2.1.3 | Update USRP ProcessManager imports   | PENDING | --      | --        | --          |
| 4.2.1.4 | Update HackRF BufferManager imports  | PENDING | --      | --        | --          |
| 4.2.1.5 | Update USRP BufferManager imports    | PENDING | --      | --        | --          |
| 4.2.1.6 | TypeScript compilation verification  | PENDING | --      | --        | --          |
