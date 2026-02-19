# Implementation Plan: Codebase Hardening

**Branch**: `008-codebase-hardening` | **Date**: 2026-02-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-codebase-hardening/spec.md`

## Summary

Eliminate all unsafe shell calls (19 files, ~66 call sites), decompose all oversized files (51 actionable files >300 lines), and fix remaining convention violations (4 UI elements). Three sequential workstreams: (A) mechanical exec-to-execFile migration across all server-side code, (B) file decomposition using extract-and-orchestrate pattern prioritized by file size, (C) minor convention fixes. Full implementation plan: `docs/plans/2026-02-19-codebase-hardening.md`.

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode)
**Primary Dependencies**: SvelteKit 2.22, Svelte 5, Node.js child_process (execFile/spawn), better-sqlite3
**Storage**: SQLite (rf_signals.db)
**Testing**: Vitest 3.2.4 (47 test files, ~250+ tests, 151 security-specific)
**Target Platform**: Raspberry Pi 5, Kali Linux 2025.4 (aarch64), native host (no Docker for main app)
**Project Type**: Web application (SvelteKit fullstack)
**Performance Goals**: WebSocket msg <16ms, spectrum display >30fps, <200MB heap
**Constraints**: 8GB RAM shared with SDR tools, earlyoom active, single Vitest worker for memory
**Scale/Scope**: 19 files to migrate (Workstream A), 51 files to decompose (Workstream B), 4 UI elements to fix (Workstream C)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Article  | Rule                                           | Status      | Notes                                                                                                                     |
| -------- | ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| II-2.1   | No `any`                                       | PASS        | 4 existing `as any` are documented library limitations, no new ones introduced                                            |
| II-2.2   | Max 300 lines per file                         | IN PROGRESS | 51 files exceed — this branch fixes Tier 1 (4 files >1000 lines); Tier 2/3 deferred to follow-up branch                   |
| II-2.6   | No barrel files                                | PASS        | All eliminated in prior branch                                                                                            |
| II-2.6   | No hardcoded hex colors                        | PASS        | Addressed in prior branch                                                                                                 |
| III-3.1  | Test-first                                     | ADAPTED     | Mechanical refactoring — existing 250+ tests as regression net; no new behavior = no test-first. See spec.md Assumptions. |
| VIII-8.1 | Validate all inputs                            | IN PROGRESS | Shell call migration adds input validation at every dynamic call site                                                     |
| IX-9.2   | 1 task = 1 commit                              | PASS        | Plan structured as atomic commits per task                                                                                |
| IX-9.3   | Commit format: type(scope): TXXX — description | PASS        | All commit messages follow convention                                                                                     |

**Gate result**: PASS — no blocking violations. Two IN PROGRESS items are the purpose of this branch.

## Project Structure

### Documentation (this feature)

```text
specs/008-codebase-hardening/
├── spec.md              # Feature specification (stakeholder-oriented)
├── plan.md              # This file
├── research.md          # Phase 0 research decisions
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── components/dashboard/        # Svelte components (decomposition targets: B1-B4)
│   │   ├── DashboardMap.svelte      # 1794 lines → map/ subdirectory
│   │   ├── TopStatusBar.svelte      # 1203 lines → status/ subdirectory
│   │   ├── panels/DevicesPanel.svelte # 1047 lines → panels/devices/ subdirectory
│   │   └── ...
│   ├── server/
│   │   ├── hardware/                # Hardware managers (migration targets: A4-A5)
│   │   ├── kismet/                  # Kismet services (migration targets: A6)
│   │   ├── mcp/servers/             # MCP servers (migration target: A7)
│   │   ├── security/input-sanitizer.ts  # Validation library (used by migrations)
│   │   └── host-exec.ts             # DELETED by Task A1
│   ├── constitution/                # Audit tools (migration target: A7)
│   └── ...
├── routes/api/                      # API routes (migration targets: A2-A3)
└── hooks.server.ts                  # Auth/rate-limit (decomposition target: B-Tier2)

tests/
├── security/                        # 9 files, 151 tests — regression safety net
├── unit/                            # 11 files — component and service tests
├── integration/                     # 3 files — API and WebSocket tests
└── ...
```

**Structure Decision**: Existing SvelteKit monorepo structure. New files created only during decomposition — always as siblings or subdirectories of the file being decomposed. No new top-level directories.

## Complexity Tracking

No constitution violations need justification. All changes are remediation of existing violations.

## Task Summary

| ID  | Workstream      | Description                              | Files | Risk     |
| --- | --------------- | ---------------------------------------- | ----- | -------- |
| A0  | Shell Migration | Migrate alfa-detector.ts (1 static call) | 1     | LOW      |
| A1  | Shell Migration | Delete host-exec.ts wrapper              | 1     | CRITICAL |
| A2  | Shell Migration | Migrate 5 API routes (static commands)   | 5     | LOW      |
| A3  | Shell Migration | Migrate 2 API routes (dynamic commands)  | 2     | HIGH     |
| A4  | Shell Migration | Migrate 3 detection files                | 3     | HIGH     |
| A5  | Shell Migration | Migrate 2 hardware managers              | 2     | CRITICAL |
| A6  | Shell Migration | Migrate 2 Kismet services                | 2     | CRITICAL |
| A7  | Shell Migration | Migrate 3 remaining libraries            | 3     | MEDIUM   |
| B1  | Decomposition   | DashboardMap.svelte (1794 lines)         | 6     | MEDIUM   |
| B2  | Decomposition   | sweep-manager.ts (1417 lines)            | 4     | MEDIUM   |
| B3  | Decomposition   | TopStatusBar.svelte (1203 lines)         | 4     | MEDIUM   |
| B4  | Decomposition   | DevicesPanel.svelte (1047 lines)         | 4     | MEDIUM   |
| C1  | Convention      | Migrate 4 raw HTML elements to shadcn    | 2     | LOW      |
| C2  | Convention      | Add constitutional exemptions            | 4     | LOW      |

**Full task details**: See `docs/plans/2026-02-19-codebase-hardening.md`

### Task ID Cross-Reference

| Plan ID  | tasks.md ID | Description                          |
| -------- | ----------- | ------------------------------------ |
| (setup)  | T001-T002   | Baseline verification + caller audit |
| A1       | T003        | Delete host-exec.ts wrapper          |
| A0       | T004        | Migrate alfa-detector.ts             |
| A2       | T005-T009   | Migrate 5 API routes (static)        |
| (verify) | T010        | Intermediate verification            |
| A3       | T011-T012   | Migrate 2 API routes (dynamic)       |
| A4       | T013-T015   | Migrate 3 detection files            |
| (verify) | T016        | Intermediate verification            |
| A5       | T017-T018   | Migrate 2 hardware managers          |
| A6       | T019-T020   | Migrate 2 Kismet services            |
| (verify) | T021        | Intermediate verification            |
| A7       | T022-T024   | Migrate 3 remaining libraries        |
| (verify) | T025        | Final US1 verification               |
| B1       | T026        | Decompose DashboardMap.svelte        |
| B2       | T027        | Decompose sweep-manager.ts           |
| B3       | T028        | Decompose TopStatusBar.svelte        |
| B4       | T029        | Decompose DevicesPanel.svelte        |
| (verify) | T030        | US2 verification                     |
| C1       | T031        | Migrate 4 raw HTML elements          |
| C2       | T032        | Add constitutional exemptions        |
| (verify) | T033-T036   | US3 + final verification suite       |
