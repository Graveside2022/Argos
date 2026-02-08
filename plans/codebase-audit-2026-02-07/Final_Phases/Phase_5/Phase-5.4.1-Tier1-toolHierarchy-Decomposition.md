# Phase 5.4.1 -- Tier 1: toolHierarchy.ts Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.1-TOOLHIERARCHY
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.1 -- Decompose toolHierarchy.ts (1,502 lines)
Risk Level:     LOW
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 8 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                               |
| --------------- | ----------------------------------- |
| Path            | `src/lib/data/toolHierarchy.ts`     |
| Current Lines   | 1,502                               |
| Tier            | 1 (>1,000 lines, unconditional)     |
| Execution Order | 1 of 7 (first Tier 1 decomposition) |

---

## 2. Content Analysis

Pure declarative data file. Contains a hierarchical tree structure defining all tool
categories, tool definitions, metadata, icons, and navigation paths. Zero business logic.
Zero functions exceeding 60 lines (the entire file is a single exported constant).

**Why It Exceeds Threshold:**
Single monolithic data structure. Every tool category (RF, WiFi, GSM, drone, etc.) is
defined inline within one object literal.

**Key Observation:** This file contains NO logic branches, NO functions, and NO imports
of business logic. It is a pure data definition. Post-split, the OUI database fragment
(`oui-database.ts`) at ~420 lines is documented as an exception in Phase 5.4.0 Section 7
because pure data files without branching logic are exempt from the 500-line hard limit.

---

## 3. Decomposition Strategy

Split by top-level category into individual data modules. Create a barrel `index.ts` that
re-assembles the full hierarchy at import time via spread operator.

**Rationale:** Each tool category (RF, WiFi, GSM, drone, network, system) is an
independently-scoped data block with no cross-references. The split is purely structural.

---

## 4. New File Manifest

| New File                              | Content                                    | Est. Lines |
| ------------------------------------- | ------------------------------------------ | ---------- |
| `src/lib/data/tools/index.ts`         | Barrel re-export, assembles full hierarchy | ~40        |
| `src/lib/data/tools/rf-tools.ts`      | HackRF, USRP, RTL-SDR, spectrum tools      | ~200       |
| `src/lib/data/tools/wifi-tools.ts`    | Kismet, Bettercap, WiFi analysis tools     | ~200       |
| `src/lib/data/tools/gsm-tools.ts`     | GSM Evil, grgsm, cellular tools            | ~150       |
| `src/lib/data/tools/drone-tools.ts`   | DroneID, flight path, detection tools      | ~150       |
| `src/lib/data/tools/network-tools.ts` | Wireshark, packet analysis tools           | ~150       |
| `src/lib/data/tools/system-tools.ts`  | System health, monitoring, agent tools     | ~150       |
| `src/lib/data/tools/types.ts`         | ToolCategory, ToolDefinition interfaces    | ~60        |

**Total target files:** 8
**Maximum file size:** ~200 lines (rf-tools.ts, wifi-tools.ts)
**Original file disposition:** Deleted after migration complete

---

## 5. Barrel Re-Export Pattern

```typescript
// src/lib/data/tools/index.ts
import { rfTools } from './rf-tools';
import { wifiTools } from './wifi-tools';
import { gsmTools } from './gsm-tools';
import { droneTools } from './drone-tools';
import { networkTools } from './network-tools';
import { systemTools } from './system-tools';
export type { ToolCategory, ToolDefinition } from './types';

export const toolHierarchy = [
	...rfTools,
	...wifiTools,
	...gsmTools,
	...droneTools,
	...networkTools,
	...systemTools
];
```

**Import path compatibility:** Existing imports using `from '$lib/data/toolHierarchy'`
must be updated to `from '$lib/data/tools'` (barrel resolution). Alternatively, create a
redirect file at the old path:

```typescript
// src/lib/data/toolHierarchy.ts (backward-compat redirect, delete after migration)
export { toolHierarchy } from './tools';
export type { ToolCategory, ToolDefinition } from './tools';
```

---

## 6. Migration Steps

1. Create directory `src/lib/data/tools/`.
2. Create `types.ts` with `ToolCategory` and `ToolDefinition` interfaces extracted from the original file.
3. Create each category file (`rf-tools.ts`, `wifi-tools.ts`, etc.) by copying the relevant data block and adding the correct type import.
4. Create `index.ts` barrel that assembles the full hierarchy via spread.
5. Find all importers of the original file:
    ```bash
    grep -r "toolHierarchy" src/ --include="*.ts" --include="*.svelte" -l
    ```
6. Update each importer to use the new barrel path.
7. Verify TypeScript compilation: `npx tsc --noEmit`.
8. Verify build: `npm run build`.
9. Delete the original `toolHierarchy.ts` (or replace with backward-compat redirect).
10. Commit.

---

## 7. Verification Commands

```bash
# 1. Import resolution (must not break)
cd /home/kali/Documents/Argos/Argos && npx tsc --noEmit 2>&1 | grep -i "toolHierarchy"

# 2. Runtime equivalence (build succeeds)
npm run build 2>&1 | tail -5

# 3. No file exceeds 300 lines
wc -l src/lib/data/tools/*.ts

# 4. All importers updated
grep -r "from.*toolHierarchy" src/ --include="*.ts" --include="*.svelte" | grep -v "data/tools"
# Expected: zero matches (all updated) OR only backward-compat redirect

# 5. No circular dependencies
npx madge --circular src/lib/data/tools/
```

---

## 8. Key Constraints and Caveats

1. **Pure data, zero logic risk.** This is the safest Tier 1 decomposition. No function extraction, no state management changes, no event handler rewiring.
2. **Type file is the dependency root.** `types.ts` must import NOTHING from sibling modules to prevent circular dependencies.
3. **Spread order matters.** The barrel `index.ts` must spread categories in the same order as the original file to preserve any order-dependent rendering.
4. **Post-split exception.** If any category file exceeds 500 lines (unlikely given estimates), further split by sub-category.

---

## 9. Commit Message

```
refactor: split toolHierarchy into category modules

- Extract rf-tools, wifi-tools, gsm-tools, drone-tools, network-tools, system-tools
- Create types.ts for ToolCategory and ToolDefinition interfaces
- Barrel index.ts reassembles full hierarchy via spread
- Original 1,502-line file replaced by 8 files, largest ~200 lines
- No logic changes, structural only
```

---

## 10. Standards Compliance

| Standard             | Compliance                                                |
| -------------------- | --------------------------------------------------------- |
| Barr Group Rule 1.3  | All files <500 lines post-split                           |
| NASA/JPL Rule 2.4    | N/A (no functions in data files)                          |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                        |
| CERT C MSC41         | No secrets in data definitions                            |
| DoD STIG V-222602    | Cross-referenced Phase 4; no dead tool definitions remain |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.1 -- Tier 1: toolHierarchy.ts Decomposition
```
