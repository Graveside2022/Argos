# Phase 5.3.5: Store-Action Exemptions Documentation

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: MISRA C:2012 Rule 8.7 (documented exception), CERT C STR00-C
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 5 -- Architecture Decomposition and Structural Enforcement
**Sub-Phase**: 5.3 -- Store-Service Boundary Resolution
**Task ID**: 5.3.5
**Risk Level**: LOW -- JSDoc annotation only; zero behavioral changes
**Prerequisites**: Tasks 5.3.3 and 5.3.4 (runtime violation fixes) complete
**Blocks**: None (can proceed to 5.3.6 in parallel)
**Estimated Files Touched**: 4 (annotation only)
**Standards**: MISRA C:2012 Rule 8.7 (documented architectural exemption)

---

## Objective

Add JSDoc architectural exemption documentation to 4 hackrfsweep service files that legitimately import store modules at runtime. These files implement the "store action service" pattern where the service IS the store's authorized write API. This is a deliberate architectural choice, not a violation, and must be documented for audit traceability.

No code behavior changes. Only JSDoc comments are added.

---

## Current State

The following 4 files import store modules at runtime. They were evaluated during the Phase 5.3 audit and determined to be architecturally correct.

| File                                       | Store(s) Imported                 | Rationale                                                           |
| ------------------------------------------ | --------------------------------- | ------------------------------------------------------------------- |
| `services/hackrfsweep/controlService.ts`   | controlStore, frequencyStore      | Service wraps controlActions/frequencyStore for sweep orchestration |
| `services/hackrfsweep/displayService.ts`   | displayStore                      | Service wraps displayActions for timer/progress display             |
| `services/hackrfsweep/frequencyService.ts` | frequencyStore                    | Service wraps frequencyActions for frequency CRUD                   |
| `services/hackrfsweep/signalService.ts`    | signalStore, displayStore, hackrf | Service orchestrates signal processing pipeline across stores       |

### Why These Are Exempted

The "store action service" pattern is the architectural inverse of a violation. In this pattern:

1. The store defines the reactive state shape.
2. The service provides the authorized mutation API for that state.
3. Components call service methods instead of directly calling store mutation functions.
4. The service and store are co-located in the same feature module (`hackrfsweep/`).

This is analogous to a database repository pattern where the repository (service) is the only code authorized to write to the database (store). Refactoring to callback injection would add indirection without benefit -- the service IS the store's write layer.

### Verification of Current State

```bash
# Confirm these 4 files exist and have store imports
grep -rn "from.*stores" src/lib/services/hackrfsweep/ --include="*.ts" | grep -v "import type"
# EXPECTED: exactly 4 files with runtime store imports
```

---

## Execution Steps

### JSDoc Template

Add the following JSDoc comment to the TOP of each of the 4 files (immediately after any existing file-level comments, before the first import statement):

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: [STORE_LIST]
 */
```

### File-Specific Annotations

#### 1. `src/lib/services/hackrfsweep/controlService.ts`

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: controlStore, frequencyStore
 */
```

#### 2. `src/lib/services/hackrfsweep/displayService.ts`

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: displayStore
 */
```

#### 3. `src/lib/services/hackrfsweep/frequencyService.ts`

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: frequencyStore
 */
```

#### 4. `src/lib/services/hackrfsweep/signalService.ts`

```typescript
/**
 * @architectural-exemption store-action-service
 *
 * This service is the authorized write API for its co-located store(s).
 * It imports store modules at runtime by design. This pattern was evaluated
 * during Phase 5.3 audit (2026-02-08) and determined to be the correct
 * architecture for this feature module.
 *
 * Do NOT refactor to callback injection -- the service IS the store's
 * mutation layer. Refactoring would add indirection without benefit.
 *
 * Stores managed: signalStore, displayStore, hackrf (spectrum data)
 */
```

---

## Verification

```bash
# Verify all 4 files have the exemption tag
grep -rn "@architectural-exemption" src/lib/services/hackrfsweep/ --include="*.ts"
# EXPECTED: 4 results, one per file

# Verify no behavioral changes (TypeScript still compiles)
npx tsc --noEmit
# EXPECTED: 0 errors

# Verify the boundary check now shows exactly 4 exempted files
grep -rn "from.*stores" src/lib/services/ --include="*.ts" \
  | grep -v "import type" \
  | grep -v "\.d\.ts" \
  | grep -v "example-usage" \
  | grep -v "test-connection"
# EXPECTED: exactly 4 lines, all in services/hackrfsweep/
```

---

## Future Maintenance

If new services are added that follow the store-action-service pattern:

1. The service MUST be co-located with the store it manages (same feature directory).
2. The `@architectural-exemption store-action-service` JSDoc tag MUST be present.
3. The `Stores managed:` line MUST list all imported stores.
4. The exemption MUST be reviewed during each Phase 5.3-equivalent audit cycle.

If a grepping verification tool (ESLint rule, CI check) is later added to enforce the store-service boundary, it should whitelist files containing the `@architectural-exemption store-action-service` tag.

---

## Risk Assessment

### Risk 1: JSDoc Comment Placement

**Probability**: LOW. If the comment is placed after the first import instead of before it, it still documents the exemption but may confuse linters that expect comments before imports.

**Mitigation**: Place the JSDoc block BEFORE the first `import` statement in each file. If the file has a shebang or existing file-level comment, place the JSDoc after those but before imports.

### Risk 2: Future Developer Removes JSDoc

**Probability**: LOW. JSDoc comments are generally preserved during refactoring.

**Mitigation**: The Phase 5.3.7 verification task includes a grep check for the `@architectural-exemption` tag. If the tag is missing, verification fails.

### Rollback Strategy

Remove the JSDoc comments. No behavioral rollback needed.

```bash
# No functional rollback needed -- these are comments only
git checkout HEAD -- \
  src/lib/services/hackrfsweep/controlService.ts \
  src/lib/services/hackrfsweep/displayService.ts \
  src/lib/services/hackrfsweep/frequencyService.ts \
  src/lib/services/hackrfsweep/signalService.ts
```

---

_Document version: 1.0_
_Created: 2026-02-08_
_Authority: Principal Software Architect_
_Standards applied: MISRA C:2012 Rule 8.7 (documented exception)_
_Classification: UNCLASSIFIED // FOUO_
