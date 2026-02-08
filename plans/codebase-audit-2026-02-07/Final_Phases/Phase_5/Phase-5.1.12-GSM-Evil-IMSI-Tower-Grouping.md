# Phase 5.1.12 -- GSM Evil: Extract IMSI Tower Grouping

| Field             | Value                                                                   |
| ----------------- | ----------------------------------------------------------------------- |
| **Phase**         | 5.1.12                                                                  |
| **Title**         | GSM Evil: Extract IMSI Tower Grouping                                   |
| **Risk Level**    | LOW                                                                     |
| **Prerequisites** | Phase 5.1.10 complete (lookup tables available for import)              |
| **Files Touched** | 2 (1 modified, 1 created)                                               |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 15, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                                              |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect                     |

---

## 1. Objective

Extract the `groupIMSIsByTower` function (74 lines) from the GSM Evil god page into
a dedicated service module. This function EXCEEDS the 60-LOC NASA/JPL Rule 15 limit
and must be split into a classifier function and an orchestrator.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Function              | Location  | Lines | Side Effects | >60 LOC? |
| --------------------- | --------- | ----- | ------------ | -------- |
| `groupIMSIsByTower()` | L892-L965 | 74    | None (pure)  | **YES**  |

**Total lines to extract**: 74

---

## 3. Decomposition of groupIMSIsByTower (74 lines)

The function groups captured IMSI records by their serving tower and classifies each
tower's status (fake/suspicious/unknown/legitimate).

**Split into 2 functions**:

**Function 1**: `classifyTowerStatus(mcc: string, carrier: string): { status: string; symbol: string }`

- Pure function, determines if a tower is fake/suspicious/unknown/ok (~20 lines)
- Classification criteria based on MCC/carrier validity

**Function 2**: `groupIMSIsByTower(imsis: CapturedIMSI[], lookupCarrier, lookupCountry, towerLocations): TowerGroup[]`

- Orchestrator using the classifier (~45 lines)
- Groups IMSIs by tower ID, applies classification, returns structured results

**Post-split max function length**: ~45 lines

---

## 4. Implementation Steps

### Step 1: Create the Service File

Create `src/lib/services/gsm-evil/towerGrouper.ts`:

```typescript
// src/lib/services/gsm-evil/towerGrouper.ts

import { lookupCarrier, lookupCountry } from '$lib/data/gsm-lookup-tables';

// --- Types ---

interface CapturedIMSI {
	imsi: string;
	mcc: string;
	mnc: string;
	lac: string;
	cellId: string;
	timestamp: string;
	// ... additional fields
}

interface TowerGroup {
	towerId: string;
	mcc: string;
	mnc: string;
	carrier: string;
	country: { name: string; flag: string; code: string };
	status: { status: string; symbol: string };
	imsis: CapturedIMSI[];
}

// --- Pure functions ---

export function classifyTowerStatus(
	mcc: string,
	carrier: string
): { status: string; symbol: string } {
	// Determine tower legitimacy based on MCC/carrier (~20 lines)
	// Returns { status: 'fake'|'suspicious'|'unknown'|'legitimate', symbol: emoji/icon }
}

export function groupIMSIsByTower(
	imsis: CapturedIMSI[],
	towerLocations?: Map<string, { lat: number; lon: number }>
): TowerGroup[] {
	// Group IMSIs by tower, apply classification (~45 lines)
	// Uses lookupCarrier and lookupCountry from gsm-lookup-tables
}
```

### Step 2: Update the God Page

1. Remove `groupIMSIsByTower()` (L892-L965)
2. Add import:

```typescript
import { groupIMSIsByTower } from '$lib/services/gsm-evil/towerGrouper';
```

3. Update call sites (the function name is preserved, so only import wiring is needed)

### Step 3: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 5. Verification Commands

```bash
# Verify function definition removed from god page:
grep -c 'function groupIMSIsByTower' src/routes/gsm-evil/+page.svelte
# Expected: 0

# Verify service file exists with expected size:
wc -l src/lib/services/gsm-evil/towerGrouper.ts
# Expected: ~90

# Verify no function exceeds 60 LOC:
python3 scripts/audit-function-sizes-v2.py src/lib/services/gsm-evil/towerGrouper.ts
# Expected: 0 functions >60 LOC

# Verify import wired:
grep 'towerGrouper' src/routes/gsm-evil/+page.svelte
# Expected: >= 1 match

# Build verification:
npm run typecheck
npm run build
```

---

## 6. Risk Assessment

| Risk                                | Severity | Likelihood | Mitigation                                      |
| ----------------------------------- | -------- | ---------- | ----------------------------------------------- |
| Tower classification logic error    | MEDIUM   | LOW        | Logic is a direct extraction, no transformation |
| Import path for lookup tables wrong | LOW      | LOW        | TypeScript catches at typecheck                 |
| CapturedIMSI type shape mismatch    | LOW      | LOW        | Define interface based on actual API response   |

**Overall risk**: LOW. This is a pure function extraction. The function has no side
effects, no state dependencies, and no async behavior.

---

## 7. Standards Compliance

| Standard              | Requirement                                | How This Sub-Task Satisfies It                                        |
| --------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax      | All extracted TypeScript passes `npm run typecheck`                   |
| NASA/JPL Rule 15      | Functions shall be no longer than 60 lines | 74-line function split into 20-line classifier + 45-line orchestrator |
| NASA/JPL Rule 14      | Minimize function complexity               | Classification logic separated from grouping logic                    |
| Barr C Ch. 8          | Each module shall have a header            | `towerGrouper.ts` exports typed public interface                      |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -f src/lib/services/gsm-evil/towerGrouper.ts
```

Single commit, single revert.

---

_Phase 5.1.12 -- GSM Evil: Extract IMSI Tower Grouping_
_Execution priority: 7 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -74 lines from god page_
