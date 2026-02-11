# Complete TypeScript Error Inventory

**Generated**: 2026-02-11
**Total Errors**: 72 errors across 28 files
**Source**: `npm run typecheck` output

---

## Production Code Errors (43 errors)

### src/lib/stores/dashboard/agent-context-store.ts (18 errors)

1. **Line 73** - Element implicitly has 'any' type

    ```
    device['dot11.device']?.['dot11.device.last_beaconed_ssid']
    Property 'dot11.device' does not exist on type 'KismetDevice'
    ```

2. **Line 80** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.type']
    Property 'kismet.device.base.type' does not exist on type 'KismetDevice'
    ```

3. **Line 87** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.manuf']
    Property 'kismet.device.base.manuf' does not exist on type 'KismetDevice'
    ```

4. **Line 94** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.signal']?.['kismet.common.signal.last_signal']
    Property 'kismet.device.base.signal' does not exist on type 'KismetDevice'
    ```

5. **Line 100** - Property does not exist

    ```
    device.signal?.last_signal_dbm
    Property 'last_signal_dbm' does not exist on type '{ last_signal?: number; ... }'
    Did you mean 'last_signal'?
    ```

6. **Line 97** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.signal']?.['kismet.common.signal.last_signal_dbm']
    Property 'kismet.device.base.signal' does not exist on type 'KismetDevice'
    ```

7. **Line 114** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.channel']
    Property 'kismet.device.base.channel' does not exist on type 'KismetDevice'
    ```

8. **Line 115** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.frequency']
    Property 'kismet.device.base.frequency' does not exist on type 'KismetDevice'
    ```

9. **Line 122** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.packets.total']
    Property 'kismet.device.base.packets.total' does not exist on type 'KismetDevice'
    ```

10. **Line 135** - Element implicitly has 'any' type

    ```
    device['dot11.device']?.['dot11.device.advertised_ssid_map']
    Property 'dot11.device' does not exist on type 'KismetDevice'
    ```

11. **Line 142** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.last_time']
    Property 'kismet.device.base.last_time' does not exist on type 'KismetDevice'
    ```

12. **Line 149** - Property does not exist

    ```
    device.first_seen
    Property 'first_seen' does not exist on type 'KismetDevice'
    Did you mean 'firstSeen'?
    ```

13. **Line 155** - Element implicitly has 'any' type

    ```
    device['kismet.device.base.first_time']
    Property 'kismet.device.base.first_time' does not exist on type 'KismetDevice'
    ```

14. **Line 161** - Property does not exist

    ```
    $gps.accuracy
    Property 'accuracy' does not exist on type 'GPSState'
    ```

15. **Line 167** - Property does not exist

    ```
    $gps.heading
    Property 'heading' does not exist on type 'GPSState'
    ```

16. **Line 173** - Property does not exist

    ```
    $gps.speed
    Property 'speed' does not exist on type 'GPSState'
    ```

17. **Line 179** - Type comparison unintentional

    ```
    $kismet.status === 'connected'
    Types '"running" | "stopped" | "starting" | "stopping"' and '"connected"' have no overlap
    ```

18. **Line 185** - Property does not exist
    ```
    $kismet.message
    Property 'message' does not exist on type 'KismetState'
    ```

---

### src/routes/api/kismet/status/+server.ts (10 errors)

1. **Line 972** - Property does not exist

    ```
    status.running
    Property 'running' does not exist on type 'Promise<Record<string, unknown>>'
    ```

2. **Line 978** - Property does not exist

    ```
    status.running
    Property 'running' does not exist on type 'Promise<Record<string, unknown>>'
    ```

3. **Line 984** - Property does not exist

    ```
    status.running
    Property 'running' does not exist on type 'Promise<Record<string, unknown>>'
    ```

4. **Line 990** - Property does not exist

    ```
    status.interface
    Property 'interface' does not exist on type 'Promise<Record<string, unknown>>'
    ```

5. **Line 996** - Property does not exist

    ```
    status.channels
    Property 'channels' does not exist on type 'Promise<Record<string, unknown>>'
    ```

6. **Line 1002** - Property does not exist

    ```
    status.deviceCount
    Property 'deviceCount' does not exist on type 'Promise<Record<string, unknown>>'
    ```

7. **Line 1008** - Property does not exist

    ```
    status.uptime
    Property 'uptime' does not exist on type 'Promise<Record<string, unknown>>'
    ```

8. **Line 1014** - Property does not exist

    ```
    status.startTime
    Property 'startTime' does not exist on type 'Promise<Record<string, unknown>>'
    ```

9. **Line 1020** - Property does not exist

    ```
    status.monitorInterfaces
    Property 'monitorInterfaces' does not exist on type 'Promise<Record<string, unknown>>'
    ```

10. **Line 1026** - Property does not exist
    ```
    status.metrics
    Property 'metrics' does not exist on type 'Promise<Record<string, unknown>>'
    ```

---

### src/routes/api/kismet/devices/+server.ts (5 errors)

1. **Line 936** - Type conversion error

    ```
    (devices || []) as Record<string, unknown>[]
    Conversion of 'KismetDevice[]' to 'Record<string, unknown>[]' may be a mistake
    Index signature for 'string' missing in 'KismetDevice'
    ```

2. **Line 942** - Property does not exist

    ```
    status.running
    Property 'running' does not exist on type 'Promise<Record<string, unknown>>'
    ```

3. **Line 948** - Property does not exist

    ```
    status.deviceCount
    Property 'deviceCount' does not exist on type 'Promise<Record<string, unknown>>'
    ```

4. **Line 954** - Property does not exist

    ```
    status.interface
    Property 'interface' does not exist on type 'Promise<Record<string, unknown>>'
    ```

5. **Line 960** - Property does not exist
    ```
    status.uptime
    Property 'uptime' does not exist on type 'Promise<Record<string, unknown>>'
    ```

---

### src/lib/services/db/signal-database.ts (4 errors)

1. **Line 901** - Type mismatch

    ```
    source: signal.source
    Type '"kismet" | "hackrf" | "rtl-sdr" | "other"' not assignable to 'SignalSource'
    Type '"kismet"' not assignable to 'SignalSource'
    ```

2. **Line 908** - Type mismatch

    ```
    source: signal.source
    Type '"kismet" | "hackrf" | "rtl-sdr" | "other"' not assignable to 'SignalSource'
    ```

3. **Line 914** - Type mismatch

    ```
    source: this.normalizeSignalSource(record.source)
    Type 'SignalSource' not assignable to '"kismet" | "hackrf" | "rtl-sdr" | "other"'
    ```

4. **Line 922** - Type mismatch
    ```
    metadata: (record.metadata || {}) as Record<string, unknown>
    Type 'Record<string, unknown>' not assignable to 'SignalMetadata'
    Type 'unknown' not assignable to 'string | number | boolean | undefined'
    ```

---

### src/lib/server/security/auth-audit.ts (3 errors)

1. **Line 74** - Type mismatch

    ```
    logger.info('[AUTH_AUDIT]', record)
    Argument of type 'AuthAuditRecord' not assignable to 'Record<string, unknown>'
    Index signature for 'string' missing in 'AuthAuditRecord'
    ```

2. **Line 80** - Type mismatch

    ```
    logger.warn('[AUTH_AUDIT]', record)
    Argument of type 'AuthAuditRecord' not assignable to 'Record<string, unknown>'
    ```

3. **Line 83** - Type mismatch
    ```
    logger.info('[AUTH_AUDIT]', record)
    Argument of type 'AuthAuditRecord' not assignable to 'Record<string, unknown>'
    ```

---

### src/hooks.server.ts (2 errors)

1. **Line 238** - Type mismatch

    ```
    eventType: 'RATE_LIMIT_EXCEEDED'
    Type '"RATE_LIMIT_EXCEEDED"' not assignable to type 'AuthEventType'
    ```

2. **Line 257** - Type mismatch
    ```
    eventType: 'RATE_LIMIT_EXCEEDED'
    Type '"RATE_LIMIT_EXCEEDED"' not assignable to type 'AuthEventType'
    ```

---

### src/lib/server/db/signal-repository.ts (2 errors)

1. **Line 888** - Property does not exist

    ```
    altitude: signal.altitude || 0
    Property 'altitude' does not exist on type 'SignalMarker'
    ```

2. **Line 894** - Property does not exist
    ```
    altitude: signal.altitude || 0
    Property 'altitude' does not exist on type 'SignalMarker'
    ```

---

### Single Error Files (6 errors)

#### src/routes/api/signals/batch/+server.ts (1 error)

**Line 1033** - Type mismatch

```
const signalMarkers: SignalMarker[] = signals.map(...)
Property 'position' missing in type but required in 'SignalMarker'
```

#### src/routes/api/kismet/start/+server.ts (1 error)

**Line 966** - Property does not exist

```
export const POST: RequestHandler = async ({ _url }) => {
Property '_url' does not exist on type 'RequestEvent<RouteParams, "/api/kismet/start">'
```

#### src/routes/api/gsm-evil/health/+server.ts (1 error)

**Line 928** - Cannot find module

```
await import('$lib/server/gsm-database-path')
Cannot find module '$lib/server/gsm-database-path' or its type declarations
```

#### src/lib/server/kismet/web-socket-manager.ts (1 error)

**Line 307** - Type mismatch

```
data: device
Type 'KismetDevice' not assignable to 'Record<string, unknown>'
Index signature for 'string' missing in 'KismetDevice'
```

#### src/lib/server/kismet/kismet-proxy.ts (1 error)

**Line 336** - Type mismatch

```
signal: { last_signal: lastSignal, max_signal: maxSignal, min_signal: minSignal }
Type '{ last_signal: any; ... }' not assignable to type 'number'
```

#### src/lib/server/db/geo.ts (1 error)

**Line 882** - Type mismatch

```
metadata
Type 'Record<string, unknown>' not assignable to 'SignalMetadata'
Type 'unknown' not assignable to 'string | number | boolean | undefined'
```

---

## Component Errors (2 errors)

### src/lib/components/dashboard/DashboardMap.svelte (1 error)

**Line 280** - Argument count mismatch

```
const [cLon, cLat] = spreadClientPosition(client.location.lon, ...)
Expected 6 arguments, but got 5
```

### src/lib/components/dashboard/TerminalPanel.svelte (1 error)

**Line 438** - Type incompatibility

```
terminalPanelState.update((s) => { ... })
Type '(string | null)[]' not assignable to type 'string[]'
Type 'string | null' not assignable to type 'string'
```

---

## Test File Errors (29 errors)

### tests/integration/agent-tool-integration.test.ts (9 errors)

1. **Line 1143** - Cannot find name 'initializeToolExecutionFramework'
2. **Line 1149** - Cannot find name 'globalExecutor'
3. **Line 1155** - Cannot find name 'globalExecutor'
4. **Line 1161** - Cannot find name 'globalExecutor'
5. **Line 1167** - Cannot find name 'globalRegistry'
6. **Line 1173** - Cannot find name 'globalRegistry'
7. **Line 1179** - Cannot find name 'globalRegistry'
8. **Line 1185** - Cannot find name 'globalExecutor'
9. **Line 1191** - Cannot find module '../../src/routes/api/agent/tools/+server'

### tests/unit/server/database/signals.repository.test.ts (4 errors)

1. **Line 1225** - Cannot find module '$lib/server/database/schema'
2. **Line 1231** - Cannot find module '$lib/server/database/signals.repository'
3. **Line 1237** - Cannot find module '$lib/server/database/index'
4. **Line 1242** - Unused '@ts-expect-error' directive

### tests/services/map/signalClustering.test.ts (3 errors)

1. **Line 1202** - Parameter 'c' implicitly has 'any' type
2. **Line 1208** - Parameter 'c' implicitly has 'any' type
3. **Line 1214** - Parameter 'c' implicitly has 'any' type

### tests/load/dataVolumes.test.ts (1 error)

**Line 1196** - Cannot find module '$lib/stores/map/signals'

### tests/unit/test-rssi-coral.ts (1 error)

**Line 1220** - Cannot find module '../../src/lib/services/localization/hybrid-rssi-localizer'

### src/routes/gsm-evil/+page.svelte (2 errors)

1. **Line 1131** - Parameter 'a' implicitly has 'any' type
2. **Line 1137** - Parameter 'b' implicitly has 'any' type

---

## Error Summary by Category

| Category                    | Count | Files                                                 |
| --------------------------- | ----- | ----------------------------------------------------- |
| **Promise type access**     | 20    | agent-context-store.ts, kismet/status, kismet/devices |
| **Bracket notation**        | 13    | agent-context-store.ts                                |
| **Missing type properties** | 9     | agent-context-store.ts, signal-repository.ts          |
| **Type mismatches**         | 12    | signal-database.ts, auth-audit.ts, hooks.server.ts    |
| **Missing modules**         | 7     | Test files                                            |
| **Index signature**         | 5     | web-socket-manager.ts, kismet-proxy.ts, auth-audit.ts |
| **Other**                   | 6     | Various                                               |

---

## Files Requiring Type Definitions

1. **KismetStatusResponse** - Used by kismet/status, kismet/devices
2. **KismetDevice with index signature** - Used by agent-context-store, devices
3. **GPSState extended** - Needs accuracy, heading, speed properties
4. **KismetState extended** - Needs message property
5. **SignalMarker extended** - Needs altitude, position properties
6. **SignalMetadata** - Proper type definition needed
7. **SignalSource** - Type alignment with literal unions
8. **AuthEventType** - Add RATE_LIMIT_EXCEEDED enum value
9. **AuthAuditRecord** - Add index signature for logger compatibility

---

**Next Steps**: See DEPENDENCY_GRAPH.md for fix order and MISSING_PIECES.md for complete type definitions needed.
