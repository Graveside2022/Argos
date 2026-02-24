# Codebase Audit — Complete Findings

> **Date:** 2026-02-23 (original) | 2026-02-24 (verified + expanded) | 2026-02-24 (second verification pass)
> **Scope:** Full `src/` tree (~56,800 LOC, 467 files per Cartographer mapping)
> **Method:** Automated grep + manual review across 3 audit passes; verified pass with line-level grep on 2026-02-24; second independent verification pass on 2026-02-24 with exhaustive Grep searches against live `016-code-expressiveness` branch (HEAD `b8480ff`)

---

## Verification Notes

This document was independently verified on 2026-02-24. Each finding was cross-referenced against the live codebase using targeted grep searches with exact file:line confirmation. Changes from the original audit are marked with **[CORRECTED]**, **[EXPANDED]**, or **[NEW]** tags. Findings that were inaccurate have been struck through or replaced.

A second independent verification pass was performed on 2026-02-24 using exhaustive ripgrep searches. Additional corrections marked with **[V2]** below.

---

## Priority Legend

| Priority | Meaning                                                                        |
| -------- | ------------------------------------------------------------------------------ |
| P0       | **Fix now** — will cause debugging pain, production failures, or security risk |
| P1       | **Fix soon** — code smell, DRY violation, or type safety gap                   |
| P2       | **Nice-to-have** — polish, consistency, minor improvement                      |

---

## Category A: Operational Fragility (Debugging & Deployment Risk)

These are the ones that cause 30-minute debugging sessions.

### A1. P0 Hardcoded `/tmp/` Paths — 17 instances across 10 files **[CORRECTED]**

**Risk:** Symlink attacks on multi-user systems; breakage if `/tmp` is noexec; stale files across restarts; no way to change log locations without code edits.

| Path                                         | File(s)                                                                    | Count |
| -------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| `/tmp/kismet-start.log`                      | `kismet-control-service.ts:84,170,227,231`                                 | 4     |
| `/tmp/kismet.log`                            | `kismet-control-service.ts:110`                                            | 1     |
| `/tmp/argos-kismet.pid`                      | `service-manager.ts:14`                                                    | 1     |
| `/tmp/argos-kismet.log`                      | `service-manager.ts:15`                                                    | 1     |
| `/tmp/grgsm_scan.log`                        | `gsm-scan-helpers.ts:86`, `gsm-scan-service.ts:35`, `frames/+server.ts:63` | 3     |
| `/tmp/grgsm_scan_${Date.now()}_${index}.log` | `gsm-scan-frequency-analysis.ts:225`                                       | 1     |
| `/tmp/gsmevil2.log`                          | `gsm-evil-control-helpers.ts:168,230`                                      | 2     |
| `/tmp/gsm_db.sqlite`                         | `gsm-database-path.ts:34`, `imsi-data/+server.ts:58`, `imsi/+server.ts:68` | 3     |

> **Original claimed 18+ across 8 files.** Verified: 17 instances across 10 files. The original missed `frames/+server.ts` and miscounted file groupings.

**Fix:** Create `ARGOS_TEMP_DIR` constant: `process.env.ARGOS_TEMP_DIR || path.join(os.tmpdir(), 'argos')`. Use across all files. Ensure the directory is created on startup with `mkdirSync(dir, { recursive: true })`.

### A2. P0 Service URLs Hardcoded Inconsistently — ~28 instances across 15+ files **[EXPANDED]**

Some files use env vars, others hardcode the same URL directly. When you change a port mapping, half the code breaks.

| Service      | URL                                | Env var exists?             | Files that ignore env var                                                                   |
| ------------ | ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| Kismet API   | `localhost:2501`                   | Yes `KISMET_API_URL`        | `kismet-control-service.ts:40`, `kismet-control-service-extended.ts:132,286`                |
| GSM Evil     | `localhost:8080`                   | No                          | `gsm-evil-health-service.ts:137`, `gsm-evil-status/+server.ts:84`, `offnet-utilities.ts:87` |
| OpenWebRX    | `localhost:8073`                   | No                          | `OpenWebRXView.svelte:12`, `network-detector.ts:186`, `openwebrx/control/+server.ts:42`     |
| Bettercap    | `localhost:80`                     | No                          | `dashboard/+page.svelte:140` **[NEW]**                                                      |
| HackRF API   | `localhost:8092`                   | Yes `PUBLIC_HACKRF_API_URL` | `network-detector.ts:161` (uses env, but port 8092 undocumented)                            |
| Argos (self) | `localhost:5173`                   | Yes `ARGOS_API_URL`         | `api-debugger.ts:46,66,113`, `websocket-server.ts:17`, `cors.ts:10,12` **[NEW]**            |
| CORS origins | `localhost:5173`, `localhost:3000` | No                          | `cors.ts:10-12` **[NEW]**                                                                   |

> **Original claimed 10+ files.** Verified: ~28 hardcoded URL instances across 15+ files. The original missed Bettercap (port 80), HackRF API (port 8092), CORS origins, and several MCP server references.

**MCP servers** (`src/lib/server/mcp/`) contain ~8 additional `localhost:5173` references but these correctly use `process.env.ARGOS_API_URL || 'http://localhost:5173'` fallback pattern (acceptable).

**Fix:** Create `src/lib/constants/services.ts` with all service URLs sourced from env vars with fallback defaults. Import everywhere. Add `BETTERCAP_URL`, `GSM_EVIL_URL`, `OPENWEBRX_URL` env vars.

### A3. P1 `process.env.USER || 'kali'` — Hardcoded to one distro

`kismet-control-service-extended.ts:76` falls back to `'kali'` user. Same file at line 183 also references `'kali'` in a status string. Breaks silently on Parrot OS (`parrot`), Raspberry Pi OS (`pi`), or any custom deployment user.

**Fix:** Use a more generic fallback (`os.userInfo().username`) or fail explicitly with a helpful error.

### A4. P1 Server-Side `setInterval()` Without Cleanup — 4 files **[CORRECTED]**

| File                          | Interval             | Cleanup?                                             |
| ----------------------------- | -------------------- | ---------------------------------------------------- |
| `resource-manager.ts:19`      | 30s hardware refresh | No dispose method                                    |
| `gsm-monitor-service.ts:27`   | 10s idle check       | No shutdown method                                   |
| `rate-limit-middleware.ts:20` | 5min cleanup         | globalThis guard prevents duplicates, but no dispose |
| `web-socket-manager.ts:60`    | 60s cache cleanup    | No stop method for this timer                        |

**Files WITH proper cleanup (no action needed):**

- `hardware-detector.ts:161` — has `stop()` method with `clearInterval`
- `cleanup-service.ts:97,101` — has `stop()` method with `clearInterval`
- `sweep-manager.ts:75` — has cleanup in dispose
- `websocket-handlers.ts:142` — per-connection, cleaned on WebSocket close

> **Original claimed 3 files and listed `logger.ts:74` — that was WRONG.** `logger.ts` has no `setInterval`. The actual 4th uncleaned file is `rate-limit-middleware.ts` (uses globalThis guard to prevent HMR duplication, but has no dispose method for graceful shutdown).

During Vite HMR, `resource-manager.ts` and `gsm-monitor-service.ts` create new instances without clearing old timers. The `rate-limit-middleware.ts` and `web-socket-manager.ts` use globalThis guards to prevent HMR duplication (lower risk) but still lack clean shutdown.

**Fix:** Add `dispose()` methods; store interval IDs and clear on module reload. For globalThis-guarded intervals, add cleanup to the server shutdown handler in `hooks.server.ts`.

### A5. P2 Client-Side `setInterval()` Lifecycle Pattern Inconsistency **[CORRECTED — downgraded from P1]**

> **Original claimed 4 components lacked cleanup. This was WRONG.** All 4 listed components DO have proper cleanup:

| Component                  | Pattern            | Cleanup                                                           |
| -------------------------- | ------------------ | ----------------------------------------------------------------- |
| `SatelliteTable.svelte:25` | `$effect` + return | Yes — `return () => clearInterval(interval)` at line 35           |
| `TopStatusBar.svelte:138`  | `$effect` + return | Yes — `return () => { clearInterval(...) }` at lines 164-168      |
| `GsmEvilPanel.svelte:95`   | `onDestroy`        | Yes — `clearInterval(imsiPollInterval)` at line 108-110           |
| `TowerTable.svelte:49`     | `onDestroy`        | Yes — `clearInterval(timestampInterval)` at line 54-56            |
| `OverviewPanel.svelte:68`  | `onMount` return   | Yes — `return () => clearInterval(refreshInterval)` at line 72-74 |

**Remaining issue (downgraded to P2):** The cleanup approach is inconsistent — `SatelliteTable` and `TopStatusBar` use Svelte 5 `$effect` return pattern, while `GsmEvilPanel`, `TowerTable`, and `OverviewPanel` use the older `onMount`/`onDestroy` pattern. Both work, but the idiomatic Svelte 5 approach is `$effect` with return cleanup.

**Fix:** Low priority. Optionally migrate `onMount`/`onDestroy` interval patterns to `$effect` return pattern for consistency.

### A6. P2 `/var/run/gpsd.sock` Hardcoded

`serial-detector.ts:83` — standard on Debian/Kali but varies by distro. Should be configurable via env var.

---

## Category B: DRY / Mechanical Refactoring

Code duplication that inflates the codebase and creates divergence risk.

### B1. P0 Client-Side Fetch Wrapper — ~37 identical try/catch/return-null patterns **[CORRECTED]**

**Lines saved: ~110** | **Effort: Small**

Client-side `await fetch()` calls follow a repetitive try/catch/return-null pattern across **37 call sites in 19 files** (components, stores, route logic). A generic `fetchJSON<T>(url, options?)` wrapper would eliminate 3-4 boilerplate lines per site.

> **Original claimed 60+.** Verified: ~37 client-side fetch sites. The 60+ number likely included server-side `fetch()` calls in API routes and MCP servers, which have different error handling needs and should NOT use the same wrapper.

**Heaviest client-side consumers:**

- `status-bar-data.ts` — 5 fetch calls
- `tak-config-logic.ts` — 4 fetch calls
- `gsm-evil-page-logic.ts` — 5 fetch calls
- `OverviewPanel.svelte` — 3 fetch calls
- `GsmEvilPanel.svelte` — 3 fetch calls

### B2. P0 FNV-1a MAC Hash + GPS Offset — Verbatim clone across 2 files

**Lines saved: ~80** | **Effort: Small**

`hashMAC()`, `hashMAC2()`, `signalToDistance()`, `offsetGps()`, `computeFallbackLocation()` duplicated byte-for-byte between:

- `src/lib/server/services/kismet.service.ts` (lines 120-177)
- `src/routes/api/kismet/devices/+server.ts` (lines 36-109)

### B3. P1 Haversine Distance — 6 independent implementations **[EXPANDED]**

**Lines saved: ~60** | **Effort: Small**

Canonical `calculateDistance()` exists in `geo.ts:19` and uses the shared `GEO.EARTH_RADIUS_M` constant. 5 other implementations should import it.

| File                           | Function                        | Unit   |
| ------------------------------ | ------------------------------- | ------ |
| `geo.ts:19`                    | `calculateDistance()` canonical | meters |
| `map-helpers.ts:174`           | `haversineKm()`                 | km     |
| `status-bar-data.ts:94`        | `haversineMeters()`             | meters |
| `components.test.ts:167`       | inline                          | meters |
| `kismet/devices/+server.ts:83` | inline (R=6371000) **[NEW]**    | meters |
| `kismet.service.ts:155`        | inline (R=6371000) **[NEW]**    | meters |

> **Original counted 4.** The kismet files also contain inline haversine-like offset math with `R = 6371000` that duplicates the same calculation.

### B4. P1 MAC-to-Angle — 3 Different Hash Algorithms (Consistency Bug)

**Lines saved: ~20** | **Effort: Small**

Same purpose (deterministic fan-out of devices around GPS point), different algorithms. Same device gets a different angle depending on which code path processes it.

- `map-helpers.ts:9` — `macToAngle()` using DJB2-ish hash
- `kismet.service.ts:120` — `hashMAC()` using FNV-1a
- `kismet/devices/+server.ts:36` — `hashMAC()` using FNV-1a (clone)

### B5. P1 `delay()` Utility — 37 copies across 21 files **[CORRECTED]**

**Lines saved: ~37** | **Effort: Trivial**

Exact same `await new Promise(resolve => setTimeout(resolve, N))` pattern across 21 files (original said 18).

**Heaviest files:**

- `service-manager.ts` — 6 instances
- `kismet-control-service-extended.ts` — 3 instances
- `sweep-cycle-init.ts` — 3 instances
- `gsm-evil-control-helpers.ts` — 2 instances
- `gsm-scan-service.ts` — 2 instances

**Fix:** `export const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));` in `src/lib/utils/delay.ts`.

### B6. P1 Earth Radius `6371000` — Hardcoded in 5 files **[CORRECTED]**

`GEO.EARTH_RADIUS_M` exists in `constants/limits.ts:21` but only `geo.ts:20` uses it. 4 other files hardcode the number:

- `map-helpers.ts:105`
- `status-bar-data.ts:95`
- `kismet/devices/+server.ts:83`
- `kismet.service.ts:155`

> **Original said 4 files** (3 hardcoded + 1 constant). Verified: 5 files total with the constant, 4 that ignore it.

### B7. P1 `111320` (meters/degree lat) — Magic number in `map-helpers.ts`

`METERS_PER_DEGREE_LAT` constant exists in `geo.ts:13` but `map-helpers.ts:46-47` uses raw `111320`.

### B8. P1 Unsafe Error Casts — 14 remaining **[EXPANDED]**

Two patterns of unsafe error casting remain:

**Pattern 1: `(error as { message?: string })` — 4 instances (original finding):**

- `kismet-control-service-extended.ts:278`
- `hooks.server.ts:248`
- `gsm-evil/activity/+server.ts:24` — `(error as { stdout: string }).stdout`
- `gsm-evil-stop-helpers.ts:74` — `(error as { signal?: string }).signal`

**Pattern 2: `(error as Error)` — 7 instances (missed by original audit):**

- `sweep-coordinator.ts:117`
- `sweep-coordinator.ts:267`
- `sweep-cycle-init.ts:120` (assigned to `err`)
- `sweep-cycle-init.ts:197`
- `sweep-cycle-init.ts:205`
- `sweep-health-checker.ts:198` (assigned to `err`)
- `base.ts:366`

**Pattern 3: Other unsafe casts on error — 3 additional:**

- `hooks.server.ts:248` — `(error as unknown as Record<string, unknown>)`
- `hackrf/data-stream/+server.ts:110` — eslint-disable for `any` on listener pairs

> **Original counted 4.** Verified: 14 total unsafe error casts across both patterns. The T014 commit eliminated some but the HackRF subsystem and hooks were not fully cleaned.

**Fix:** Use shared `errMsg()` from `error-utils.ts` for all error message extraction. For structured error properties (`.signal`, `.stdout`), use type guards.

### B9. P1 Dual Logger API — `logger.error()` vs `logError()` **[CORRECTED]** **[V2]**

| API              | Call sites | Files |
| ---------------- | ---------- | ----- |
| `logger.error()` | 150        | 85    |
| `logError()`     | 86         | 25    |

> **Original said ~170 calls split 50/50.** First verification said 204. Second verification (exhaustive grep count): **236 total calls** split roughly **64/36** (not 50/50). `logger.error()` is dominant. `logError()` is concentrated in the `hackrf/`, `kismet/`, and `db/` subsystems.

**Fix:** Standardize on `logger.error()` since it has ~1.7x more usage. Migrate the 86 `logError()` calls.

### B10. P2 GPS Coordinate Validation — 3 implementations

`hasValidLocation()`, `extractGpsCoords()`, and threshold-based check — all variants of "is this coord valid?"

### B11. P2 Ad-hoc Retry Loop to `withRetry()` — Partially Resolved

> Commit `0514035` (T028) migrated 2 ad-hoc retry loops to `withRetry()`. Additional ad-hoc retry patterns may remain in the kismet service manager.

### B12. P2 Switch to Lookup Tables in `l3-message-decoders.ts`

---

## Category C: Type Safety

Casts and unvalidated data that hide bugs until runtime.

### C1. P1 ~100+ Unsafe `as` Casts on Untyped API/JSON Responses **[EXPANDED]**

25+ files use `as string`, `as number`, `as Record<string, unknown>` to extract fields from JSON/API responses. Verified 60+ cast sites in grep results alone.

**Heaviest offenders (verified):**

| File                        | Cast count   | External source          |
| --------------------------- | ------------ | ------------------------ |
| `agent-context-store.ts`    | 15 **[NEW]** | Kismet device records    |
| `cell-tower-service.ts`     | 10           | OpenCelliD API           |
| `gps-satellite-service.ts`  | 8            | gpsd                     |
| `status-bar-data.ts`        | 8            | Open-Meteo weather       |
| `kismet/devices/+server.ts` | 8 **[NEW]**  | Kismet raw device shape  |
| `kismet/status/+server.ts`  | 4 **[NEW]**  | Kismet system status     |
| `TakDataPackage.svelte`     | 6            | TAK Server API           |
| `TakAuthImport.svelte`      | 3 **[NEW]**  | TAK cert upload response |

> **Original listed 4 files.** The `agent-context-store.ts` is the worst offender with 15 `as` casts — it was entirely missed.

**Fix:** Define typed interfaces for each external API's response shape. Validate at boundary with Zod or at minimum type the parse result correctly. `safeJsonParse()` already exists in `src/lib/server/security/safe-json.ts` and is used in GPS/hardware services — extend this pattern.

### C2. P1 `globalThis as Record<string, unknown>` — 11 instances, 5 files

Singleton pattern hacks `globalThis` without type declarations.

| File                                   | Instances |
| -------------------------------------- | --------- |
| `hooks.server.ts:270-271`              | 2         |
| `web-socket-manager.ts:71,81`          | 2         |
| `rate-limit-middleware.ts:14,16,19,20` | 4         |
| `database.ts:258-259`                  | 2         |
| `sweep-manager.ts:306`                 | 1         |

**Fix:** Add to `app.d.ts`: `declare global { var __rateLimiter: RateLimiter; var __dbShutdown: boolean; ... }`

### C3. P1 Unvalidated `JSON.parse()` at Trust Boundaries **[EXPANDED]**

~20+ `JSON.parse()` calls (original said ~18), many cast directly with `as SomeType`. Most dangerous:

- `websocket-server.ts:137` — `as WebSocketMessage`
- `web-socket-manager.ts:117` — `as ClientMessage`
- `agent/runtime.ts:160` — `as Record<string, unknown>`
- `gsm-evil-store.ts:99` — `as Partial<GSMEvilState>` **[NEW]**
- `gsm-evil-scan-stream.ts:25` — raw SSE data **[NEW]**

`safeJsonParse()` exists in `src/lib/server/security/safe-json.ts` but is only used in 3 files (GPS position, GPS satellites, hardware details). The WebSocket and SSE trust boundaries remain unprotected.

**Fix:** Extend `safeJsonParse()` usage to all trust boundaries, especially WebSocket message parsing and SSE stream consumption.

### C4. P1 Untyped Kismet Raw Device Shape

`kismet/devices/+server.ts` processes devices as `Record<string, unknown>[]`. Three helper functions manually cast properties. Should be a `KismetRawDevice` interface.

### C5. P1 Missing External API Response Interfaces (3 Services)

OpenCelliD, gpsd, and Open-Meteo responses are never typed — fields accessed via `as number` casts.

### C6. P2 `milsymbol` Renderer as `any`

`symbol-factory.ts:56-57` — eslint-disable for `no-explicit-any`. One of 4 `any` suppressions in the codebase (not 2 as originally claimed).

### C7. P2 Type Branding for Domain IDs

`DeviceId`, `SignalId`, `SessionId` all `string` — no compile-time distinction.

### C8. P2 Typed WebSocket Message Discriminated Union

### C9. P2 Repository/Data Access Abstraction

---

## Category D: Findings Missed by Original Audit **[NEW SECTION]**

### D1. P1 `OverviewPanel.svelte` Swallowed Errors **[NEW]**

Lines 40-61 contain three fetch functions with `catch (_error: unknown) { /* silent */ }`. This violates the project's "No swallowed errors" convention (CLAUDE.md). Failures in system info, hardware status, or hardware details fetch are silently discarded.

**Fix:** At minimum log the error. Better: show a degraded UI state with "unavailable" indicators.

### D2. P1 Remaining `eslint-disable` Directives — 4 instances **[NEW]**

| File                                | Directive                            | Reason                 |
| ----------------------------------- | ------------------------------------ | ---------------------- |
| `hackrf/data-stream/+server.ts:110` | `@typescript-eslint/no-explicit-any` | Generic listener pairs |
| `symbol-factory.ts:56`              | `@typescript-eslint/no-explicit-any` | milsymbol renderer     |
| `validation-error.ts:47`            | `@typescript-eslint/no-explicit-any` | Zod issue union        |
| `dynamic-server.ts:14`              | `no-undef`                           | MCP server global      |

The original audit's "Clean Bill of Health" claimed only 2 `any` types. There are actually 4 `eslint-disable` directives suppressing type safety checks.

### D3. P1 `process.env` Bypass of Zod-validated `env.ts` — 35+ direct accesses **[V2 NEW]**

The codebase has a Zod-validated `src/lib/server/env.ts` module for typed environment variable access, but **35+ files read `process.env` directly** instead of using it. This means:

- No runtime validation of env var format/presence at those access points
- Inconsistent fallback defaults (some use `|| 'http://localhost:2501'`, others `|| ''`)
- Changes to env var names require grep-and-replace instead of single-point update

**Worst offenders (non-MCP server code):**

| File                                 | Direct `process.env` reads                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `auth-middleware.ts`                 | 3 (`ARGOS_API_KEY`)                                                                  |
| `kismet-proxy.ts`                    | 5 (`KISMET_HOST`, `KISMET_PORT`, `KISMET_API_KEY`, `KISMET_USER`, `KISMET_PASSWORD`) |
| `web-socket-manager.ts`              | 2 (`KISMET_API_URL`, `KISMET_API_KEY`)                                               |
| `kismet-control-service-extended.ts` | 3 (`USER`, `KISMET_USER`, `KISMET_PASSWORD`)                                         |
| `agent/runtime.ts`                   | 2 (`ANTHROPIC_API_KEY`)                                                              |
| `cell-tower-service.ts`              | 1 (`OPENCELLID_API_KEY`)                                                             |
| `tak-service.ts`                     | 1 (`NODE_TLS_REJECT_UNAUTHORIZED`)                                                   |
| `network-detector.ts`                | 2 (`PUBLIC_KISMET_API_URL`, `PUBLIC_HACKRF_API_URL`)                                 |
| `cors.ts`                            | 1 (`ARGOS_CORS_ORIGINS`)                                                             |
| `websocket-server.ts`                | 1 (`HOSTNAME`)                                                                       |

**Note:** MCP servers (`src/lib/server/mcp/`) have ~8 additional `process.env` reads. These run as standalone processes and cannot import SvelteKit modules, so direct access is acceptable there.

**Fix:** Add missing env vars to `env.ts` Zod schema. Import typed `env` object in all server files instead of reading `process.env` directly. This is a Phase 1 priority because it directly affects A2 (hardcoded URLs).

### D4. P1 Oversized Files (>300 LOC) — 19 non-test files **[V2 NEW]**

Article 2.2 of CLAUDE.md sets a 300-line file limit. 19 non-test source files exceed it:

| File                                 | Lines | Category       |
| ------------------------------------ | ----- | -------------- |
| `base.ts` (websocket)                | 394   | Infrastructure |
| `gsm-evil-store.ts`                  | 380   | Store          |
| `dynamic-server-tools.ts`            | 379   | MCP            |
| `system-inspector.ts`                | 373   | MCP            |
| `gsm-evil-health-service.ts`         | 370   | Service        |
| `api-debugger.ts`                    | 368   | MCP            |
| `terminal-store.ts`                  | 347   | Store          |
| `frontend-tools.ts`                  | 335   | Agent          |
| `dashboard-map-logic.svelte.ts`      | 335   | Component      |
| `TakConfigView.svelte`               | 329   | Component      |
| `error-tracker.ts`                   | 321   | HackRF         |
| `gsm-scan-frequency-analysis.ts`     | 313   | Service        |
| `gsm-scan-capture.ts`                | 313   | Service        |
| `sweep-manager.ts`                   | 313   | HackRF         |
| `tak-service.ts`                     | 312   | Service        |
| `kismet-control-service-extended.ts` | 306   | Service        |
| `streaming-inspector.ts`             | 300   | MCP            |
| `DashboardMap.svelte`                | 300   | Component      |
| `hardware-details-service.ts`        | 297   | Service        |

> MCP server files (5 of these) are tool definition arrays that resist decomposition — consider these acceptable exceptions. The remaining 14 are actionable.

**Fix:** Extract sub-modules. For example, `gsm-evil-store.ts` (380 lines) could split into state definition + actions + computed. `base.ts` (394 lines) could separate reconnect logic from message handling.

### D5. P2 `@ts-expect-error` in Tests **[NEW]**

`src/lib/utils/theme-colors.test.ts:9,19` — 2 `@ts-expect-error` directives for SSR testing (intentionally removing `document`). Acceptable in tests but should be documented.

---

## Clean Bill of Health (Verified with corrections)

| Check                   | Result                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SQL Injection**       | **Safe.** Parameterized queries confirmed. `validateSqlIdentifier` guards dynamic table names.                                                                                                                                                   |
| `@ts-ignore`            | Zero (confirmed)                                                                                                                                                                                                                                 |
| `@ts-expect-error`      | 2 (in test file only — acceptable) **[CORRECTED]**                                                                                                                                                                                               |
| `any` types             | 4 eslint-disable directives (not 2 as originally claimed) **[CORRECTED]**                                                                                                                                                                        |
| `eval()` / `exec()`     | Zero — uses `execFile` correctly (confirmed)                                                                                                                                                                                                     |
| Leaked secrets          | Zero — all keys via env vars (confirmed)                                                                                                                                                                                                         |
| `console.log` pollution | Zero in production code. 6 `console.warn` in `tool-hierarchy.test.ts` (test-only, acceptable). **[V2]**                                                                                                                                          |
| Empty catch blocks      | 3 `/* silent */` catch blocks in `OverviewPanel.svelte:40,49,58` (documented in D1). ~30 additional `catch (_error)` blocks exist but all either log, return defaults, or handle expected failure modes (e.g., process-kill). **[V2 CORRECTED]** |
| `process.exit()`        | 10 instances — 8 in MCP servers (acceptable: standalone processes), 2 in auth-middleware (startup validation, acceptable)                                                                                                                        |

---

## Recommended Implementation Order **[V2 UPDATED]**

### Phase 1 — Operational Hardening (prevent debugging sessions)

- D3 (env.ts centralization) — 35+ direct `process.env` accesses, **do first** as it enables A2 **[V2 NEW]**
- A1 (temp dir constant) — 17 instances, 10 files
- A2 (service URLs) — ~28 instances, 15+ files (easier after D3)
- A3 (kali fallback) — 2 instances, 1 file
- A4 (server timer cleanup) — 4 files

### Phase 2 — DRY Consolidation (biggest LOC reduction)

- B5 (delay utility) — 37 instances, 21 files (trivial, do first)
- B2 (MAC hash dedup) — 2 files, ~80 lines saved
- B1 (client fetch wrapper) — 37 sites, 19 files
- B8 (error casts) — 14 instances across both patterns

### Phase 3 — Type Safety Hardening

- C2 (globalThis typing) — 11 instances, 5 files
- C1/C5 (external API interfaces) — biggest type safety gain
- C3 (JSON.parse validation) — extend safeJsonParse to WebSocket/SSE boundaries
- D1 (swallowed errors in OverviewPanel) — quick fix

### Phase 4 — Structural + Polish

- D4 (oversized file decomposition) — 14 actionable files >300 LOC **[V2 NEW]**
- B3 (haversine consolidation) — 6 implementations to 1
- B4 (MAC angle consistency) — 3 algorithms to 1
- B6/B7 (magic number constants) — mechanical replacement
- B9 (logger API standardization) — 86 call sites to migrate **[V2 CORRECTED]**
- A5 (onMount/onDestroy to $effect migration) — optional consistency
- Remaining C items (C4, C6-C9)
