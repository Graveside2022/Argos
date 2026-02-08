# Phase 5.1.13 -- GSM Evil: Extract Data Fetchers

| Field             | Value                                               |
| ----------------- | --------------------------------------------------- |
| **Phase**         | 5.1.13                                              |
| **Title**         | GSM Evil: Extract Data Fetchers                     |
| **Risk Level**    | LOW                                                 |
| **Prerequisites** | Phase 5.1.10 complete (lookup tables extracted)     |
| **Files Touched** | 2 (1 modified, 1 created)                           |
| **Standards**     | MISRA C:2023 Rule 1.1, CERT C ERR00-C, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                          |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect |

---

## 1. Objective

Extract 3 data fetcher functions from the GSM Evil god page into a dedicated service
module. All functions are under 60 LOC and do not require further decomposition.
They are straightforward API call wrappers.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Function            | Location    | Lines | Side Effects | >60 LOC? |
| ------------------- | ----------- | ----- | ------------ | -------- |
| `fetchRealFrames()` | L1263-L1292 | 30    | API call     | No       |
| `checkActivity()`   | L1293-L1310 | 18    | API call     | No       |
| `fetchIMSIs()`      | L1311-L1324 | 14    | API call     | No       |

**Total lines to extract**: 62

---

## 3. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/gsm-evil/dataFetchers.ts`:

```typescript
// src/lib/services/gsm-evil/dataFetchers.ts

interface RealFrame {
	// ... frame data shape from API response
}

interface ActivityStatus {
	// ... activity check response shape
}

interface CapturedIMSI {
	// ... IMSI data shape (shared with towerGrouper.ts)
}

export async function fetchRealFrames(): Promise<RealFrame[]> {
	// Extracted from L1263-L1292 (~30 lines)
	// Fetches GSM frame data from /api/gsm-evil/frames endpoint
}

export async function checkActivity(): Promise<ActivityStatus> {
	// Extracted from L1293-L1310 (~18 lines)
	// Checks if GSM Evil is actively scanning/capturing
}

export async function fetchIMSIs(): Promise<CapturedIMSI[]> {
	// Extracted from L1311-L1324 (~14 lines)
	// Fetches captured IMSI records
}
```

### Step 2: Update the God Page

1. Remove `fetchRealFrames()`, `checkActivity()`, `fetchIMSIs()` from `+page.svelte`
2. Add import:

```typescript
import { fetchRealFrames, checkActivity, fetchIMSIs } from '$lib/services/gsm-evil/dataFetchers';
```

3. All call sites use the same function names -- no renaming required

### Step 3: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# Verify function definitions removed from god page:
grep -c 'function fetchRealFrames\|function checkActivity\|function fetchIMSIs' \
  src/routes/gsm-evil/+page.svelte
# Expected: 0

# Verify service file exists:
wc -l src/lib/services/gsm-evil/dataFetchers.ts
# Expected: ~80 (including types and imports)

# Verify import wired:
grep 'dataFetchers' src/routes/gsm-evil/+page.svelte
# Expected: >= 1 match

# Build verification:
npm run typecheck
npm run build
```

---

## 5. Risk Assessment

| Risk                           | Severity | Likelihood | Mitigation                                      |
| ------------------------------ | -------- | ---------- | ----------------------------------------------- |
| API response type mismatch     | LOW      | LOW        | Define types based on actual API response shape |
| Error handling behavior change | LOW      | LOW        | Preserve try/catch structure from original      |
| CapturedIMSI type duplication  | LOW      | MEDIUM     | Share type definition with towerGrouper.ts      |

**Overall risk**: LOW. These are simple API call wrappers. Each is under 60 LOC.
No decomposition required. The extraction is a direct cut-and-paste.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                             |
| --------------------- | ------------------------------------- | ---------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | All TypeScript passes `npm run typecheck`                  |
| CERT C ERR00-C        | Adopt consistent error handling       | Each fetcher preserves its original error handling pattern |
| Barr C Ch. 8          | Each module shall have a header       | `dataFetchers.ts` exports 3 typed async functions          |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -f src/lib/services/gsm-evil/dataFetchers.ts
```

Single commit, single revert.

---

_Phase 5.1.13 -- GSM Evil: Extract Data Fetchers_
_Execution priority: 8 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -62 lines from god page_
