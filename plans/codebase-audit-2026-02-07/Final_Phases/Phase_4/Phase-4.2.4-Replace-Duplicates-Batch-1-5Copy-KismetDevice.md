# Phase 4.2.4: Replace Duplicates Batch 1 -- 5-Copy KismetDevice

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL60-CPP (Obey One-Definition Rule), NASA/JPL Rule 15 (Single Point of Definition), BARR-C Rule 1.3 (No Duplicate Definitions), MISRA Rule 8.2 (Type Compatibility)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Phase**        | 4 -- Architecture Decomposition and Type Safety                    |
| **Sub-Phase**    | 4.2 -- Type Deduplication                                          |
| **Task ID**      | 4.2.4                                                              |
| **Title**        | Replace Duplicates Batch 1 -- 5-Copy KismetDevice                  |
| **Status**       | PLANNED                                                            |
| **Risk Level**   | MEDIUM (field merge across 5 different conventions)                |
| **Duration**     | 30 minutes                                                         |
| **Dependencies** | Phase-4.2.3 (Semantic conflicts resolved -- names are unambiguous) |
| **Blocks**       | None (batches are independently compilable)                        |
| **Branch**       | `agent/alex/phase-4.2-type-dedup`                                  |
| **Commit**       | `refactor: deduplicate KismetDevice from 5 copies to 1`            |

---

## Objective

Consolidate the 5 separate `KismetDevice` interface definitions into a single canonical definition at `src/lib/types/kismet.ts:1`. Merge superset fields from `server/kismet/types.ts:536` and `api/kismet.ts:25` into the canonical. Delete all 4 non-canonical copies.

---

## Current State Assessment

| Metric                         | Value                                            |
| ------------------------------ | ------------------------------------------------ |
| Total KismetDevice definitions | 5                                                |
| Canonical location             | `src/lib/types/kismet.ts:1` (13 importers)       |
| Definitions to delete          | 4                                                |
| Importers to update            | 1 (`integration-example.svelte`)                 |
| Field merge required           | YES (add optional fields from server/api copies) |

### Current Locations

| #   | File                                        | Line | Importers | Convention          | Action           |
| --- | ------------------------------------------- | ---- | --------- | ------------------- | ---------------- |
| 1   | `src/lib/types/kismet.ts`                   | 1    | 13        | camelCase           | KEEP (canonical) |
| 2   | `src/lib/types/signals.ts`                  | 84   | 0         | kismet dot-notation | DELETE           |
| 3   | `src/lib/services/api/kismet.ts`            | 25   | 0         | camelCase           | DELETE           |
| 4   | `src/lib/server/services/kismet.service.ts` | 7    | 0         | snake_case mix      | DELETE           |
| 5   | `src/lib/server/kismet/types.ts`            | 536  | 1         | camelCase           | DELETE           |

### Field Merge Details

Merge the following fields from non-canonical copies into the canonical `src/lib/types/kismet.ts:1` (add as optional fields):

From `server/kismet/types.ts:536`:

- `firstSeen?: number`
- `clients?: number`
- `probeRequests?: string[]`
- `macaddr?: string`

From `api/kismet.ts:25`:

- `gps?: { lat: number; lon: number; alt?: number }`

These fields are added as optional (`?`) to avoid breaking existing consumers that do not provide them.

---

## Execution Steps

### Step 1: Merge superset fields into canonical

**File**: `src/lib/types/kismet.ts:1`

Add the following optional fields to the existing `KismetDevice` interface (at the end of the interface body, before the closing `}`):

```typescript
	// Merged from server/kismet/types.ts:536
	firstSeen?: number;
	clients?: number;
	probeRequests?: string[];
	macaddr?: string;
	// Merged from api/kismet.ts:25
	gps?: { lat: number; lon: number; alt?: number };
```

### Step 2: Delete from `src/lib/types/signals.ts`

**Delete lines 84-108** (the `KismetDevice` interface that uses raw Kismet API dot-notation fields).

- Importers of `KismetDevice` from `types/signals.ts`: **0** (no file imports `KismetDevice` from this path)
- If any code references the dot-notation shape, rename to `RawKismetDevice` instead of deleting. Verify:

```bash
grep -rn "from.*types/signals.*KismetDevice" --include="*.ts" --include="*.svelte" src/
```

If 0 results: delete entirely.

### Step 3: Delete from `src/lib/services/api/kismet.ts`

**Delete lines 25-57** (the `KismetDevice` interface).

- Importers of `KismetDevice` from this file: **0** (only `KismetStatus` is imported from this file)
- Add import at top if internal usage within the file requires it:

```typescript
import type { KismetDevice } from '$lib/types/kismet';
```

### Step 4: Delete from `src/lib/server/services/kismet.service.ts`

**Delete lines 7-28** (the `KismetDevice` interface).

- Importers: **0** (file itself has 0 importers)
- Add import:

```typescript
import type { KismetDevice } from '$lib/types/kismet';
```

### Step 5: Delete from `src/lib/server/kismet/types.ts`

**Delete lines 536-560** (the `KismetDevice` interface).

- Importers of `KismetDevice` from this file: **1** (`integration-example.svelte`)
- Update `src/routes/tactical-map-simple/integration-example.svelte:9`:

```typescript
// BEFORE:
import type { KismetDevice } from '$lib/server/kismet/types';

// AFTER:
import type { KismetDevice } from '$lib/types/kismet';
```

---

## Verification

**Command 1 -- Exactly 1 definition remains**:

```bash
grep -rn "export.*interface KismetDevice" --include="*.ts" src/
```

**Expected**: Exactly 1 result in `src/lib/types/kismet.ts`.

**Command 2 -- TypeScript compiles**:

```bash
npx tsc --noEmit 2>&1 | grep -i "kismetdevice" | head -10
```

**Expected**: 0 errors mentioning KismetDevice.

**Command 3 -- Full compilation**:

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Expected**: 0 errors.

**Command 4 -- Merged fields present in canonical**:

```bash
grep -A 5 "firstSeen\|clients\|probeRequests\|macaddr\|gps" src/lib/types/kismet.ts | head -20
```

**Expected**: All merged fields appear in the canonical definition.

**Command 5 -- Import path updated in integration-example**:

```bash
grep "KismetDevice" src/routes/tactical-map-simple/integration-example.svelte
```

**Expected**: Import from `$lib/types/kismet`, NOT from `$lib/server/kismet/types`.

---

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                      |
| ------------------------------------------ | ---------- | ------ | --------------------------------------------------------------- |
| Field merge creates compile errors         | MEDIUM     | LOW    | All merged fields are optional (`?`); existing code unaffected  |
| Dot-notation KismetDevice still referenced | LOW        | LOW    | Grep verified 0 importers of KismetDevice from types/signals.ts |
| kismet.service.ts internal usage           | LOW        | LOW    | File has 0 importers; add import for internal safety            |
| integration-example.svelte import breaks   | MEDIUM     | LOW    | Explicit import path update included in execution steps         |

### Medium Risk: KismetDevice canonical merge

Merging 5 different field sets into one interface may cause some fields to become optional that were previously required. This is safe because all existing code already handles optional fields via `?.` access. The canonical `types/kismet.ts` version is already the most widely imported (13 files), so no consumer code needs to change -- only the 1 importer from `server/kismet/types.ts` needs a path update.

---

## Rollback Strategy

### Per-file rollback

```bash
git checkout -- src/lib/types/kismet.ts
git checkout -- src/lib/types/signals.ts
git checkout -- src/lib/services/api/kismet.ts
git checkout -- src/lib/server/services/kismet.service.ts
git checkout -- src/lib/server/kismet/types.ts
git checkout -- src/routes/tactical-map-simple/integration-example.svelte
```

### Full task rollback

```bash
git revert <commit-hash>  # Revert the "deduplicate KismetDevice" commit
```

---

## Standards Traceability

| Standard         | Rule                       | Applicability                                         |
| ---------------- | -------------------------- | ----------------------------------------------------- |
| CERT DCL60-CPP   | Obey One-Definition Rule   | KismetDevice reduced from 5 definitions to 1          |
| NASA/JPL Rule 15 | Single Point of Definition | `src/lib/types/kismet.ts` is sole definition point    |
| BARR-C Rule 1.3  | No Duplicate Definitions   | 4 duplicate definitions removed                       |
| MISRA Rule 8.2   | Type Compatibility         | Optional field merge preserves backward compatibility |

---

## Cross-References

- **Depends on**: Phase-4.2.3 (Semantic Conflicts Resolved)
- **Blocks**: None (batches are independently compilable)
- **Related**: Phase-4.2.5 (Batch 2 -- SpectrumData), Phase-4.2.6 (Batch 3 -- 3-copy types including KismetStatus)

---

## Execution Tracking

| Subtask | Description                                        | Status  | Started | Completed | Verified By |
| ------- | -------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 4.2.4.1 | Merge superset fields into canonical kismet.ts     | PENDING | --      | --        | --          |
| 4.2.4.2 | Delete from types/signals.ts (lines 84-108)        | PENDING | --      | --        | --          |
| 4.2.4.3 | Delete from api/kismet.ts (lines 25-57)            | PENDING | --      | --        | --          |
| 4.2.4.4 | Delete from kismet.service.ts (lines 7-28)         | PENDING | --      | --        | --          |
| 4.2.4.5 | Delete from server/kismet/types.ts (lines 536-560) | PENDING | --      | --        | --          |
| 4.2.4.6 | Update integration-example.svelte import path      | PENDING | --      | --        | --          |
| 4.2.4.7 | TypeScript compilation verification                | PENDING | --      | --        | --          |
