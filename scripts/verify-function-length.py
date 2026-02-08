#!/usr/bin/env python3
"""
Verify exact function lengths by counting from opening brace to closing brace.
"""
import sys
import re


def count_function_lines(filepath, start_line, func_name):
    """Count lines from start_line to the matching closing brace."""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except FileNotFoundError:
        return None, f"FILE NOT FOUND: {filepath}"

    if start_line > len(lines):
        return None, f"Line {start_line} beyond file end ({len(lines)} lines)"

    # Find the opening brace
    brace_depth = 0
    found_opening = False
    end_line = None

    # Strip block comments as we go
    in_block_comment = False

    for i in range(start_line - 1, len(lines)):
        line = lines[i]
        # Process character by character for brace counting
        j = 0
        in_string_single = False
        in_string_double = False
        in_template = False

        while j < len(line):
            ch = line[j]

            # Handle block comment state
            if in_block_comment:
                if j + 1 < len(line) and ch == '*' and line[j+1] == '/':
                    in_block_comment = False
                    j += 2
                    continue
                j += 1
                continue

            # Check for comment starts
            if not in_string_single and not in_string_double and not in_template:
                if j + 1 < len(line) and ch == '/' and line[j+1] == '/':
                    break  # Rest is line comment
                if j + 1 < len(line) and ch == '/' and line[j+1] == '*':
                    in_block_comment = True
                    j += 2
                    continue

            # Handle escapes
            if ch == '\\' and (in_string_single or in_string_double or in_template):
                j += 2
                continue

            # String state
            if ch == "'" and not in_string_double and not in_template:
                in_string_single = not in_string_single
            elif ch == '"' and not in_string_single and not in_template:
                in_string_double = not in_string_double
            elif ch == '`' and not in_string_single and not in_string_double:
                in_template = not in_template

            # Brace counting
            if not in_string_single and not in_string_double and not in_template:
                if ch == '{':
                    if not found_opening:
                        found_opening = True
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                    if found_opening and brace_depth == 0:
                        end_line = i + 1  # 1-indexed
                        return end_line - start_line + 1, None

            j += 1

    return None, f"Could not find closing brace (depth={brace_depth}, found_opening={found_opening})"


def main():
    # Verify plan's claimed functions
    functions_to_verify = [
        # CRITICAL (>150 lines) - from plan
        ('src/lib/stores/gsmEvilStore.ts', 70, 'createGSMEvilStore', 318),
        ('src/lib/server/wireshark.ts', 221, 'setupPacketStream', 272),
        ('src/lib/server/kismet/device_intelligence.ts', 499, 'initializeOUIDatabase', 219),
        ('src/lib/services/gsm-evil/server.ts', 37, 'setupRoutes', 193),
        ('src/lib/stores/rtl433Store.ts', 61, 'createRTL433Store', 191),
        ('src/routes/api/gsm-evil/health/+server.ts', 6, 'performHealthCheck', 182),
        ('src/lib/components/map/AirSignalOverlay.svelte', 39, 'toggleRFDetection', 167),
        ('src/lib/services/map/signalClustering.ts', 139, 'clusterSignals', 161),
        ('src/routes/api/system/info/+server.ts', 42, 'getSystemInfo', 156),
        ('src/lib/stores/kismet.ts', 20, 'createKismetStore', 154),
        # HIGH (100-149 lines) - from plan
        ('src/lib/components/hackrf/SignalAgeVisualization.svelte', 69, 'drawVisualization', 148),
        ('src/lib/services/usrp/sweep-manager/buffer/BufferManager.ts', 194, 'parseSpectrumData', 128),
        ('src/lib/components/tactical-map/system/SystemInfoPopup.svelte', 86, 'createSystemInfoContent', 121),
        ('src/lib/server/mcp/dynamic-server.ts', 508, 'setupHandlers', 119),
        ('src/lib/server/db/cleanupService.ts', 93, 'prepareStatements', 116),
        ('src/routes/api/hardware/details/+server.ts', 83, 'getWifiDetails', 111),
        ('src/lib/server/toolChecker.ts', 11, 'checkInstalledTools', 107),
        ('src/lib/services/recovery/errorRecovery.ts', 291, 'registerDefaultStrategies', 106),
        ('src/lib/components/drone/FlightPathVisualization.svelte', 60, 'updateVisualization', 105),
        # STANDARD (60-99 lines) - from plan
        ('src/lib/components/map/KismetDashboardOverlay.svelte', 238, 'getDeviceType', 98),
        ('src/lib/server/websocket-server.ts', 27, 'initializeWebSocketServer', 97),
        ('src/lib/components/hackrf/SpectrumChart.svelte', 166, 'updateWaterfallOptimized', 97),
        ('src/lib/services/hackrf/sweep-manager/buffer/BufferManager.ts', 197, 'parseSpectrumData', 94),
        ('src/lib/services/websocket/test-connection.ts', 11, 'testWebSocketConnections', 94),
        ('src/lib/services/drone/flightPathAnalyzer.ts', 217, 'calculateEfficiency', 91),
        ('src/lib/server/gsm-database-path.ts', 13, 'resolveGsmDatabasePath', 90),
        ('src/routes/kismet/+page.svelte', 152, 'startKismet', 89),
        ('src/lib/server/hackrf/sweepManager.ts', 124, '_performHealthCheck', 88),
        ('src/lib/server/hardware/detection/serial-detector.ts', 16, 'detectGPSModules', 88),
        ('src/lib/components/hackrf/SpectrumChart.svelte', 75, 'drawSpectrum', 87),
        ('src/lib/server/db/signalRepository.ts', 65, 'insertSignalsBatch', 86),
        ('src/lib/server/hardware/detection/hardware-detector.ts', 20, 'scanAllHardware', 86),
        ('src/lib/components/dashboard/AgentChatPanel.svelte', 107, 'sendMessageWithContent', 86),
        ('src/lib/server/db/migrations/runMigrations.ts', 5, 'runMigrations', 84),
        ('src/lib/components/dashboard/DashboardMap.svelte', 358, 'handleMapLoad', 83),
        ('src/lib/components/tactical-map/kismet/DeviceManager.svelte', 140, 'createDevicePopupContent', 81),
        ('src/lib/server/kismet/kismet_controller.ts', 420, 'stopExternalKismetProcesses', 80),
        ('src/lib/server/agent/runtime.ts', 257, 'createAgent', 79),
        ('src/lib/services/recovery/errorRecovery.ts', 212, 'attemptRecovery', 75),
        ('src/lib/server/wireshark.ts', 54, 'tryRealCapture', 74),
        ('src/lib/components/map/AirSignalOverlay.svelte', 207, 'processSpectrumData', 74),
        ('src/lib/components/drone/FlightPathVisualization.svelte', 258, 'addFlightMarkers', 73),
        ('src/routes/droneid/+page.svelte', 59, 'connectWebSocket', 71),
        ('src/lib/server/kismet/device_intelligence.ts', 355, 'performClassification', 70),
        ('src/lib/server/hardware/resourceManager.ts', 32, 'scanForOrphans', 70),
        ('src/lib/services/drone/flightPathAnalyzer.ts', 312, 'detectAnomalies', 69),
        ('src/routes/api/gps/position/+server.ts', 180, 'buildGpsResponse', 68),
        ('src/lib/stores/packetAnalysisStore.ts', 173, 'analyzePacket', 68),
        ('src/lib/services/drone/flightPathAnalyzer.ts', 145, 'identifySignalHotspots', 68),
        ('src/lib/server/kismet/kismet_controller.ts', 646, 'enrichDeviceData', 68),
        ('src/routes/test/+page.svelte', 68, 'testWebSockets', 67),
        ('src/lib/services/map/networkAnalyzer.ts', 254, 'exploreCluster', 67),
        ('src/lib/components/drone/MissionControl.svelte', 120, 'addWaypoint', 67),
        ('src/routes/api/gps/position/+server.ts', 111, 'queryGpsd', 65),
        ('src/lib/server/agent/tool-execution/detection/tool-mapper.ts', 101, 'generateNamespace', 65),
        ('src/lib/server/hardware/detection/serial-detector.ts', 108, 'detectCellularModems', 65),
        ('src/lib/server/kismet/device_tracker.ts', 402, 'updateStatistics', 64),
        ('src/lib/services/monitoring/systemHealth.ts', 307, 'analyzeHealth', 63),
        ('src/lib/server/agent/tool-execution/detection/tool-mapper.ts', 30, 'mapToExecutionTool', 63),
        ('src/lib/server/wifite/processManager.ts', 271, 'buildArgs', 62),
        ('src/lib/services/hackrf/sweep-manager/error/ErrorTracker.ts', 130, 'analyzeError', 61),
        ('src/lib/services/localization/coral/CoralAccelerator.v2.ts', 32, 'startProcess', 61),
        ('src/lib/server/hackrf/sweepManager.ts', 1123, '_performRecovery', 61),
    ]

    print(f"{'Claimed':>7} {'Actual':>7} {'Match':>6} | {'Function':40} | File:Line")
    print(f"{'-'*7}-+-{'-'*7}-+-{'-'*6}-+-{'-'*40}-+-{'-'*60}")

    mismatches = []
    missing = []
    for filepath, start_line, func_name, claimed_lines in functions_to_verify:
        actual_lines, error = count_function_lines(filepath, start_line, func_name)
        if error:
            status = 'ERROR'
            actual_str = error[:50]
            missing.append((filepath, start_line, func_name, claimed_lines, error))
        elif actual_lines == claimed_lines:
            status = 'OK'
            actual_str = str(actual_lines)
        else:
            diff = actual_lines - claimed_lines
            status = f'+{diff}' if diff > 0 else str(diff)
            actual_str = str(actual_lines)
            mismatches.append((filepath, start_line, func_name, claimed_lines, actual_lines))

        print(f"{claimed_lines:>7} {actual_str:>7} {status:>6} | {func_name:40} | {filepath}:{start_line}")

    print(f"\n{'='*120}")
    print(f"SUMMARY: {len(functions_to_verify)} functions verified")
    print(f"  Exact matches: {len(functions_to_verify) - len(mismatches) - len(missing)}")
    print(f"  Mismatches:    {len(mismatches)}")
    print(f"  Missing/Error: {len(missing)}")

    if mismatches:
        print(f"\nMISMATCHES:")
        for fp, line, name, claimed, actual in mismatches:
            print(f"  {name:40} claimed={claimed:4} actual={actual:4} diff={actual-claimed:+4} @ {fp}:{line}")

    if missing:
        print(f"\nMISSING/ERRORS:")
        for fp, line, name, claimed, err in missing:
            print(f"  {name:40} claimed={claimed:4} ERROR: {err} @ {fp}:{line}")


if __name__ == '__main__':
    main()
