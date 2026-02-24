# Implementation Plan: Code Expressiveness Improvement

**Branch**: `016-code-expressiveness` | **Date**: 2026-02-24 (V2 — all 32 findings covered) | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-code-expressiveness/spec.md`
**Research**: [research.md](research.md) — live codebase verification completed 2026-02-24

## Summary

Improve Argos codebase expressiveness through three orthogonal work streams: (A) migrate 60 remaining API routes to the existing `createHandler()` factory and spread shared utilities, (B) install and demonstrate 5 client-side libraries that close tooling gaps, and (C) harden operations by centralizing env vars, eliminating hardcoded paths/URLs, consolidating DRY violations, and decomposing oversized files. Core utilities (`errMsg`, `execFileAsync`, `safe`, `withRetry`, `withTimeout`, `createHandler`) already exist — this plan focuses on **migration at scale** and operational hygiene.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode) + Svelte 5.35.5 / SvelteKit 2.22.3
**Primary Dependencies**: SvelteKit, Tailwind CSS, better-sqlite3, ws, node-pty, zod. New: @tanstack/table-core, virtua, sveltekit-superforms, formsnap, @tanstack/svelte-query
**Storage**: SQLite via better-sqlite3 (no ORM). N/A for this spec (no schema changes).
**Testing**: Vitest (unit in `src/`, integration in `tests/`). Playwright for E2E.
**Target Platform**: Raspberry Pi 5 (Kali Linux, ARM Cortex-A76, 8GB RAM)
**Project Type**: Web application (SvelteKit monolith — server + client in one project)
**Performance Goals**: No regression. WebSocket < 16ms, initial load < 3s, < 200MB heap.
**Constraints**: < 200MB heap (RPi 5 memory-constrained). No concurrent `svelte-check`. OOM risk with parallel agents.
**Scale/Scope**: 66 route handler files, ~47,900 LOC, 467 source files. Estimated 1,000–1,500 lines removed (Part A+C), 500–800 lines added (Part B).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article                 | Requirement                           | Status | Notes                                                                                                                                 |
| ----------------------- | ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| I.1 Comprehension Lock  | Problem fully understood              | PASS   | Spec has 12 user stories, 33 FRs, audit findings verified                                                                             |
| I.2 Codebase Inventory  | Existing implementations searched     | PASS   | research.md documents all prior art                                                                                                   |
| II.1 TypeScript Strict  | No `any`, no `@ts-ignore`             | PASS   | All new code uses `unknown` + guards. 4 pre-existing `eslint-disable` out of scope + FR-035 adds typed interfaces for 4 external APIs |
| II.2 Modularity         | Max 50 line functions, 300 line files | PASS   | Part C Phase 4 specifically addresses oversized files                                                                                 |
| II.3 Naming             | kebab-case files, camelCase functions | PASS   | All new modules follow convention                                                                                                     |
| II.4 Error Handling     | No swallowed errors                   | PASS   | Factory enforces logging. D1 (OverviewPanel) addressed in Phase 3                                                                     |
| II.6 Forbidden Patterns | No barrel files, catch-all utils      | PASS   | `delay.ts`, `error-utils.ts` are domain-specific, not catch-alls                                                                      |
| III.1 Test-First        | Tests before/alongside implementation | PASS   | New utilities already have tests; migration tasks use existing test suites                                                            |
| V.1-3 Performance       | No regressions                        | PASS   | No new server-side allocations; client libs are lightweight (Virtua ~3kB)                                                             |
| VI.1-3 Dependencies     | Pin exact, justify, no forbidden      | GATE   | 5 new packages need user approval (Phase 3)                                                                                           |
| VIII.3 AI Permissions   | Ask before installing packages        | GATE   | Will prompt before `npm install`                                                                                                      |
| IX.2 Task Granularity   | 5min–2hr, max 5 files per task        | PASS   | Migration batched by API domain (5–8 files per batch)                                                                                 |

**Gate Status**: PASS (2 gates require user approval during execution — dependency installation)

## Project Structure

### Documentation (this feature)

```text
specs/016-code-expressiveness/
├── spec.md                          # Feature specification (V2 with Part C)
├── plan.md                          # This file
├── research.md                      # Phase 0 research output (verified 2026-02-24)
├── data-model.md                    # Phase 1 data model (N/A — no new entities)
├── quickstart.md                    # Phase 1 quickstart guide
├── codebase-audit-findings.md       # Audit input (verified 2026-02-24)
├── checklists/
│   └── requirements.md              # Spec quality checklist
└── tasks.md                         # Phase 2 output (/speckit.tasks)
```

### Source Code — New & Modified Files

```text
src/
├── lib/
│   ├── utils/
│   │   └── delay.ts                    # NEW: shared delay() utility (FR-026)
│   ├── constants/
│   │   └── limits.ts                   # MODIFY: export METERS_PER_DEGREE_LAT (FR-029)
│   ├── server/
│   │   ├── env.ts                      # MODIFY: expand Zod schema from 4→19 vars (FR-023)
│   │   ├── api/
│   │   │   └── create-handler.ts       # EXISTING: route handler factory (no changes needed)
│   │   └── services/                   # MODIFY: replace process.env, /tmp/, logError()
│   ├── stores/
│   │   └── tactical-map/
│   │       └── kismet-store.ts         # MODIFY: unify as canonical Kismet data source (FR-022)
│   ├── components/
│   │   ├── ui/
│   │   │   ├── data-table/             # NEW: shadcn-svelte data-table helper (FR-017)
│   │   │   └── form/                   # NEW: formsnap components (FR-019)
│   │   └── dashboard/                  # MODIFY: add toast notifications, virtual lists
│   └── websocket/
│       └── base.ts                     # MODIFY: decompose (FR-031, >300 LOC)
├── routes/
│   └── api/                            # MODIFY: ~60 routes migrate to createHandler()
└── app.d.ts                            # MODIFY: declare globalThis types (C2 fix)
```

**Structure Decision**: Single SvelteKit monolith. All new code fits within existing directory structure. No new top-level directories. New modules (`delay.ts`, `data-table/`, `form/`) follow existing patterns.

## Complexity Tracking

| Violation                                      | Why Needed                                | Simpler Alternative Rejected Because                                                       |
| ---------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| 5 new npm packages (Part B)                    | Close documented client-side tooling gaps | Hand-rolling tables/forms/virtual-scroll is 10x more code and less maintained              |
| `*-types.ts` files for circular dep resolution | Break 8 import cycles                     | Moving types inline creates duplication; shared types module is the standard Go/TS pattern |

---

## Phase Plan

### Phase 1 — Operational Hardening (Part C, Priority P0-P1)

**Goal**: Eliminate operational fragility — hardcoded paths, bypassed env validation, magic numbers. This phase has zero behavioral changes and is pure mechanical refactoring.

**Dependency**: None. Can start immediately. Enables Phase 2 (route migration needs env constants).

| Step | FR             | Files                                                                        | Description                                                     |
| ---- | -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1.1  | FR-023         | `env.ts`, `.env.example`                                                     | Expand Zod schema: add 15 new env vars with sensible defaults   |
| 1.2  | FR-024         | `env.ts`, 10 service files                                                   | Add `ARGOS_TEMP_DIR`, replace 17 `/tmp/` paths                  |
| 1.3  | FR-025         | `env.ts`, 15+ files                                                          | Replace ~28 hardcoded localhost URLs with env-backed constants  |
| 1.4  | FR-023         | 22 files                                                                     | Migrate 46 `process.env` accesses to typed `env` import         |
| 1.5  | FR-026         | `delay.ts` (new), 21 files                                                   | Create `delay()`, migrate 38 inline patterns                    |
| 1.6  | FR-027, FR-028 | `geo.ts`, `map-helpers.ts`, `kismet.service.ts`, `kismet/devices/+server.ts` | Consolidate haversine (6→1) and MAC-to-angle (3→1)              |
| 1.7  | FR-029         | `limits.ts`, `map-helpers.ts`, 4 files                                       | Replace magic numbers with named constants                      |
| 1.8  | FR-030         | 4 service files                                                              | Add `dispose()` methods for uncleaned setInterval               |
| 1.9  | FR-033         | `kismet-control-service-extended.ts`                                         | Replace `'kali'` fallback with `os.userInfo().username`         |
| 1.10 | FR-032         | 22 files                                                                     | Migrate 60 `logError()` calls to `logger.error()`               |
| 1.11 | FR-044         | `kismet.service.ts`, `kismet/devices/+server.ts`                             | Extract FNV-1a MAC hash + GPS offset helpers into shared module |
| 1.12 | FR-040         | `serial-detector.ts`, `env.ts`                                               | Make `/var/run/gpsd.sock` configurable via env var              |
| 1.13 | FR-041         | `geo.ts`, other GPS validation sites                                         | Consolidate GPS coordinate validation (3 → 1)                   |
| 1.14 | FR-042         | `kismet-control-service-extended.ts`                                         | Migrate remaining ad-hoc retry patterns to `withRetry()`        |
| 1.15 | FR-043         | `l3-message-decoders.ts`                                                     | Replace switch/case with lookup table pattern                   |

**Verification**: `npm run build` succeeds. `npm run test:unit` passes. Zero `process.env.` in non-MCP files. Zero `/tmp/` in source. Zero `logError(` in source.

---

### Phase 2 — Route Handler Migration (Part A, Priority P1)

**Goal**: Migrate ~60 remaining route handlers to `createHandler()`. Eliminate inline `errMsg()` definitions, unsafe error casts, and inconsistent error response shapes.

**Dependency**: Phase 1 (env constants must exist before routes can reference them).

**Migration batches** (grouped by API domain, 5–8 files each):

| Step | Domain                                                                    | Files                    | Key patterns to migrate                                                    |
| ---- | ------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| 2.1  | system/\*                                                                 | 8 routes                 | Mix of `json()` + try-catch and bare returns                               |
| 2.2  | hackrf/\*                                                                 | 5 routes                 | Some use `new Response()`, streaming exempt                                |
| 2.3  | gsm-evil/\*                                                               | 10 routes                | Complex: some parse request body, some return custom status                |
| 2.4  | kismet/\*                                                                 | 5 routes                 | WebSocket proxy route exempt; REST routes migrate                          |
| 2.5  | signals/_, rf/_                                                           | 7 routes                 | Mix of query param parsing and bare returns                                |
| 2.6  | tak/\*                                                                    | 6 routes                 | POST-heavy: cert upload, enrollment, config                                |
| 2.7  | gps/_, cell-towers/_                                                      | 4 routes                 | Service delegation pattern                                                 |
| 2.8  | Remaining (weather, terminal, openwebrx, map-tiles, agent, db, streaming) | ~15 routes               | Mixed patterns                                                             |
| 2.9  | FR-015                                                                    | 8 files                  | Fix remaining unsafe error casts using `errMsg()` + type guards            |
| 2.10 | FR-014                                                                    | `create-handler.ts` docs | Document unified error response contract (`{ success, error?, details? }`) |

**Per-batch process**:

1. Read all route files in the batch
2. Replace boilerplate with `createHandler()` call
3. Remove local `errMsg()` if present (use shared import)
4. Verify: `npx tsc --noEmit` on modified files, `npm run build`
5. Run existing tests for the domain

**Status (2026-02-24 analysis)**: Only 6 routes currently use factory (pilot migration). Mass migration deferred to tasks.md Phase 18 (T068-T077, 10 batches of 5 files). SC-004 requires 50+.

**Verification**: `createHandler` import in 50+ route files. Zero local `errMsg()` definitions. Zero `(error as Error)` casts. `npm run build` succeeds. All tests pass.

---

### Phase 3 — Client-Side Tooling (Part B, Priority P2)

**Goal**: Install 5 libraries and create one demonstration of each pattern. This is additive (new code only, no migration).

**Dependency**: None (independent of Phase 1–2). Requires user approval for `npm install`.

| Step | FR     | Library                         | Demonstration target                                                                                                      |
| ---- | ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | —      | `npm install`                   | Install @tanstack/table-core, virtua, sveltekit-superforms, formsnap, @tanstack/svelte-query (user approval required)     |
| 3.2  | FR-017 | @tanstack/table-core            | Add `data-table` shadcn helper. Apply to one existing table (e.g., signals list or device table) with sorting + filtering |
| 3.3  | FR-018 | virtua                          | Add `VList` to one list displaying 100+ items (signal entries or scan results)                                            |
| 3.4  | FR-019 | sveltekit-superforms + formsnap | Add validated form to one configuration page (e.g., GSM Evil settings or TAK config)                                      |
| 3.5  | FR-020 | svelte-sonner                   | Extend toast usage beyond current 2 components to all API success/error feedback paths                                    |
| 3.6  | FR-021 | @tanstack/svelte-query          | Add query caching to one REST-only endpoint (e.g., weather, system info). WebSocket stores untouched.                     |
| 3.7  | FR-022 | —                               | Unify Kismet dual store: make tactical-map store canonical, agent-context-store derives from it                           |
| 3.8  | FR-034 | `fetchJSON<T>()` (new)          | Create shared client-side fetch wrapper. Apply to 37 sites across 19 files.                                               |

**Verification**: Each library has at least 1 working usage. `npm run build` succeeds. No new unused dependencies.

---

### Phase 4 — Structural Cleanup (Part A+C, Priority P2-P3)

**Goal**: Dead export removal, circular dependency resolution, oversized file decomposition.

**Dependency**: Phase 2 (route migration may eliminate some dead exports and change import graphs).

| Step | FR                             | Description                                                                                                                                                                   |
| ---- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | FR-008                         | Run dead export analysis (ts-prune or manual). Remove/unexport 25+ dead symbols.                                                                                              |
| 4.2  | FR-009                         | Resolve 8 circular dependency cycles by extracting shared types modules                                                                                                       |
| 4.3  | FR-031                         | Decompose 14 oversized files (>300 LOC) into focused sub-modules                                                                                                              |
| 4.4  | FR-036, FR-037, FR-038, FR-039 | Address type safety items: globalThis typing (C2/FR-036), unvalidated JSON.parse (C3/FR-037), swallowed errors in OverviewPanel (D1/FR-038), eslint-disable audit (D2/FR-039) |
| 4.5  | FR-035                         | Define typed interfaces for Kismet, OpenCelliD, gpsd, Open-Meteo responses. Migrate ~100+ unsafe `as` casts in 25+ files                                                      |

**Decomposition targets** (from research.md R12):

| File                                 | Lines | Split strategy                                                |
| ------------------------------------ | ----- | ------------------------------------------------------------- |
| `base.ts` (websocket)                | 394   | reconnect-logic.ts + message-handler.ts + heartbeat.ts        |
| `gsm-evil-store.ts`                  | 380   | gsm-evil-state.ts + gsm-evil-actions.ts + gsm-evil-derived.ts |
| `gsm-evil-health-service.ts`         | 370   | health-checks.ts + status-parser.ts                           |
| `terminal-store.ts`                  | 347   | terminal-state.ts + terminal-ws.ts                            |
| `dashboard-map-logic.svelte.ts`      | 335   | map-init.ts + marker-manager.ts                               |
| `TakConfigView.svelte`               | 329   | Extract TakConfigForm + TakConfigDisplay sub-components       |
| `error-tracker.ts`                   | 321   | error-tracking.ts + error-analysis.ts                         |
| `gsm-scan-frequency-analysis.ts`     | 313   | frequency-analysis.ts + frequency-report.ts                   |
| `gsm-scan-capture.ts`                | 313   | capture-manager.ts + capture-processor.ts                     |
| `sweep-manager.ts`                   | 313   | sweep-coordination.ts + sweep-config.ts                       |
| `tak-service.ts`                     | 312   | tak-connection.ts + tak-operations.ts                         |
| `kismet-control-service-extended.ts` | 306   | kismet-control.ts + kismet-status.ts                          |
| `DashboardMap.svelte`                | 300   | Borderline — extract map-controls sub-component if needed     |

**Verification**: `madge --circular src/` reports 0 cycles. Zero dead exports per ts-prune. Zero non-exempt files > 300 LOC. `npm run build` succeeds. All tests pass.

---

### Phase 5 — Final Verification & Metrics

**Goal**: Validate all 35 success criteria. Record before/after metrics.

| Step | Description                                                                                   |
| ---- | --------------------------------------------------------------------------------------------- |
| 5.1  | Run full test suite: `npm run test:unit`, `npm run test:integration`, `npm run test:security` |
| 5.2  | Run `npm run build` — verify zero new warnings                                                |
| 5.3  | Measure LOC delta (target: -1,000 from Part A+C)                                              |
| 5.4  | Verify each SC-001 through SC-035 with targeted grep/search                                   |
| 5.5  | Coverage gate: verify ≥80% branch coverage on new shared utilities (Constitution III.2)       |
| 5.6  | FR-014 validation: spot-check 10 migrated routes for unified error response shape             |
| 5.7  | Run production build, measure bundle size delta                                               |
| 5.8  | Document final metrics in verification report                                                 |

---

## Risk Register

| Risk                                             | Likelihood | Impact | Mitigation                                                               |
| ------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------ |
| Route migration breaks existing API behavior     | Medium     | High   | Batch by domain, test each batch, verify with existing integration tests |
| OOM during concurrent typecheck/build on RPi 5   | High       | Medium | Single-instance lock on typecheck hook, never run concurrent builds      |
| New npm packages have Svelte 5 incompatibilities | Low        | Medium | All libraries verified against Svelte 5.35.5 in research                 |
| Circular dep resolution creates new cycles       | Low        | Medium | `madge --circular` check after each resolution                           |
| Oversized file decomposition breaks imports      | Medium     | Medium | Find-and-replace all consumers after each split                          |
| env.ts expansion breaks startup for missing vars | Medium     | High   | All new vars have sensible defaults; existing .env preserved             |

---

## Phasing Dependencies

```
Phase 1 (Operational Hardening)
    │
    ├──→ Phase 2 (Route Migration) ──→ Phase 4 (Structural Cleanup)
    │                                         │
    │                                         ├──→ Phase 5 (Verification)
    │                                         │
Phase 3 (Client Libraries) ─────────────────────┘
```

Phase 1 and Phase 3 are independent and could run in parallel (different files, different layers). Phase 2 depends on Phase 1 (routes need env constants). Phase 4 depends on Phase 2 (dead exports change after migration). Phase 5 depends on all others.
