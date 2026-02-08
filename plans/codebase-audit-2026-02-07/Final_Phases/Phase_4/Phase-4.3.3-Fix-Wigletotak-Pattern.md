# Phase 4.3.3: Fix Wigletotak Pattern (5 Components, Same Fix)

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: CERT DCL30-C (declare variable with correct type), CERT MSC41-C (never hard-code sensitive information), BARR-C Rule 1.3 (braces shall always be used), NASA/JPL Rule 11 (no dynamic memory after init)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| **Phase**        | 4 -- Type Safety Hardening                                         |
| **Sub-Phase**    | 4.3 -- `any` Type Elimination                                      |
| **Task ID**      | 4.3.3                                                              |
| **Title**        | Fix Wigletotak Pattern (5 Components, Same Fix)                    |
| **Status**       | PLANNED                                                            |
| **Risk Level**   | MEDIUM -- Runtime `null` access if `onMount` not yet called        |
| **Duration**     | 45 minutes                                                         |
| **Dependencies** | None (independent of other 4.3.x tasks)                            |
| **Blocks**       | Phase 4.3.8 (ESLint `no-explicit-any` escalation)                  |
| **Branch**       | `agent/alex/phase-4.3-any-elimination`                             |
| **Commit**       | `fix(types): eliminate any from wigletotak dynamic import pattern` |
| **Standards**    | CERT DCL30-C, CERT MSC41-C, BARR-C Rule 1.3, NASA/JPL Rule 11      |

---

## Objective

Eliminate all 29 `any` occurrences across 5 Wigletotak components that share an identical anti-pattern: dynamically imported modules typed as `any` because the imports happen at runtime inside `onMount`.

**Result**: 29 `any` removed.

---

## Current State Assessment

### Affected Files

| File                                                                | `any` Count | Lines            |
| ------------------------------------------------------------------- | :---------: | ---------------- |
| `src/lib/components/wigletotak/directory/DirectoryCard.svelte`      |      8      | 6-10, 13, 25, 44 |
| `src/lib/components/wigletotak/settings/AnalysisModeCard.svelte`    |      6      | 6-10, 37         |
| `src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte` |      6      | 6-10, 39         |
| `src/lib/components/wigletotak/settings/TAKSettingsCard.svelte`     |      6      | 6-10, 41         |
| `src/routes/wigletotak/+page.svelte`                                |      3      | 6-7, 38          |
| **Total**                                                           |   **29**    |                  |

### Root Cause

All files follow the same pattern:

```typescript
let wigleStore: any;
let _wigleActions: any;
let wigleService: any;
let logInfo: any;
let logError: any;
```

These are dynamically imported inside `onMount` to prevent SSR issues. The types exist in the imported modules but are not utilized.

---

## Execution Steps

### Fix Pattern (Apply Identically to All 5 Components)

#### Step 1: Import Types Statically

Types are erased at compile time, making them safe for SSR:

```typescript
import type { Writable } from 'svelte/store';
import type { WigleState } from '$lib/stores/wigletotak/wigleStore';
import type { logInfo as LogInfoFn, logError as LogErrorFn } from '$lib/utils/logger';
```

Note: The `wigleService` module needs its export types checked. If it exports an object, use `typeof import(...)`.

#### Step 2: Type the Variables Using the Imports

**BEFORE**:

```typescript
let wigleStore: any;
let _wigleActions: any;
let wigleService: any;
let logInfo: any;
let logError: any;
```

**AFTER**:

```typescript
let wigleStore: Writable<WigleState> | null = null;
let _wigleActions: typeof import('$lib/stores/wigletotak/wigleStore').wigleActions | null = null;
let wigleService: typeof import('$lib/services/wigletotak/wigleService').wigleService | null = null;
let logInfo: typeof LogInfoFn | null = null;
let logError: typeof LogErrorFn | null = null;
```

#### Step 3: Fix Subscribe Callback Type

**BEFORE** (e.g., DirectoryCard.svelte:44):

```typescript
wigleStore.subscribe((state: any) => {
```

**AFTER**:

```typescript
wigleStore.subscribe((state: WigleState) => {
```

---

### DirectoryCard-Specific Fixes (2 Additional `any`)

`DirectoryCard.svelte` has 2 additional `any` types beyond the common pattern:

#### Fix `directorySettings`

**BEFORE** (line 13):

```typescript
let directorySettings: any = $state({
```

**AFTER**:

```typescript
let directorySettings: DirectorySettings = $state({
```

The `DirectorySettings` interface is already exported from `src/lib/stores/wigletotak/wigleStore.ts` (line 19).

#### Fix `wigleFiles`

**BEFORE** (line 25):

```typescript
let wigleFiles: any[] = $state(directorySettings.wigleFiles);
```

**AFTER**:

```typescript
let wigleFiles: string[] = $state(directorySettings.wigleFiles);
```

---

## Per-File Verification Commands

```bash
# DirectoryCard.svelte (8 any)
grep -n ': any\|as any' src/lib/components/wigletotak/directory/DirectoryCard.svelte
# Expected: 0 matches

# AnalysisModeCard.svelte (6 any)
grep -n ': any\|as any' src/lib/components/wigletotak/settings/AnalysisModeCard.svelte
# Expected: 0 matches

# AntennaSettingsCard.svelte (6 any)
grep -n ': any\|as any' src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte
# Expected: 0 matches

# TAKSettingsCard.svelte (6 any)
grep -n ': any\|as any' src/lib/components/wigletotak/settings/TAKSettingsCard.svelte
# Expected: 0 matches

# +page.svelte (3 any)
grep -n ': any\|as any' src/routes/wigletotak/+page.svelte
# Expected: 0 matches

# TypeScript compiles for all wigletotak files
npx tsc --noEmit 2>&1 | grep -i 'wigle'
# Expected: 0 errors
```

---

## Verification

```bash
# Aggregate check
grep -rn ': any\|as any' \
  src/lib/components/wigletotak/directory/DirectoryCard.svelte \
  src/lib/components/wigletotak/settings/AnalysisModeCard.svelte \
  src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte \
  src/lib/components/wigletotak/settings/TAKSettingsCard.svelte \
  src/routes/wigletotak/+page.svelte
# Expected: 0 matches

npx tsc --noEmit 2>&1 | grep -i 'wigle'
# Expected: 0 errors
```

---

## Risk Assessment

| Risk                                      | Likelihood | Impact | Mitigation                                                  |
| ----------------------------------------- | ---------- | ------ | ----------------------------------------------------------- |
| Runtime `null` access before `onMount`    | MEDIUM     | MEDIUM | Guard calls with `if (wigleStore)` checks (already present) |
| `typeof import(...)` resolves incorrectly | LOW        | LOW    | TypeScript will flag; fall back to explicit interface       |
| `DirectorySettings` not exported          | LOW        | LOW    | Verify export exists in wigleStore.ts line 19               |

---

## Rollback Strategy

Per-file rollback:

```bash
git checkout -- src/lib/components/wigletotak/directory/DirectoryCard.svelte
git checkout -- src/lib/components/wigletotak/settings/AnalysisModeCard.svelte
git checkout -- src/lib/components/wigletotak/settings/AntennaSettingsCard.svelte
git checkout -- src/lib/components/wigletotak/settings/TAKSettingsCard.svelte
git checkout -- src/routes/wigletotak/+page.svelte
```

---

## Standards Traceability

| Standard         | Rule         | Applicability                                                        |
| ---------------- | ------------ | -------------------------------------------------------------------- |
| CERT DCL30-C     | Correct type | Variables declared with proper types instead of `any`                |
| CERT MSC41-C     | No hardcode  | Type-safe imports prevent misconfiguration                           |
| BARR-C Rule 1.3  | Braces       | All interfaces and type annotations properly structured              |
| NASA/JPL Rule 11 | Dynamic mem  | `null` initialization with explicit type prevents undefined behavior |

---

## Cross-References

- **Source**: [Phase 4.3 Master](Phase-4.3-ANY-TYPE-ELIMINATION.md) -- Task 4.3.4 and Task 4.3.2b
- **Blocks**: [Phase 4.3.8](Phase-4.3.8-Remove-ESLint-Disable-Directives.md) (ESLint escalation)
