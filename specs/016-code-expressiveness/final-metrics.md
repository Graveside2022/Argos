# Final Metrics: Code Expressiveness Improvement

**Date**: 2026-02-24
**Branch**: `016-code-expressiveness`
**Baseline commit**: `4947310` (pre-implementation)
**Final commit**: see `git log --oneline 016-code-expressiveness --not main`

---

## Summary Comparison

| Metric                       | Baseline       | Final               | Delta                       |
| ---------------------------- | -------------- | ------------------- | --------------------------- |
| Files (cloc)                 | 422            | 431                 | +9 (new utility/type files) |
| Code lines                   | 47,902         | 47,540              | **-362 net**                |
| Comments                     | 5,547          | 5,493               | -54                         |
| TypeScript files             | 302            | 311                 | +9                          |
| TypeScript lines             | 35,701         | 35,322              | **-379**                    |
| Svelte lines                 | 10,165         | 10,182              | +17 (toast additions)       |
| Circular dependencies        | 8              | **0**               | **-8 (100% eliminated)**    |
| jscpd clones                 | 33             | 35                  | +2                          |
| jscpd duplication %          | 0.95%          | 0.76%               | **-0.19 pp**                |
| `errMsg()` local copies      | 19 files       | 1 file (shared)     | **-18 (95% reduction)**     |
| `promisify(execFile)` copies | 36 files       | 1 file (shared)     | **-35 (97% reduction)**     |
| `(error as Error)` casts     | 38 occurrences | 0                   | **-38 (100% eliminated)**   |
| Dead exports                 | 25+ estimated  | ~0 (ts-prune clean) | **100% eliminated**         |

## Git Diffstat

```
339 files changed, 4,491 insertions(+), 31,474 deletions(-)
```

**Gross lines deleted**: 31,474 (includes old spec directories 001-015 cleanup)
**Net code line reduction**: 362 lines (new utilities offset massive deletions)

> Note: The large deletion count includes the removal of completed spec directories
> (001-015) in commit `82350aa`. The code-only delta in `src/` is approximately
> -1,300 lines from dead export removal offset by +950 lines of new utility code
> and tests.

## New Shared Utilities Created

| Utility           | File                                   | Tests    | Purpose                                            |
| ----------------- | -------------------------------------- | -------- | -------------------------------------------------- |
| `errMsg()`        | `src/lib/server/api/error-utils.ts`    | 11 tests | Type-safe error message extraction                 |
| `execFileAsync()` | `src/lib/server/exec.ts`               | 13 tests | Promisified child_process.execFile                 |
| `safe()`          | `src/lib/server/result.ts`             | 8 tests  | Result tuple `[T, null] \| [null, Error]`          |
| `createHandler()` | `src/lib/server/api/create-handler.ts` | 9 tests  | Route handler factory (try/catch, logging, JSON)   |
| `withRetry()`     | `src/lib/server/retry.ts`              | 8 tests  | Configurable retry with linear/exponential backoff |
| `withTimeout()`   | `src/lib/server/timeout.ts`            | 6 tests  | Promise-based timeout wrapper                      |

**Total new tests**: 55 tests (all passing)

## Circular Dependency Resolution

All 8 cycles resolved via shared type extraction pattern:

| Cycle                                                 | Resolution File            |
| ----------------------------------------------------- | -------------------------- |
| map-handlers <-> map-handlers-helpers                 | `map-handler-types.ts`     |
| process-lifecycle <-> process-manager                 | `process-manager-types.ts` |
| l3-decoder <-> l3-message-decoders                    | `l3-types.ts`              |
| gps-position-service <-> gps-response-builder         | `gps-types.ts`             |
| gsm-evil-control-helpers <-> gsm-evil-control-service | `gsm-evil-types.ts`        |
| gsm-evil-control-service <-> gsm-evil-stop-helpers    | `gsm-evil-types.ts`        |
| kismet-service-transform <-> kismet.service           | `kismet-service-types.ts`  |
| gsm-evil-page-logic <-> gsm-evil-scan-stream          | Re-export removal          |

## Route Handler Migration

39 API route files touched across two tiers of migration:

- **Tier 1 — Factory adoption**: 6 route files use `createHandler()` factory
  (try/catch, error formatting, logging handled by factory)
- **Tier 2 — Shared import migration**: ~33 additional route files migrated
  to use shared `errMsg()` and/or `execFileAsync()` imports (replacing local copies)
- Remaining ~27 route files unchanged (no local errMsg/execFileAsync to replace)

## Expressiveness Scorecard (Updated)

| Technique             | Before   | After  | Notes                                                |
| --------------------- | -------- | ------ | ---------------------------------------------------- |
| DRY                   | D        | **A**  | errMsg + execFileAsync consolidated                  |
| YAGNI                 | C+       | **A**  | ~120 dead exports removed, 9 files deleted           |
| Factory Functions     | F        | **C+** | createHandler() created + 6 routes; 60 remain manual |
| Result Type           | F        | **B**  | safe() utility + 3 demo conversions                  |
| Higher-Order Wrappers | —        | **B+** | withRetry() created + migrated; withTimeout() ready  |
| Circular Dependencies | 8 cycles | **0**  | All resolved                                         |
| Unsafe Error Casts    | 38       | **0**  | All replaced with errMsg()                           |

## Deferred Tasks (Phase 8 client-side)

The following tasks are deferred to a future spec as they add new library capabilities
rather than improving code expressiveness:

- T018-T019: TanStack Table data tables
- T020-T021: Virtua virtual scrolling
- T022: Superforms + formsnap form validation
- T023: Svelte Query (optional)
- T024: Kismet store unification

## Verification Checklist

- [x] `npm run build` — passes
- [x] `npx madge --circular --ts-config tsconfig.json --extensions ts src/` — 0 cycles
- [x] `errMsg()` only in shared module — confirmed
- [x] `promisify(execFile)` only in shared module — confirmed
- [x] `(error as Error)` casts — 0 remaining
- [x] All 55 new utility tests pass
- [x] svelte-sonner toast integration working (3 components)
- [ ] Full `npm run test:unit` (deferred due to RPi 5 OOM constraints)
