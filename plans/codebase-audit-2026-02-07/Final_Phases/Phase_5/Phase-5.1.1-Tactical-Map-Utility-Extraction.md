# Phase 5.1.1 -- Tactical Map: Extract Lookup Tables and Utilities

| Field             | Value                                                 |
| ----------------- | ----------------------------------------------------- |
| **Phase**         | 5.1.1                                                 |
| **Title**         | Tactical Map: Extract Lookup Tables and Utilities     |
| **Risk Level**    | LOW                                                   |
| **Prerequisites** | Phase 4 complete, Phase 5.1.0 assessment verified     |
| **Files Touched** | 2 (1 modified, 1 created)                             |
| **Standards**     | MISRA C:2023 Rule 1.1, NASA/JPL Rule 14, Barr C Ch. 8 |
| **Audit Date**    | 2026-02-08                                            |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect   |

---

## 1. Objective

Extract 6 pure utility functions and 1 constant object from the tactical-map-simple
god page into a new service module. These functions have zero side effects, zero
dependency on component state, accept primitive inputs and return primitive outputs.
This is the simplest extraction and validates the extraction workflow before
touching stateful logic.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

| Function/Constant                                    | Location    | Lines | Side Effects | State Deps |
| ---------------------------------------------------- | ----------- | ----- | ------------ | ---------- |
| `signalBands` constant object                        | L280-L293   | ~14   | None         | None       |
| `getSignalColor(power: number): string`              | L822-L831   | 10    | None         | None       |
| `getSignalBandKey(rssi: number): string`             | L294-L301   | 8     | None         | None       |
| `formatDeviceLastSeen(device: KismetDevice): string` | L302-L311   | 10    | None         | None       |
| `getMncCarrier(mccMnc: string): string`              | L591-L605   | 15    | None         | None       |
| `calculateSignalPosition(signalStrength, index)`     | L1321-L1335 | 15    | None         | None       |

**Total lines to extract**: ~72

**All functions are under 60 LOC. No further splitting required.**

---

## 3. Implementation Steps

### Step 1: Create the Target File

Create `src/lib/services/tactical-map/utils.ts`.

Ensure the directory `src/lib/services/tactical-map/` exists:

```bash
mkdir -p src/lib/services/tactical-map/
```

### Step 2: Extract and Export Functions

Move the following from `+page.svelte` to `utils.ts`:

```typescript
// src/lib/services/tactical-map/utils.ts

import type { KismetDevice } from '$lib/types/kismet'; // adjust import path as needed

export const signalBands = {
	// ... (L280-L293 content from +page.svelte)
};

export function getSignalColor(power: number): string {
	// ... (L822-L831 content from +page.svelte)
}

export function getSignalBandKey(rssi: number): string {
	// ... (L294-L301 content from +page.svelte)
}

export function formatDeviceLastSeen(device: KismetDevice): string {
	// ... (L302-L311 content from +page.svelte)
}

export function getMncCarrier(mccMnc: string): string {
	// ... (L591-L605 content from +page.svelte)
}

export function calculateSignalPosition(
	signalStrength: number,
	index: number
): { x: number; y: number } {
	// ... (L1321-L1335 content from +page.svelte)
}
```

### Step 3: Update the God Page

1. Remove the function/constant definitions from `+page.svelte`
2. Add import statement at the top of the `<script>` block:

```typescript
import {
	signalBands,
	getSignalColor,
	getSignalBandKey,
	formatDeviceLastSeen,
	getMncCarrier,
	calculateSignalPosition
} from '$lib/services/tactical-map/utils';
```

3. Verify all call sites still reference these functions by their original names
   (no renaming required since we are exporting with the same names)

### Step 4: Type Check and Build

```bash
npm run typecheck
npm run build
```

---

## 4. Verification Commands

```bash
# After extraction:
grep -c 'getSignalColor\|getSignalBandKey\|formatDeviceLastSeen\|getMncCarrier\|calculateSignalPosition' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0 function definitions, N import references
# (grep will match import line and call sites, but NOT function definitions)

# Verify function definitions are NOT in the page (search for 'function <name>'):
grep -c 'function getSignalColor\|function getSignalBandKey\|function formatDeviceLastSeen\|function getMncCarrier\|function calculateSignalPosition' \
  src/routes/tactical-map-simple/+page.svelte
# Expected: 0

# Verify exports exist in new file:
grep -c 'export function\|export const signalBands' src/lib/services/tactical-map/utils.ts
# Expected: 6

# Verify import exists in page:
grep 'tactical-map/utils' src/routes/tactical-map-simple/+page.svelte
# Expected: 1 match (import line)

# Build verification:
npm run typecheck
# Expected: 0 errors

npm run build
# Expected: 0 errors
```

---

## 5. Risk Assessment

| Risk                                   | Severity | Likelihood | Mitigation                                        |
| -------------------------------------- | -------- | ---------- | ------------------------------------------------- |
| Function signature mismatch after move | LOW      | LOW        | TypeScript typecheck catches immediately          |
| Missing call sites in template section | LOW      | LOW        | Build will fail if template references are broken |
| Import path typo                       | LOW      | MEDIUM     | TypeScript import resolution catches at typecheck |

**Overall risk**: LOW. These are pure functions with no state, no DOM interaction,
and no async behavior. The extraction is a straightforward cut-and-paste with
import wiring.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                                 |
| --------------------- | ------------------------------------- | -------------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | All extracted TypeScript passes `npm run typecheck`            |
| NASA/JPL Rule 14      | Minimize function complexity          | Pure functions extracted to dedicated utility module           |
| Barr C Ch. 8          | Each module shall have a header       | `utils.ts` exports typed public interface with 6 named exports |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/lib/services/tactical-map/utils.ts
# If directory is empty after removal:
rmdir src/lib/services/tactical-map/ 2>/dev/null
```

Single commit, single revert. No cascading dependencies on this step.

---

_Phase 5.1.1 -- Tactical Map: Extract Lookup Tables and Utilities_
_Execution priority: 5 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -72 lines from god page_
