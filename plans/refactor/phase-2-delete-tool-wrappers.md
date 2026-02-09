# Phase 2: Delete Tool Wrappers

**Timeline**: 2 days
**Effort**: 16 hours
**Risk**: LOW (external tools run independently)
**Savings**: ~17,000 lines (verified, up from original ~15,000)
**Commits**: 5 sub-commits with dashboard gates

---

## Goal

Remove massive API/service wrappers around external tools that already have their own APIs. Dashboard spectrum and WiFi features must continue working.

**Rationale**: Tools like Kismet, Bettercap, GSM Evil 2 run as independent services with their own REST APIs and web UIs. We're maintaining thousands of lines to re-wrap what already exists.

---

## VERIFICATION GATE (run after EVERY sub-commit)

```bash
npm run build && npm run typecheck
npm run dev &
sleep 8
# Dashboard loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dashboard | grep -q 200
# Health endpoint
curl -s http://localhost:5173/api/health | grep -q "ok"
# HackRF API still exists (dashboard uses this)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/hackrf/status | grep -qE "200|401"
# GPS API still exists
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/gps/position | grep -qE "200|401"
kill %1
echo "PASS: All gates passed"
```

---

## 2.1 Delete API Endpoint Wrappers

**Commit**: `refactor(phase2.1): delete tool wrapper API endpoints`
**Verified lines**: 5,632

### GSM Evil 2 External Tool (2,332 lines)

```bash
rm -rf src/routes/api/gsm-evil/                     # 2,332 lines (verified, 11 files)
```

### Niche/Hardware Tool Wrappers (1,662 lines)

```bash
rm -rf src/routes/api/rtl-433/                      # 475 lines (verified)
rm -rf src/routes/api/droneid/                      # 292 lines (verified)
rm -rf src/routes/api/openwebrx/                    # 269 lines (verified)
rm -rf src/routes/api/bettercap/                    # 209 lines (verified)
rm -rf src/routes/api/wifite/                       # 127 lines (verified)
rm -rf src/routes/api/wireshark/                    # 115 lines (verified)
rm -rf src/routes/api/btle/                         # 53 lines (verified)
rm -rf src/routes/api/pagermon/                     # 61 lines (verified)
rm -rf src/routes/api/gnuradio/                     # 28 lines (verified)
rm -rf src/routes/api/companion/                    # 33 lines (verified)
```

### Bloat Endpoints (1,638 lines)

```bash
rm -rf src/routes/api/cell-towers/                  # 198 lines (verified)
rm -rf src/routes/api/tactical-map/                 # 149 lines (verified)
rm -rf src/routes/api/tools/                        # 249 lines (verified)
rm -rf src/routes/api/mcp/                          # 71 lines (verified)
rm -rf src/routes/api/weather/                      # 55 lines (verified)
rm -rf src/routes/api/relationships/                # 48 lines (verified)
rm -rf src/routes/api/devices/                      # 44 lines (verified)
rm -rf src/routes/api/rf/                           # 660 lines (verified)
```

**Remaining API dirs after this step**: agent, db, gps, hackrf, hardware, health, kismet, map-tiles, signals, system, terminal, ws

**GATE**: Run verification. Commit if passes.

---

## 2.2 Delete Server-Side Tool Wrappers

**Commit**: `refactor(phase2.2): delete server-side tool wrapper code`
**Verified lines**: 3,279

```bash
rm -rf src/lib/server/wifite/                       # 572 lines (verified)
rm src/lib/server/wireshark.ts                      # 556 lines (verified)
rm -rf src/lib/server/usrp/                         # 469 lines (verified)
rm -rf src/lib/server/bettercap/                    # 169 lines (verified)
rm -rf src/lib/server/pagermon/                     # 163 lines (verified)
rm -rf src/lib/server/companion/                    # 178 lines (verified)
rm -rf src/lib/server/gnuradio/                     # 149 lines (verified)
rm -rf src/lib/server/btle/                         # 143 lines (verified)
rm src/lib/server/gsm-database-path.ts              # 102 lines (verified)
rm src/lib/server/tool-checker.ts                   # 137 lines (verified)
rm src/lib/server/network-interfaces.ts             # 63 lines (verified)
rm src/lib/server/validate-env.js                   # 39 lines (verified)
```

**GATE**: Run verification. Commit if passes.

---

## 2.3 Delete Service-Layer Tool Wrappers

**Commit**: `refactor(phase2.3): delete service-layer tool wrappers`
**Verified lines**: 3,126 (CORRECTED from original 1,423)

```bash
rm -rf src/lib/services/gsm-evil/                   # 639 lines (verified)
rm -rf src/lib/services/localization/               # 1,105 lines (verified, was claimed 348)
rm -rf src/lib/services/usrp/                       # 1,077 lines (verified, was claimed 131)
rm -rf src/lib/services/wigletotak/                 # 305 lines (verified)
```

**CORRECTION**: `localization/` is 1,105 lines (12 files including coral/ subdirectory), not 348. `usrp/` is 1,077 lines (5 files including sweep-manager/ subdirectory), not 131. Original audit missed subdirectories.

**GATE**: Run verification. Commit if passes.

---

## 2.4 Delete Stores for Deleted Tools

**Commit**: `refactor(phase2.4): delete stores for removed tools`
**Verified lines**: 1,589

```bash
rm src/lib/stores/gsm-evil-store.ts                 # 389 lines (verified)
rm src/lib/stores/drone.ts                          # 370 lines (verified)
rm src/lib/stores/rtl433-store.ts                   # 253 lines (verified)
rm src/lib/stores/wifite-store.ts                   # 171 lines (verified)
rm src/lib/stores/hardware-store.ts                 # 143 lines (verified)
rm src/lib/stores/bettercap-store.ts                # 132 lines (verified)
rm src/lib/stores/pagermon-store.ts                 # 105 lines (verified)
rm src/lib/stores/usrp.ts                           # 26 lines (verified)
```

Also check for orphaned stores:

```bash
rm src/lib/stores/btle-store.ts                     # 98 lines (found in audit, not in original plan)
rm src/lib/stores/companion-store.ts                # 89 lines (found in audit, not in original plan)
```

**GATE**: Run verification. Commit if passes.

---

## 2.5 Delete HackRF Emitter Jamming Protocols

**Commit**: `refactor(phase2.5): delete HackRF jamming protocols`
**Verified lines**: 3,099

**CRITICAL PATH NOTE**: All files are under `hackrf_emitter/backend/`, NOT `hackrf_emitter/` directly.

```bash
rm hackrf_emitter/backend/rf_workflows/adsb_protocol.py                 # 580 lines (verified)
rm hackrf_emitter/backend/rf_workflows/drone_video_jamming_protocol.py  # 579 lines (verified)
rm hackrf_emitter/backend/rf_workflows/elrs_jamming_protocol.py         # 559 lines (verified)
rm hackrf_emitter/backend/rf_workflows/gps_protocol.py                  # 460 lines (verified)
rm hackrf_emitter/backend/rf_workflows/elrs_protocol.py                 # 330 lines (verified)
rm hackrf_emitter/backend/rf_workflows/wideband_signal_cache.py         # 371 lines (verified)
rm hackrf_emitter/backend/initialize_cache.py                           # 119 lines (verified)
rm hackrf_emitter/backend/simple_test.py                                # 101 lines (verified)
```

**GATE**: Run verification. Commit if passes.

---

## Phase 2 Verified Totals

| Section              | Claimed Lines | Verified Lines | Delta      | Correction                           |
| -------------------- | ------------- | -------------- | ---------- | ------------------------------------ |
| 2.1 API Endpoints    | 5,632         | 5,632          | 0          | -                                    |
| 2.2 Server Wrappers  | 3,279         | 3,279          | 0          | -                                    |
| 2.3 Service Wrappers | 1,423         | 3,126          | +1,703     | localization/ and usrp/ undercounted |
| 2.4 Stores           | 1,589         | 1,776          | +187       | Added btle + companion stores        |
| 2.5 HackRF Emitter   | 2,178         | 3,099          | +921       | Paths corrected to backend/          |
| **TOTAL**            | **~14,101**   | **~16,912**    | **+2,811** | -                                    |

---

## Remaining API Endpoints After Phase 2

```
src/routes/api/
  agent/        # 718 lines - Ollama agent
  db/           # 216 lines - database cleanup
  gps/          # 397 lines - GPS position
  hackrf/       # 773 lines - spectrum analysis
  hardware/     # 590 lines - hardware detection
  health/       # health check
  kismet/       # 1,601 lines - WiFi scanning
  map-tiles/    # tile proxy
  signals/      # 249 lines - signal storage
  system/       # 380 lines - system metrics
  terminal/     # 101 lines - shell management
  ws/           # WebSocket upgrade
```

---

## Success Criteria

- [ ] 5 commits made, each with passing verification gate
- [ ] All tool wrapper endpoints deleted
- [ ] Server-side tool wrappers removed
- [ ] Service-layer wrappers removed (including full localization/ and usrp/ trees)
- [ ] Stores for deleted tools removed
- [ ] HackRF jamming protocols deleted (correct paths under backend/)
- [ ] `npm run build && npm run typecheck` passes
- [ ] Dashboard loads at /dashboard (HTTP 200)
- [ ] Spectrum analysis works (api/hackrf endpoints remain)
- [ ] GPS works (api/gps remains)

---

## Rollback

Each sub-step has its own commit:

```bash
git revert HEAD  # Revert the failing commit
```

**Risk Assessment**: LOW RISK - External tools run independently. Dashboard's embedded features use the remaining api/hackrf, api/gps, api/map-tiles endpoints.
