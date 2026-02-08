# Phase 5.1.10 -- GSM Evil: Extract Lookup Tables

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| **Phase**         | 5.1.10                                                |
| **Title**         | GSM Evil: Extract Lookup Tables                       |
| **Risk Level**    | ZERO                                                  |
| **Prerequisites** | None (can execute independently)                      |
| **Files Touched** | 2 (1 modified, 1 created)                             |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect   |

---

## 1. Objective

Extract 786 lines of static lookup tables (30.3% of the entire GSM Evil god page)
into a dedicated data module. These tables are pure data with no behavior, no state
dependencies, and no imports. This is the lowest-risk extraction possible. The data
module can also be reused by `tactical-map-simple` (which has a smaller `getMncCarrier`
table) and any future GSM-related pages.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Data Table     | Location  | Lines   | Content                               |
| -------------- | --------- | ------- | ------------------------------------- |
| `mncToCarrier` | L70-L628  | 559     | MCC-MNC to carrier name mapping       |
| `mccToCountry` | L631-L855 | 225     | MCC to country name/flag/code mapping |
| **Total**      |           | **786** | 30.3% of the file                     |

---

## 3. Implementation Steps

### Step 1: Create the Data Module

Create `src/lib/data/gsm-lookup-tables.ts`:

```typescript
// src/lib/data/gsm-lookup-tables.ts
// GSM Mobile Network Code (MNC) and Mobile Country Code (MCC) lookup tables
// Used by gsm-evil and tactical-map-simple pages

export const mncToCarrier: Record<string, string> = {
	// ... entire table from L70-L628 (559 lines)
};

export const mccToCountry: Record<string, { name: string; flag: string; code: string }> = {
	// ... entire table from L631-L855 (225 lines)
};

export function lookupCarrier(mcc: string, mnc: string): string {
	const key = `${mcc}-${mnc.padStart(2, '0')}`;
	return mncToCarrier[key] || 'Unknown';
}

export function lookupCountry(mcc: string): { name: string; flag: string; code: string } {
	return mccToCountry[mcc] || { name: 'Unknown', flag: '', code: '??' };
}
```

### Step 2: Update the GSM Evil Page

1. Remove the `mncToCarrier` table definition (L70-L628)
2. Remove the `mccToCountry` table definition (L631-L855)
3. Add import at the top of the `<script>` block:

```typescript
import {
	mncToCarrier,
	mccToCountry,
	lookupCarrier,
	lookupCountry
} from '$lib/data/gsm-lookup-tables';
```

4. Replace any inline lookup logic with the new `lookupCarrier` and `lookupCountry`
   helper functions where applicable

### Step 3: Evaluate Cross-Page Reuse

The tactical-map-simple page has a smaller `getMncCarrier` function (extracted to
`utils.ts` in Phase 5.1.1). Consider updating that function to import from
`gsm-lookup-tables.ts` instead of maintaining a separate smaller table. This
deduplication is optional and can be deferred.

---

## 4. Verification Commands

```bash
# Verify table definitions removed from god page:
grep -c 'mncToCarrier\|mccToCountry' src/routes/gsm-evil/+page.svelte
# Expected: only import lines, no table definitions

# Verify data module exists with correct size:
wc -l src/lib/data/gsm-lookup-tables.ts
# Expected: ~800

# Verify exports:
grep -c 'export const\|export function' src/lib/data/gsm-lookup-tables.ts
# Expected: 4 (mncToCarrier, mccToCountry, lookupCarrier, lookupCountry)

# Verify god page imports from data module:
grep 'gsm-lookup-tables' src/routes/gsm-evil/+page.svelte
# Expected: 1 match (import line)

# Build verification:
npm run typecheck
npm run build
# Expected: 0 errors
```

---

## 5. Risk Assessment

| Risk                              | Severity | Likelihood | Mitigation                                       |
| --------------------------------- | -------- | ---------- | ------------------------------------------------ |
| Table data corruption during copy | LOW      | LOW        | Direct cut-paste; no transformation needed       |
| Import path typo                  | LOW      | LOW        | TypeScript import resolution catches immediately |
| Table key format mismatch         | LOW      | LOW        | Lookup functions validate key format             |

**Overall risk**: ZERO. These are static data tables with no behavior. The extraction
is a pure cut-and-paste operation with import wiring.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                                |
| --------------------- | ------------------------------------- | ------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | TypeScript passes typecheck                                   |
| NASA/JPL Rule 14      | Minimize function complexity          | Data separated from logic into dedicated module               |
| Barr C Ch. 8          | Each module shall have a header       | `gsm-lookup-tables.ts` exports typed interface with 4 exports |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -f src/lib/data/gsm-lookup-tables.ts
# If directory is empty:
rmdir src/lib/data/ 2>/dev/null
```

Instant revert. Zero cascading dependencies.

---

_Phase 5.1.10 -- GSM Evil: Extract Lookup Tables_
_Execution priority: 2 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -786 lines from god page_
