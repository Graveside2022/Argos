# Implementation Plan: Code Expressiveness Improvement

**Branch**: `016-code-expressiveness` | **Date**: 2026-02-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-code-expressiveness/spec.md`

## Summary

Raise the Argos codebase expressiveness GPA from C+ (2.37) to B+ by introducing shared abstractions (route handler factory, result types, DRY utilities) and closing client-side tooling gaps with production-grade libraries. Part A targets ~1,000 lines of net server-side boilerplate reduction across 66 route handlers (gross elimination ~2,000+ offset by ~800–1,000 lines of new utility code). Part B integrates 6 headless libraries into the existing SvelteKit + shadcn-svelte + Lunaris stack.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode), Svelte 5.35.5, SvelteKit 2.22.3
**Primary Dependencies**: SvelteKit, Tailwind CSS 4.1.18, better-sqlite3, Zod 3.25.76, bits-ui 2.15.5, shadcn 3.8.4, svelte-sonner 1.0.7 (installed but unused)
**Storage**: SQLite (rf_signals.db) via direct better-sqlite3 calls
**Testing**: Vitest 3.2.4, Playwright 1.53.2
**Target Platform**: Raspberry Pi 5 (8GB RAM, ARM Cortex-A76), Kali Linux
**Project Type**: Web application (SvelteKit monolith — server + client in one repo)
**Performance Goals**: WebSocket < 16ms, initial load < 3s, < 200MB heap, < 15% CPU
**Constraints**: No Docker for main app. OOM-sensitive (svelte-check ~650MB). No barrel files. No catch-all utils. Max 300 lines/file, 50 lines/function.
**Scale/Scope**: 47,902 LOC, 422 files, 66 route handler files, 19 API domains

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                | Gate                                              | Status | Notes                                                                                           |
| ---------------------- | ------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| I.1 Comprehension Lock | Understand before writing                         | PASS   | Full codebase analysis done (errMsg 19×, execFileAsync 36×, error casts 39×, route handlers 66) |
| I.2 Codebase Inventory | Search before modifying                           | PASS   | All target files inventoried via grep/glob                                                      |
| II.1 TypeScript Strict | No `any`, strict mode                             | PASS   | All new code will be strict-typed. Eliminates 39 unsafe `(error as Error)` casts                |
| II.2 Modularity        | Max 50 lines/fn, 300 lines/file, no circular deps | PASS   | Plan explicitly resolves 8 circular deps. All new modules < 300 lines                           |
| II.3 Naming            | kebab-case files                                  | PASS   | New files: `route-handler.ts`, `error-utils.ts`, `exec-utils.ts`, `result.ts`                   |
| II.4 Error Handling    | No swallowed errors                               | PASS   | Factory centralizes error handling — nothing swallowed                                          |
| II.6 Forbidden         | No barrel files, no catch-all utils               | PASS   | Domain-specific modules, not utils.ts                                                           |
| III.1 Test-First       | Write tests before/alongside                      | PASS   | TDD for all new utilities                                                                       |
| V.2 Load               | No unused dependencies                            | PASS   | Activates svelte-sonner (already installed, zero imports). New deps are lazy-loaded             |
| VI.1 Discipline        | Pin exact versions, justify packages              | PASS   | Each new package justified in spec with stars/downloads                                         |
| VI.3 Forbidden         | No npm install without approval                   | PASS   | User explicitly approved all Part B libraries in spec Rev 3                                     |
| IX.1 Spec-Kit          | plan.md = HOW, tech details                       | PASS   | This document                                                                                   |

**Post-Phase 1 Re-check**: All gates remain PASS. No new dependencies introduced that violate constitution.

## Research Findings

### Correction: `safeParseWithHandling` Is NOT Abandoned

The original analysis stated 3 abstractions had "0–15% adoption." Live codebase verification reveals:

| Abstraction             | Definition                                     | Call Sites                                      | Adoption                            | Status                            |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------- | --------------------------------- |
| `safeParseWithHandling` | `src/lib/utils/validation-error.ts:186`        | 30+ across 14 files                             | **HIGH** (~45% of validation sites) | KEEP — actively used              |
| `safeJsonParse`         | `src/lib/server/security/safe-json.ts:16`      | 3 files                                         | LOW (~5%)                           | ABSORB into factory or keep as-is |
| `safeErrorResponse`     | `src/lib/server/security/error-response.ts:15` | 0 consumers (only definition + `logAndRespond`) | ZERO                                | ABSORB into factory, then remove  |
| `handleCatchError`      | (in tak routes)                                | 2 files                                         | VERY LOW                            | ABSORB into factory               |

**Decision**: `safeParseWithHandling` stays as-is — it's a well-adopted abstraction with proper Zod integration. Only `safeErrorResponse` and `handleCatchError` are absorbed into the factory. `safeJsonParse` has niche value (raw string → validated typed output) and may be kept or absorbed.

### Verified Codebase Inventory

| Target                                      | Count                                                                         | Source                 |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `function errMsg()` copies                  | 19 files                                                                      | grep `function errMsg` |
| `execFileAsync` / `promisify(execFile)`     | 36 files                                                                      | grep                   |
| `(error as Error)` / `(err as Error)` casts | 39 occurrences in 23 files                                                    | grep                   |
| Route handler files (`+server.ts`)          | 66                                                                            | find                   |
| API domains                                 | 19                                                                            | ls src/routes/api/     |
| JSON error response patterns                | 47 occurrences across 20 route files                                          | grep                   |
| `safeParseWithHandling` call sites          | 30+ across 14 files                                                           | grep                   |
| Kismet stores                               | 1 main store + references in 3 other stores                                   | grep                   |
| Existing shadcn UI components               | 8 dirs (alert-dialog, badge, button, input, select, separator, switch, table) | ls                     |
| Existing Zod schemas                        | 7 files in src/lib/schemas/                                                   | glob                   |
| svelte-sonner usage                         | 0 imports (only in validation-error.ts toast support)                         | grep                   |

### Error Response Shape Analysis

Current codebase has at least 3 distinct error response patterns in route handlers:

1. **`json({ error: string }, { status })` pattern** — most common (~20 routes)
2. **`error(status, message)` SvelteKit throw** — used in some routes (e.g., signals/+server.ts)
3. **`json({ success: false, error: string })` pattern** — used in a few routes

The factory must produce **pattern 1** (the most common) as default, with an option to include `success` boolean for consumers that check it.

### Part B Library Integration Points

| Library                  | Install Needed               | Integration Point                                              | Svelte 5 Status                                                 |
| ------------------------ | ---------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `@tanstack/table-core`   | YES (`npm install`)          | New `data-table` helper via shadcn CLI                         | Core is framework-agnostic; shadcn provides `createSvelteTable` |
| `virtua`                 | YES                          | Import `VList` from `virtua/svelte`                            | Svelte 5 snippets supported                                     |
| `sveltekit-superforms`   | YES                          | Form actions + Zod schemas                                     | Works in legacy mode, runes in v3                               |
| `formsnap`               | YES                          | Wraps Superforms for accessible components                     | Svelte 5 compatible via bits-ui                                 |
| `@tanstack/svelte-query` | YES (optional)               | `QueryClientProvider` in layout, `createQuery` in pages        | Requires Svelte 5.25.0+ (we have 5.35.5)                        |
| `svelte-sonner`          | NO (already installed 1.0.7) | Add `<Toaster />` to root layout, import `toast` in components | Svelte 5 compatible                                             |

## Project Structure

### Documentation (this feature)

```text
specs/016-code-expressiveness/
├── spec.md              # Feature specification (Rev 3)
├── plan.md              # This file
├── research.md          # Phase 0 findings (embedded above)
├── checklists/
│   └── requirements.md  # Quality validation checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code — Part A (Server-Side Abstractions)

New files to create:

```text
src/lib/server/api/
├── route-handler.ts         # createHandler() factory + types (~120 lines)
├── route-handler.test.ts    # Factory unit tests
├── error-utils.ts           # Shared errMsg() + error extraction (~40 lines)
├── error-utils.test.ts      # errMsg tests
└── api-response.ts          # Unified ApiError/ApiSuccess types (~30 lines)

src/lib/server/utils/
├── exec-utils.ts            # Shared execFileAsync() (~25 lines)
├── exec-utils.test.ts       # execFileAsync tests
├── result.ts                # safe() tuple utility (~40 lines)
├── result.test.ts           # safe() tests
├── retry.ts                 # withRetry() higher-order wrapper (~50 lines)
├── retry.test.ts
├── timeout.ts               # withTimeout() higher-order wrapper (~30 lines)
└── timeout.test.ts
```

Files to modify (Part A):

```text
# errMsg consolidation — 19 files (remove local errMsg, add import)
src/routes/api/signals/+server.ts
src/routes/api/signals/statistics/+server.ts
src/routes/api/signals/batch/+server.ts
src/routes/api/system/info/+server.ts
src/routes/api/system/services/+server.ts
src/routes/api/system/docker/+server.ts
src/routes/api/system/docker/[action]/+server.ts
src/routes/api/system/memory-pressure/+server.ts
src/routes/api/openwebrx/control/+server.ts
src/routes/api/hackrf/start-sweep/+server.ts
src/routes/api/db/cleanup/+server.ts
src/routes/api/rf/stop-sweep/+server.ts
src/routes/api/rf/emergency-stop/+server.ts
src/routes/api/rf/start-sweep/+server.ts
src/routes/api/tak/certs/+server.ts
src/routes/api/tak/enroll/+server.ts
src/routes/api/tak/truststore/+server.ts
src/routes/api/tak/import-package/+server.ts
src/lib/hackrf/sweep-manager/buffer-parser.ts

# execFileAsync consolidation — 36 files (all listed in research)

# Route handler factory migration — 50+ of 66 route handler files

# Error cast elimination — 23 files with (error as Error) casts
```

### Source Code — Part B (Client-Side Tooling)

New files to create:

```text
src/lib/components/ui/sonner/
└── (none — import Toaster from svelte-sonner directly)

src/lib/components/data-table/
├── data-table.svelte           # Reusable data-table wrapper component
├── data-table-pagination.svelte
├── data-table-toolbar.svelte
└── columns.ts                  # Column helper patterns

src/lib/components/virtual-list/
└── virtual-list.svelte         # Thin wrapper around Virtua VList
```

Files to modify (Part B):

```text
src/routes/+layout.svelte          # Add <Toaster /> from svelte-sonner
src/lib/stores/tactical-map/kismet-store.ts  # Unify dual-store architecture
```

**Structure Decision**: SvelteKit monolith — all code in `src/`. Server abstractions in `src/lib/server/api/` and `src/lib/server/utils/`. Client components in `src/lib/components/`. This follows existing project layout.

## Complexity Tracking

| Violation                             | Why Needed                                                                                                 | Simpler Alternative Rejected Because                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| New `src/lib/server/api/` directory   | Route handler factory needs a home. Cannot go in existing dirs without violating "no catch-all utils" rule | Putting in `src/lib/server/security/` would mix concerns          |
| New `src/lib/server/utils/` directory | `exec-utils`, `result`, `retry`, `timeout` are genuinely cross-cutting                                     | Individual dirs per file would be excessive for 4 small utilities |

## Implementation Phases

> **Note**: Task IDs below (T001–T025) are plan-level identifiers. The authoritative task list in `tasks.md` uses its own numbering (T001–T030) with a setup task prepended and some tasks split. Always reference `tasks.md` for execution.

### Phase 1: Foundation Utilities (Low Risk, High Impact)

**Goal**: Create the building blocks that everything else depends on.

1. **T001** — Create `src/lib/server/api/error-utils.ts`: Shared `errMsg()` function + `extractErrorMessage()` that handles all error shapes. Unit tests.
2. **T002** — Create `src/lib/server/utils/exec-utils.ts`: Shared `execFileAsync()` wrapping `promisify(execFile)`. Unit tests.
3. **T003** — Create `src/lib/server/api/api-response.ts`: Unified `ApiErrorResponse` and `ApiSuccessResponse` types. No runtime code, just TypeScript types.
4. **T004** — Create `src/lib/server/utils/result.ts`: `safe()` utility returning `[T, null] | [null, Error]` tuples. Unit tests.

### Phase 2: Route Handler Factory (Medium Risk, Highest Impact)

**Goal**: The single highest-impact abstraction — eliminates boilerplate from 50+ routes.

5. **T005** — Create `src/lib/server/api/route-handler.ts`: `createHandler()` factory that wraps a business logic function with try-catch, logging, errMsg, and JSON error response. Uses types from T003. Unit tests.
6. **T006** — Migrate 3 pilot routes to use factory: `signals/+server.ts`, `system/info/+server.ts`, `db/cleanup/+server.ts`. Verify identical behavior.
7. **T007** — Migrate remaining routes in batches (by API domain): system/, hackrf/, rf/, gsm-evil/, kismet/, tak/, signals/, openwebrx/. Each batch verified with existing tests.

### Phase 3: DRY Consolidation (Low Risk)

**Goal**: Eliminate the 19 errMsg copies and 36 execFileAsync duplicates.

8. **T008** — Replace all 19 `errMsg()` copies with import from `error-utils.ts`. One commit per batch of ~5 files.
9. **T009** — Replace all 36 `execFileAsync` declarations with import from `exec-utils.ts`.
10. **T010** — Eliminate all 39 `(error as Error)` / `(err as Error)` casts across 23 files — route through `errMsg()` or factory.

### Phase 4: Cleanup (Low Risk)

**Goal**: Remove dead weight from the codebase.

11. **T011** — Run dead export analysis, identify all exported-but-unused symbols, remove/unexport.
12. **T012** — Absorb `safeErrorResponse` and `logAndRespond` into factory (0 consumers). Remove `error-response.ts` if fully superseded.
13. **T013** — Evaluate `safeJsonParse` (3 consumers) — absorb or keep.
14. **T014** — Resolve 8 circular dependency cycles. Strategy per cycle:
    - Helper ↔ Service cycles (6): Move shared types to a `*-types.ts` file
    - `process-lifecycle.ts ↔ process-manager.ts`: Invert dependency direction
    - `gsm-evil-page-logic.ts ↔ gsm-evil-scan-stream.ts`: Extract shared interface

### Phase 5: Higher-Order Wrappers (Low Risk)

**Goal**: Cross-cutting async concerns as composable wrappers.

15. **T015** — Create `withRetry()` in `src/lib/server/utils/retry.ts`. Unit tests.
16. **T016** — Create `withTimeout()` in `src/lib/server/utils/timeout.ts`. Unit tests.
17. **T017** — Identify and migrate existing ad-hoc retry/timeout patterns to wrappers.

### Phase 6: Client-Side Tooling — Activate svelte-sonner (Lowest Risk)

**Goal**: Light up the already-installed toast library.

18. **T018** — Add `<Toaster />` to root `+layout.svelte`. Add `toast()` calls to 2–3 existing API success/error handlers as proof of pattern.

### Phase 7: Client-Side Tooling — Data Tables (Medium Risk)

**Goal**: Headless data table with TanStack Table + shadcn-svelte.

19. **T019** — Install `@tanstack/table-core`. Create data-table helper components following shadcn-svelte pattern.
20. **T020** — Build one production data table (e.g., Kismet device list or signal history) using the new components. Verify sorting, filtering, Lunaris styling.

### Phase 8: Client-Side Tooling — Virtual Scrolling (Low Risk)

**Goal**: Smooth scrolling for long lists.

21. **T021** — Install `virtua`. Create thin wrapper component.
22. **T022** — Apply virtual scrolling to one existing long list (signal entries or device list).

### Phase 9: Client-Side Tooling — Form Validation (Medium Risk)

**Goal**: Schema-validated forms with accessible components.

23. **T023** — Install `sveltekit-superforms` + `formsnap`. Create one validated form (e.g., GSM Evil configuration) as pattern reference.

### Phase 10: Client-Side Tooling — Optional Items

**Goal**: Stretch goals if time permits.

24. **T024** — (Optional) Install `@tanstack/svelte-query` v6. Apply to one REST endpoint.
25. **T025** — Unify dual Kismet store architecture — single store with WebSocket primary, REST fallback.

## Dependency Graph

```
T001 (errMsg) ──┐
T002 (execFile) │
T003 (types)  ──┼── T005 (factory) ── T006 (pilot) ── T007 (full migration)
T004 (safe())  ─┘
                     T008 (errMsg DRY) ── depends on T001
                     T009 (exec DRY) ─── depends on T002
                     T010 (error casts) ─ depends on T001 + T005
                     T011 (dead exports) ─ independent
                     T012-T013 (absorb) ── depends on T005
                     T014 (circular deps) ─ independent
                     T015-T017 (wrappers) ─ independent
                     T018 (sonner) ─────── independent
                     T019-T020 (tables) ── independent
                     T021-T022 (virtual) ── independent
                     T023 (forms) ──────── independent
                     T024-T025 (optional) ─ independent
```

## Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                                                   |
| -------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------- |
| Factory breaks SvelteKit type inference            | Low        | High   | T006 pilot tests 3 routes before bulk migration                                              |
| errMsg consolidation misses edge cases             | Very Low   | Low    | All 19 copies verified identical                                                             |
| Dead export removal breaks MCP servers             | Very Low   | Medium | MCP uses HTTP API, not imports — no risk                                                     |
| Circular dep resolution changes behavior           | Low        | Medium | Each cycle resolved individually with tests                                                  |
| svelte-sonner Toaster conflicts with Lunaris theme | Very Low   | Low    | sonner supports custom styling via CSS                                                       |
| TanStack Table v9 breaks shadcn helpers            | Low        | Low    | We use table-core directly; v9 core API is backward-compatible                               |
| OOM during migration (many files open)             | Medium     | Medium | Commit per batch, targeted vitest runs, avoid concurrent svelte-check                        |
| Client-side library Svelte 5.35 compat issues      | Low        | Medium | superforms works in legacy mode; virtua/sonner verified Svelte 5; pilot before bulk adoption |

## Verification Strategy

Per the constitution (Universal Verification Commands):

- **After each task**: `npx vitest run <changed-test-files> --no-coverage`
- **After each phase**: `npm run build` + `npm run test:unit`
- **Final verification**: `npm run build && npm run test:all && npx madge --circular src/`
- **LOC measurement**: `cloc src/ --include-lang=TypeScript,Svelte` before and after
