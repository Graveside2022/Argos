# Removed Exports — T016 Dead Export Cleanup

**Date**: 2026-02-23
**Method**: `npx ts-prune` + grep verification against `.svelte` and `.ts` consumers
**Verification**: `npx tsc --noEmit` (0 errors), `npm run build` (success)

## Summary

| Metric                           | Count  |
| -------------------------------- | ------ |
| Files deleted entirely           | 9      |
| Files modified (exports removed) | 34     |
| Total lines removed              | ~1,321 |
| Dead symbols eliminated          | ~120   |

## Files Deleted (entire file was dead)

| File                                 | Dead Symbols                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/gps/api.ts`                 | Re-export shim (getGpsPosition, getSatelliteData)                                                                            |
| `src/lib/gps/positioning.ts`         | Re-export shim (getGpsPosition, GpsPositionResponse)                                                                         |
| `src/lib/gps/stores.ts`              | gpsPosition, gpsError writable stores                                                                                        |
| `src/lib/kismet/api-types.ts`        | 8 interfaces (KismetStatus, KismetDevice, KismetScript, KismetStats, KismetConfig, DeviceFilter, ChannelStat, InterfaceInfo) |
| `src/lib/kismet/websocket.ts`        | KismetWebSocketClient class, getKismetWebSocketClient, destroyKismetWebSocketClient, KismetMessage                           |
| `src/lib/server/api/api-response.ts` | ApiSuccessResponse, ApiErrorResponse, ApiResponse (unused by createHandler)                                                  |
| `src/lib/types/api.ts`               | successResponse, errorResponse, validateApiResponse, safeValidateApiResponse                                                 |
| `src/lib/types/signal.ts`            | SignalReadingSchema, SignalReading, validateSignalReading, safeValidateSignalReading                                         |
| `src/lib/types/wifi.ts`              | WifiNetworkSchema, WifiNetwork, validateWifiNetwork, safeValidateWifiNetwork                                                 |

## Dead Symbols Removed from Existing Files

### Schema type aliases (Zod `.infer` types shadowing dedicated types/)

| File                          | Removed                                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/schemas/api.ts`      | GPSCoordinates, SignalMetadataInputSchema, SignalBatchRequest                                                                                                                |
| `src/lib/schemas/database.ts` | DbSignal, DbDevice, DbNetwork, DbRelationship                                                                                                                                |
| `src/lib/schemas/hardware.ts` | WiFiCapabilities, BluetoothCapabilities, GPSCapabilities, CellularCapabilities, HardwareCapabilities, HardwareCategory, ConnectionType, HardwareStatus                       |
| `src/lib/schemas/kismet.ts`   | ServiceHealthResponse, GPSStateResponse, HackRFStatusResponse, GPSAPIResponse, KismetDot11Data, KismetLocation, KismetSignalData, validateKismetStatus, validateKismetDevice |
| `src/lib/schemas/rf.ts`       | FrequencyRange, StartSweepRequest, StopSweepRequest, EmergencyStopRequest, KismetDevicesResponse, KismetControlResponse, GPSApiResponse                                      |
| `src/lib/schemas/stores.ts`   | GPSPosition, GPSStatus, SimplifiedSignal                                                                                                                                     |

### Type definitions

| File                                 | Removed                                                                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types/enums.ts`             | WebSocketState, CircuitBreakerState                                                                                                           |
| `src/lib/types/gsm.ts`               | ScanResult                                                                                                                                    |
| `src/lib/types/service-responses.ts` | ServiceHealthResponse, GPSStateResponse, HackRFStatusResponse                                                                                 |
| `src/lib/types/shared.ts`            | SignalSource, Device, DeviceRecord, WebSocketState, AppError                                                                                  |
| `src/lib/types/signals.ts`           | SignalFilter, SignalData, KismetDevice, HackRFData, WSMessage, SignalMessage, KismetMessage, HackRFMessage, SignalProcessor, SignalAggregator |
| `src/lib/types/tak.ts`               | TakContact, CotMessage                                                                                                                        |
| `src/lib/types/terminal.ts`          | TerminalMessage                                                                                                                               |

### Utility functions

| File                                          | Removed                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/gps/types.ts`                        | validateGPSPosition, safeValidateGPSPosition                    |
| `src/lib/kismet/types.ts`                     | validateKismetDevice, safeValidateKismetDevice                  |
| `src/lib/kismet/stores.ts`                    | activeDevices, recentAlerts, devicesByType, channelDistribution |
| `src/lib/map/visibility-engine.ts`            | togglePromoted, getVisibilityFilter                             |
| `src/lib/hackrf/sweep-manager/sweep-utils.ts` | getSignalStrength, isCriticalStartupError, SIGNAL_THRESHOLDS    |
| `src/lib/utils/css-loader.ts`                 | preloadCSS                                                      |
| `src/lib/utils/mgrs-converter.ts`             | getMGRSPrecision, MGRS_PRECISION                                |
| `src/lib/utils/signal-utils.ts`               | getSignalColor, formatLastSeen                                  |
| `src/lib/utils/validation-error.ts`           | getAllUserFriendlyMessages, isZodError                          |
| `src/lib/validators/gsm.ts`                   | validateFrequency                                               |

### Server-side

| File                                                               | Removed                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `src/lib/server/agent/frontend-tools.ts`                           | validateFrontendToolCall, checkRequired, checkEnum                   |
| `src/lib/server/db/database.ts`                                    | Type re-export block (DbSignal, DbDevice, DbNetwork, DbRelationship) |
| `src/lib/server/hackrf/types.ts`                                   | SpectrumDataPoint, ApiResponse                                       |
| `src/lib/server/hardware/detection/hardware-detector.ts`           | isHardwareAvailable, isCategoryAvailable, getCompatibleHardware      |
| `src/lib/server/hardware/detection-types.ts`                       | HardwareRequirement                                                  |
| `src/lib/server/hardware/resource-manager.ts`                      | getResourceManager                                                   |
| `src/lib/server/hardware/types.ts`                                 | ResourceRequest, ToolRegistration                                    |
| `src/lib/server/mcp/shared/api-client.ts`                          | checkArgosConnection                                                 |
| `src/lib/server/security/cors.ts`                                  | isOriginAllowed                                                      |
| `src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts` | ScanEvent, ScanEventType re-exports                                  |
| `src/lib/server/services/hardware/hardware-details-helpers.ts`     | GpsdParsedLine                                                       |

## Exports Preserved (verified live)

| Symbol                                                         | File                                 | Reason                              |
| -------------------------------------------------------------- | ------------------------------------ | ----------------------------------- |
| `cn`, `WithoutChildrenOrChild`, `WithElementRef`               | `src/lib/utils.ts`                   | shadcn-svelte .svelte consumers     |
| `uiIcons`                                                      | `src/lib/data/tool-icons.ts`         | .svelte consumer                    |
| `palettes`                                                     | `src/lib/themes/palettes.ts`         | .svelte consumer                    |
| `markCSSLoaded`                                                | `src/lib/utils/css-loader.ts`        | .svelte layout consumer             |
| `isCategory`                                                   | `src/lib/types/tools.ts`             | ToolsNavigationView.svelte consumer |
| `migrate`                                                      | `src/lib/server/db/migrations/*.ts`  | Dynamically called by db-migrate    |
| `initializeWebSocketServer`, `broadcast`, `getConnectionCount` | `src/lib/server/websocket-server.ts` | hooks.server.ts consumer            |
| All `.svelte.ts` exports                                       | component logic modules              | Consumed by companion .svelte files |
| All store exports                                              | `src/lib/stores/**`                  | Consumed by .svelte components      |
| All component helper exports                                   | `src/lib/components/**/*.ts`         | Consumed by companion .svelte files |
| All page logic exports                                         | `src/routes/gsm-evil/*.ts`           | Consumed by +page.svelte            |
