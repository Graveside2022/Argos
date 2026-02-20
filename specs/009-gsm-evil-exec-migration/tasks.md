# Tasks: GSM Evil & Kismet Extended — Safe Exec Migration

**Input**: Design documents from `/specs/009-gsm-evil-exec-migration/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md
**Branch**: `009-gsm-evil-exec-migration`

**Tests**: WAIVED per constitution check — GSM Evil has no dedicated unit tests. Regression relies on TypeScript compilation + security tests.

**Organization**: Single user story (P1) — tasks organized by execution phase from plan.md (security gaps → routes → services → Kismet → cleanup → carryover).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1]**: User Story 1 — Eliminate Shell Injection in GSM Evil Subsystem
- Include exact file paths in descriptions

---

## Phase 1: Security Gaps (Fix Validation Before Migration)

**Purpose**: Add missing input validation to 5 identified security gaps. This ensures all dynamic values are validated regardless of migration.

- [x] T001 [US1] Add `validateNumericParam()` for PID parsed from ps output in `src/routes/api/gsm-evil/status/+server.ts`
- [x] T002 [US1] Add `validateNumericParam()` for frequency from hackrf_sweep output in `src/routes/api/gsm-evil/intelligent-scan/+server.ts`
- [x] T003 [US1] Add path validation (allowlist) for `imsiDbPath` in `src/routes/api/gsm-evil/activity/+server.ts`
- [x] T004 [US1] Add `validateInterfaceName()` for `alfaInterface` from sysfs in `src/lib/server/services/kismet/kismet-control-service-extended.ts`
- [x] T005 [US1] Add port validation with `validateNumericParam()` for lsof port in `src/lib/server/services/kismet/kismet-control-service-extended.ts` (carryover I3)

**Checkpoint**: All dynamic values validated. Run `npm run typecheck` — 0 errors.

---

## Phase 2: GSM Evil Route Migrations (Simple, Static Commands)

**Purpose**: Migrate the 7 GSM Evil API routes. Most use static commands or already-validated parameters. Low risk, 26 call sites.

- [x] T006 [P] [US1] Migrate `legacyShellExec` → `execFileAsync`/`fs` in `src/routes/api/gsm-evil/live-frames/+server.ts` (2 calls — simplest file, 1 actual exec)
- [x] T007 [P] [US1] Migrate `legacyShellExec` → `execFileAsync`/`fs` in `src/routes/api/gsm-evil/frames/+server.ts` (3 calls — pipe chain + fs)
- [x] T008 [P] [US1] Migrate `legacyShellExec` → `execFileAsync` in `src/routes/api/gsm-evil/status/+server.ts` (5 calls — multi-pipe chains → pgrep/ps)
- [x] T009 [P] [US1] Migrate `legacyShellExec` → `execFileAsync`/`fs`/`better-sqlite3` in `src/routes/api/gsm-evil/activity/+server.ts` (5 calls — pipes, redirects, inline Python)
- [x] T010 [P] [US1] Migrate `legacyShellExec` → `fs`/`better-sqlite3` in `src/routes/api/gsm-evil/imsi-data/+server.ts` (3 calls — inline Python → better-sqlite3)
- [x] T011 [P] [US1] Migrate `legacyShellExec` → `fs`/`better-sqlite3` in `src/routes/api/gsm-evil/imsi/+server.ts` (3 calls — inline Python → better-sqlite3)
- [x] T012 [US1] Migrate `legacyShellExec` → `execFileAsync`/`spawn` in `src/routes/api/gsm-evil/intelligent-scan/+server.ts` (5 calls — pipes, background, redirects)
- [x] T013 [US1] Run `npm run typecheck && npm run build` — verify 0 errors after all route migrations

**Checkpoint**: All 7 route files migrated. `grep -rn "legacyShellExec" src/routes/` returns 0 matches.

---

## Phase 3: GSM Evil Service Migrations (Complex Shell Patterns)

**Purpose**: Migrate the 4 GSM Evil service files. Contains the hardest patterns: background processes, inline Python, pipe chains, sed scripting. 57 call sites.

- [x] T014 [US1] Migrate `legacyShellExec` → `execFileAsync`/`better-sqlite3`/`fetch` in `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts` (9 calls — multi-pipe chains, inline Python SQL → better-sqlite3)
- [x] T015 [US1] Migrate `legacyShellExec` → `execFileAsync`/`fs` in `src/lib/server/services/gsm-evil/gsm-scan-service.ts` (11 calls — pipes, redirects, process discovery)
- [x] T016 [US1] Migrate `legacyShellExec` → `execFileAsync`/`spawn`/`fs` in `src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts` (17 calls — background processes, pipes, redirects, PID capture)
- [x] T017 [US1] Migrate `legacyShellExec` → `execFileAsync`/`spawn`/`fs` in `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts` (20 calls — background/nohup, nested shell, redirects, sed → fs operations)
- [x] T018 [US1] Run `npm run typecheck && npm run build` — verify 0 errors after all service migrations

**Checkpoint**: All 4 service files migrated. `grep -rn "legacyShellExec" src/lib/server/services/gsm-evil/` returns 0 matches.

---

## Phase 4: Kismet Extended Migration

**Purpose**: Migrate kismet-control-service-extended.ts. Contains credential-via-curl (→ fetch), kismet daemonization via bash -c (→ spawn), and repetitive pgrep patterns. 17 call sites.

- [x] T019 [US1] Migrate `legacyShellExec` → `execFileAsync`/`spawn`/`fetch`/`fs` in `src/lib/server/services/kismet/kismet-control-service-extended.ts` (17 calls — bash -c → spawn, curl → fetch, pgrep patterns)
- [x] T020 [US1] Run `npm run typecheck && npm run build` — verify 0 errors after Kismet migration

**Checkpoint**: Kismet file migrated. `grep -rn "legacyShellExec" src/lib/server/services/kismet/` returns 0 matches.

---

## Phase 5: Cleanup & Verification

**Purpose**: Delete the legacy shim, verify zero shell execution remains, run full test suite.

- [x] T021 [US1] Delete `src/lib/server/legacy-shell-exec.ts` — remove the legacyShellExec shim entirely
- [x] T022 [US1] Verify zero `legacyShellExec` or `promisify(exec)` imports remain: `grep -r "legacyShellExec\|promisify(exec)" src/ --include="*.ts"` returns 0 matches
- [x] T023 [US1] Verify only `execFile` and `spawn` imports from `child_process`: `grep -r "from 'child_process'" src/ --include="*.ts" | grep -v "execFile\|spawn"` returns 0 matches
- [x] T024 [US1] Run full verification suite: `npm run typecheck && npm run build && npm run test:unit && npm run test:security` — all pass

**Checkpoint**: SC-001 through SC-005 met. Zero shell injection vectors remain.

---

## Phase 6: Carryover Items (Low-Effort Fixes from 008 Review)

**Purpose**: Address actionable carryover items from the 008 code review.

- [x] T025 [P] Replace `setTimeout` hack with MapLibre load event in `src/lib/components/dashboard/map/map-setup.ts` (carryover S4)
- [x] T026 [P] Add sudoers configuration documentation to `deployment/` for all `sudo` usage in service files (carryover S5)
- [x] T027 Run final verification: `npm run typecheck && npm run build && npm run test:unit && npm run test:security` — all pass

**Checkpoint**: All carryover items complete. Branch ready for review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Security Gaps)**: No dependencies — can start immediately. T001–T005 are all [P] parallelizable.
- **Phase 2 (Routes)**: Depends on Phase 1 validation fixes being in place. T006–T011 are [P] parallelizable; T012 is sequential (most complex route).
- **Phase 3 (Services)**: Depends on Phase 2 (shared patterns established). Sequential within phase (increasing complexity).
- **Phase 4 (Kismet)**: Depends on Phase 3 (GSM Evil patterns proven). Single file.
- **Phase 5 (Cleanup)**: Depends on Phases 2–4 (all callers migrated before shim deletion).
- **Phase 6 (Carryover)**: Independent of Phases 1–5. T025 and T026 are [P] parallelizable.

### Within Each Phase

- Files marked [P] can be migrated in parallel (no shared state)
- Verification tasks (T013, T018, T020, T024, T027) are sequential checkpoints
- Each file migration = 1 commit per constitution IX-9.2

### Parallel Opportunities

```bash
# Phase 1: All 5 validation tasks can run in parallel
T001, T002, T003, T004, T005

# Phase 2: Routes T006–T011 can run in parallel (different files)
T006, T007, T008, T009, T010, T011

# Phase 6: Carryover items can run in parallel
T025, T026
```

---

## Implementation Strategy

### Sequential Execution (Single Developer)

1. Complete Phase 1: Security gaps (T001–T005) → commit
2. Complete Phase 2: Route migrations (T006–T013) → commit per file
3. Complete Phase 3: Service migrations (T014–T018) → commit per file
4. Complete Phase 4: Kismet migration (T019–T020) → commit
5. Complete Phase 5: Cleanup (T021–T024) → commit
6. Complete Phase 6: Carryover (T025–T027) → commit per item

### Verification After Each File

After each file migration, verify:
1. `npm run typecheck` — 0 errors
2. `grep -rn "legacyShellExec" <migrated-file>` — 0 matches
3. No new `any` types introduced
4. All try/catch blocks have explicit error handling

---

## Notes

- **No new files created** — all changes are in-place migrations within existing files
- **`legacy-shell-exec.ts` deleted as final task** — only after ALL callers migrated
- **1 task = 1 commit, max 5 files** per constitution IX-9.2
- **Pattern reference**: See plan.md § Migration Patterns for A–E templates
- **Security gaps**: See research.md § R3 for the 5 unvalidated dynamic values
- Total: 27 tasks across 6 phases
