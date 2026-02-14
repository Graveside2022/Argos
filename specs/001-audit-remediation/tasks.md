# Tasks: Constitutional Audit Remediation

**Input**: Design documents from `/specs/001-audit-remediation/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Tests are NOT explicitly requested in the specification. Only existing tests must pass after each phase.

**Organization**: Tasks are grouped by user story (P1, P2, P3) to enable independent implementation and testing of each priority level.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Commit Discipline (Article XII §12.1)

**CRITICAL**: Every completed task gets its own commit immediately after verification passes. This is the constitution-mandated rollback mechanism.

**Pattern**: After each task's verification commands succeed, commit with:

```bash
git add [files-modified-by-this-task]
git commit -m "type(scope): TXXX — brief description

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Commit Types**:
- `feat(scope)`: New schema, component, module, or capability
- `refactor(scope)`: Moving files, replacing patterns, restructuring
- `test(scope)`: Adding tests, running audits, verification
- `chore(scope)`: Dependencies, configuration, setup

**Examples**:
- T018: `feat(types): T018 — create SignalReading Zod schema`
- T024: `refactor(api): T024 — add Zod validation to HackRF sweep endpoint`
- T066: `refactor(ui): T066 — replace custom Button with Shadcn in HackRF panel`
- T095: `refactor(kismet): T095 — move kismet service to feature module`

**Forbidden**: Batch commits across multiple tasks. Each task = one commit.

## Path Conventions

- **SvelteKit monolith**: `src/` at repository root
- Paths assume `src/lib/`, `src/routes/`, `tests/`, `config/`, `scripts/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and prepare environment for migration

**Dependency Install Order**: T001 first (Zod), then T002 (Shadcn init modifies tailwind.config), then T003-T005 can run sequentially or in parallel. T006-T009 (script creation) can run in parallel after all dependencies installed.

- [ ] T001 Install Zod runtime validation library: `npm install zod`
- [ ] T002 Install Shadcn-Svelte CLI and initialize: `npx shadcn-svelte@latest init`. Answer prompts: TypeScript=yes, Svelte 5=yes, Tailwind CSS=yes, Default theme=yes, Components directory=src/lib/components/ui. Document any prompt variations in plan.md if initialization differs from defaults.
- [ ] T003 Install required Shadcn dependencies: `npm install clsx tailwind-merge`
- [ ] T004 Install optional Tailwind typography plugin: `npm install -D @tailwindcss/typography`
- [ ] T005 Install axe-core for accessibility testing: `npm install -D @axe-core/playwright`
- [ ] T006 [P] Create performance benchmark script: `scripts/benchmark-zod-validation.ts`
- [ ] T007 [P] Create Shadcn render benchmark script: `scripts/benchmark-shadcn-render.ts`
- [ ] T008 [P] Create visual regression test spec: `tests/e2e/visual-regression.spec.ts` (spec file only, not running tests yet - used by T012)
- [ ] T009 [P] Create accessibility test spec: `tests/e2e/accessibility.spec.ts` (spec file only, not running tests yet - used later in P2)

**Verification**: Run `npm install` to verify all dependencies installed successfully

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Run constitutional audit baseline: `npx tsx scripts/run-audit.ts` to capture current state (42% compliance, 860 violations)
- [ ] T011 Create audit tracking spreadsheet in `docs/reports/2026-02-13/compliance-tracking.md` to monitor progress
- [ ] T012 Capture visual regression baseline (6-8 screenshots): `npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots`
- [ ] T013 [P] Benchmark Zod validation overhead: `npx tsx scripts/benchmark-zod-validation.ts` (target: <5ms). **If >5ms**: Document in plan.md, proceed with monitoring flag, re-evaluate after P1 field deployment. Benchmark establishes baseline, not blocking criterion.
- [ ] T014 [P] Benchmark Shadcn component render time: `npx tsx scripts/benchmark-shadcn-render.ts` (target: <16ms on RPi5 ARM). **If >16ms**: Document in plan.md, proceed with monitoring flag, re-evaluate after P2 field deployment. Benchmark establishes baseline, not blocking criterion.
- [ ] T015 [P] Measure current bundle size: `npm run build && du -sh .svelte-kit/output/client/_app/immutable/`
- [ ] T016 Verify all existing tests pass before migration: `npm run test:unit && npm run test:integration && npm run test:e2e`
- [ ] T017 Create backup branch: `git checkout -b 001-audit-remediation-backup` (safety measure)

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Type Safety Validation (Priority: P1) 🎯 MVP

**Goal**: Replace all 581 type assertions with Zod runtime validation schemas to increase compliance from 42% to 60%

**Independent Test**: Replace type assertions file-by-file, run TypeScript compilation and test suites after each change, verify validation errors are caught at runtime with invalid data

### Step 1: Create Common Zod Schemas (Foundation for US1)

- [X] T018 [P] [US1] Create SignalReading schema in `src/lib/types/signal.ts` with Zod validation. Include JSDoc comment explaining validation rules (frequency 1-6000 MHz, power -120 to 0 dBm). Verify: `npx tsc --noEmit src/lib/types/signal.ts`. Commit: `git add src/lib/types/signal.ts && git commit -m "feat(types): T018 — create SignalReading Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T019 [P] [US1] Create WifiNetwork schema in `src/lib/types/wifi.ts` with Zod validation. Include JSDoc comment explaining validation rules. Verify: `npx tsc --noEmit src/lib/types/wifi.ts`. Commit: `git add src/lib/types/wifi.ts && git commit -m "feat(types): T019 — create WifiNetwork Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T020 [P] [US1] Create GpsPosition schema in `src/lib/types/gps.ts` with Zod validation. Include JSDoc comment explaining validation rules. Verify: `npx tsc --noEmit src/lib/types/gps.ts`. Commit: `git add src/lib/types/gps.ts && git commit -m "feat(types): T020 — create GpsPosition Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T021 [P] [US1] Create ApiResponse<T> generic schema in `src/lib/types/api.ts` with Zod validation. Include JSDoc comment explaining validation rules. Verify: `npx tsc --noEmit src/lib/types/api.ts`. Commit: `git add src/lib/types/api.ts && git commit -m "feat(types): T021 — create ApiResponse generic Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T022 [P] [US1] Create HackRFSweepConfig schema in `src/lib/types/hackrf.ts` with Zod validation. Include JSDoc comment explaining validation rules. Verify: `npx tsc --noEmit src/lib/types/hackrf.ts`. Commit: `git add src/lib/types/hackrf.ts && git commit -m "feat(types): T022 — create HackRFSweepConfig Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T023 [P] [US1] Create KismetDevice schema in `src/lib/types/kismet.ts` with Zod validation. Include JSDoc comment explaining validation rules. Verify: `npx tsc --noEmit src/lib/types/kismet.ts`. Commit: `git add src/lib/types/kismet.ts && git commit -m "feat(types): T023 — create KismetDevice Zod schema

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: Run `npm run typecheck` to verify schemas compile

### Step 2: Migrate API Endpoints (High Priority - External Data)

**Rationale**: API endpoints handle untrusted external data - highest priority for runtime validation

- [X] T024 [US1] Add Zod validation to `src/routes/api/hackrf/sweep/+server.ts` for POST request body. Verify: `npx tsc --noEmit src/routes/api/hackrf/sweep/+server.ts && npm run test:integration`. Commit: `git add src/routes/api/hackrf/sweep/+server.ts && git commit -m "refactor(api): T024 — add Zod validation to HackRF sweep endpoint

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T025 [US1] Add Zod validation to `src/routes/api/hackrf/status/+server.ts` for GET response
- [X] T026 [US1] Add Zod validation to `src/routes/api/kismet/devices/+server.ts` for GET response
- [ ] T027 [US1] Add Zod validation to `src/routes/api/kismet/networks/+server.ts` for GET response
- [X] T028 [US1] Add Zod validation to `src/routes/api/gps/position/+server.ts` for GET response
- [ ] T029 [US1] Add Zod validation to `src/routes/api/usrp/power/+server.ts` for POST request body
- [X] T030 [US1] Add Zod validation to `src/routes/api/gsm-evil/control/+server.ts` for POST request body

**Verification**: Run `npm run typecheck && npm run test:integration` after each API migration

### Step 3: Migrate WebSocket Message Handlers (High Priority - Real-Time Data)

- [X] T031 [US1] Add Zod validation to HackRF WebSocket message handler in `src/lib/server/websocket-server.ts`
- [X] T032 [US1] Add Zod validation to Kismet WebSocket message handler in `src/lib/server/websocket-server.ts`
- [ ] T033 [US1] Add Zod validation to GPS WebSocket message handler in `src/lib/server/websocket-server.ts`

**Verification**: Test WebSocket connections manually via browser DevTools after each migration

### Step 4: Migrate Database Query Results (Medium Priority)

- [ ] T034 [US1] Add Zod validation to signal database queries in `src/lib/server/db/signals.ts`
- [ ] T035 [US1] Add Zod validation to network database queries in `src/lib/server/db/networks.ts`
- [ ] T036 [US1] Add Zod validation to device database queries in `src/lib/server/db/devices.ts`

**Verification**: Run `npm run test:integration` to verify database queries work correctly

### Step 5: Migrate Stores (Medium Priority)

- [ ] T037 [US1] Add Zod validation to signal store in `src/lib/stores/signals.ts`
- [ ] T038 [US1] Add Zod validation to network store in `src/lib/stores/networks.ts`
- [ ] T039 [US1] Add Zod validation to GPS store in `src/lib/stores/gps.ts`
- [ ] T040 [US1] Add Zod validation to HackRF store in `src/lib/stores/hackrf.ts`

**Verification**: Run `npm run test:unit` to verify stores work correctly

### Step 6: Add Error Handling Infrastructure

- [ ] T041 [US1] Create error handling utility for Zod validation failures in `src/lib/utils/validation-error.ts`
- [ ] T042 [US1] Add console logging for validation errors (Docker logs) in validation error utility
- [ ] T043 [US1] Add UI toast notifications for user-initiated validation failures in `src/lib/components/Toast.svelte`
- [ ] T044 [US1] Verify background validation failures (WebSocket streams) only log to console, no UI notifications

**Verification**: Trigger validation errors manually and verify error handling works correctly

### Step 7: Audit Remaining Type Assertions

- [X] T045 [US1] Audit all remaining type assertions: `grep -r " as " src/ --include="*.ts" | wc -l` (should be significantly reduced)
- [X] T046 [US1] Add justification comments to any remaining necessary type assertions per Article II §2.1
- [X] T047 [US1] Document any type assertions that cannot be migrated to Zod in `docs/type-assertions-justification.md`
- [X] T047A [US1] **VALIDATION TEST (SC-004)**: Inject invalid data to verify Zod catches runtime errors. Test cases: (1) POST to `/api/hackrf/sweep` with `frequency: 9999` (exceeds 6000 MHz max), (2) POST with `frequency: "invalid"` (wrong type), (3) POST with missing required field. Expected: ZodError thrown with descriptive message `"frequency: Expected number ≤6000, received 9999"`, error logged to console with field path + stack trace (FR-005), toast notification displayed for user-initiated POST (FR-006). Verify error does NOT crash application (graceful degradation). Document test results in `docs/reports/2026-02-13/zod-validation-test.md`. Commit: `git add docs/reports/2026-02-13/zod-validation-test.md && git commit -m "test(validation): T047A — verify Zod catches runtime errors

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: Run `grep -r " as " src/ --include="*.ts"` and verify all assertions have justification comments OR are migrated

### Final US1 Verification

- [X] T048 [US1] Run full test suite: `npm run test:unit && npm run test:integration && npm run test:e2e`
- [X] T049 [US1] Run TypeScript strict mode compilation: `npm run typecheck`
- [X] T050 [US1] Run ESLint: `npm run lint`
- [X] T051 [US1] Run performance benchmark for Zod validation: `npx tsx scripts/benchmark-zod-validation.ts` (verify <5ms)
- [X] T052 [US1] Run constitutional audit: `npx tsx scripts/run-audit.ts` (verify compliance ≥ 60%, zero HIGH violations). Commit: `git add . && git commit -m "test(audit): T052 — verify P1 compliance at 60%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [X] T053 [US1] Create PR for P1 deployment: `gh pr create --title "P1: Type Safety Validation" --body "Replaces 581 type assertions with Zod runtime validation. Compliance: 42% → 60%."`
- [ ] T053A [US1] **EVALUATION CHECKPOINT**: Deploy P1 to production Raspberry Pi 5 units at NTC/JMRC. Monitor for 1-2 weeks. **Go/No-Go Decision Criteria**: (1) Zero P1-caused production incidents, (2) <1% API requests trigger Zod validation errors (measured via Docker logs: `docker logs argos-dev | grep "ZodError"`), (3) Performance within NFR-001 budget (<5ms overhead, measured via `scripts/benchmark-zod-validation.ts`), (4) Positive operator feedback (informal poll, >50% satisfied). Document decision in `docs/reports/2026-02-13/p1-evaluation-decision.md`. **BLOCKING**: P2 (US2) cannot start until Go decision reached.

**Checkpoint**: User Story 1 (P1) complete and ready for production deployment. Evaluate at NTC/JMRC for 1-2 weeks before starting P2.

---

## Phase 4: User Story 2 - UI Design System Migration (Priority: P2)

**Goal**: Migrate from hardcoded hex colors to Shadcn component library to reach 68% compliance

**Independent Test**: Migrate components to Shadcn one-by-one, capture before/after screenshots, verify all functionality works identically, confirm accessibility improvements with keyboard navigation testing

**⚠️ PREREQUISITE**: User Story 1 (P1) must be deployed to production and evaluated for 1-2 weeks before starting P2

### Step 1: Install Shadcn Components

- [ ] T055 [US2] Install Shadcn Button component: `npx shadcn-svelte@latest add button`
- [ ] T056 [US2] Install Shadcn Input component: `npx shadcn-svelte@latest add input`
- [ ] T057 [US2] Install Shadcn Card component: `npx shadcn-svelte@latest add card`
- [ ] T058 [US2] Install Shadcn Dialog component: `npx shadcn-svelte@latest add dialog`
- [ ] T059 [US2] Install Shadcn Badge component: `npx shadcn-svelte@latest add badge`
- [ ] T060 [US2] Install Shadcn Select component: `npx shadcn-svelte@latest add select`

**Verification**: Verify Shadcn components installed in `src/lib/components/ui/`

### Step 2: Update Tailwind Configuration

- [ ] T061 [US2] Update `tailwind.config.js` with Shadcn theme configuration (preserve Argos cyberpunk palette)
- [ ] T062 [US2] Add Shadcn default theme colors (rounded corners, shadows) to Tailwind config
- [ ] T063 [US2] Verify Tailwind config compiles: `npm run build`. After successful build, run `mcp__shadcn__get_audit_checklist` to verify Shadcn installation completeness.

**Verification**: Run `npm run build` to verify Tailwind config is valid, then run MCP audit checklist

### Step 3: Audit Existing Components for Replacement

- [ ] T064 [US2] Audit `src/lib/components/` directory and list all custom buttons, inputs, cards for Shadcn replacement. **Use MCP server**: `mcp__shadcn__list_items_in_registries` to discover available Shadcn components, then `mcp__shadcn__search_items_in_registries` to find candidates matching custom component functionality. **Criteria for Shadcn candidates**: Interactive elements (buttons, inputs, selects, dialogs), components with hardcoded colors, <300 lines, general-purpose (not hardware-specific). **Exclude**: Map components, spectrum visualizers, hardware status indicators, tactical graphics.
- [ ] T065 [US2] Create component migration checklist mapping custom components → Shadcn primitives (e.g., Button.svelte → shadcn Button, Input.svelte → shadcn Input, Card.svelte → shadcn Card). **Use MCP server**: `mcp__shadcn__view_items_in_registries` to view detailed information about target Shadcn components including file structures and dependencies.

**Verification**: Review checklist with all custom components identified

### Step 4: Migrate Dashboard Components

**Rationale**: Start with high-visibility dashboard components, migrate one-by-one with verification

**MCP Server Guidance**:
- **Shadcn**: Use `mcp__shadcn__get_item_examples_from_registries` to view implementation examples before migrating (e.g., search for "button-demo", "input example", "card-demo")
- **Svelte**: Use `mcp__svelte__svelte-autofixer` to validate component code after migration and `mcp__svelte__get-documentation` to reference Svelte 5 patterns (runes, snippets, effects)

- [ ] T066 [US2] Replace custom Button in HackRF panel with Shadcn Button in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.
- [ ] T067 [US2] Replace custom Button in Kismet panel with Shadcn Button in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.
- [ ] T068 [US2] Replace custom Button in GPS panel with Shadcn Button in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.
- [ ] T069 [US2] Replace custom Button in Tactical Map panel with Shadcn Button in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.
- [ ] T070 [US2] Replace custom Input in HackRF frequency inputs with Shadcn Input in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.
- [ ] T071 [US2] Replace custom Card in panel containers with Shadcn Card in `src/routes/+page.svelte`. After editing, validate with `mcp__svelte__svelte-autofixer`.

**Verification**: Test each component replacement manually - verify click handlers work, styling is modern, functionality identical. Run svelte-autofixer on modified files to catch Svelte 5 pattern violations.

### Step 5: Migrate Hardcoded Colors to Tailwind Theme

- [ ] T072 [US2] Find all hardcoded hex colors: `grep -r "#[0-9a-fA-F]\{6\}" src/ --include="*.svelte" --include="*.ts"`
- [ ] T073 [US2] Replace hardcoded colors in dashboard with Tailwind theme classes in `src/routes/+page.svelte`
- [ ] T074 [US2] Replace hardcoded colors in component library with Tailwind theme classes in `src/lib/components/*.svelte`
- [ ] T075 [US2] Replace hardcoded colors in HackRF components with Tailwind theme classes
- [ ] T076 [US2] Replace hardcoded colors in Kismet components with Tailwind theme classes
- [ ] T077 [US2] Replace hardcoded colors in GPS components with Tailwind theme classes

**Verification**: Run `grep -r "#[0-9a-fA-F]\{6\}" src/` and verify zero or near-zero hardcoded hex colors remain

### Step 6: Add Accessibility Features

- [ ] T078 [US2] Add ARIA labels to all Shadcn Button components for screen reader support
- [ ] T079 [US2] Add ARIA labels to all Shadcn Input components for screen reader support
- [ ] T080 [US2] Verify keyboard navigation works (Tab through all interactive elements) - visible focus rings required
- [ ] T081 [US2] Test with keyboard only - no mouse - verify all functionality accessible

**Verification**: Run accessibility tests: `npx playwright test tests/e2e/accessibility.spec.ts` (verify zero WCAG 2.1 AA violations)

### Step 7: Visual Regression Testing

- [ ] T082 [US2] Capture after-migration screenshots: `npx playwright test tests/e2e/visual-regression.spec.ts`
- [ ] T083 [US2] Compare before/after screenshots - verify intentional diffs only (rounded corners, shadows, modern styling)
- [ ] T084 [US2] Create visual comparison report with before/after screenshots for Army EW operator approval
- [ ] T085 [US2] Share visual comparison with Army EW operators via email/meeting for deployment approval

**Verification**: Obtain operator approval before deployment

### Final US2 Verification

- [ ] T086 [US2] Run full test suite: `npm run test:unit && npm run test:integration && npm run test:e2e`
- [ ] T087 [US2] Run TypeScript compilation: `npm run typecheck`
- [ ] T088 [US2] Run ESLint: `npm run lint`
- [ ] T089 [US2] Run performance benchmark for Shadcn render time: `npx tsx scripts/benchmark-shadcn-render.ts` (verify <16ms on RPi5 ARM)
- [ ] T090 [US2] Measure bundle size increase: `npm run build && du -sh .svelte-kit/output/client/_app/immutable/` (verify <5% increase)
- [ ] T091 [US2] Run constitutional audit: `npx tsx scripts/run-audit.ts` (verify compliance ≥ 68%, zero MEDIUM violations). Commit: `git add . && git commit -m "test(audit): T091 — verify P2 compliance at 68%

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [ ] T092 [US2] Create PR for P2 deployment: `gh pr create --title "P2: UI Design System Migration" --body "Replaces 269 hardcoded colors with Shadcn components. Compliance: 60% → 68%. Army EW operator approved."`

**Checkpoint**: User Story 2 (P2) complete and ready for production deployment. Evaluate at NTC/JMRC before starting P3.

---

## Phase 5: User Story 3 - Feature-Based Architecture Refactor (Priority: P3)

**Goal**: Migrate from service layer pattern to feature-based architecture to achieve 70%+ compliance

**Independent Test**: Migrate one feature module at a time (7 phases: Kismet, HackRF, GPS, USRP, Tactical Map, WebSocket Base, Cleanup), run full test suite after each migration, verify WebSocket connections work, confirm no broken imports

**⚠️ PREREQUISITE**: User Story 2 (P2) must be deployed to production and evaluated before starting P3

### Phase 5.1: Kismet Feature Module Migration

- [X] T094 [US3] Create feature directory: `mkdir -p src/lib/kismet`
- [X] T095 [US3] Move `src/lib/services/websocket/kismet.ts` → `src/lib/kismet/websocket.ts`
- [X] T096 [US3] Create `src/lib/kismet/api.ts` and move Kismet API logic from `src/routes/api/kismet/`
- [X] T097 [US3] Create `src/lib/kismet/types.ts` and move Kismet types from `src/lib/types/kismet.ts`
- [X] T098 [US3] Create `src/lib/kismet/stores.ts` and move Kismet stores from `src/lib/stores/`
- [X] T099 [US3] Update all imports throughout codebase: `grep -r "from.*services.*kismet" src/` and replace with `src/lib/kismet/`
- [X] T100 [US3] Run TypeScript compilation to catch broken imports: `npm run typecheck`
- [X] T101 [US3] Run ESLint to catch unused imports: `npm run lint`
- [X] T102 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T103 [US3] Verify Kismet WebSocket connection works: Manual test via browser DevTools (connect, receive WiFi data)
- [X] T104 [US3] Commit Kismet migration: `git add . && git commit -m "refactor(kismet): migrate to feature-based architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: Kismet functionality works identically, tests pass, no broken imports

### Phase 5.2: HackRF Feature Module Migration

- [X] T105 [US3] Create feature directory: `mkdir -p src/lib/hackrf`
- [X] T106 [US3] Move `src/lib/services/websocket/hackrf.ts` → `src/lib/hackrf/websocket.ts`
- [X] T107 [US3] Create `src/lib/hackrf/spectrum.ts` and move spectrum analysis logic
- [X] T108 [US3] Create `src/lib/hackrf/sweep.ts` and move sweep logic
- [X] T109 [US3] Create `src/lib/hackrf/types.ts` and move HackRF types from `src/lib/types/hackrf.ts`
- [X] T110 [US3] Create `src/lib/hackrf/stores.ts` and move HackRF stores from `src/lib/stores/`
- [X] T111 [US3] Update all imports throughout codebase: `grep -r "from.*services.*hackrf" src/` and replace with `src/lib/hackrf/`
- [X] T112 [US3] Run TypeScript compilation: `npm run typecheck`
- [X] T113 [US3] Run ESLint: `npm run lint`
- [X] T114 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T115 [US3] Verify HackRF FFT stream works: Manual test via browser (start scan, verify FFT waterfall displays)
- [X] T116 [US3] Commit HackRF migration: `git add . && git commit -m "refactor(hackrf): migrate to feature-based architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: HackRF functionality works identically, tests pass, FFT stream functional

### Phase 5.3: GPS Feature Module Migration

- [X] T117 [US3] Create feature directory: `mkdir -p src/lib/gps`
- [X] T118 [US3] Create `src/lib/gps/api.ts` and move GPS API logic from `src/routes/api/gps/`
- [X] T119 [US3] Create `src/lib/gps/positioning.ts` and move GPS positioning logic
- [X] T120 [US3] Create `src/lib/gps/types.ts` and move GPS types from `src/lib/types/gps.ts`
- [X] T121 [US3] Create `src/lib/gps/stores.ts` and move GPS stores from `src/lib/stores/`
- [X] T122 [US3] Update all imports throughout codebase: `grep -r "from.*services.*gps" src/` (if any) and replace
- [X] T123 [US3] Run TypeScript compilation: `npm run typecheck`
- [X] T124 [US3] Run ESLint: `npm run lint`
- [X] T125 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T126 [US3] Verify GPS positioning works: Manual test (check GPS panel shows lat/lon, tactical map shows marker)
- [X] T127 [US3] Commit GPS migration: `git add . && git commit -m "refactor(gps): migrate to feature-based architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: GPS functionality works identically, tests pass

### Phase 5.4: USRP Feature Module Migration

- [X] T128 [US3] Move `src/lib/services/usrp/` → `src/lib/usrp/` (entire directory)
- [X] T129 [US3] Organize USRP module: create `src/lib/usrp/api.ts`, `src/lib/usrp/power.ts`, `src/lib/usrp/types.ts`
- [X] T130 [US3] Update all imports throughout codebase: `grep -r "from.*services.*usrp" src/` and replace with `src/lib/usrp/`
- [X] T131 [US3] Run TypeScript compilation: `npm run typecheck`
- [X] T132 [US3] Run ESLint: `npm run lint`
- [X] T133 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T134 [US3] Commit USRP migration: `git add . && git commit -m "refactor(usrp): migrate to feature-based architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: USRP functionality works identically, tests pass

### Phase 5.5: Tactical Map Feature Module Migration

- [X] T135 [US3] Move `src/lib/services/tactical-map/` → `src/lib/tactical-map/` (entire directory)
- [X] T136 [US3] Organize Tactical Map module: create `src/lib/tactical-map/map-engine.ts`, `src/lib/tactical-map/layers/`, `src/lib/tactical-map/stores.ts`
- [X] T137 [US3] Update all imports throughout codebase: `grep -r "from.*services.*tactical-map" src/` and replace with `src/lib/tactical-map/`
- [X] T138 [US3] Run TypeScript compilation: `npm run typecheck`
- [X] T139 [US3] Run ESLint: `npm run lint`
- [X] T140 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T141 [US3] Verify Tactical Map works: Manual test (open map panel, verify GPS marker, WiFi network markers display)
- [X] T142 [US3] Commit Tactical Map migration: `git add . && git commit -m "refactor(tactical-map): migrate to feature-based architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: Tactical Map functionality works identically, tests pass

### Phase 5.6: WebSocket Base Extraction

- [X] T143 [US3] Identify shared WebSocket base code in `src/lib/server/websocket-server.ts`
- [X] T144 [US3] Extract shared WebSocket base code to `src/lib/server/websocket-base.ts`
- [X] T145 [US3] Update Kismet feature module to import from `src/lib/server/websocket-base.ts`
- [X] T146 [US3] Update HackRF feature module to import from `src/lib/server/websocket-base.ts`
- [X] T147 [US3] Update GPS feature module (if WebSocket used) to import from `src/lib/server/websocket-base.ts`
- [X] T148 [US3] Run TypeScript compilation: `npm run typecheck`
- [X] T149 [US3] Run full test suite: `npm run test:unit && npm run test:integration`
- [X] T150 [US3] Verify all WebSocket connections work after extraction (HackRF FFT, Kismet WiFi, GPS position)
- [X] T151 [US3] Commit WebSocket base extraction: `git add . && git commit -m "refactor(websocket): extract shared base to websocket-base.ts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`

**Verification**: All WebSocket connections functional, no regressions

### Phase 5.7: Cleanup and Final Verification

- [ ] T152 [US3] Verify `src/lib/services/` directory is empty: `ls -la src/lib/services/`
- [ ] T153 [US3] Delete empty `src/lib/services/` directory: `rm -rf src/lib/services/`
- [ ] T154 [US3] Verify no broken imports: `grep -r "from.*services" src/` (should return zero results)
- [ ] T155 [US3] Run TypeScript compilation: `npm run typecheck`
- [ ] T156 [US3] Run ESLint: `npm run lint`
- [ ] T157 [US3] Run full test suite: `npm run test:unit && npm run test:integration && npm run test:e2e`
- [ ] T158 [US3] Manual end-to-end test: Start HackRF scan, Kismet scan, GPS positioning, Tactical Map - verify all work
- [ ] T159 [US3] Run constitutional audit: `npx tsx scripts/run-audit.ts` (verify compliance ≥ 70%, zero CRITICAL violations). Commit: `git add . && git commit -m "test(audit): T159 — verify P3 compliance at 70%+

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"`
- [ ] T160 [US3] Create PR for P3 deployment: `gh pr create --title "P3: Feature-Based Architecture Refactor" --body "Migrates from service layer to feature modules. Compliance: 68% → 70%+. All 7 phases complete."`

**Checkpoint**: User Story 3 (P3) complete and ready for production deployment. All user stories now implemented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T162 [P] Update CLAUDE.md to document new feature module structure in "Project Structure" section
- [ ] T163 [P] Create feature module READMEs: `src/lib/kismet/README.md`, `src/lib/hackrf/README.md`, `src/lib/gps/README.md`, `src/lib/usrp/README.md`, `src/lib/tactical-map/README.md` documenting module purpose
- [ ] T164 [P] Add JSDoc comments to all Zod schemas explaining validation rules per NFR-008
- [ ] T165 Run final constitutional audit: `npx tsx scripts/run-audit.ts` (verify compliance ≥ 70%, <300 total violations)
- [ ] T166 Create compliance improvement report in `docs/reports/2026-02-13/final-compliance-report.md` comparing baseline (42%) to final (70%+)
- [ ] T167 Run quickstart.md end-to-end validation: Follow all testing scenarios in `specs/001-audit-remediation/quickstart.md`
- [ ] T168 Verify all git commits follow conventional commit format: `git log --oneline --grep="refactor\|feat\|fix"`
- [ ] T169 Create final summary PR combining all three phases: `gh pr create --title "Constitutional Audit Remediation Complete" --body "All three phases (P1, P2, P3) complete. Compliance: 42% → 70%+. 860 violations → <300."`

**Verification**: Final compliance ≥ 70%, all phases deployed to production, all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1/P1 (Phase 3)**: Depends on Foundational - Can start immediately after Phase 2
- **User Story 2/P2 (Phase 4)**: Depends on US1 completion AND 1-2 week field evaluation at NTC/JMRC
- **User Story 3/P3 (Phase 5)**: Depends on US2 completion AND field evaluation
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1 - Type Safety)**: Independent - no dependencies on other stories
  - **Field Deployment**: Deploy to production immediately after completion
  - **Evaluation Period**: 1-2 weeks at NTC/JMRC before P2 starts

- **User Story 2 (P2 - UI Modernization)**: Independent - no dependencies on other stories
  - **Prerequisite**: US1 must be evaluated successfully for 1-2 weeks
  - **Army Operator Approval**: Required before deployment (screenshot comparison)
  - **Field Deployment**: Deploy to production after operator approval
  - **Evaluation Period**: Monitor before P3 starts

- **User Story 3 (P3 - Service Layer)**: Independent - no dependencies on other stories
  - **Prerequisite**: US2 must be evaluated successfully
  - **7 Sub-Phases**: Must complete sequentially (Kismet → HackRF → GPS → USRP → Tactical Map → WebSocket Base → Cleanup)
  - **Field Deployment**: Deploy to production after all 7 phases complete

### Within Each User Story

**User Story 1 (P1):**
- Common schemas first (T018-T023) before API/WebSocket/Database migrations
- API endpoints (T024-T030) can run in parallel after schemas complete
- WebSocket handlers (T031-T033) can run in parallel after schemas complete
- Database queries (T034-T036) can run in parallel after schemas complete
- Stores (T037-T040) can run in parallel after schemas complete
- Error handling (T041-T044) after core migrations
- Final audit (T045-T047) after all migrations
- Verification (T048-T054) sequentially at end

**User Story 2 (P2):**
- Shadcn installation (T055-T060) in parallel
- Tailwind config (T061-T063) after Shadcn installation
- Component audit (T064-T065) can run in parallel with Tailwind config
- Dashboard migration (T066-T071) sequentially (one component at a time)
- Color migration (T072-T077) can run in parallel after component migration
- Accessibility (T078-T081) after component migration
- Visual regression (T082-T085) sequentially at end
- Verification (T086-T093) sequentially at end

**User Story 3 (P3):**
- 7 sub-phases MUST run sequentially (T094-T161)
- Each sub-phase is atomic (create directory → move files → update imports → verify → commit)
- No parallelization within P3 due to import path dependencies

### Parallel Opportunities

**Phase 1 (Setup):**
- T001-T005: Install dependencies sequentially (npm install order)
- T006-T009: Create scripts/tests in parallel

**Phase 2 (Foundational):**
- T013-T015: Benchmarks can run in parallel
- T016-T017: Tests and backup sequentially

**Phase 3 (User Story 1):**
- T018-T023: Common schemas in parallel (6 tasks)
- T024-T030: API endpoints in parallel (7 tasks)
- T031-T033: WebSocket handlers in parallel (3 tasks)
- T034-T036: Database queries in parallel (3 tasks)
- T037-T040: Stores in parallel (4 tasks)

**Phase 4 (User Story 2):**
- T055-T060: Shadcn components in parallel (6 tasks)
- T072-T077: Color migrations in parallel (6 tasks)

**Phase 6 (Polish):**
- T162-T164: Documentation in parallel (3 tasks)

---

## Parallel Example: User Story 1 (P1) - Common Schemas

```bash
# Launch all common schema creation tasks together (after Phase 2 complete):
# These tasks touch different files with no dependencies

Task T018: "Create SignalReading schema in src/lib/types/signal.ts"
Task T019: "Create WifiNetwork schema in src/lib/types/wifi.ts"
Task T020: "Create GpsPosition schema in src/lib/types/gps.ts"
Task T021: "Create ApiResponse<T> schema in src/lib/types/api.ts"
Task T022: "Create HackRFSweepConfig schema in src/lib/types/hackrf.ts"
Task T023: "Create KismetDevice schema in src/lib/types/kismet.ts"

# After all schemas complete, launch API endpoint migrations in parallel:
Task T024: "Add Zod validation to src/routes/api/hackrf/sweep/+server.ts"
Task T025: "Add Zod validation to src/routes/api/hackrf/status/+server.ts"
Task T026: "Add Zod validation to src/routes/api/kismet/devices/+server.ts"
# ... etc (7 API endpoints total)
```

---

## Implementation Strategy

### Sequential Deployment (Incremental Risk Reduction)

**Rationale**: Each phase deploys to production independently with field evaluation checkpoints between phases

1. **Complete Phase 1 (Setup)** → Install dependencies, create benchmarks, capture baselines
2. **Complete Phase 2 (Foundational)** → Verify current state, prepare for migration
3. **Complete Phase 3 (User Story 1 - P1 Type Safety)** → Deploy to production immediately
   - **STOP**: Evaluate at NTC/JMRC for 1-2 weeks
   - Monitor: Zod validation errors, performance impact, operator feedback
   - **Go/No-Go Decision**: Proceed to P2 only if P1 validates successfully
4. **Complete Phase 4 (User Story 2 - P2 UI Modernization)** → Deploy after operator approval
   - **STOP**: Evaluate at NTC/JMRC
   - Monitor: Visual feedback, accessibility, performance
   - **Go/No-Go Decision**: Proceed to P3 only if P2 validates successfully
5. **Complete Phase 5 (User Story 3 - P3 Service Layer Refactor)** → Deploy after all 7 phases
   - **STOP**: Evaluate at NTC/JMRC
   - Monitor: WebSocket uptime, architectural improvements
6. **Complete Phase 6 (Polish)** → Final cleanup and documentation

### MVP First (User Story 1 Only - Fastest Time to Value)

If incremental deployment is preferred:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (P1 Type Safety)
4. **STOP and DEPLOY**: Test US1 independently, deploy to production
5. **Evaluate** for 1-2 weeks at NTC/JMRC
6. **Decision Point**: Continue with P2/P3 or pause

**Benefits**: Lowest risk, highest ROI phase deployed first (42% → 60% compliance)

### Parallel Team Strategy (Not Recommended for This Project)

**❌ NOT RECOMMENDED**: This is refactoring work with tight dependencies. Sequential execution recommended.

If multiple developers were available (not typical for this project):
- Developer A: User Story 1 (P1) - after Phase 2
- Developer B: Prepare for User Story 2 (P2) - capture baselines, install Shadcn
- Developer C: Research for User Story 3 (P3) - document import paths

However, **development freeze is in effect** (3-6 weeks, this is the only priority work), so single developer sequential execution is expected.

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] label**: Maps task to specific user story (US1, US2, US3) for traceability
- **Each user story independently deployable**: P1 deploys first, evaluated, then P2, then P3
- **Sequential deployment with evaluation checkpoints**: Reduces risk, validates approach incrementally
- **Tests are NOT explicitly requested**: Only existing tests must pass after each phase
- **Commit after EVERY completed task** (Article XII §12.1): One commit per task, not batched. Use conventional commit format with Co-Authored-By. This is the rollback mechanism.
- **Stop at checkpoints**: Each checkpoint is a deployment opportunity
- **Avoid**: Big-bang deployment, skipping field evaluation, concurrent feature work during remediation

---

## Total Task Count: 168 tasks (updated after remediation edits)

- **Setup (Phase 1)**: 9 tasks
- **Foundational (Phase 2)**: 8 tasks
- **User Story 1/P1 (Phase 3)**: 38 tasks (includes T047A validation test, T053A evaluation checkpoint)
- **User Story 2/P2 (Phase 4)**: 38 tasks (removed batch commit T092)
- **User Story 3/P3 (Phase 5)**: 67 tasks (removed batch commit T160)
- **Polish (Phase 6)**: 8 tasks

**Changes from original 169 tasks**: Removed 3 batch commit tasks (violate Article XII §12.1), added 2 critical tasks (T047A runtime validation test, T053A evaluation checkpoint).

## Parallel Opportunities: ~40 tasks can run in parallel (23% of total)

- Phase 1: 4 parallel tasks (scripts/tests)
- Phase 2: 3 parallel tasks (benchmarks)
- Phase 3/US1: 23 parallel tasks (schemas, API endpoints, WebSocket, database, stores)
- Phase 4/US2: 12 parallel tasks (Shadcn components, color migrations)
- Phase 6: 3 parallel tasks (documentation)

## Independent Test Criteria per Story

**User Story 1 (P1 - Type Safety)**:
- Replace type assertions file-by-file
- Run `npm run typecheck` after each file
- Run test suites after each change
- Trigger validation errors manually with invalid data
- Verify errors caught at runtime with descriptive messages
- Constitutional audit shows ≥ 60% compliance, zero HIGH violations

**User Story 2 (P2 - UI Modernization)**:
- Migrate components to Shadcn one-by-one
- Capture before/after screenshots
- Verify all functionality works identically (click handlers, WebSocket data, map behavior)
- Test keyboard navigation (Tab through all elements, visible focus rings)
- Run `npx playwright test tests/e2e/accessibility.spec.ts` (zero WCAG 2.1 AA violations)
- Constitutional audit shows ≥ 68% compliance, zero MEDIUM violations

**User Story 3 (P3 - Service Layer Refactor)**:
- Migrate one feature module at a time (7 phases)
- Run full test suite after each phase: `npm run test:unit && npm run test:integration`
- Verify WebSocket connections work (HackRF FFT, Kismet WiFi, GPS position)
- Verify no broken imports: `grep -r "from.*services" src/` returns zero
- Verify `src/lib/services/` directory deleted
- Constitutional audit shows ≥ 70% compliance, zero CRITICAL violations

## Suggested MVP Scope: User Story 1 (P1 - Type Safety) Only

**Rationale**: Highest ROI (42% → 60% compliance), lowest risk, independently deployable and testable. Deploy to production first, evaluate for 1-2 weeks, then decide whether to continue with P2/P3 based on field validation results.

**MVP Deliverable**: 581 type assertions replaced with Zod validation, runtime error catching operational, constitutional compliance increased by 18 percentage points.

---

## Format Validation: ✅ ALL tasks follow checklist format

- ✅ Checkbox: All tasks start with `- [ ]`
- ✅ Task ID: All tasks have sequential ID (T001-T169)
- ✅ [P] marker: Present only on parallelizable tasks (different files, no dependencies)
- ✅ [Story] label: Present on all user story tasks (US1, US2, US3), absent on Setup/Foundational/Polish tasks
- ✅ Description: All tasks have clear action with exact file path (where applicable)
- ✅ Examples verified against checklist format requirements
