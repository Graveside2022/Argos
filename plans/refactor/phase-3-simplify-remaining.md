# Phase 3: Simplify Remaining Code

**Timeline**: 5 days
**Effort**: 40 hours
**Risk**: MODERATE (code refactoring, testing required)
**Savings**: ~28,000 lines (corrected from original ~25,000)
**Commits**: 10 sub-commits with dashboard gates

---

## Goal

Aggressively simplify core code to minimal viable implementations. This is the most intensive phase requiring careful refactoring and testing.

---

## VERIFICATION GATE (run after EVERY sub-commit)

```bash
npm run build && npm run typecheck
npm run dev &
sleep 8
# Dashboard loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dashboard | grep -q 200
# Health
curl -s http://localhost:5173/api/health | grep -q "ok"
# HackRF endpoint responsive
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/hackrf/status | grep -qE "200|401"
# Kismet endpoint responsive
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/kismet/status | grep -qE "200|401"
kill %1
echo "PASS: All gates passed"
```

---

## 3.1 Simplify server/kismet/ (6,760 -> 400 lines)

**Commit**: `refactor(phase3.1): simplify Kismet server wrapper to minimal proxy`
**Verified total**: 6,760 lines across 14 files

Kismet has its own REST API + WebSocket. We need: simple API client (100 lines), types (200 lines), WebSocket manager (100 lines).

### Delete over-engineered wrappers (all verified):

```bash
rm src/lib/server/kismet/device-intelligence.ts     # 1,320 lines
rm src/lib/server/kismet/security-analyzer.ts       # 891 lines
rm src/lib/server/kismet/device-tracker.ts          # 503 lines
rm src/lib/server/kismet/fusion-controller.ts       # 143 lines
rm src/lib/server/kismet/script-manager.ts          # 220 lines
rm src/lib/server/kismet/wifi-adapter-detector.ts   # 241 lines
rm src/lib/server/kismet/alfa-detector.ts           # 159 lines
```

### Additional files to simplify (found in audit, not in original plan):

```
api-client.ts        # 472 lines -> simplify to 100
kismet-controller.ts # 808 lines -> simplify to 100
types.ts             # 616 lines -> simplify to 200
web-socket-manager.ts # 592 lines -> simplify to 100
kismet-proxy.ts      # 486 lines -> delete (merge into api-client)
service-manager.ts   # 230 lines -> delete
index.ts             # 79 lines -> simplify to 20
```

**Savings**: ~6,360 lines

**GATE**: Run verification. Commit if passes.

---

## 3.2 Simplify services/map/ (5,756 -> 800 lines)

**Commit**: `refactor(phase3.2): simplify map services to essentials`
**Verified total**: 5,756 lines across 16 files

### Delete over-engineered features (all verified):

```bash
rm src/lib/services/map/drone-detection.ts          # 861 lines
rm src/lib/services/map/signal-interpolation.ts     # 544 lines
rm src/lib/services/map/webgl-heatmap-renderer.ts   # 411 lines
rm src/lib/services/map/network-analyzer.ts         # 407 lines
rm src/lib/services/map/altitude-layer-manager.ts   # 367 lines
rm src/lib/services/map/contour-generator.ts        # 344 lines
rm src/lib/services/map/performance-monitor.ts      # 287 lines
rm src/lib/services/map/grid-processor.ts           # 267 lines
rm src/lib/services/map/signal-aggregator.ts        # 109 lines
rm src/lib/services/map/kismet-rssi-service.ts      # 251 lines
```

### Keep & simplify (found in audit):

```
index.ts              # 136 lines -> simplify to 30
signal-clustering.ts  # 411 lines -> simplify to 200
signal-filtering.ts   # 576 lines -> simplify to 250
heatmap-service.ts    # 506 lines -> simplify to 200
map-utils.ts          # 279 lines -> simplify to 120
```

**Savings**: ~4,956 lines

**GATE**: Run verification. Commit if passes.

---

## 3.3 Delete agent/tool-execution/ (3,322 lines)

**Commit**: `refactor(phase3.3): delete over-engineered agent tool execution`
**Verified total**: 3,322 lines across 19 files (CORRECTED from claimed 2,783)

```bash
rm -rf src/lib/server/agent/tool-execution/         # 3,322 lines (verified)
# 5 adapters, 4 detectors, router, registry, executor, README - all overkill for 1B model
```

The original plan claimed 2,783 lines. Actual is 3,322 (includes README.md 344 lines, init.ts 84 lines, and other files not originally counted).

### Keep simplified agent (separate files outside tool-execution/):

```
runtime (200 lines)
tools (100 lines)
frontend-tools (200 lines)
```

**Savings**: 3,322 lines

**GATE**: Run verification. Commit if passes.

---

## 3.4 Simplify services/hackrf/ (5,047 -> 300 lines)

**Commit**: `refactor(phase3.4): simplify HackRF services to minimal client`
**Verified total**: 5,047 lines across 15 files (CORRECTED from claimed 2,776)

**CRITICAL CORRECTION**: Original plan claimed 2,776 lines. Actual is 5,047 (82% undercount). The plan missed 4 entire files plus undercounted sweep-manager/.

### Files to delete/simplify:

```bash
rm src/lib/services/hackrf/usrp-api.ts              # 496 lines (duplicate!)
rm src/lib/services/hackrf/time-window-filter.ts    # 485 lines
rm src/lib/services/hackrf/signal-processor.ts      # 474 lines
rm src/lib/services/hackrf/sweep-analyzer.ts        # 283 lines (NOT IN ORIGINAL PLAN)
rm -rf src/lib/services/hackrf/sweep-manager/       # 1,994 lines (verified, was claimed 1,464)
```

### Additional files missed in original plan:

```
hackrf-service.ts    # 481 lines -> simplify to 150
api.ts               # 499 lines -> simplify to 150
index.ts             # 58 lines -> simplify to 20
```

**Savings**: ~4,747 lines

**GATE**: Run verification. Commit if passes.

---

## 3.5 Simplify services/websocket/ (2,274 -> 300 lines)

**Commit**: `refactor(phase3.5): simplify WebSocket services`
**Verified total**: 2,274 lines (after Phase 1 deletes example files)

Note: example-usage.ts (281) and test-connection.ts (108) already deleted in Phase 1.

### Simplify remaining files:

```
base.ts              # 376 -> 100 lines
kismet.ts            # 410 -> 100 lines
hackrf.ts            # 408 -> 100 lines
data-stream-manager.ts # 545 -> delete (merge into base.ts)
index.ts             # 146 -> 30 lines
```

**Savings**: ~1,585 lines (after Phase 1 deletions)

**GATE**: Run verification. Commit if passes.

---

## 3.6 Simplify server/hackrf/ (1,584 -> 200 lines)

**Commit**: `refactor(phase3.6): simplify HackRF server sweep manager`
**Verified total**: 1,584 lines across 3 files

```
sweep-manager.ts     # 1,490 lines -> simplify to 200 (basic process management)
types.ts             # 80 lines -> keep
index.ts             # 14 lines -> keep
```

**Savings**: ~1,290 lines

**GATE**: Run verification. Commit if passes.

---

## 3.7 Simplify api/kismet/ (1,601 -> 200 lines)

**Commit**: `refactor(phase3.7): consolidate Kismet API to minimal proxy`
**Verified total**: 1,601 lines across 20 endpoints

Consolidate 20 endpoints to 3 files:

```
proxy/+server.ts     # 100 lines (proxies Kismet REST API)
status/+server.ts    # 50 lines (service status)
types.ts             # 50 lines (shared types)
```

**Savings**: ~1,401 lines

**GATE**: Run verification. Commit if passes.

---

## 3.8 Simplify Components

**Commit**: `refactor(phase3.8): simplify dashboard and map components`

### Dashboard Components (6,770 -> 2,000 lines)

```
DashboardMap.svelte           # 1,053 -> 500 lines
TopStatusBar.svelte           # 1,001 -> 400 lines
OverviewPanel.svelte          # 741 -> 300 lines
TerminalPanel.svelte          # 691 -> 300 lines
AgentChatPanel.svelte         # 623 -> 300 lines
TerminalTabContent.svelte     # 347 -> 200 lines
Others (18 files)             # 2,314 -> 0 (merge essential parts)
```

### HackRF Components (3,079 -> 500 lines)

```bash
rm src/lib/components/hackrf/TimeFilterDemo.svelte  # 287 lines (verified, dead demo)
```

Simplify remaining:

```
SpectrumChart.svelte          # 408 -> 200
SweepControl.svelte           # 209 -> 150
StatusDisplay.svelte          # 182 -> 100
ConnectionStatus.svelte       # 144 -> 50
```

### Map Components (3,059 -> 500 lines)

```
KismetDashboardOverlay.svelte # 1,280 -> 300
AirSignalOverlay.svelte       # 1,019 -> 200
```

### Delete Kismet Components (separate from dashboard overlay)

```bash
rm -rf src/lib/components/kismet/                   # if exists after Phase 1
```

**Total Component Savings**: ~10,000 lines

**GATE**: Run verification. Commit if passes.

---

## 3.9 Simplify Python Backend (7,913 -> 800 lines)

**Commit**: `refactor(phase3.9): simplify HackRF Python backend`

**CRITICAL**: All paths are under `hackrf_emitter/backend/`, NOT `hackrf_emitter/` root.

After Phase 2 deletes jamming protocols (~3,099 lines), remaining is ~4,814 lines.

### Simplify remaining files:

```
backend/app.py                                    # 406 -> 150 lines
backend/rf_workflows/hackrf_controller.py         # 795 -> 250 lines
backend/rf_workflows/enhanced_workflows.py        # 1,385 -> 200 lines (merge modulation)
backend/rf_workflows/modulation_workflows.py      # 672 -> merged above
backend/rf_workflows/universal_signal_cache.py    # 625 -> 150 lines
backend/rf_workflows/raw_energy_protocol.py       # 340 -> 100 lines
backend/utils/config_manager.py                   # 254 -> 80 lines
backend/sweep_bridge.py                           # 172 -> 100 lines
backend/rf_workflows/crc16_python.py              # 70 -> 30 lines
backend/utils/safety_manager.py                   # 95 -> keep as-is
```

**Savings**: ~4,000 lines

**GATE**: Test with `cd hackrf_emitter/backend && python app.py` and `curl http://localhost:8092/status`

---

## 3.10 Consolidate Scripts (30,700 -> 3,448 lines)

**Commit**: `refactor(phase3.10): consolidate scripts to ~10 essential`
**Verified total**: 30,700 lines across 157 files

After Phase 1 deletes (maintenance/, infrastructure/, audit scripts = ~2,630 lines), remaining is ~28,070 lines.

### Delete duplicate directories:

```bash
rm -rf scripts/install/                             # Mirrors scripts/deploy/
rm -rf scripts/dev/                                 # Dev convenience scripts
rm -rf scripts/testing/                             # After Phase 1 partial delete
rm -rf scripts/monitoring/                          # 6 files
rm -rf scripts/gps-integration/                     # 6 files
rm -rf scripts/security/                            # 2 files
```

### Keep ~10 essential scripts:

```
deploy-master.sh              # 363 lines
setup-host-complete.sh        # 529 lines
cpu-guardian.sh               # 474 lines
argos-keepalive.sh            # 443 lines
build-production.sh           # 231 lines
docker-automation.sh          # 307 lines
pre-commit-hook.sh            # 199 lines
install-system-dependencies.sh # 486 lines
deploy-containers.sh          # 257 lines
mcp-start.sh                  # 14 lines
```

**Savings**: ~24,000 lines

**GATE**: Run verification. Commit if passes.

---

## Phase 3 Corrected Totals

| Section              | Original Claim   | Verified Actual    | Savings |
| -------------------- | ---------------- | ------------------ | ------- |
| 3.1 server/kismet/   | 6,760 -> 400     | 6,760 -> 400       | 6,360   |
| 3.2 services/map/    | 5,756 -> 800     | 5,756 -> 800       | 4,956   |
| 3.3 agent/tool-exec  | 2,783            | 3,322              | 3,322   |
| 3.4 services/hackrf/ | 2,776 -> 300     | **5,047** -> 300   | 4,747   |
| 3.5 services/ws/     | 2,274 -> 300     | 1,885\* -> 300     | 1,585   |
| 3.6 server/hackrf/   | 1,584 -> 200     | 1,584 -> 200       | 1,290   |
| 3.7 api/kismet/      | 1,601 -> 200     | 1,601 -> 200       | 1,401   |
| 3.8 Components       | ~12,500 -> 2,000 | ~12,908 -> 2,000   | ~10,000 |
| 3.9 Python Backend   | ~5,735 -> 800    | ~4,814\* -> 800    | ~4,000  |
| 3.10 Scripts         | ~28,070 -> 3,448 | ~28,070\* -> 3,448 | ~24,000 |

\* After Phase 1 and Phase 2 deletions

**Total Phase 3 Savings**: ~61,661 lines -> but this overlaps with future simplification work. Net new deletions: ~28,000 lines.

---

## Success Criteria

- [ ] 10 commits made, each with passing verification gate
- [ ] server/kismet/ simplified to ~400 lines
- [ ] services/map/ simplified to ~800 lines
- [ ] agent/tool-execution/ deleted entirely
- [ ] services/hackrf/ simplified to ~300 lines (from verified 5,047)
- [ ] services/websocket/ simplified to ~300 lines
- [ ] server/hackrf/ simplified to ~200 lines
- [ ] api/kismet/ consolidated to ~200 lines
- [ ] Components simplified to ~2,000 lines
- [ ] Python backend simplified to ~800 lines
- [ ] Scripts consolidated to ~3,500 lines
- [ ] `npm run build && npm run typecheck` passes after each commit
- [ ] Dashboard fully functional after each commit

---

## Rollback

Each sub-step has its own commit:

```bash
git revert HEAD  # Revert only the failing commit
```

**Risk Assessment**: MODERATE RISK - Actual code refactoring. Work incrementally: simplify one area, verify, commit, then move to next. The verification gate catches breaks immediately.
