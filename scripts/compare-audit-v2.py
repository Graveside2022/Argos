#!/usr/bin/env python3
"""
Compare scanner results to plan's claimed inventory, with correct path matching.
"""

# Plan's complete list: 63 named functions + 4 "removed by Phase 5.1" entries = up to 67
# Plus 12 that the plan notes are in God Pages / tactial-map-simple
plan_functions = [
    # CRITICAL (>150) -- 10 entries
    ('stores/gsmEvilStore.ts', 'createGSMEvilStore', 318),
    ('server/wireshark.ts', 'setupPacketStream', 272),
    ('server/kismet/device_intelligence.ts', 'initializeOUIDatabase', 219),
    ('services/gsm-evil/server.ts', 'setupRoutes', 193),
    ('stores/rtl433Store.ts', 'createRTL433Store', 191),
    ('api/gsm-evil/health/+server.ts', 'performHealthCheck', 182),
    ('components/map/AirSignalOverlay.svelte', 'toggleRFDetection', 167),
    ('services/map/signalClustering.ts', 'clusterSignals', 161),
    ('api/system/info/+server.ts', 'getSystemInfo', 156),
    ('stores/kismet.ts', 'createKismetStore', 154),
    # HIGH (100-149) -- 9 named + 1 "removed"
    ('components/hackrf/SignalAgeVisualization.svelte', 'drawVisualization', 148),
    ('services/usrp/sweep-manager/buffer/BufferManager.ts', 'parseSpectrumData', 128),
    ('components/tactical-map/system/SystemInfoPopup.svelte', 'createSystemInfoContent', 121),
    ('server/mcp/dynamic-server.ts', 'setupHandlers', 119),
    ('server/db/cleanupService.ts', 'prepareStatements', 116),
    ('api/hardware/details/+server.ts', 'getWifiDetails', 111),
    ('server/toolChecker.ts', 'checkInstalledTools', 107),
    ('services/recovery/errorRecovery.ts', 'registerDefaultStrategies', 106),
    ('components/drone/FlightPathVisualization.svelte', 'updateVisualization', 105),
    # STANDARD (60-99) -- 41 named + 3 "removed"
    ('components/map/KismetDashboardOverlay.svelte', 'getDeviceType', 98),
    ('server/websocket-server.ts', 'initializeWebSocketServer', 97),
    ('components/hackrf/SpectrumChart.svelte', 'updateWaterfallOptimized', 97),
    ('services/hackrf/sweep-manager/buffer/BufferManager.ts', 'parseSpectrumData', 94),
    ('services/websocket/test-connection.ts', 'testWebSocketConnections', 94),
    ('services/drone/flightPathAnalyzer.ts', 'calculateEfficiency', 91),
    ('server/gsm-database-path.ts', 'resolveGsmDatabasePath', 90),
    ('kismet/+page.svelte', 'startKismet', 89),
    ('server/hackrf/sweepManager.ts', '_performHealthCheck', 88),
    ('server/hardware/detection/serial-detector.ts', 'detectGPSModules', 88),
    ('components/hackrf/SpectrumChart.svelte', 'drawSpectrum', 87),
    ('server/db/signalRepository.ts', 'insertSignalsBatch', 86),
    ('server/hardware/detection/hardware-detector.ts', 'scanAllHardware', 86),
    ('components/dashboard/AgentChatPanel.svelte', 'sendMessageWithContent', 86),
    ('server/db/migrations/runMigrations.ts', 'runMigrations', 84),
    ('components/dashboard/DashboardMap.svelte', 'handleMapLoad', 83),
    ('components/tactical-map/kismet/DeviceManager.svelte', 'createDevicePopupContent', 81),
    ('server/kismet/kismet_controller.ts', 'stopExternalKismetProcesses', 80),
    ('server/agent/runtime.ts', 'createAgent', 79),
    ('services/recovery/errorRecovery.ts', 'attemptRecovery', 75),
    ('server/wireshark.ts', 'tryRealCapture', 74),
    ('components/map/AirSignalOverlay.svelte', 'processSpectrumData', 74),
    ('components/drone/FlightPathVisualization.svelte', 'addFlightMarkers', 73),
    ('droneid/+page.svelte', 'connectWebSocket', 71),
    ('server/kismet/device_intelligence.ts', 'performClassification', 70),
    ('server/hardware/resourceManager.ts', 'scanForOrphans', 70),
    ('services/drone/flightPathAnalyzer.ts', 'detectAnomalies', 69),
    ('api/gps/position/+server.ts', 'buildGpsResponse', 68),
    ('stores/packetAnalysisStore.ts', 'analyzePacket', 68),
    ('services/drone/flightPathAnalyzer.ts', 'identifySignalHotspots', 68),
    ('server/kismet/kismet_controller.ts', 'enrichDeviceData', 68),
    ('test/+page.svelte', 'testWebSockets', 67),
    ('services/map/networkAnalyzer.ts', 'exploreCluster', 67),
    ('components/drone/MissionControl.svelte', 'addWaypoint', 67),
    ('api/gps/position/+server.ts', 'queryGpsd', 65),
    ('server/agent/tool-execution/detection/tool-mapper.ts', 'generateNamespace', 65),
    ('server/hardware/detection/serial-detector.ts', 'detectCellularModems', 65),
    ('server/kismet/device_tracker.ts', 'updateStatistics', 64),
    ('services/monitoring/systemHealth.ts', 'analyzeHealth', 63),
    ('server/agent/tool-execution/detection/tool-mapper.ts', 'mapToExecutionTool', 63),
    ('server/wifite/processManager.ts', 'buildArgs', 62),
    ('services/hackrf/sweep-manager/error/ErrorTracker.ts', 'analyzeError', 61),
    ('services/localization/coral/CoralAccelerator.v2.ts', 'startProcess', 61),
    ('server/hackrf/sweepManager.ts', '_performRecovery', 61),
]

# Phase 5.1 removals acknowledged in the plan (not given full entries)
plan_phase51 = [
    ('tactical-map-simple/+page.svelte', 'updateGPSPosition', 100),
    ('hackrfsweep/+page.svelte', 'startLocalTimer', 82),
    ('gsm-evil/+page.svelte', 'groupIMSIsByTower', 72),
    # "67 tactical-map-simple rssi-integration -- peripheral" (unnamed)
]

# Scanner results -- using the raw output from our scanner script
# I'll read them fresh
import subprocess, os, json

def normalize_path(p):
    """Remove common prefixes to get a path fragment for matching."""
    # Remove leading src/ or routes/ or lib/ prefixes to get just the meaningful part
    p = p.replace('\\', '/')
    # Remove src/ prefix if present
    if p.startswith('src/'):
        p = p[4:]
    # Remove lib/ or routes/ prefix
    for prefix in ['lib/', 'routes/']:
        if p.startswith(prefix):
            return p[len(prefix):]
    return p

def path_match(scanner_path, plan_path):
    """Check if paths match after normalization."""
    s = normalize_path(scanner_path)
    p = normalize_path(plan_path)
    return s == p or s.endswith(p) or p.endswith(s)

# Run the scanner to get fresh results
os.chdir('/home/kali/Documents/Argos/Argos')

# Parse the scanner output directly
scanner_output = subprocess.run(
    ['python3', 'scripts/audit-function-sizes.py', 'src/'],
    capture_output=True, text=True
).stdout

# Parse scanner lines
scanner_results = []
in_data = False
for line in scanner_output.split('\n'):
    line = line.strip()
    if line.startswith('------'):
        in_data = True
        continue
    if in_data and '|' in line:
        parts = [p.strip() for p in line.split('|')]
        if len(parts) == 4:
            try:
                lines_count = int(parts[0])
                file_path = parts[1]
                start_line = int(parts[2])
                func_name = parts[3]
                scanner_results.append((file_path, start_line, func_name, lines_count))
            except ValueError:
                continue
    if line.startswith('=') and in_data:
        break

print(f"Scanner found: {len(scanner_results)} functions >60 lines")
print(f"Plan claims:   {len(plan_functions)} named functions + {len(plan_phase51)} Phase 5.1 entries = {len(plan_functions) + len(plan_phase51)}")

# Build plan lookup with normalized paths
plan_lookup = {}
for plan_path, func_name, claimed_lines in plan_functions + plan_phase51:
    key = func_name  # Use function name as primary key
    if key not in plan_lookup:
        plan_lookup[key] = []
    plan_lookup[key].append((plan_path, claimed_lines))

# Match scanner results to plan
matched_scanner = set()  # indices into scanner_results
matched_plan = set()     # (path, func_name) from plan

print(f"\n{'='*120}")
print("MATCHING SCANNER TO PLAN")
print(f"{'='*120}")

for i, (s_path, s_line, s_func, s_lines) in enumerate(scanner_results):
    if s_func in plan_lookup:
        for plan_path, plan_lines in plan_lookup[s_func]:
            if path_match(s_path, plan_path):
                matched_scanner.add(i)
                matched_plan.add((plan_path, s_func))
                break

# MISSED by plan (in scanner, not matched to plan)
missed = [(i, scanner_results[i]) for i in range(len(scanner_results)) if i not in matched_scanner]
missed.sort(key=lambda x: x[1][3], reverse=True)

print(f"\n{'='*120}")
print(f"FUNCTIONS MISSED BY PLAN ({len(missed)} total)")
print(f"Scanner found these but the plan does NOT list them.")
print(f"{'='*120}")
for idx, (path, line, func, lines) in missed:
    print(f"  {lines:>4} lines | {path}:{line} | {func}")

# Categorize the missed functions
missed_api_routes = [m for m in missed if m[1][2] in ('POST', 'GET', 'PUT', 'DELETE', 'PATCH')]
missed_api_inner = [m for m in missed if m[1][2] == 'start' and 'api/' in m[1][0]]
missed_god_pages = [m for m in missed if 'tactical-map-simple' in m[1][0] or 'gsm-evil/+page' in m[1][0] or 'rfsweep/+page' in m[1][0] or 'hackrfsweep/+page' in m[1][0]]
missed_other = [m for m in missed if m not in missed_api_routes and m not in missed_api_inner and m not in missed_god_pages]

print(f"\n  Breakdown:")
print(f"    API route handlers (POST/GET/etc):  {len(missed_api_routes)}")
print(f"    SSE stream start() inners:          {len(missed_api_inner)}")
print(f"    God Page functions (Phase 5.1):      {len(missed_god_pages)}")
print(f"    Other missed functions:              {len(missed_other)}")

# PHANTOM: in plan but not matched by scanner
phantom = [(p, f, l) for p, f, l in (plan_functions + plan_phase51) if (p, f) not in matched_plan]
phantom.sort(key=lambda x: x[2], reverse=True)

print(f"\n{'='*120}")
print(f"PHANTOM FUNCTIONS ({len(phantom)} total)")
print(f"Plan lists these but scanner did NOT find them >60 lines.")
print(f"{'='*120}")
for path, func, lines in phantom:
    print(f"  {lines:>4} lines | {path} | {func}")

# SIZE MISMATCH: matched but different line counts
print(f"\n{'='*120}")
print("SIZE MISMATCHES (matched but different line count)")
print(f"{'='*120}")
mismatch_count = 0
for i in matched_scanner:
    s_path, s_line, s_func, s_lines = scanner_results[i]
    if s_func in plan_lookup:
        for plan_path, plan_lines in plan_lookup[s_func]:
            if path_match(s_path, plan_path):
                if s_lines != plan_lines:
                    diff = s_lines - plan_lines
                    print(f"  {s_func:40} plan={plan_lines:4} actual={s_lines:4} diff={diff:>+4} | {s_path}")
                    mismatch_count += 1
                break

print(f"\nTotal mismatches: {mismatch_count}")

# FINAL SUMMARY
print(f"\n{'='*120}")
print("FINAL SUMMARY")
print(f"{'='*120}")

all_scanner = len(scanner_results)
s_crit = sum(1 for _, _, _, l in scanner_results if l > 150)
s_high = sum(1 for _, _, _, l in scanner_results if 100 <= l <= 150)  # note: 150 is in high, not critical
s_std = sum(1 for _, _, _, l in scanner_results if 61 <= l < 100)
s_61 = sum(1 for _, _, _, l in scanner_results if l == 61)

print(f"  Scanner total functions >60 lines:  {all_scanner}")
print(f"    >150 CRITICAL:                    {s_crit}")
print(f"    100-150 HIGH:                     {s_high}")
print(f"    61-99 STANDARD:                   {s_std}")
print(f"    Exactly 61 lines:                 {s_61}")
print()
print(f"  Plan claimed:                       75 total")
print(f"    Plan CRITICAL (>150):             10")
print(f"    Plan HIGH (100-149):              ~10")
print(f"    Plan STANDARD (60-99):            ~41")
print(f"    Plan Phase 5.1 removals:          4")
print()
print(f"  Matched (plan <-> scanner):         {len(matched_scanner)}")
print(f"  Missed by plan (scanner only):      {len(missed)}")
print(f"  Phantom (plan only, not in scanner):{len(phantom)}")
