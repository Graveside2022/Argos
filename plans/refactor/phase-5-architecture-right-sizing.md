# Phase 5: Architecture Right-Sizing

**Timeline**: 5 days
**Effort**: 40 hours
**Risk**: MODERATE (restructuring active code, not just deleting dead code)
**Savings**: ~25,000 lines (42,000 → ~17,000)
**Commits**: 12 sub-commits with dashboard gates
**Baseline**: 42,000 lines in src/ (post-Phase 4), 90 typecheck errors, build passing

---

## Problem Statement

Argos is a SvelteKit UI dashboard that proxies to existing backends (Kismet, HackRF Python emitter, gpsd). The current 42,000-line codebase re-implements backend logic in TypeScript, over-engineers hardware detection for a fixed Raspberry Pi deployment, ships dev-only tooling in production, and scatters business logic across components instead of services.

A properly-sized version of this app should be ~10,000-12,000 lines.

---

## VERIFICATION GATE (run after EVERY sub-commit)

```bash
npm run build && npm run typecheck && npm run lint
npm run dev &
sleep 8
# Dashboard loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dashboard | grep -q 200
# Health
curl -s http://localhost:5173/api/health | grep -q "ok"
# No console errors (manual check)
kill %1
echo "PASS: All gates passed"
```

---

## Sub-Phase 5.1: Delete Dead Code (Zero-Risk)

**Savings**: ~3,000 lines
**Risk**: ZERO (nothing imports these)
**Commit**: `refactor(phase5.1): delete dead localization, USRP, and .deleted files`

### Files to Delete

**Localization service (1,030 lines)** — never imported, references non-existent Coral TPU + hardcoded `/home/ubuntu/` paths:

- `src/lib/services/localization/coral/coral-accelerator-v2.ts` (297 lines)
- `src/lib/services/localization/coral/coral_worker.py` (187 lines)
- `src/lib/services/localization/coral/coral-accelerator.ts` (157 lines)
- `src/lib/services/localization/rssi-localizer.ts` (172 lines)
- `src/lib/services/localization/hybrid-rssi-localizer.ts` (103 lines)
- `src/lib/services/localization/types.ts` (42 lines)
- `src/lib/services/localization/index.ts` (31 lines)
- `src/lib/services/localization/coral/index.ts` (20 lines)
- `src/lib/services/localization/coral/setup_coral_env.sh` (21 lines)
- `src/lib/services/localization/RSSILocalizer.ts.deleted` (0 lines)
- `src/lib/services/localization/HybridRSSILocalizer.ts.deleted` (0 lines)

**USRP sweep services (1,077 lines)** — USRP hardware not installed, duplicate of HackRF pattern:

- `src/lib/services/usrp/sweep-manager/buffer-manager.ts` (547 lines)
- `src/lib/services/usrp/sweep-manager/process-manager.ts` (386 lines)
- `src/lib/services/usrp/` entire directory (verify zero imports first)

**USRP server sweep manager (465 lines)**:

- `src/lib/server/usrp/sweep-manager.ts` (465 lines)
- `src/lib/server/usrp/` entire directory

**USRP API service (496 lines)**:

- `src/lib/services/hackrf/usrp-api.ts` (496 lines)

**HackRF sweep shell/python scripts in services (277 lines)** — belong in hackrf_emitter, not SvelteKit:

- `src/lib/services/hackrf/sweep-manager/usrp_sweep.py` (146 lines)
- `src/lib/services/hackrf/sweep-manager/auto_sweep.sh` (77 lines)
- `src/lib/services/hackrf/sweep-manager/mock_sweep.sh` (54 lines)

**Hardware README (428 lines)** — documentation inside source tree:

- `src/lib/server/hardware/README.md` (428 lines)

### Verification

- Grep every file for imports before deleting
- Run full verification gate

---

## Sub-Phase 5.2: Simplify Hardware Detection

**Savings**: ~1,700 lines (2,047 → ~350)
**Risk**: LOW (hardware detection runs at startup, easy to test)
**Commit**: `refactor(phase5.2): replace hardware detection with simple known-device check`

### Problem

11 files / 2,047 lines detect hardware by polling `lsusb`, `iw dev`, `mmcli`, `uhd_find_devices`, and probing network services — every 30 seconds. But the Pi has 3 known devices (HackRF, Alfa WiFi, GPS dongle) that don't change.

### Files to Replace

Replace entire `src/lib/server/hardware/detection/` directory (1,080 lines) with a single `simple-detector.ts` (~120 lines):

- `detection/usb-detector.ts` (378 lines) — DELETE
- `detection/serial-detector.ts` (274 lines) — DELETE
- `detection/network-detector.ts` (220 lines) — DELETE
- `detection/hardware-detector.ts` (208 lines) — DELETE

Replace `hardware-registry.ts` (251 lines) with a simple Map (~30 lines).

Simplify `resource-manager.ts` (290 lines) to ~80 lines — remove mutex contention logic (single-user Pi), reduce poll interval to 60s or on-demand only.

Remove `detection-types.ts` (169 lines) — replace with 30-line type definition for 3 device types.

### Keep

- `hackrf-manager.ts` (108 lines) — Docker/process detection is useful
- `alfa-manager.ts` (51 lines) — Kismet interface detection is useful
- `index.ts` (66 lines) — simplify exports

### New File: `src/lib/server/hardware/simple-detector.ts` (~120 lines)

```typescript
// Detect 3 known devices:
// 1. HackRF: run `hackrf_info`, check exit code
// 2. Alfa WiFi: run `iw dev`, look for wlan interface
// 3. GPS: check /dev/ttyUSB0 exists, optionally read NMEA
// Run once at startup + on-demand via API
```

---

## Sub-Phase 5.3: Collapse HackRF Frontend Services

**Savings**: ~4,000 lines (4,279 → ~300)
**Risk**: MODERATE (SSE data flow changes, requires careful testing)
**Commit**: `refactor(phase5.3): replace HackRF frontend services with thin SSE client`

### Problem

The Python backend (`hackrf_emitter/`) already runs `hackrf_sweep`, captures stdout, and serves data. The TypeScript frontend re-implements:

- Stdout parsing (buffer-manager.ts, 528 lines)
- Error tracking and device health scoring (error-tracker.ts, 537 lines)
- Frequency cycling logic (frequency-cycler.ts, 459 lines)
- Process spawning (process-manager.ts, 439 lines)
- Signal fade/opacity math (time-window-filter.ts, 485 lines)

### Files to Delete

- `src/lib/services/hackrf/sweep-manager/error-tracker.ts` (537 lines)
- `src/lib/services/hackrf/sweep-manager/buffer-manager.ts` (528 lines)
- `src/lib/services/hackrf/time-window-filter.ts` (485 lines)
- `src/lib/services/hackrf/sweep-manager/frequency-cycler.ts` (459 lines)
- `src/lib/services/hackrf/sweep-manager/process-manager.ts` (439 lines)
- `src/lib/services/hackrf/sweep-manager/index.ts` (31 lines)

### Files to Simplify

- `src/lib/services/hackrf/api.ts` (499 lines → ~80 lines) — generic SSE client
- `src/lib/services/hackrf/hackrf-service.ts` (481 lines → ~100 lines) — thin store wrapper
- `src/lib/services/hackrf/index.ts` (47 lines → ~10 lines)

### Also Simplify Server-Side

- `src/lib/server/hackrf/sweep-manager.ts` (1,490 lines → ~300 lines) — remove frontend module imports, simplify to: start process, parse output, send JSON via SSE

### New Architecture

```
hackrf_sweep binary → sweep-manager.ts (server, ~300 lines)
  → parses stdout into JSON
  → sends via SSE: { frequency, power, timestamp }
  → frontend receives pre-parsed JSON
  → hackrf-service.ts (client, ~100 lines) manages SSE connection + store updates
```

### Migration Strategy

1. First: add JSON parsing to server sweep-manager (it currently sends raw text)
2. Then: delete frontend parsing/tracking code
3. Finally: simplify hackrf-service.ts to just connect + update store

---

## Sub-Phase 5.4: Simplify Database Layer

**Savings**: ~2,000 lines (2,721 → ~700)
**Risk**: LOW (most deletions are unused features)
**Commit**: `refactor(phase5.4): simplify database to core signal storage`

### Problem

Enterprise-grade database architecture (cleanup service, optimizer, aggregation tables, pattern detection, network graph) for a single-user system that stores 1 hour of RF data.

### Files to Delete

- `src/lib/server/db/cleanup-service.ts` (506 lines) — replace with simple `DELETE WHERE timestamp < ?` in database.ts
- `src/lib/server/db/db-optimizer.ts` (502 lines) — one-time pragmas belong in constructor, not a separate class
- `src/lib/server/db/cleanup-strategy.sql` (249 lines) — aggregation tables never queried
- `src/lib/server/db/migrations/001_add_cleanup_features.sql` (232 lines) — cleanup views unused

### Files to Simplify

- `src/lib/server/db/database.ts` (356 lines → ~200 lines) — inline pragmas, add simple cleanup timer
- `src/lib/server/db/signal-repository.ts` (201 lines → ~100 lines) — remove unused queries
- `src/lib/server/db/network-repository.ts` (67 lines) — audit for actual usage, likely delete
- `src/lib/server/db/spatial-repository.ts` (63 lines) — inline into database.ts

### Keep As-Is

- `src/lib/server/db/schema.sql` (124 lines) — core schema
- `src/lib/server/db/geo.ts` (112 lines) — spatial math needed
- `src/lib/server/db/device-service.ts` (82 lines) — device queries
- `src/lib/server/db/types.ts` (70 lines)
- `src/lib/server/db/index.ts` (49 lines)
- `src/lib/server/db/migrations/run-migrations.ts` (88 lines)
- `src/lib/server/db/migrations/002_*.sql` (20 lines)

---

## Sub-Phase 5.5: Collapse Agent Layer

**Savings**: ~900 lines (987 → ~100)
**Risk**: LOW (agent chat still works, just simpler)
**Commit**: `refactor(phase5.5): simplify agent to direct Ollama proxy`

### Problem

The agent layer has 987 lines supporting Anthropic API + Ollama + tool execution + frontend tool registry. In production, only Ollama runs (no ANTHROPIC_API_KEY), and the 1B model can't use tools effectively.

### Files to Delete

- `src/lib/server/agent/frontend-tools.ts` (368 lines) — agent ignores tool calls
- `src/lib/server/agent/tools.ts` (269 lines) — tool definitions never executed

### Files to Simplify

- `src/lib/server/agent/runtime.ts` (335 lines → ~100 lines) — remove Anthropic fallback, remove tool execution loop, keep Ollama streaming only
- `src/routes/api/agent/tools/+server.ts` (488 lines → ~50 lines) — simplify to return basic device/signal context

### Keep

- `src/routes/api/agent/stream/+server.ts` — simplify the handler

---

## Sub-Phase 5.6: Simplify MCP Server (Keep in src/)

**Savings**: ~500 lines (1,981 → ~1,400)
**Risk**: LOW (standalone process, no runtime dependency)
**Commit**: `refactor(phase5.6): simplify MCP server config and types`

### Context

MCP server ships with Claude Code in Docker and must stay in `src/lib/server/mcp/`. It runs as a standalone process communicating via HTTP API to the SvelteKit app.

### Actions

- Simplify `config-generator.ts` (202 lines → ~80 lines) — remove auto-detection logic, hardcode Docker/host paths
- Trim unused tool definitions from `dynamic-server.ts` (655 lines → ~500 lines)
- Audit MCP tool modules for dead code
- Keep all 12 tools functional — MCP integration is a production feature

---

## Sub-Phase 5.7: Consolidate Duplicate Stores

**Savings**: ~1,100 lines (1,959 → ~800)
**Risk**: MODERATE (store consumers need updating)
**Commit**: `refactor(phase5.7): consolidate duplicate stores`

### Problem

Two parallel store hierarchies exist:

- `src/lib/stores/hackrf.ts` (318 lines) AND `src/lib/stores/tactical-map/hackrf-store.ts` (121 lines)
- `src/lib/stores/kismet.ts` (204 lines) AND `src/lib/stores/tactical-map/kismet-store.ts` (128 lines)

### Actions

1. Merge `hackrf.ts` + `tactical-map/hackrf-store.ts` → single `hackrf.ts` (~200 lines)
2. Merge `kismet.ts` + `tactical-map/kismet-store.ts` → single `kismet.ts` (~150 lines)
3. Merge `agent-context-store.ts` (216 lines) into `dashboard-store.ts` — agent context is dashboard state
4. Audit `tools-store.ts` (159 lines) — if only used by ToolsNavigationView, inline it
5. Delete `tactical-map/` store directory after merge
6. Delete `dashboard/index.ts` barrel (71 lines) if unused

### Update All Consumers

- Grep for every import of the old paths
- Update to new consolidated paths
- Test each panel/component individually

---

## Sub-Phase 5.8: Extract Services from Components

**Savings**: ~2,500 lines (components shrink, services stay lean)
**Risk**: MODERATE (component refactoring)
**Commit**: `refactor(phase5.8): extract business logic from components to services`

### Problem

Components contain business logic that should be in services:

- `TopStatusBar.svelte` (1,001 lines) — fetches weather, calculates RF conditions, runs Haversine
- `DashboardMap.svelte` (1,053 lines) — geo math, popup state, cell tower fetching
- `OverviewPanel.svelte` (741 lines) — hardware queries, data transformation
- Haversine distance calculation duplicated in 3+ files

### New Service Files

Create `src/lib/services/geo-utils.ts` (~50 lines):

- Haversine distance (extracted from 3 duplicated copies)
- Circle polygon generation (from DashboardMap)

Create `src/lib/services/weather-service.ts` (~80 lines):

- Weather fetching + RF conditions logic (from TopStatusBar)
- Weather icon SVG mapping

Create `src/lib/services/hardware-info-service.ts` (~60 lines):

- Hardware details fetching (from OverviewPanel)
- System info queries

### Component Simplifications

- `TopStatusBar.svelte`: 1,001 → ~400 lines (extract weather, RF logic, parameterize dropdowns)
- `DashboardMap.svelte`: 1,053 → ~500 lines (extract geo math, split popup rendering)
- `OverviewPanel.svelte`: 741 → ~350 lines (extract data fetching to service)

---

## Sub-Phase 5.9: Slim Kismet Server Types

**Savings**: ~700 lines (2,133 → ~1,400)
**Risk**: LOW (removing unused type fields)
**Commit**: `refactor(phase5.9): trim Kismet types and remove unused service manager`

### Problem

- `src/lib/server/kismet/types.ts` (616 lines) — defines DeviceClassification, SecurityAssessment, DeviceFingerprint that are never populated by Kismet API responses
- `src/lib/server/kismet/service-manager.ts` (230 lines) — lifecycle management duplicated by existing service scripts

### Actions

- `types.ts`: 616 → ~250 lines — keep WiFiDevice essentials, ManufacturerInfo; remove unpopulated classification/fingerprint types
- Delete `service-manager.ts` (230 lines) — use existing systemctl/script controls
- Audit `fusion-controller.ts` (36 lines) — likely dead

---

## Sub-Phase 5.10: Simplify Tactical Map Services

**Savings**: ~450 lines (597 → ~150)
**Risk**: LOW (thin wrappers, easy to inline)
**Commit**: `refactor(phase5.10): inline tactical map service wrappers`

### Problem

`src/lib/services/tactical-map/` has thin wrappers around stores that add no value:

- `gps-service.ts` (92 lines) — wraps gpsStore with setInterval
- `kismet-service.ts` (222 lines) — wraps KismetProxy with polling
- `hackrf-service.ts` (110 lines) — wraps spectrum data

### Actions

- `gps-service.ts`: inline into dashboard page onMount (10 lines)
- `kismet-service.ts`: simplify to ~80 lines, move polling logic to store
- Delete `hackrf-service.ts` — unused after Phase 5.3
- Delete directory barrel files

---

## Sub-Phase 5.11: Slim API Routes

**Savings**: ~1,500 lines (4,820 → ~3,300)
**Risk**: MODERATE (API contract changes need testing)
**Commit**: `refactor(phase5.11): simplify oversized API routes`

### Problem

Several routes contain business logic that should be in services:

- `api/agent/tools/+server.ts` (488 lines) — inline Kismet queries
- `api/gps/position/+server.ts` (397 lines) — GPS transformation logic
- `api/hardware/details/+server.ts` (352 lines) — sysfs queries

### Actions

- `agent/tools/+server.ts`: 488 → ~100 lines — use kismet-client service
- `gps/position/+server.ts`: 397 → ~150 lines — extract transformation to service
- `hardware/details/+server.ts`: 352 → ~100 lines — use hardware-info-service
- Other routes: audit for dead endpoints, inline small services

---

## Sub-Phase 5.12: Final Cleanup and WebSocket Simplification

**Savings**: ~1,000 lines
**Risk**: LOW
**Commit**: `refactor(phase5.12): final cleanup pass`

### Actions

- Consolidate `src/lib/services/websocket/hackrf.ts` (408) + `kismet.ts` (410) — extract shared logic to base.ts, reduce each to ~200 lines
- Remove `src/lib/services/db/signal-database.ts` (536 lines) if it duplicates `src/lib/server/db/database.ts`
- Audit `src/lib/services/map/map-utils.ts` (279 lines) — extract shared geo functions already in geo-utils.ts
- Clean up `src/lib/styles/palantir-design-system.css` (585 lines) — audit for unused classes
- Remove any remaining barrel `index.ts` files with zero imports
- Final typecheck and lint pass

---

## Summary

| Sub-Phase | Description                                    | Lines Saved | Risk     |
| --------- | ---------------------------------------------- | ----------: | -------- |
| 5.1       | Delete dead code (localization, USRP, scripts) |      ~3,000 | ZERO     |
| 5.2       | Simplify hardware detection                    |      ~1,700 | LOW      |
| 5.3       | Collapse HackRF frontend services              |      ~4,000 | MODERATE |
| 5.4       | Simplify database layer                        |      ~2,000 | LOW      |
| 5.5       | Collapse agent layer                           |        ~900 | LOW      |
| 5.6       | Simplify MCP server (keep in src/)             |        ~500 | LOW      |
| 5.7       | Consolidate duplicate stores                   |      ~1,100 | MODERATE |
| 5.8       | Extract services from components               |      ~2,500 | MODERATE |
| 5.9       | Slim Kismet server types                       |        ~700 | LOW      |
| 5.10      | Simplify tactical map services                 |        ~450 | LOW      |
| 5.11      | Slim API routes                                |      ~1,500 | MODERATE |
| 5.12      | Final cleanup                                  |      ~1,000 | LOW      |
| **Total** |                                                | **~19,300** |          |

### Projected Result

- **Before**: 42,000 lines in src/
- **After**: ~17,000-20,000 lines in src/
- **Target**: A properly-sized SvelteKit dashboard proxying to existing backends

### Execution Order

Phases are ordered by dependency and risk:

1. **5.1** (dead code) and **5.6** (MCP move) can run first — zero risk
2. **5.2** (hardware), **5.4** (database), **5.5** (agent), **5.9** (Kismet types) — low risk, independent
3. **5.3** (HackRF services) — moderate risk, biggest single win
4. **5.7** (stores) then **5.8** (components) then **5.10** (tactical map) — depend on each other
5. **5.11** (routes) and **5.12** (cleanup) — final pass

### Key Principle

**Every line of TypeScript that re-implements logic already in a backend (Kismet, HackRF Python, gpsd) is a line to delete.** The frontend's job is: connect, receive JSON, display it.
