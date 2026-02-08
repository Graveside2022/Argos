# Phase 4.3.4: Fix Store `any` Types

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL30-C (declare variable with correct type), CERT EXP34-C (do not dereference null pointers), BARR-C Rule 1.3 (braces shall always be used), NASA/JPL Rule 14 (check return values)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| **Phase**        | 4 -- Type Safety Hardening                                      |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                   |
| **Task ID**      | 4.3.4                                                           |
| **Title**        | Fix Store `any` Types                                           |
| **Status**       | PLANNED                                                         |
| **Risk Level**   | LOW -- Standard type replacements with well-known Leaflet types |
| **Duration**     | 15 minutes                                                      |
| **Dependencies** | None (independent of other 4.3.x tasks)                         |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation)               |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                          |
| **Commit**       | `fix(types): replace any with proper types in store files`      |
| **Standards**    | CERT DCL30-C, CERT EXP34-C, BARR-C Rule 1.3, NASA/JPL Rule 14   |

---

## Objective

Eliminate 3 `any` occurrences across 3 store files: an index signature in `rtl433Store.ts`, and Leaflet marker parameters in `hackrfStore.ts` and `kismetStore.ts`.

**Result**: 3 `any` removed. (Remaining store `any` in `gsmEvilStore.ts` is handled in [Phase 4.3.1](Phase-4.3.1-Fix-High-Value-Targets.md) Section C.)

---

## Current State Assessment

| File                                         | `any` Count | Line | Pattern                 |
| -------------------------------------------- | :---------: | ---- | ----------------------- |
| `src/lib/stores/rtl433Store.ts`              |      1      | 25   | Index signature `: any` |
| `src/lib/stores/tactical-map/hackrfStore.ts` |      1      | 101  | `marker: any` parameter |
| `src/lib/stores/tactical-map/kismetStore.ts` |      1      | 90   | `marker: any` parameter |
| **Total**                                    |    **3**    |      |                         |

---

## Execution Steps

### Step 1: Fix `rtl433Store.ts` Index Signature (line 25)

This is an index signature in the `CapturedSignal` interface. RTL-433 JSON signals have dynamic keys but values are always primitives (string, number, boolean, null).

**BEFORE** (line 25):

```typescript
[key: string]: any; // Allow for any additional signal data
```

**AFTER**:

```typescript
[key: string]: string | number | boolean | null | undefined;
```

### Step 2: Fix `hackrfStore.ts` Marker Parameter (line 101)

**BEFORE** (line 101):

```typescript
export const addSignalMarker = (signalId: string, marker: any) => {
```

**AFTER**:

```typescript
import type { Marker } from 'leaflet';
export const addSignalMarker = (signalId: string, marker: Marker) => {
```

If the marker can also be a CircleMarker or Layer, use the broader type:

```typescript
import type { Layer } from 'leaflet';
export const addSignalMarker = (signalId: string, marker: Layer) => {
```

### Step 3: Fix `kismetStore.ts` Marker Parameter (line 90)

**BEFORE** (line 90):

```typescript
export const addKismetDeviceMarker = (mac: string, marker: any) => {
```

**AFTER**:

```typescript
import type { Layer } from 'leaflet';
export const addKismetDeviceMarker = (mac: string, marker: Layer) => {
```

---

## Verification

```bash
# 1. Zero any remaining in all 3 files
grep -n ': any\|as any' \
  src/lib/stores/rtl433Store.ts \
  src/lib/stores/tactical-map/hackrfStore.ts \
  src/lib/stores/tactical-map/kismetStore.ts
# Expected: 0 matches

# 2. TypeScript compiles
npx tsc --noEmit 2>&1 | grep -E 'rtl433Store|hackrfStore|kismetStore'
# Expected: 0 errors

# 3. Verify Leaflet types resolve
npx tsc --noEmit 2>&1 | grep -i 'leaflet'
# Expected: 0 errors
```

---

## Risk Assessment

| Risk                                 | Likelihood | Impact | Mitigation                                           |
| ------------------------------------ | ---------- | ------ | ---------------------------------------------------- |
| Leaflet `Layer`/`Marker` types wrong | LOW        | LOW    | Already provided by `@types/leaflet`; standard types |
| Index signature too restrictive      | LOW        | LOW    | RTL-433 values verified as primitives only           |
| Callers pass non-Marker object       | LOW        | MEDIUM | TypeScript will flag; check call sites               |

---

## Rollback Strategy

```bash
git checkout -- src/lib/stores/rtl433Store.ts
git checkout -- src/lib/stores/tactical-map/hackrfStore.ts
git checkout -- src/lib/stores/tactical-map/kismetStore.ts
```

---

## Standards Traceability

| Standard         | Rule         | Applicability                                                  |
| ---------------- | ------------ | -------------------------------------------------------------- |
| CERT DCL30-C     | Correct type | Index signature narrowed from `any` to primitive union         |
| CERT EXP34-C     | Null deref   | Leaflet `Layer` type prevents dereferencing wrong object type  |
| BARR-C Rule 1.3  | Braces       | Import type declarations properly structured                   |
| NASA/JPL Rule 14 | Return vals  | Typed markers enable compile-time validation of map operations |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.5
- **Related**: [Phase 4.3.0](Phase-4.3.0-Delete-Custom-Leaflet-DTS.md) -- Leaflet types must resolve via `@types/leaflet` after custom .d.ts deletion
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (ESLint escalation)
