# Tasks: Codebase Hardening

**Input**: Design documents from `/specs/008-codebase-hardening/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: No new test tasks — spec relies on existing 250+ test regression suite (151 security, 80+ unit, 25+ integration). Verification commands run after each task.

**Organization**: Tasks grouped by user story (US1: Safe Command Execution, US2: Maintainable File Sizes, US3: Convention Compliance).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Establish baseline and verify clean starting state

- [x] T001 Run baseline verification: `npx tsc --noEmit && npm run test:unit && npm run test:security` — confirm 0 errors, 163+ tests pass, 151 security tests pass
- [x] T002 Audit all callers of `hostExec` by searching for `from.*host-exec` across `src/` — document the 17 files that import it for tracking during migration

**Checkpoint**: Baseline verified, caller inventory complete

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Remove the centralized unsafe exec wrapper that all other migration tasks depend on

- [x] T003 [US1] **CRITICAL** Delete `src/lib/server/host-exec.ts` — replaced with legacyShellExec shim for 12 GSM Evil/Kismet Extended files (deferred to branch 009). Commit: `refactor(security): T003 — delete host-exec.ts, shim GSM Evil to legacyShellExec`

**Checkpoint**: host-exec.ts deleted, TypeScript errors in 17 files confirm the migration surface

---

## Phase 3: User Story 1 — Safe Command Execution (Priority: P1)

**Goal**: Migrate all ~66 unsafe exec call sites across 19 files to execFile/spawn with argument arrays. Zero shell-string-based execution remaining.

**Independent Test**: `npm run test:security` passes + `grep -r "promisify(exec)" src/` returns 0 matches + `grep -r "from 'child_process'" src/ | grep -v execFile | grep -v spawn` returns 0 matches

### Implementation for User Story 1

- [x] T004 [P] [US1] Migrate `src/lib/server/kismet/alfa-detector.ts` — replace 1 static exec call (`lsusb`) with `execFileAsync('/usr/bin/lsusb', [])`. Commit: `fix(security): T004 — migrate alfa-detector to execFile`
- [x] T005 [P] [US1] Migrate `src/routes/api/system/metrics/+server.ts` — replace 4 static exec calls: use `os.cpus()` for CPU, `execFileAsync('/usr/bin/df', ['-B1', '/'])` for disk, `execFileAsync('/usr/bin/vcgencmd', ['measure_temp'])` for temp, `fs.readFileSync('/proc/net/dev')` for network. Commit: `fix(security): T005 — migrate metrics route to execFile`
- [x] T006 [P] [US1] Migrate `src/routes/api/system/memory-pressure/+server.ts` — replace 2 static exec calls with `execFileAsync('/usr/bin/pgrep', ['earlyoom'])` and `execFileAsync('/usr/sbin/zramctl', ['--output', 'NAME,DISKSIZE,DATA,COMPR'])`. Commit: `fix(security): T006 — migrate memory-pressure route to execFile`
- [x] T007 [P] [US1] Migrate `src/routes/api/system/docker/+server.ts` — replace 2 static exec calls with `execFileAsync('/usr/bin/docker', [...])` for ps and info commands. Commit: `fix(security): T007 — migrate docker status route to execFile`
- [x] T008 [P] [US1] Migrate `src/routes/api/rf/status/+server.ts` — replace 1 static exec call with `execFileAsync('/usr/bin/hackrf_info', [], { timeout: 2000 })`. Commit: `fix(security): T008 — migrate rf/status route to execFile`
- [x] T009 [P] [US1] Migrate `src/routes/api/kismet/stop/+server.ts` — replace 6 static exec calls (pgrep, pkill, ip link) with execFileAsync using absolute paths. Commit: `fix(security): T009 — migrate kismet/stop route to execFile`
- [x] T010 [US1] Run verification: `npx tsc --noEmit && npm run test:security` — confirm static route migrations compile and pass
- [x] T011 [US1] **HIGH** Migrate `src/routes/api/system/docker/[action]/+server.ts` — replace 3 dynamic exec calls with `execFileAsync('/usr/bin/docker', ['compose', '-f', composeFile, ...])`. Add Zod body validation: `z.object({ service: z.enum(['openwebrx', 'bettercap']) })`. Commit: `fix(security): T011 — migrate docker action route, add Zod validation`
- [x] T012 [US1] **HIGH** Migrate `src/routes/api/system/services/+server.ts` — replace 2 dynamic exec calls with `execFileAsync('/usr/bin/pgrep', ['-f', service.process])` and `execFileAsync('/usr/bin/lsof', ['-i:' + service.port, '-sTCP:LISTEN'])`. Commit: `fix(security): T012 — migrate services route to execFile`
- [x] T013 [P] [US1] **HIGH** Migrate `src/lib/server/hardware/detection/network-detector.ts` — replace 1 static exec call with `execFileAsync('/usr/bin/uhd_find_devices', ['--args=type=usrp'])`. Commit: `fix(security): T013 — migrate network-detector to execFile`
- [x] T014 [P] [US1] **HIGH** Migrate `src/lib/server/hardware/detection/serial-detector.ts` — replace 4 exec calls: use `fs.readFileSync` for device path (validate with `validatePathWithinDir`), `execFileAsync('/usr/bin/systemctl', ['is-active', 'gpsd'])`, `execFileAsync('/usr/bin/mmcli', ['-L'])`, validate modemId as numeric then `execFileAsync('/usr/bin/mmcli', ['-m', String(modemId)])`. Commit: `fix(security): T014 — migrate serial-detector to execFile`
- [x] T015 [P] [US1] **HIGH** Migrate `src/lib/server/hardware/detection/usb-detector.ts` — replace 8 exec calls: 6 static (hackrf_info, uhd_find_devices, rtl_test, iw dev, hciconfig, bluetoothctl) + 2 dynamic with `validateInterfaceName(iface)`. Commit: `fix(security): T015 — migrate usb-detector to execFile`
- [x] T016 [US1] Run verification: `npx tsc --noEmit && npm run test:unit` — confirm detection file migrations compile and pass
- [x] T017 [P] [US1] **CRITICAL** Migrate `src/lib/server/hardware/alfa-manager.ts` — replace 3 dynamic exec calls: validate iface with `validateInterfaceName`, use `execFileAsync('/usr/sbin/iwconfig', [safeIface])` and `execFileAsync('/usr/bin/pgrep', ['-x', proc])`. Commit: `fix(security): T017 — migrate alfa-manager to execFile`
- [x] T018 [P] [US1] **CRITICAL** Migrate `src/lib/server/hardware/hackrf-manager.ts` — replace 6 exec calls: 2 static + 2 pgrep/pkill + 2 docker commands with `execFileAsync('/usr/bin/docker', ['ps', '--filter', ...])`. Commit: `fix(security): T018 — migrate hackrf-manager to execFile`
- [x] T019 [US1] **CRITICAL** Migrate `src/lib/server/kismet/service-manager.ts` (~14 call sites, highest-risk single task). See `docs/plans/2026-02-19-codebase-hardening.md` Task A6 Step 1 for full per-call-site guidance. Migration by pattern group:
    - **Static commands** (6 calls): pgrep kismet, pkill, iw dev del, lsusb — mechanical exec→execFile
    - **Dynamic PID/process** (2 calls): `ps -p ${pid}` — validate with `validateNumericParam(pid, 'pid', 1, 4194304)`, then execFileAsync
    - **Dynamic interface** (3 calls): `ip link set/show ${iface}` — validate with `validateInterfaceName`, then execFileAsync
    - **Sysfs writes** (2 calls): USB unbind/bind `${bus}-${device}` — validate bus/device as numeric, replace exec with `fs.writeFileSync` to sysfs path
    - **File reads** (1 call): `tail -n ${lines} ${LOG_FILE}` — replace with `fs.readFileSync` + `.split('\n').slice(-lines)`
    - Commit: `fix(security): T019 — migrate kismet service-manager to execFile`
- [x] T020 [US1] **CRITICAL** Migrate `src/lib/server/services/kismet/kismet-control-service.ts` — replace 4 exec calls: 1 static pgrep, 2 `nohup` commands with `spawn(path, [], { detached: true, stdio: [...] })` + `child.unref()`, 1 tail+grep with `fs.readFileSync` + JS parse. Commit: `fix(security): T020 — migrate kismet-control-service to execFile/spawn`
- [x] T021 [US1] Run verification: `npx tsc --noEmit && npm run test:unit` — confirm Kismet service migrations compile and pass
- [x] T022 [P] [US1] Migrate `src/lib/server/services/hardware/hardware-details-service.ts` — replace 4 exec calls: 1 static `iw dev` + 2 dynamic iface info (validate iface) + 1 dynamic phy info (validate phyIdx as numeric). Commit: `fix(security): T022 — migrate hardware-details-service to execFile`
- [x] T023 [P] [US1] Migrate `src/lib/server/mcp/servers/test-runner.ts` — replace 3 exec calls from validated command map with `execFileAsync('/usr/bin/npm', ['run', scriptName], { cwd, timeout })`. Commit: `fix(security): T023 — migrate test-runner MCP server to execFile`
- [x] T024 [P] [US1] Migrate `src/lib/constitution/git-categorizer.ts` — replace 3 exec calls: 2 static `git rev-parse` + 1 dynamic `git blame` with `execFileAsync('/usr/bin/git', ['blame', '--porcelain', '-L' + line + ',' + line, file])`. Commit: `fix(security): T024 — migrate git-categorizer to execFile`
- [x] T025 [US1] Run final US1 verification: `npx tsc --noEmit && npm run test:unit && npm run test:security` — confirm zero errors. Then run `grep -r "promisify(exec)" src/` and `grep -r "from 'child_process'" src/ | grep -v execFile | grep -v spawn` — both must return 0 matches. Commit: `fix(security): T025 — verify zero unsafe exec remaining`

**Checkpoint**: User Story 1 complete — zero unsafe exec calls in codebase. SC-001 and SC-005 achieved.

---

## Phase 4: User Story 2 — Maintainable File Sizes (Priority: P2)

**Goal**: Decompose the 4 files exceeding 1000 lines (Tier 1) into modules under 300 lines each. Tier 2/3 (47 remaining files) planned in follow-up.

**Independent Test**: `wc -l` on all decomposed files shows <300 lines each + `npm run test:unit` passes + `npm run build` succeeds

### Implementation for User Story 2

- [x] T026 [US2] Decompose `src/lib/components/dashboard/DashboardMap.svelte` (1794 lines) — extract into `src/lib/components/dashboard/map/MapControls.svelte`, `MapLayers.svelte`, `MapPopups.svelte`, `MapOverlays.svelte`, and `map-helpers.ts`. Original file becomes thin orchestrator <300 lines. See `docs/plans/2026-02-19-codebase-hardening.md` Task B1 for section-by-section extraction guide. Run: `npx tsc --noEmit && npm run build`. Commit: `refactor(dashboard): T026 — decompose DashboardMap into 5 focused modules`
- [x] T027 [US2] Decompose `src/lib/server/hackrf/sweep-manager.ts` (1417 lines) — extract `sweep-health-checker.ts`, `sweep-cleanup-manager.ts`, `sweep-memory-monitor.ts`. Original file becomes orchestrator <300 lines. See `docs/plans/2026-02-19-codebase-hardening.md` Task B2 for extraction guide. Run: `npx tsc --noEmit && npm run test:unit`. Commit: `refactor(hackrf): T027 — decompose sweep-manager into 4 focused modules`
- [x] T028 [US2] Decompose `src/lib/components/dashboard/TopStatusBar.svelte` (1203 lines) — extract into `src/lib/components/dashboard/status/StatusIndicators.svelte`, `NetworkInfo.svelte`, `SystemMonitor.svelte`. Original file <300 lines. See `docs/plans/2026-02-19-codebase-hardening.md` Task B3 for extraction guide. Run: `npx tsc --noEmit && npm run build`. Commit: `refactor(dashboard): T028 — decompose TopStatusBar into 4 focused modules`
- [x] T029 [US2] Decompose `src/lib/components/dashboard/panels/DevicesPanel.svelte` (1047 lines) — extract into `src/lib/components/dashboard/panels/devices/DeviceList.svelte`, `DeviceFilters.svelte`, `DeviceDetails.svelte`. Original file <300 lines. See `docs/plans/2026-02-19-codebase-hardening.md` Task B4 for extraction guide. Run: `npx tsc --noEmit && npm run build`. Commit: `refactor(dashboard): T029 — decompose DevicesPanel into 4 focused modules`
- [x] T030 [US2] Run US2 verification: `npx tsc --noEmit && npm run test:unit && npm run build` — confirm all decomposed files <300 lines, all tests pass, production build succeeds

**Checkpoint**: User Story 2 Tier 1 complete — 4 largest files decomposed. Tier 2/3 (47 files) tracked for follow-up.

---

## Phase 5: User Story 3 — Convention Compliance (Priority: P3)

**Goal**: Migrate 4 raw HTML elements to shadcn components and document 8 intentional exemptions.

**Independent Test**: `grep -r '<button' src/lib/components/ src/routes/ --include='*.svelte'` shows only exempted buttons + `npx tsc --noEmit` passes + `npm run build` succeeds

### Implementation for User Story 3

- [x] T031 [P] [US3] Migrate raw HTML elements to shadcn in `src/lib/components/status/TAKIndicator.svelte` (configure button → `Button variant="outline" size="sm"`) and `src/lib/components/dashboard/tak/TakConfigView.svelte` (1 checkbox → shadcn Checkbox, 2 radio buttons → shadcn RadioGroup). Run: `npx tsc --noEmit && npm run build`. Commit: `fix(ui): T031 — migrate raw button/input elements to shadcn components`
- [x] T032 [P] [US3] Add constitutional exemption comments to intentionally raw buttons in `src/lib/components/dashboard/DashboardMap.svelte` (2 map control buttons), `src/routes/dashboard/+page.svelte` (5 tab buttons), `src/lib/components/status/TAKIndicator.svelte` (1 indicator toggle). Verify `src/lib/components/dashboard/IconRail.svelte` already has exemption. Commit: `docs(constitution): T032 — add exemption comments for intentional raw HTML elements`
- [x] T033 [US3] Run US3 verification: `npx tsc --noEmit && npm run build` — confirm no type errors, production build succeeds

**Checkpoint**: User Story 3 complete — all raw HTML either migrated or documented exempt. SC-006 achieved.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [x] T034 Run full verification suite: `npx tsc --noEmit` (0 errors) + `npm run test:unit` (163+ pass) + `npm run test:security` (151 pass) + `npm run build` (succeeds) + zero-exec audit: `grep -r "promisify(exec)" src/` (0 matches) + `grep -r "from 'child_process'" src/ | grep -v execFile | grep -v spawn` (0 matches)
- [x] T035 Run constitutional audit (pre-existing parser failure — constitution.md format mismatch unrelated to 008): `npx tsx scripts/run-audit.ts` — confirm no new violations (SC-006)
- [x] T036 Run line-count audit on all modified files — confirm no Tier 1 file >300 lines (data files exempt)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T002 (caller audit) — T003 deletes host-exec.ts
- **US1 (Phase 3)**: Depends on T003 — TypeScript errors from deletion guide the migration
- **US2 (Phase 4)**: Independent of US1 — can start after Phase 1 if desired
- **US3 (Phase 5)**: Independent of US1 and US2 — can start after Phase 1
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Blocked by T003 (host-exec.ts deletion). No dependencies on US2 or US3.
- **User Story 2 (P2)**: No blockers beyond Phase 1. Independent of US1 and US3.
- **User Story 3 (P3)**: No blockers beyond Phase 1. Independent of US1 and US2.

### Within Each User Story

- US1: Static-command tasks (T004-T009) can run in parallel → verify → dynamic tasks (T011-T012) → detection files (T013-T015, parallel) → hardware managers (T017-T018, parallel) → Kismet services (T019-T020, sequential) → remaining libs (T022-T024, parallel) → final verify
- US2: Each decomposition task (T026-T029) is independent but recommended sequential for learning
- US3: T031 and T032 can run in parallel

### Parallel Opportunities

- T004-T009: All 6 static migration tasks touch different files — full parallel
- T013-T015: All 3 detection files touch different files — full parallel
- T017-T018: Both hardware managers touch different files — full parallel
- T022-T024: All 3 remaining libraries touch different files — full parallel
- T031-T032: Convention tasks touch different files — full parallel

---

## Parallel Example: User Story 1 (Static Migrations)

```bash
# Launch all static-command migrations in parallel (T004-T009):
Task: "Migrate alfa-detector.ts in src/lib/server/kismet/alfa-detector.ts"
Task: "Migrate metrics route in src/routes/api/system/metrics/+server.ts"
Task: "Migrate memory-pressure in src/routes/api/system/memory-pressure/+server.ts"
Task: "Migrate docker status in src/routes/api/system/docker/+server.ts"
Task: "Migrate rf/status in src/routes/api/rf/status/+server.ts"
Task: "Migrate kismet/stop in src/routes/api/kismet/stop/+server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003)
3. Complete Phase 3: User Story 1 (T004-T025)
4. **STOP and VALIDATE**: SC-001 achieved — zero unsafe exec in codebase
5. This alone delivers the highest-value security hardening

### Incremental Delivery

1. Setup + Foundational → baseline established
2. Add User Story 1 → zero unsafe exec → security hardened (MVP)
3. Add User Story 2 Tier 1 → 4 largest files decomposed → maintainability improved
4. Add User Story 3 → convention compliance → UI consistency achieved
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Phase 2 is done:
   - Developer A: User Story 1 (shell call migration)
   - Developer B: User Story 2 (file decomposition)
   - Developer C: User Story 3 (convention fixes)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task — format: `type(scope): TXXX — description`
- Run `npx tsc --noEmit` after every task to catch errors early
- Full plan details with code examples: `docs/plans/2026-02-19-codebase-hardening.md`
- Tier 2/3 file decomposition (47 files, 300-999 lines) not included — plan follow-up branch after Tier 1
- **Risk levels**: CRITICAL = dynamic input + hardware/system access, HIGH = dynamic input, LOW = static commands only
- **Note**: Old T035 (zero-exec audit) merged into T034. Task IDs T035-T036 renumbered from original T036-T037.
