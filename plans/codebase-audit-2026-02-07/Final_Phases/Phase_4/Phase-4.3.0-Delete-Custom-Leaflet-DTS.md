# Phase 4.3.0: Delete Custom `leaflet.d.ts`

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL00-C (const-correct declarations), MISRA C 2012 Rule 8.13 (pointer to const), NASA/JPL Rule 15 (validate inputs from external sources)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                               |
| ---------------- | ------------------------------------------------------------------- |
| **Phase**        | 4 -- Type Safety Hardening                                          |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                       |
| **Task ID**      | 4.3.0                                                               |
| **Title**        | Delete Custom `leaflet.d.ts`                                        |
| **Status**       | PLANNED                                                             |
| **Risk Level**   | HIGH -- Type conflicts with `@types/leaflet` possible               |
| **Duration**     | 15 minutes                                                          |
| **Dependencies** | None (first task in 4.3)                                            |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation)                   |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                              |
| **Commit**       | `fix(types): delete custom leaflet.d.ts in favor of @types/leaflet` |
| **Standards**    | CERT DCL00-C, MISRA 8.13, NASA/JPL Rule 15                          |

---

## Objective

Delete the custom `src/types/leaflet.d.ts` file (166 lines, 19 `any` occurrences). The official `@types/leaflet@1.9.20` package is already installed and provides complete, accurate type definitions. The custom file is a subset copy with weaker types (19 `any` where the official package has proper types).

**Result**: 19 `any` removed, 166 lines deleted.

---

## Current State Assessment

| Metric                              | Value      | Verification Command                                                        |
| ----------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Custom `leaflet.d.ts` line count    | 166        | `wc -l src/types/leaflet.d.ts`                                              |
| `any` occurrences in custom file    | 19         | `grep -c ': any\|as any' src/types/leaflet.d.ts`                            |
| `@types/leaflet` installed version  | 1.9.20     | `npm ls @types/leaflet`                                                     |
| Files importing from custom leaflet | 0 expected | `grep -rn "from.*types/leaflet" --include='*.ts' --include='*.svelte' src/` |

---

## Execution Steps

### Step 1: Pre-Check -- Verify `@types/leaflet` Is Installed

Verify `@types/leaflet` is installed and provides the same symbols:

```bash
npm ls @types/leaflet
# Expected: @types/leaflet@1.9.20

# Verify official types cover Map, tileLayer, marker, etc.
node -e "const t = require.resolve('@types/leaflet'); console.log(t)"
```

### Step 2: Check for Direct Imports

```bash
grep -rn "from.*types/leaflet" --include='*.ts' --include='*.svelte' src/
# Expected: 0 results (or only leaflet-extensions.d.ts)
```

### Step 3: Delete the File

```bash
rm src/types/leaflet.d.ts
```

### Step 4: Post-Check -- Verify No Compile Errors

```bash
npx tsc --noEmit 2>&1 | head -30
```

If compile errors arise from imports referencing the deleted module, check whether `src/lib/types/leaflet-extensions.d.ts` needs adjustment (this file extends Leaflet types, not replaces them).

---

## Conflict Resolution

If any file explicitly imports from `../../types/leaflet.d.ts` (unlikely -- `.d.ts` files are typically ambient), update the import to reference `leaflet` directly:

```typescript
// BEFORE (if found)
import type { Map } from '../../types/leaflet';

// AFTER
import type { Map } from 'leaflet';
```

**Verification command**:

```bash
grep -rn "from.*types/leaflet" --include='*.ts' --include='*.svelte' src/
# Expected: 0 results (or only leaflet-extensions.d.ts)
```

---

## Verification

```bash
# 1. File is deleted
ls src/types/leaflet.d.ts 2>&1
# Expected: No such file or directory

# 2. TypeScript compiles clean
npx tsc --noEmit 2>&1 | tail -5
# Expected: no errors

# 3. Zero any removed from scope
grep -rn ': any\|as any' --include='*.d.ts' src/types/ 2>&1
# Expected: 0 matches or directory not found

# 4. Leaflet types still resolve
npx tsc --noEmit --traceResolution 2>&1 | grep leaflet | head -5
# Expected: resolves to @types/leaflet
```

---

## Risk Assessment

| Risk                                 | Likelihood | Impact | Mitigation                                               |
| ------------------------------------ | ---------- | ------ | -------------------------------------------------------- |
| Type conflicts with `@types/leaflet` | MEDIUM     | HIGH   | Run `npx tsc --noEmit` immediately; rollback if errors   |
| Files importing from deleted path    | LOW        | LOW    | Pre-check grep; update import path if found              |
| `leaflet-extensions.d.ts` conflict   | LOW        | MEDIUM | Extension file augments, does not depend on custom .d.ts |

---

## Rollback Strategy

```bash
git checkout -- src/types/leaflet.d.ts
```

---

## Standards Traceability

| Standard         | Rule                   | Applicability                                                  |
| ---------------- | ---------------------- | -------------------------------------------------------------- |
| CERT DCL00-C     | Const-correct decls    | Official `@types/leaflet` provides `readonly` where applicable |
| MISRA C 2012     | Rule 8.13              | Pointer-to-const correctness in type definitions               |
| NASA/JPL Rule 15 | Validate external data | Proper types enforce shape validation at compile time          |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.1
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) -- ESLint escalation requires all `any` eliminated
- **Related**: Phase 4.3.4 (Store any types) -- `hackrfStore.ts` and `kismetStore.ts` import Leaflet `Layer`/`Marker` types
