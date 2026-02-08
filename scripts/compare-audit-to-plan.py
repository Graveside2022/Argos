#!/usr/bin/env python3
"""
Compare scanner results to plan's claimed inventory.
Identify MISSED functions (found but not in plan) and PHANTOM functions (in plan but not found).
"""

# Plan's complete list of functions (all 63 entries from Phase 5.3)
plan_functions = {
    # CRITICAL (>150)
    ('lib/stores/gsmEvilStore.ts', 'createGSMEvilStore', 318),
    ('lib/server/wireshark.ts', 'setupPacketStream', 272),
    ('lib/server/kismet/device_intelligence.ts', 'initializeOUIDatabase', 219),
    ('lib/services/gsm-evil/server.ts', 'setupRoutes', 193),
    ('lib/stores/rtl433Store.ts', 'createRTL433Store', 191),
    ('routes/api/gsm-evil/health/+server.ts', 'performHealthCheck', 182),
    ('lib/components/map/AirSignalOverlay.svelte', 'toggleRFDetection', 167),
    ('lib/services/map/signalClustering.ts', 'clusterSignals', 161),
    ('routes/api/system/info/+server.ts', 'getSystemInfo', 156),
    ('lib/stores/kismet.ts', 'createKismetStore', 154),
    # HIGH (100-149)
    ('lib/components/hackrf/SignalAgeVisualization.svelte', 'drawVisualization', 148),
    ('lib/services/usrp/sweep-manager/buffer/BufferManager.ts', 'parseSpectrumData', 128),
    ('lib/components/tactical-map/system/SystemInfoPopup.svelte', 'createSystemInfoContent', 121),
    ('lib/server/mcp/dynamic-server.ts', 'setupHandlers', 119),
    ('lib/server/db/cleanupService.ts', 'prepareStatements', 116),
    ('routes/api/hardware/details/+server.ts', 'getWifiDetails', 111),
    ('lib/server/toolChecker.ts', 'checkInstalledTools', 107),
    ('lib/services/recovery/errorRecovery.ts', 'registerDefaultStrategies', 106),
    ('lib/components/drone/FlightPathVisualization.svelte', 'updateVisualization', 105),
    # Note: plan says "100 *(tactical-map-simple -- removed by Phase 5.1)*" - we'll check
    # STANDARD (60-99)
    ('lib/components/map/KismetDashboardOverlay.svelte', 'getDeviceType', 98),
    ('lib/server/websocket-server.ts', 'initializeWebSocketServer', 97),
    ('lib/components/hackrf/SpectrumChart.svelte', 'updateWaterfallOptimized', 97),
    ('lib/services/hackrf/sweep-manager/buffer/BufferManager.ts', 'parseSpectrumData', 94),
    ('lib/services/websocket/test-connection.ts', 'testWebSocketConnections', 94),
    ('lib/services/drone/flightPathAnalyzer.ts', 'calculateEfficiency', 91),
    ('lib/server/gsm-database-path.ts', 'resolveGsmDatabasePath', 90),
    ('routes/kismet/+page.svelte', 'startKismet', 89),
    ('lib/server/hackrf/sweepManager.ts', '_performHealthCheck', 88),
    ('lib/server/hardware/detection/serial-detector.ts', 'detectGPSModules', 88),
    ('lib/components/hackrf/SpectrumChart.svelte', 'drawSpectrum', 87),
    ('lib/server/db/signalRepository.ts', 'insertSignalsBatch', 86),
    ('lib/server/hardware/detection/hardware-detector.ts', 'scanAllHardware', 86),
    ('lib/components/dashboard/AgentChatPanel.svelte', 'sendMessageWithContent', 86),
    ('lib/server/db/migrations/runMigrations.ts', 'runMigrations', 84),
    ('lib/components/dashboard/DashboardMap.svelte', 'handleMapLoad', 83),
    # Note: plan says "82 *(hackrfsweep -- removed by Phase 5.1)*"
    ('lib/components/tactical-map/kismet/DeviceManager.svelte', 'createDevicePopupContent', 81),
    ('lib/server/kismet/kismet_controller.ts', 'stopExternalKismetProcesses', 80),
    ('lib/server/agent/runtime.ts', 'createAgent', 79),
    ('lib/services/recovery/errorRecovery.ts', 'attemptRecovery', 75),
    ('lib/server/wireshark.ts', 'tryRealCapture', 74),
    ('lib/components/map/AirSignalOverlay.svelte', 'processSpectrumData', 74),
    ('lib/components/drone/FlightPathVisualization.svelte', 'addFlightMarkers', 73),
    # Note: plan says "72 *(gsm-evil -- removed by Phase 5.1)*"
    ('routes/droneid/+page.svelte', 'connectWebSocket', 71),
    ('lib/server/kismet/device_intelligence.ts', 'performClassification', 70),
    ('lib/server/hardware/resourceManager.ts', 'scanForOrphans', 70),
    ('lib/services/drone/flightPathAnalyzer.ts', 'detectAnomalies', 69),
    ('routes/api/gps/position/+server.ts', 'buildGpsResponse', 68),
    ('lib/stores/packetAnalysisStore.ts', 'analyzePacket', 68),
    ('lib/services/drone/flightPathAnalyzer.ts', 'identifySignalHotspots', 68),
    ('lib/server/kismet/kismet_controller.ts', 'enrichDeviceData', 68),
    # Note: plan says "67 *(tactical-map-simple rssi-integration -- peripheral)*"
    ('routes/test/+page.svelte', 'testWebSockets', 67),
    ('lib/services/map/networkAnalyzer.ts', 'exploreCluster', 67),
    ('lib/components/drone/MissionControl.svelte', 'addWaypoint', 67),
    ('routes/api/gps/position/+server.ts', 'queryGpsd', 65),
    ('lib/server/agent/tool-execution/detection/tool-mapper.ts', 'generateNamespace', 65),
    ('lib/server/hardware/detection/serial-detector.ts', 'detectCellularModems', 65),
    ('lib/server/kismet/device_tracker.ts', 'updateStatistics', 64),
    ('lib/services/monitoring/systemHealth.ts', 'analyzeHealth', 63),
    ('lib/server/agent/tool-execution/detection/tool-mapper.ts', 'mapToExecutionTool', 63),
    ('lib/server/wifite/processManager.ts', 'buildArgs', 62),
    ('lib/services/hackrf/sweep-manager/error/ErrorTracker.ts', 'analyzeError', 61),
    ('lib/services/localization/coral/CoralAccelerator.v2.ts', 'startProcess', 61),
    ('lib/server/hackrf/sweepManager.ts', '_performRecovery', 61),
}

# Plan also mentions these as "removed by Phase 5.1":
# 100 lines: tactical-map-simple function
# 82 lines: hackrfsweep function (startLocalTimer)
# 72 lines: gsm-evil function (groupIMSIsByTower)
# 67 lines: tactical-map-simple rssi-integration function
plan_phase51_removals = {
    ('routes/tactical-map-simple/+page.svelte', 'updateGPSPosition', 100),
    ('routes/hackrfsweep/+page.svelte', 'startLocalTimer', 82),
    ('routes/gsm-evil/+page.svelte', 'groupIMSIsByTower', 72),
    # tactical-map-simple rssi-integration -- unclear function name
}

# Scanner results (from the output above)
scanner_results = [
    ('routes/api/gsm-evil/intelligent-scan-stream/+server.ts', 14, 'POST', 533),
    ('routes/api/gsm-evil/intelligent-scan-stream/+server.ts', 18, 'start', 519),
    ('routes/api/gsm-evil/scan/+server.ts', 5, 'POST', 294),
    ('routes/api/kismet/control/+server.ts', 5, 'POST', 261),
    ('routes/tactical-map-simple/+page.svelte', 1467, 'fetchKismetDevices', 260),
    ('lib/services/hackrf/api.ts', 84, 'connectToDataStream', 243),
    ('routes/tactical-map-simple/+page.svelte', 1729, 'processSignals', 234),
    ('lib/services/hackrf/usrp-api.ts', 95, 'connectToDataStream', 232),
    ('routes/api/gsm-evil/control/+server.ts', 7, 'POST', 230),
    ('routes/tactical-map-simple/+page.svelte', 1092, 'getDeviceIconSVG', 227),
    ('routes/api/droneid/+server.ts', 63, 'POST', 211),
    ('routes/api/rtl-433/control/+server.ts', 12, 'POST', 208),
    ('routes/api/hackrf/data-stream/+server.ts', 43, 'GET', 197),
    ('routes/gsm-evil/+page.svelte', 1073, 'scanFrequencies', 189),
    ('routes/api/openwebrx/control/+server.ts', 42, 'POST', 171),
    ('routes/tactical-map-simple/+page.svelte', 925, 'showPiPopup', 165),
    ('routes/api/bettercap/control/+server.ts', 8, 'POST', 165),
    ('routes/api/kismet/start/+server.ts', 45, 'POST', 163),
    ('routes/api/cell-towers/nearby/+server.ts', 32, 'GET', 149),
    ('routes/api/gsm-evil/intelligent-scan/+server.ts', 6, 'POST', 145),
    ('routes/api/hackrf/data-stream/+server.ts', 60, 'start', 136),
    ('routes/api/rtl-433/stream/+server.ts', 8, 'GET', 133),
    ('routes/api/gsm-evil/frames/+server.ts', 5, 'GET', 128),
    ('routes/tactical-map-simple/+page.svelte', 666, 'addCellTower', 127),
    ('routes/api/rtl-433/stream/+server.ts', 12, 'start', 117),
    ('routes/api/gsm-evil/tower-location/+server.ts', 21, 'POST', 116),
    ('routes/api/db/cleanup/+server.ts', 35, 'GET', 115),
    ('routes/api/gps/position/+server.ts', 249, 'GET', 113),
    ('routes/api/gsm-evil/status/+server.ts', 6, 'GET', 113),
    ('routes/api/kismet/status/+server.ts', 6, 'GET', 112),
    ('routes/api/rf/start-sweep/+server.ts', 6, 'POST', 106),
    ('routes/tactical-map-simple/+page.svelte', 1337, 'updateGPSPosition', 100),
    ('routes/api/tactical-map/cell-towers/+server.ts', 9, 'GET', 99),
    ('routes/api/signals/batch/+server.ts', 18, 'POST', 99),
    ('routes/api/agent/tools/+server.ts', 133, 'handleAnalyzeNetworkSecurity', 98),
    ('routes/api/hackrf/start-sweep/+server.ts', 5, 'POST', 98),
    ('routes/api/kismet/stop/+server.ts', 8, 'POST', 97),
    ('routes/api/agent/tools/+server.ts', 406, 'POST', 90),
    ('routes/api/agent/tools/+server.ts', 232, 'handleGetActiveDevices', 74),
    ('routes/api/kismet/+server.ts', 5, 'GET', 74),
    ('lib/services/usrp/api.ts', 9, 'connectToDataStream', 73),
    ('routes/api/agent/tools/+server.ts', 13, 'handleGetDeviceDetails', 72),
    ('routes/api/rtl-433/protocols/+server.ts', 8, 'GET', 71),
    ('routes/api/rf/status/+server.ts', 77, 'GET', 71),
    ('routes/rfsweep/+page.svelte', 173, 'startLocalTimer', 87),
    ('routes/hackrfsweep/+page.svelte', 130, 'startLocalTimer', 82),
    ('routes/api/hackrf/test-sweep/+server.ts', 5, 'GET', 82),
    ('routes/api/kismet/interfaces/+server.ts', 8, 'GET', 81),
    ('routes/api/gsm-evil/activity/+server.ts', 5, 'GET', 83),
    ('routes/api/rf/data-stream/+server.ts', 5, 'GET', 83),
    ('routes/gsm-evil/+page.svelte', 892, 'groupIMSIsByTower', 72),
    ('routes/api/rf/status/+server.ts', 10, 'detectConnectedDevices', 66),
    ('routes/api/agent/stream/+server.ts', 68, 'start', 65),
    ('routes/api/debug/usrp-test/+server.ts', 6, 'GET', 65),
    ('routes/api/db/cleanup/+server.ts', 151, 'POST', 65),
    ('lib/services/map/signalClustering.ts', 348, 'getClusterIcon', 64),
    ('routes/rfsweep/+page.svelte', 287, 'measureUSRPPower', 63),
    ('routes/api/agent/tools/+server.ts', 343, 'handleQuerySignalHistory', 61),
    ('lib/server/db/cleanupService.ts', 269, 'runCleanup', 61),
]

# Build lookup from plan (file, func_name) pairs
plan_lookup = set()
for path, func, lines in plan_functions:
    plan_lookup.add((path, func))
for path, func, lines in plan_phase51_removals:
    plan_lookup.add((path, func))

# Also add the plan items that were in our scanner output
# Build lookup from scanner
scanner_lookup = set()
for path, line, func, lines in scanner_results:
    scanner_lookup.add((path, func))

# MISSED: in scanner but not in plan
print("=" * 120)
print("FUNCTIONS MISSED BY PLAN (found by scanner, not in plan)")
print("=" * 120)
missed = []
for path, line, func, lines in scanner_results:
    if (path, func) not in plan_lookup:
        missed.append((path, line, func, lines))
        print(f"  {lines:>4} lines | {path}:{line} | {func}")

print(f"\nTotal MISSED: {len(missed)}")

# PHANTOM: in plan but not in scanner (excluding phase 5.1 removals that ARE in scanner)
print(f"\n{'='*120}")
print("PHANTOM FUNCTIONS (in plan, NOT found by scanner)")
print("=" * 120)
phantoms = []
for path, func, lines in plan_functions:
    if (path, func) not in scanner_lookup:
        phantoms.append((path, func, lines))
        print(f"  {lines:>4} lines | {path} | {func}")

print(f"\nTotal PHANTOMS: {len(phantoms)}")

# FOUND BUT SMALLER: in plan but in scanner with different size
print(f"\n{'='*120}")
print("SIZE DISCREPANCIES (different line count)")
print("=" * 120)
plan_by_key = {}
for path, func, lines in plan_functions:
    plan_by_key[(path, func)] = lines
for path, func, lines in plan_phase51_removals:
    plan_by_key[(path, func)] = lines

for path, line, func, actual_lines in scanner_results:
    key = (path, func)
    if key in plan_by_key:
        claimed = plan_by_key[key]
        if claimed != actual_lines:
            diff = actual_lines - claimed
            print(f"  {func:40} plan={claimed:4} actual={actual_lines:4} diff={diff:+4} | {path}")

print(f"\n{'='*120}")
print("BUCKET COMPARISON")
print("=" * 120)
# Scanner buckets (including ALL functions)
s_critical = sum(1 for _, _, _, l in scanner_results if l > 150)
s_high = sum(1 for _, _, _, l in scanner_results if 100 <= l <= 150)
s_standard = sum(1 for _, _, _, l in scanner_results if 60 < l < 100)
s_total = len(scanner_results)

print(f"  {'Bucket':<20} {'Plan':>6} {'Scanner':>8} {'Diff':>6}")
print(f"  {'-'*20} {'-'*6} {'-'*8} {'-'*6}")
print(f"  {'>150 CRITICAL':<20} {'10':>6} {s_critical:>8} {s_critical-10:>+6}")
print(f"  {'100-149 HIGH':<20} {'~10':>6} {s_high:>8} {'':>6}")
print(f"  {'60-99 STANDARD':<20} {'~41':>6} {s_standard:>8} {'':>6}")
print(f"  {'TOTAL':<20} {'75':>6} {s_total:>8} {s_total-75:>+6}")


if __name__ == '__main__':
    pass
