# Phase 4.2.5: Replace Duplicates Batch 2 -- 4-Copy SpectrumData

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 5.3 (Unique Identifiers)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                    |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                          |
| **Task ID**      | 4.2.5                                                              |
| **Title**        | Replace Duplicates Batch 2 -- 4-Copy SpectrumData                  |
| **Status**       | PLANNED                                                            |
| **Risk Level**   | LOW (renames only, no deletions -- shapes are genuinely different) |
| **Duration**     | 20 minutes                                                         |
| **Dependencies** | Phase-4.2.3 (Semantic conflicts resolved)                          |
| **Blocks**       | None (batches are independently compilable)                        |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                  |
| **Commit**       | `refactor: deduplicate SpectrumData from 4 copies to 1`            |

---

## Objective

Resolve the 4-copy `SpectrumData` name collision. These are genuinely different shapes representing three distinct concepts. The resolution is to rename 3 of the 4 copies to descriptive names, keeping the server-side pipeline version as the canonical `SpectrumData`.

---

## Current State Assessment

| Metric                         | Value                                             |
| ------------------------------ | ------------------------------------------------- |
| Total SpectrumData definitions | 4                                                 |
| Canonical location             | `src/lib/server/hackrf/types.ts:38` (7 importers) |
| Renames required               | 3                                                 |
| Deletions required             | 0 (all shapes are different)                      |

### Current Locations and Shape Analysis

| #   | File                                           | Line | Shape                                 | Importers | New Name              |
| --- | ---------------------------------------------- | ---- | ------------------------------------- | --------- | --------------------- |
| 1   | `src/lib/server/hackrf/types.ts`               | 38   | Single-point with metadata, binData[] | 7         | `SpectrumData` (KEEP) |
| 2   | `src/lib/stores/hackrf.ts`                     | 5    | Array-based (frequencies[], power[])  | 0 (type)  | `SpectrumSnapshot`    |
| 3   | `src/lib/services/api/hackrf.ts`               | 48   | Array-based API response              | 1         | `SpectrumAPIResponse` |
| 4   | `src/lib/server/gnuradio/spectrum_analyzer.ts` | 4    | Minimal single-point (no metadata)    | 0         | `GNURadioSample`      |

### Resolution Rationale

These are three distinct concepts:

1. **`SpectrumData`** -- server-side single-point with metadata (keep at `server/hackrf/types.ts`)
2. **`SpectrumSnapshot`** -- client-side array format with centerFreq, sampleRate, binSize, sweepId, processed (rename `stores/hackrf.ts` copy)
3. **`SpectrumAPIResponse`** -- API response with centerFrequency, sampleRate arrays (rename `api/hackrf.ts` copy)
4. **`GNURadioSample`** -- minimal single-point measurement (rename `gnuradio` copy)

---

## Execution Steps

### Step 1: Rename in `src/lib/stores/hackrf.ts`

**File**: `src/lib/stores/hackrf.ts:5`

```typescript
// BEFORE:
export interface SpectrumData {
	frequencies: number[];
	power: number[];
	timestamp: number;
	centerFreq: number;
	sampleRate: number;
	binSize: number;
	sweepId?: string;
	processed?: boolean;
}

// AFTER:
export interface SpectrumSnapshot {
	frequencies: number[];
	power: number[];
	timestamp: number;
	centerFreq: number;
	sampleRate: number;
	binSize: number;
	sweepId?: string;
	processed?: boolean;
}
```

**Importer analysis**: No file imports `SpectrumData` by name from `stores/hackrf` (the store exports the writable store variable, not the type). The `spectrumData` store variable name stays the same -- its type annotation becomes `Writable<SpectrumSnapshot | null>`.

Update all internal references within `stores/hackrf.ts` from `SpectrumData` to `SpectrumSnapshot`.

### Step 2: Rename in `src/lib/services/api/hackrf.ts`

**File**: `src/lib/services/api/hackrf.ts:48`

```typescript
// BEFORE:
export interface SpectrumData { ... }

// AFTER:
export interface SpectrumAPIResponse { ... }
```

**Importer analysis**: 1 importer found -- `src/lib/components/hackrf/StatusDisplay.svelte:4`.

Update that import:

```typescript
// BEFORE (in StatusDisplay.svelte):
import type { SpectrumData } from '$lib/services/api/hackrf';

// AFTER:
import type { SpectrumAPIResponse } from '$lib/services/api/hackrf';
```

Update all references to `SpectrumData` within `StatusDisplay.svelte` to `SpectrumAPIResponse`.

### Step 3: Rename in `src/lib/server/gnuradio/spectrum_analyzer.ts`

**File**: `src/lib/server/gnuradio/spectrum_analyzer.ts:4`

```typescript
// BEFORE:
export interface SpectrumData { ... }

// AFTER:
export interface GNURadioSample { ... }
```

**Importer analysis**: 0 importers. Update all internal references within `spectrum_analyzer.ts` from `SpectrumData` to `GNURadioSample`.

---

## Verification

**Command 1 -- Exactly 1 SpectrumData definition**:

```bash
grep -rn "export.*interface SpectrumData\|export.*type SpectrumData" --include="*.ts" src/
```

**Expected**: Exactly 1 result in `src/lib/server/hackrf/types.ts`.

**Command 2 -- New names exist**:

```bash
grep -rn "SpectrumSnapshot" --include="*.ts" src/ | wc -l
grep -rn "SpectrumAPIResponse" --include="*.ts" --include="*.svelte" src/ | wc -l
grep -rn "GNURadioSample" --include="*.ts" src/ | wc -l
```

**Expected**: Each >= 1.

**Command 3 -- TypeScript compiles**:

```bash
npx tsc --noEmit 2>&1 | grep -i "spectrumdata\|spectrumsnapshot\|spectrumapi\|gnuradiosample" | head -10
```

**Expected**: 0 errors mentioning any spectrum-related type.

**Command 4 -- Full compilation**:

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected**: 0 errors.

**Command 5 -- StatusDisplay import updated**:

```bash
grep "SpectrumAPIResponse\|SpectrumData" src/lib/components/hackrf/StatusDisplay.svelte
```

**Expected**: Only `SpectrumAPIResponse` appears (no `SpectrumData`).

---

## Risk Assessment

| Risk                                            | Likelihood | Impact | Mitigation                                                           |
| ----------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------- |
| Store variable type annotation breaks           | LOW        | LOW    | `spectrumData` variable name unchanged; only type annotation changes |
| StatusDisplay.svelte import missed              | MEDIUM     | LOW    | Explicit update step included; compile catches if missed             |
| Other components reference SpectrumData by name | LOW        | LOW    | Grep verified only 1 importer from api/hackrf.ts                     |
| gnuradio internal usage of SpectrumData         | LOW        | LOW    | 0 importers; internal rename is self-contained                       |

### Medium Risk: SpectrumData renames

Renaming `SpectrumData` in `stores/hackrf.ts` to `SpectrumSnapshot` affects the type annotation of the `spectrumData` writable store. All subscribers access the store value, not the type name, so this is safe. The Svelte reactivity system works on store values, not type names.

---

## Rollback Strategy

### Per-file rollback

```bash
git checkout -- src/lib/stores/hackrf.ts
git checkout -- src/lib/services/api/hackrf.ts
git checkout -- src/lib/server/gnuradio/spectrum_analyzer.ts
git checkout -- src/lib/components/hackrf/StatusDisplay.svelte
```

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "deduplicate SpectrumData" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                         |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | `SpectrumData` now has exactly 1 canonical definition |
| MISRA Rule 5.3   | Unique Identifiers         | 3 distinct concepts given distinct names              |
| NASA/JPL Rule 15 | Single Point of Definition | Server pipeline type is the single `SpectrumData`     |
| BARR-C Rule 1.3  | No Duplicate Definitions   | Name collision eliminated via descriptive renames     |

---

## Cross-References

- **Depends on**: Phase-4.2.3 (Semantic Conflicts Resolved)
- **Blocks**: None (batches are independently compilable)
- **Related**: Phase-4.2.4 (Batch 1 -- KismetDevice), Phase-4.2.6 (Batch 3 -- 3-copy types)

---

## Execution Tracking

| Subtask | Description                                                 | Status  | Started | Completed | Verified By |
| ------- | ----------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.5.1 | Rename SpectrumData -> SpectrumSnapshot in stores/hackrf.ts | PENDING | --      | --        | --          |
| 4.2.5.2 | Rename SpectrumData -> SpectrumAPIResponse in api/hackrf.ts | PENDING | --      | --        | --          |
| 4.2.5.3 | Update StatusDisplay.svelte import                          | PENDING | --      | --        | --          |
| 4.2.5.4 | Rename SpectrumData -> GNURadioSample in gnuradio           | PENDING | --      | --        | --          |
| 4.2.5.5 | TypeScript compilation verification                         | PENDING | --      | --        | --          |
