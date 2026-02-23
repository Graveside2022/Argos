# Tasks: Code Expressiveness Improvement

**Feature Branch**: `016-code-expressiveness`
**Created**: 2026-02-23
**Source**: plan.md (25 tasks, 10 phases), spec.md (8 user stories)

## Task Summary

| Phase | Description | Tasks | Parallel |
|-------|-------------|-------|----------|
| 1 | Setup | 1 | No |
| 2 | Foundational (shared utilities) | 4 | Yes |
| 3 | US1 — Route Handler Factory (P1) | 4 | Partial |
| 4 | US2 — DRY Consolidation (P1) | 4 | Yes |
| 5 | US7 — Consistent Error Responses (P1) | 1 | No |
| 6 | US3 — Result Types (P2) | 1 | Yes |
| 7 | US4 — Dead Export Cleanup (P2) | 1 | Yes |
| 8 | US8 — Client-Side Libraries (P2) | 8 | Partial |
| 9 | US5 — Circular Dependency Resolution (P3) | 3 | Yes |
| 10 | US6 — Higher-Order Wrappers (P3) | 3 | Partial |
| 11 | Polish & Cross-Cutting | 2 | No |
| **Total** | | **32** | |

---

## Phase 1: Setup

- [x] T001 Verify project builds cleanly and record baseline metrics (`npm run build`, `cloc`, `npx madge --circular src/`) in `specs/016-code-expressiveness/baseline-metrics.txt`

---

## Phase 2: Foundational (blocking prerequisites for all user stories)

These utilities are consumed by multiple user stories and MUST be completed before any story phase begins.

- [x] T002 [P] Create shared `errMsg()` utility in `src/lib/server/api/error-utils.ts` — handles Error instances, strings, objects with message property, and unknown types. Add JSDoc. Add unit tests in `src/lib/server/api/error-utils.test.ts`
- [x] T003 [P] Create shared `execFileAsync()` utility in `src/lib/server/exec.ts` — wraps `promisify(execFile)` with optional `maxBuffer`, `timeout`, `cwd`, `env` overrides. Add JSDoc. Add unit tests in `src/lib/server/exec.test.ts`
- [x] T004 [P] Create unified API response types in `src/lib/server/api/api-response.ts` — `ApiErrorResponse` (`{ success: false, error: string }`) and `ApiSuccessResponse<T>` (`{ success: true, ... }`) types per spec FR-014. Add JSDoc. Type-only file, no runtime code.
- [x] T005 [P] Create `safe()` result tuple utility in `src/lib/server/result.ts` — returns `[T, null] | [null, Error]`, normalizes non-Error thrown values. Add JSDoc. Add unit tests in `src/lib/server/result.test.ts`

---

## Phase 3: US1 — Route Handler Factory (P1)

**Story goal**: A developer writes only business logic for a new API route. The factory handles try-catch, error extraction, logging, JSON wrapping, and optional Zod body validation.

**Independent test**: Create one new route using factory, verify success/error/validation paths. Migrate 3 existing routes and confirm identical behavior.

- [x] T006 [US1] Create `createHandler()` factory in `src/lib/server/api/create-handler.ts` — wraps `HandlerFn` (business logic function) returning `HandlerResult` (data object or Response) with try-catch, `errMsg()`, `logger.error()`, `json()` response. Uses types from T004. Ensure return type satisfies SvelteKit `RequestHandler` (FR-004/FR-005). Add JSDoc. Add unit tests in `src/lib/server/api/create-handler.test.ts`
- [x] T007 [US1] Migrate 3 pilot routes to factory: `src/routes/api/signals/+server.ts`, `src/routes/api/system/info/+server.ts`, `src/routes/api/db/cleanup/+server.ts` — verify identical behavior with existing tests
- [x] T008 [US1] Migrate remaining routes (batch 1 — system, hackrf, rf domains): `src/routes/api/system/**`, `src/routes/api/hackrf/**`, `src/routes/api/rf/**` to use `createHandler()`. Verify with `npm run build` + targeted vitest
- [x] T009 [US1] Migrate remaining routes (batch 2 — gsm-evil, kismet, tak, signals, openwebrx domains): `src/routes/api/gsm-evil/**`, `src/routes/api/kismet/**`, `src/routes/api/tak/**`, `src/routes/api/signals/**`, `src/routes/api/openwebrx/**` to use `createHandler()`. Verify with `npm run build` + `npm run test:unit`

---

## Phase 4: US2 — DRY Consolidation (P1)

**Story goal**: Zero local copies of `errMsg()` or `execFileAsync` remain. Abandoned abstractions are absorbed or removed.

**Independent test**: `grep -r "function errMsg" src/` returns only the shared module. `grep -r "promisify(execFile)" src/` returns only the shared module.

- [x] T010 [P] [US2] Replace all 19 local `errMsg()` definitions with import from `src/lib/server/api/error-utils.ts` — files listed in `specs/016-code-expressiveness/research.md` R1
- [x] T011 [P] [US2] Replace all 36 local `execFileAsync`/`promisify(execFile)` declarations with import from `src/lib/server/exec.ts` — files listed in `specs/016-code-expressiveness/research.md` R2
- [x] T012 [US2] Absorb `safeErrorResponse()` and `logAndRespond()` into factory pattern. Remove `src/lib/server/security/error-response.ts` if fully superseded (0 external consumers confirmed)
- [x] T013 [US2] Evaluate `safeJsonParse()` in `src/lib/server/security/safe-json.ts` (3 consumers) — absorb into factory or keep as niche utility. Document decision in research.md

---

## Phase 5: US7 — Consistent Error Responses (P1)

**Story goal**: Zero unsafe `(error as Error)` casts remain. All error handling routes through type-safe utilities.

**Independent test**: `grep -rn "(error as Error)\|(err as Error)" src/` returns zero results.

- [ ] T014 [US7] Eliminate all 39 `(error as Error)` / `(err as Error)` casts across 23 files — replace with `errMsg()` calls or route through factory. Files listed in `specs/016-code-expressiveness/research.md` R3

---

## Phase 6: US3 — Result Types (P2)

**Story goal**: `safe()` utility is available and demonstrated in at least 3 converted call sites.

**Independent test**: Write `safe()` utility with unit tests, convert 3 existing try-catch sites.

- [ ] T015 [P] [US3] Convert 3 existing try-catch sites to use `safe()` from `src/lib/server/result.ts` — choose sites within services (not route handlers) where conditional error handling adds value

---

## Phase 7: US4 — Dead Export Cleanup (P2)

**Story goal**: Zero exported-but-unused symbols remain.

**Independent test**: Run dead export analysis tool, confirm zero unused exports.

- [ ] T016 [P] [US4] Run dead export analysis on codebase (ts-prune or grep-based), identify all exported-but-unused symbols, remove `export` keyword or delete unused functions. Verify with `npm run build`. Document removed exports in `specs/016-code-expressiveness/removed-exports.md`

---

## Phase 8: US8 — Client-Side Libraries (P2)

**Story goal**: Toast notifications active, one data table with sorting, one virtual list, one validated form — all rendering with Lunaris styling.

**Independent test**: Each library has one working implementation visible in the app with correct Lunaris dark theme styling.

### Sub-phase 8a: Activate svelte-sonner (lowest risk)

- [ ] T017 [US8] Add `<Toaster />` component to `src/routes/+layout.svelte`. Add `toast()` calls to 2–3 existing API success/error handlers as proof of pattern. Verify Lunaris dark theme compatibility.

### Sub-phase 8b: Data Tables

- [ ] T018 [US8] Install `@tanstack/table-core`. Create data-table helper components in `src/lib/components/data-table/` following shadcn-svelte data-table pattern (`data-table.svelte`, `data-table-column-header.svelte`, etc.)
- [ ] T019 [US8] Build one production data table (Kismet device list or signal history) using the new data-table components. Verify sorting, filtering, pagination, and Lunaris styling in `src/lib/components/` or `src/routes/` as appropriate

### Sub-phase 8c: Virtual Scrolling

- [ ] T020 [P] [US8] Install `virtua`. Create thin wrapper component in `src/lib/components/ui/virtual-list/virtual-list.svelte` with Svelte 5 snippet-based item rendering
- [ ] T021 [US8] Apply virtual scrolling to one existing long list (signal entries or device list) in the appropriate `src/routes/` or `src/lib/components/` page

### Sub-phase 8d: Form Validation

- [ ] T022 [US8] Install `sveltekit-superforms` and `formsnap`. Create one validated form (e.g., GSM Evil configuration or system settings) as pattern reference in the appropriate route/component

### Sub-phase 8e: Optional Items

- [ ] T023 [US8] (Optional) Install `@tanstack/svelte-query` v6. Apply `$derived.by(createQuery({...}))` pattern to one REST endpoint. Verify it does NOT replace WebSocket-fed stores.
- [ ] T024 [US8] Unify dual Kismet store architecture — ensure single store at `src/lib/stores/tactical-map/kismet-store.ts` is sole source of truth with WebSocket primary, REST fallback. Verify dashboard and connection stores derive from it cleanly.

---

## Phase 9: US5 — Circular Dependency Resolution (P3)

**Story goal**: `madge --circular src/` reports zero cycles.

**Independent test**: Run `npx madge --circular src/` and confirm zero output.

- [ ] T025a [P] [US5] Resolve circular dependency cycles 1-3 (dashboard + hackrf + gsm-server):
  - `map-handlers.ts ↔ map-handlers-helpers.ts` → shared `map-handler-types.ts`
  - `process-lifecycle.ts ↔ process-manager.ts` → invert dependency direction
  - `l3-decoder.ts ↔ l3-message-decoders.ts` → shared `l3-types.ts`
  Verify with `npx madge --circular src/` (expect 5 remaining)
- [ ] T025b [P] [US5] Resolve circular dependency cycles 4-6 (gps + gsm-evil services):
  - `gps-position-service.ts ↔ gps-response-builder.ts` → shared `gps-types.ts`
  - `gsm-evil-control-helpers.ts ↔ gsm-evil-control-service.ts` → shared `gsm-evil-types.ts`
  - `gsm-evil-control-service.ts ↔ gsm-evil-stop-helpers.ts` → same `gsm-evil-types.ts`
  Verify with `npx madge --circular src/` (expect 2 remaining)
- [ ] T025c [P] [US5] Resolve circular dependency cycles 7-8 (kismet + gsm-evil page):
  - `kismet-service-transform.ts ↔ kismet.service.ts` → shared kismet types file
  - `gsm-evil-page-logic.ts ↔ gsm-evil-scan-stream.ts` → extract shared interface
  Verify with `npx madge --circular src/` (expect 0 remaining)

---

## Phase 10: US6 — Higher-Order Wrappers (P3)

**Story goal**: `withRetry()` and `withTimeout()` available as shared utilities. Existing ad-hoc patterns migrated.

**Independent test**: Unit tests for wrappers pass. 2–3 existing patterns converted.

- [ ] T026 [P] [US6] Create `withRetry()` in `src/lib/server/retry.ts` — configurable `attempts`, `delayMs`, `backoff` (linear/exponential). Add JSDoc. Add unit tests in `src/lib/server/retry.test.ts`
- [ ] T027 [P] [US6] Create `withTimeout()` in `src/lib/server/timeout.ts` — configurable `timeoutMs`. Add JSDoc. Add unit tests in `src/lib/server/timeout.test.ts`
- [ ] T028 [US6] Identify and migrate 2–3 existing ad-hoc retry/timeout patterns in service files to use `withRetry()` / `withTimeout()` wrappers

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T029 Run full verification suite: `npm run build` + `npm run test:unit` + `npx madge --circular src/`. Verify backward compatibility (FR-012) by calling key API endpoints and asserting response shapes match pre-migration format. Verify all success criteria from spec.md (SC-001 through SC-018)
- [ ] T030 Record final metrics (cloc, madge, jscpd) and compare against baseline from T001. Document results in `specs/016-code-expressiveness/final-metrics.md`

---

## Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational: T002-T005) — all [P], can run in parallel
        ├── Phase 3 (US1: Factory) — depends on T002 (errMsg) + T004 (types)
        │     ├── Phase 4 (US2: DRY) — T010 depends on T002, T011 depends on T003, T012-T013 depend on T006
        │     └── Phase 5 (US7: Error casts) — depends on T002 + T006
        ├── Phase 6 (US3: Result types) — depends on T005 only
        ├── Phase 7 (US4: Dead exports) — independent after Phase 2
        ├── Phase 8 (US8: Client-side) — independent (different layer entirely)
        ├── Phase 9 (US5: Circular deps) — independent
        └── Phase 10 (US6: Wrappers) — independent
  Phase 11 (Polish) — depends on ALL phases completing
```

### Story Completion Order

1. **Must complete first**: Phase 2 (Foundational) — blocks Phases 3-7
2. **P1 stories (do next)**: Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US7)
3. **P2 stories (parallel after P1 foundation)**: Phase 6 (US3), Phase 7 (US4), Phase 8 (US8) — all independent
4. **P3 stories (parallel anytime after Phase 2)**: Phase 9 (US5), Phase 10 (US6) — independent
5. **Always last**: Phase 11 (Polish)

## Parallel Execution Examples

### Maximum parallelism after Phase 2:
```
Agent 1: T006 (factory) → T007 (pilot) → T008 (batch 1) → T009 (batch 2)
Agent 2: T010 (errMsg DRY) + T011 (exec DRY) → T012 (absorb safeErrorResponse)
Agent 3: T017 (sonner) → T018 (data-table setup) → T019 (data-table production)
Agent 4: T025a-c (circular deps) — independent, can run anytime
```

### After US1 factory is complete (T006-T009 done):
```
Agent 1: T014 (error casts) — needs factory + errMsg
Agent 2: T020 (virtua setup) → T021 (virtua apply)
Agent 3: T026 (withRetry) + T027 (withTimeout) → T028 (migrate patterns)
Agent 4: T022 (superforms) — independent
```

## Implementation Strategy

### MVP (minimum viable: do this first)
- **Phase 1-2**: Setup + Foundational utilities (T001-T005)
- **Phase 3**: Route Handler Factory (T006-T009) — highest impact single change
- **Phase 4**: DRY Consolidation (T010-T013) — biggest LOC reduction

This MVP alone delivers ~1,000 net lines saved (gross elimination ~1,400-2,100, offset by new utility code) and transforms the server-side code quality from D/F grades to A/B on factory functions, DRY, and error handling.

### Incremental delivery after MVP:
- **Wave 2**: US7 error casts (T014) + US8 sonner activation (T017) — quick wins
- **Wave 3**: US4 dead exports (T016) + US5 circular deps (T025a-c) — cleanup
- **Wave 4**: US8 remaining (T018-T024) — client-side tooling
- **Wave 5**: US6 wrappers (T026-T028) + US3 result types (T015) — refinements
- **Final**: Polish (T029-T030) — verification and metrics
