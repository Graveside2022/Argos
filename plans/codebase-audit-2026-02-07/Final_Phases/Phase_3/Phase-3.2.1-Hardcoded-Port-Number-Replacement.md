# Phase 3.2.1: Hardcoded Port Number Replacement

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.1
**Risk Level**: LOW-MEDIUM
**Prerequisites**: Phase 3.2.0 (Constants Infrastructure Extension -- limits.ts must contain all PORTS and SERVICE_URLS constants)
**Blocks**: Phase 3.2.7 (IP Address Centralization depends on SERVICE_URLS being consumed)
**Estimated Files Touched**: 27+
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C

---

## Objective

Replace all 98 hardcoded port number literals across 27+ source files with named constants from `PORTS` and `SERVICE_URLS` objects defined in `src/lib/constants/limits.ts`. After completion, zero raw port numbers will exist in application source code outside of the constants file.

## Current State Assessment (CORRECTED per Verification Audit 2026-02-08)

| Metric                                | Value                                      |
| ------------------------------------- | ------------------------------------------ |
| Total port occurrences                | **98** (CORRECTED from original plan's 73) |
| Unique ports                          | 13                                         |
| Files affected                        | 27+                                        |
| Ports in limits.ts (before)           | 7 defined, 7 missing                       |
| Ports in limits.ts (after Task 3.2.0) | All 13 defined                             |
| Original plan undercount              | **34%** (25 occurrences missed)            |

## Scope

### Port 2501 (Kismet REST) -- 17 occurrences (CORRECTED from 14)

| #   | File                                                    | Line | Current           | Replacement           |
| --- | ------------------------------------------------------- | ---- | ----------------- | --------------------- |
| 1   | `src/lib/components/dashboard/views/KismetView.svelte`  | 10   | `:2501/`          | `PORTS.KISMET_REST`   |
| 2   | `src/lib/server/hardware/detection/network-detector.ts` | 84   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 3   | `src/lib/server/kismet/api_client.ts`                   | 26   | `port: 2501`      | `PORTS.KISMET_REST`   |
| 4   | `src/lib/server/kismet/kismet_controller.ts`            | 50   | `restPort: 2501`  | `PORTS.KISMET_REST`   |
| 5   | `src/lib/server/kismet/fusion_controller.ts`            | 44   | `port: 2501`      | `PORTS.KISMET_REST`   |
| 6   | `src/lib/server/services/kismet.service.ts`             | 24   | `BASE_URL...2501` | `SERVICE_URLS.KISMET` |
| 7   | `src/lib/services/tactical-map/kismetService.ts`        | 9    | `:2501`           | `PORTS.KISMET_REST`   |
| 8   | `src/routes/api/kismet/proxy/[...path]/+server.ts`      | 7    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 9   | `src/routes/api/kismet/devices/list/+server.ts`         | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 10  | `src/routes/api/kismet/devices/+server.ts`              | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 11  | `src/routes/api/kismet/devices/stats/+server.ts`        | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 12  | `src/routes/api/kismet/status/+server.ts`               | 10   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 13  | `src/routes/api/kismet/config/+server.ts`               | 10   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 14  | `src/routes/api/kismet/interfaces/+server.ts`           | 9    | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 15  | `src/lib/server/kismet/kismetProxy.ts`                  | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 16  | `src/lib/server/kismet/webSocketManager.ts`             | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |
| 17  | `src/routes/api/agent/tools/+server.ts`                 | --   | `localhost:2501`  | `SERVICE_URLS.KISMET` |

**Audit correction**: Items 15-17 were completely missing from the original plan. The audit found `agent/tools/+server.ts` contains port 2501 references, and `kismetProxy.ts` and `webSocketManager.ts` were omitted.

**Audit correction on file attribution**: The audit noted that several files listed in the original plan's rows 7-14 (the API route files) may not contain the literal `2501` as a standalone number but rather as part of a URL string. Each must be verified at execution time. The count of 17 is confirmed correct by the audit.

### Port 8092 (HackRF API) -- 4 occurrences (CORRECTED from 3)

| #   | File                                                    | Line | Current                | Replacement               |
| --- | ------------------------------------------------------- | ---- | ---------------------- | ------------------------- |
| 1   | `src/lib/components/hackrf/AnalysisTools.svelte`        | 14   | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 2   | `src/lib/server/hardware/detection/network-detector.ts` | 125  | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 3   | `src/routes/api/agent/tools/+server.ts`                 | --   | `localhost:8092`       | `SERVICE_URLS.HACKRF_API` |
| 4   | `src/lib/server/hardware/detection/network-detector.ts` | 167  | `localhost:8092` check | `SERVICE_URLS.HACKRF_API` |

**Audit correction**: Item 3 (`agent/tools/+server.ts`) was completely missing from the original plan. The original plan incorrectly listed `OpenWebRXView.svelte` as containing 8092 -- it contains 8073, not 8092.

### Port 8073 (Spectrum Web / OpenWebRX) -- 10 occurrences

| #    | File                                                      | Line | Current          | Replacement                 |
| ---- | --------------------------------------------------------- | ---- | ---------------- | --------------------------- |
| 1    | `src/lib/components/dashboard/views/OpenWebRXView.svelte` | 11   | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 2    | `src/lib/components/hackrf/AnalysisTools.svelte`          | 10   | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 3    | `src/lib/server/hardware/detection/network-detector.ts`   | 167  | `localhost:8073` | `SERVICE_URLS.SPECTRUM_WEB` |
| 4-10 | Additional occurrences in openwebrx routes and stores     | --   | `8073`           | `PORTS.SPECTRUM_WEB`        |

**Note**: The audit found the actual count may be closer to 12 when including `openwebrx/control` lines 95, 104, 105, 116. Executor must grep to confirm exact count at execution time.

### Port 3002 (HackRF Control) -- 1 occurrence

| #   | File                                         | Line | Current          | Replacement                   |
| --- | -------------------------------------------- | ---- | ---------------- | ----------------------------- |
| 1   | `src/routes/api/hackrf/[...path]/+server.ts` | 4    | `localhost:3002` | `SERVICE_URLS.HACKRF_CONTROL` |

### Port 11434 (Ollama) -- 4 occurrences

| #   | File                                     | Line | Current                            | Replacement           |
| --- | ---------------------------------------- | ---- | ---------------------------------- | --------------------- |
| 1   | `src/lib/server/agent/runtime.ts`        | 92   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 2   | `src/routes/api/agent/stream/+server.ts` | 43   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 3   | `src/routes/api/agent/status/+server.ts` | 15   | `localhost:11434`                  | `SERVICE_URLS.OLLAMA` |
| 4   | `src/lib/server/agent/runtime.ts`        | 215  | `localhost:11434` (2nd occurrence) | `SERVICE_URLS.OLLAMA` |

**Audit correction**: The original plan claimed `src/routes/api/agent/models/+server.ts` had an occurrence. That file **does not exist**. The actual 4th hit is `runtime.ts` line 215 (plan originally listed runtime.ts with only 1 occurrence but it has 2).

### Port 5173 (Argos Web) -- 21 occurrences (CORRECTED from 15)

| #    | File                                     | Line | Current          | Replacement                               |
| ---- | ---------------------------------------- | ---- | ---------------- | ----------------------------------------- |
| 1-21 | Various WebSocket URLs and API base URLs | --   | `localhost:5173` | `SERVICE_URLS.ARGOS` or `PORTS.ARGOS_WEB` |

**Audit correction**: The original plan claimed 15 occurrences. The audit found 21, a +6 delta. Executor must grep `5173` across all `.ts` and `.svelte` files to identify all 21 locations at execution time.

### Port 8081 (Bettercap/DroneID) -- 9 occurrences (CORRECTED from 5)

| #   | File                                    | Line | Current               | Replacement              |
| --- | --------------------------------------- | ---- | --------------------- | ------------------------ |
| 1   | `src/lib/server/bettercap/apiClient.ts` | 7    | `127.0.0.1:8081`      | `SERVICE_URLS.BETTERCAP` |
| 2   | `src/lib/server/bettercap/apiClient.ts` | 96   | `-api-rest-port 8081` | `PORTS.BETTERCAP`        |
| 3   | `src/routes/droneid/+page.svelte`       | 78   | `ws://...8081`        | `PORTS.BETTERCAP`        |
| 4   | `src/routes/api/droneid/+server.ts`     | 132  | `-p 8081`             | `PORTS.BETTERCAP`        |
| 5   | `src/routes/api/droneid/+server.ts`     | 204  | `8081` in pkill       | `PORTS.BETTERCAP`        |
| 6-9 | Additional occurrences                  | --   | `8081`                | `PORTS.BETTERCAP`        |

**Audit correction**: The original plan listed only 5 occurrences. The audit found 9, a +4 delta.

### Port 3001 (Terminal WebSocket) -- 2 occurrences

| #   | File                                                     | Line | Current | Replacement         |
| --- | -------------------------------------------------------- | ---- | ------- | ------------------- |
| 1   | `src/lib/components/dashboard/views/TerminalView.svelte` | --   | `3001`  | `PORTS.TERMINAL_WS` |
| 2   | `src/lib/components/terminal/TerminalTabContent.svelte`  | --   | `3001`  | `PORTS.TERMINAL_WS` |

### Port 8080 (GSM Evil Web) -- 9 occurrences (CORRECTED from 6)

| #   | File                                             | Line | Current          | Replacement                                     |
| --- | ------------------------------------------------ | ---- | ---------------- | ----------------------------------------------- |
| 1-9 | gsm-evil/control, health, status routes + others | --   | `localhost:8080` | `SERVICE_URLS.GSM_EVIL` or `PORTS.GSM_EVIL_WEB` |

**Audit correction**: The original plan claimed 6 occurrences. The audit found 9, a +3 delta. Missed files include `server.ts:346`, `example-tools.ts:94`, and `toolHierarchy.ts`.

### Port 4729 (grgsm collector) -- 14 occurrences (CORRECTED from 7 -- MAJOR undercount)

| #    | File                                                     | Line | Current | Replacement             |
| ---- | -------------------------------------------------------- | ---- | ------- | ----------------------- |
| 1-14 | gsm-evil/scan, intelligent-scan, activity, health routes | --   | `4729`  | `PORTS.GRGSM_COLLECTOR` |

**Audit correction**: This is the single largest undercount in the original plan. The audit found 14 occurrences vs. the plan's 7 -- a 2x undercount. These are distributed across multiple GSM Evil route files and include both connection strings and shell command arguments.

**SECURITY NOTE**: Several port 4729 occurrences are in shell command strings (`sudo grgsm_livemon_headless -f ${freq}M`). Centralizing the port number does NOT fix the injection risk. The injection vectors are addressed in Phase 2.1.2 (Shell Injection Elimination). This task replaces the port literal only.

### Port 2947 (gpsd) -- 2 occurrences

| #   | File                                                  | Line | Current | Replacement  |
| --- | ----------------------------------------------------- | ---- | ------- | ------------ |
| 1   | `src/routes/api/hardware/details/+server.ts`          | --   | `2947`  | `PORTS.GPSD` |
| 2   | `src/routes/api/gps/position/+server.ts` (or similar) | --   | `2947`  | `PORTS.GPSD` |

### Port 8088 (Tile Server) -- 1 occurrence

| #   | File                          | Line | Current | Replacement         |
| --- | ----------------------------- | ---- | ------- | ------------------- |
| 1   | `src/lib/config/mapConfig.ts` | --   | `8088`  | `PORTS.TILE_SERVER` |

### Port 8002 (Kismet WS alt) -- 1 occurrence

| #   | File                                   | Line | Current | Replacement           |
| --- | -------------------------------------- | ---- | ------- | --------------------- |
| 1   | `src/lib/services/websocket/kismet.ts` | --   | `8002`  | `PORTS.KISMET_WS_ALT` |

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.0 is complete -- `grep -c "GRGSM_COLLECTOR" src/lib/constants/limits.ts` returns 1.
2. **Replace port 2501** (17 occurrences) in all 17 files listed above. Use `PORTS.KISMET_REST` for numeric contexts and `SERVICE_URLS.KISMET` for URL string contexts.
3. **Run** `npm run typecheck` -- must exit 0.
4. **Replace port 8092** (4 occurrences). Run typecheck.
5. **Replace port 8073** (10 occurrences). Run typecheck.
6. **Replace port 3002** (1 occurrence). Run typecheck.
7. **Replace port 11434** (4 occurrences). Run typecheck.
8. **Replace port 5173** (21 occurrences). Run typecheck.
9. **Replace port 8081** (9 occurrences). Run typecheck.
10. **Replace port 3001** (2 occurrences). Run typecheck.
11. **Replace port 8080** (9 occurrences). Run typecheck.
12. **Replace port 4729** (14 occurrences). Run typecheck.
13. **Replace port 2947** (2 occurrences). Run typecheck.
14. **Replace port 8088** (1 occurrence). Run typecheck.
15. **Replace port 8002** (1 occurrence). Run typecheck.
16. **Run final verification** (grep for any remaining port literals).

**Note on client-side imports**: Svelte components cannot import server-only modules. `$lib/constants/limits.ts` is a shared module (no server-only imports like `$env/dynamic/private`), so it is safe to import in both server-side and client-side contexts. The `SERVICE_URLS` constant uses template literals that reference `PORTS` within the same file -- no external server imports.

**Procedure**: Replace in groups of one port at a time. Run `npm run typecheck` after each port group. This allows precise bisection if any replacement introduces a type error.

## Commit Message

```
refactor(constants): replace 98 hardcoded port literals with PORTS/SERVICE_URLS constants

Phase 3.2 Task 1: Hardcoded Port Number Replacement
- Replaced 17 Kismet port 2501 literals with PORTS.KISMET_REST/SERVICE_URLS.KISMET
- Replaced 4 HackRF API port 8092 literals with SERVICE_URLS.HACKRF_API
- Replaced 10 Spectrum port 8073 literals with PORTS.SPECTRUM_WEB
- Replaced 21 Argos port 5173 literals (corrected from 15)
- Replaced 14 grgsm port 4729 literals (corrected from 7 -- 2x original)
- Replaced 9 Bettercap port 8081 literals (corrected from 5)
- Replaced 9 GSM Evil port 8080 literals (corrected from 6)
- Replaced remaining ports: 11434 (4), 3002 (1), 3001 (2), 2947 (2), 8088 (1), 8002 (1)
Verified: grep for raw port literals returns 0 outside limits.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No hardcoded port literals remain**:

```bash
grep -Prn '\b(2501|8092|3002|8073|11434|8081|8080|4729|2947|8088|8002|3001)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "\.md" | wc -l
```

**Expected result**: `0`

**Command 2 -- Port 5173 specifically (often embedded in WebSocket URLs)**:

```bash
grep -Prn '\b5173\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "\.md" | wc -l
```

**Expected result**: `0`

**Command 3 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 4 -- Build succeeds**:

```bash
npm run build
```

**Expected result**: Exit 0.

## Audit Corrections Applied

| Original Claim              | Corrected Value                  | Delta                | Source                                                       |
| --------------------------- | -------------------------------- | -------------------- | ------------------------------------------------------------ |
| 73 total port occurrences   | **98**                           | +25 (34% undercount) | Verification Audit Claim 2, rated 1/5                        |
| Port 2501: 14 occurrences   | **17**                           | +3                   | Audit: missed agent/tools, kismetProxy, webSocketManager     |
| Port 8092: 3 occurrences    | **4**                            | +1                   | Audit: missed agent/tools/+server.ts                         |
| Port 5173: 15 occurrences   | **21**                           | +6                   | Audit: significant undercount across WebSocket URLs          |
| Port 8081: 5 occurrences    | **9**                            | +4                   | Audit: missed additional Bettercap/DroneID references        |
| Port 8080: 6 occurrences    | **9**                            | +3                   | Audit: missed server.ts:346, example-tools.ts, toolHierarchy |
| Port 4729: 7 occurrences    | **14**                           | +7 (2x undercount)   | Audit: MAJOR undercount, largest single error                |
| Port 11434 file attribution | runtime.ts has 2, not 1          | --                   | Audit: agent/models/+server.ts does NOT exist                |
| Port 8092 file attribution  | OpenWebRXView has 8073, not 8092 | --                   | Audit: wrong file listed in original plan                    |

**Impact of audit corrections**: Without these corrections, 25 port hardcodes would have survived execution, requiring a second pass. The verification grep commands would catch this, but at significant re-work cost.

## Risk Assessment

| Risk                                                | Likelihood | Impact | Mitigation                                                                 |
| --------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Port value change alters behavior                   | NONE       | --     | Literal-for-literal replacement; no values changed                         |
| CLIENT_SIDE import of limits.ts fails               | NONE       | --     | limits.ts has no server-only imports; safe for both contexts               |
| SERVICE_URLS template literal fails                 | LOW        | LOW    | PORTS are static `as const`; template literals resolve at module load time |
| Shell command string port replacement breaks syntax | LOW        | MEDIUM | Replace carefully: `:${PORTS.X}` vs `${PORTS.X}` vs string concatenation   |
| Missing occurrences despite audit                   | LOW        | LOW    | Final grep verification catches any remaining literals                     |

## Success Criteria

- `grep -Prn '\b(2501|8092|3002|8073|11434|8081|8080|4729|2947|8088|8002|3001|5173)\b' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l` returns **0**
- `npm run typecheck` exits 0
- `npm run build` exits 0
- All 98 occurrences replaced with named constants
- No behavioral changes -- only identifiers changed, not values

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension)
- **Blocks**: Phase-3.2.7 (IP Address Centralization -- most IPs replaced via SERVICE_URLS in this task)
- **Related**: Phase-2.1.2 (Shell Injection Elimination -- port 4729 in shell commands)
- **Related**: Phase-3.2.2 (Timeout Replacement -- independent, can execute in parallel after 3.2.0)

## Execution Tracking

| Subtask  | Description                  | Status  | Started | Completed | Verified By |
| -------- | ---------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.1.1  | Replace port 2501 (17 files) | PENDING | --      | --        | --          |
| 3.2.1.2  | Replace port 8092 (4 files)  | PENDING | --      | --        | --          |
| 3.2.1.3  | Replace port 8073 (10 files) | PENDING | --      | --        | --          |
| 3.2.1.4  | Replace port 3002 (1 file)   | PENDING | --      | --        | --          |
| 3.2.1.5  | Replace port 11434 (4 files) | PENDING | --      | --        | --          |
| 3.2.1.6  | Replace port 5173 (21 files) | PENDING | --      | --        | --          |
| 3.2.1.7  | Replace port 8081 (9 files)  | PENDING | --      | --        | --          |
| 3.2.1.8  | Replace port 3001 (2 files)  | PENDING | --      | --        | --          |
| 3.2.1.9  | Replace port 8080 (9 files)  | PENDING | --      | --        | --          |
| 3.2.1.10 | Replace port 4729 (14 files) | PENDING | --      | --        | --          |
| 3.2.1.11 | Replace port 2947 (2 files)  | PENDING | --      | --        | --          |
| 3.2.1.12 | Replace port 8088 (1 file)   | PENDING | --      | --        | --          |
| 3.2.1.13 | Replace port 8002 (1 file)   | PENDING | --      | --        | --          |
| 3.2.1.14 | Final verification grep      | PENDING | --      | --        | --          |
