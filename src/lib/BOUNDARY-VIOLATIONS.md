# Architectural Boundary Violations Registry

**Created**: 2026-02-08 (Phase 0.6)
**Status**: DEFERRED to Phase 5
**Last Verified**: 2026-02-08

## Purpose

This document tracks all remaining value-import boundary violations that cross
architectural layers. These were intentionally deferred during Phase 0 because
they require non-trivial refactoring (callback injection, event emitters, or
return-value patterns) that belongs in Phase 5 (Architecture Enforcement).

Type-only boundary violations were eliminated in Phase 0.6 by extracting shared
types to `$lib/types/`.

---

## Summary

| Category                   | Count                     | Phase 0.6 Action          |
| -------------------------- | ------------------------- | ------------------------- |
| Services -> Stores (VALUE) | 15 files, 26 import lines | DEFERRED                  |
| Stores -> Services (VALUE) | 1 file, 1 import line     | FIXED (0.6.5 lazy import) |
| Server -> Stores           | 0                         | ELIMINATED (0.6.1)        |
| Stores -> Server           | 0                         | ELIMINATED (0.6.2)        |
| Server -> Services (VALUE) | 2 files, 6 import lines   | DEFERRED                  |
| API Routes -> Stores       | 0                         | ELIMINATED (0.6.1)        |
| Services -> Stores (TYPE)  | 0                         | ELIMINATED (0.6.1, 0.6.2) |

---

## Services -> Stores VALUE Imports (14 files)

These services directly call `store.set()`, `store.update()`, or `get(store)`
on Svelte stores, creating tight coupling between the service and presentation
layers. Phase 5 will invert these dependencies.

### 1. `services/websocket/hackrf.ts`

**Imports from**: `$lib/stores/hackrf` (6 exports: spectrumData, sweepStatus, connectionStatus, sweepConfig, currentFrequency, isConnected)
**Impact**: Service WRITES spectrum data directly to store
**Proposed Fix**: Return data from service; let caller update store

### 2. `services/websocket/kismet.ts`

**Imports from**: `$lib/stores/kismet`, `$lib/stores/connection`
**Impact**: Service WRITES device data and connection status to stores
**Proposed Fix**: Event emitter pattern; service emits events, store subscribes

### 3. `services/hackrfsweep/signal-service.ts`

**Imports from**: `$lib/stores/hackrfsweep/signal-store`, `display-store`, `$lib/stores/hackrf`
**Impact**: Service READS + WRITES signal processing state
**Proposed Fix**: Callback injection; service accepts update callbacks

### 4. `services/hackrfsweep/display-service.ts`

**Imports from**: `$lib/stores/hackrfsweep/display-store`
**Impact**: Service WRITES display configuration
**Proposed Fix**: Return-value pattern; caller applies to store

### 5. `services/hackrfsweep/control-service.ts`

**Imports from**: `$lib/stores/hackrfsweep/control-store`, `frequency-store`
**Impact**: Service WRITES control state
**Proposed Fix**: Return-value pattern

### 6. `services/hackrfsweep/frequency-service.ts`

**Imports from**: `$lib/stores/hackrfsweep/frequency-store`
**Impact**: Service WRITES frequency list
**Proposed Fix**: Return-value pattern

### 7. `services/tactical-map/hackrf-service.ts`

**Imports from**: `$lib/stores/hackrf`, `$lib/stores/tactical-map/hackrf-store`
**Impact**: Service READS + WRITES HackRF state
**Proposed Fix**: Dependency injection; service receives store interface

### 8. `services/tactical-map/gps-service.ts`

**Imports from**: `$lib/stores/tactical-map/gps-store`
**Impact**: Service WRITES GPS position data to store
**Proposed Fix**: Return GPS data; let component update store

### 9. `services/tactical-map/map-service.ts`

**Imports from**: `$lib/stores/tactical-map/map-store`, `gps-store`
**Impact**: Service WRITES map state (Leaflet instance, markers)
**Proposed Fix**: Return Leaflet objects; let component manage store

### 10. `services/tactical-map/kismet-service.ts`

**Imports from**: `$lib/stores/tactical-map/kismet-store`
**Impact**: Service WRITES Kismet device data to store
**Proposed Fix**: Event emitter or callback pattern

### 11. `services/hackrf/api.ts`

**Imports from**: `$lib/stores/hackrf`
**Impact**: Service WRITES API response data to store
**Proposed Fix**: Return data; caller updates store

### 12. `services/hackrf/usrp-api.ts`

**Imports from**: `$lib/stores/hackrf`
**Impact**: Service WRITES USRP data to store
**Proposed Fix**: Return data; caller updates store

### 13. `services/wigletotak/wigle-service.ts`

**Imports from**: `$lib/stores/wigletotak/wigle-store`
**Impact**: Service WRITES WiGLE data to store
**Proposed Fix**: Callback or return-value pattern

### 14. `services/websocket/example-usage.ts`

**Imports from**: Multiple stores (hackrf, kismet, connection)
**Impact**: Example file demonstrating store usage patterns
**Proposed Fix**: Update examples when services are refactored

### 15. `services/map/kismet-rssi-service.ts`

**Imports from**: `$lib/stores/tactical-map/gps-store` (double-quote import)
**Impact**: Service READS GPS position via `get(gpsStore)`
**Proposed Fix**: Accept GPS coordinates as function parameter

---

## Server -> Services VALUE Imports (2 files)

These server modules import value exports (classes/functions) from the services
layer, creating a downward dependency from the server layer into the service layer.

### 1. `server/hackrf/sweep-manager.ts`

**Imports from**: `$lib/services/hackrf/sweep-manager/` (4 imports: ProcessManager, FrequencyCycler, BufferManager, ErrorTracker)
**Impact**: Server layer depends on service-layer implementations
**Proposed Fix**: Dependency injection or co-locate sweep-manager utilities in server/hackrf/

### 2. `server/usrp/sweep-manager.ts`

**Imports from**: `$lib/services/usrp/sweep-manager/` (2 imports: ProcessManager, BufferManager)
**Impact**: Server layer depends on service-layer implementations
**Proposed Fix**: Dependency injection or co-locate sweep-manager utilities in server/usrp/

---

## Stores -> Services VALUE Import (1 file -- FIXED in Phase 0.6.5)

### 1. `stores/usrp.ts`

**Imports**: `usrpAPI` from `$lib/services/usrp/api`
**Impact**: Store directly calls service API at module scope
**Fix Applied**: Lazy dynamic import pattern (Phase 0.6.5)

---

## Phase 5 Resolution Strategy

### Recommended Patterns (in order of preference)

1. **Return-Value Pattern**: Service functions return data; caller (component/page)
   updates the store. Simplest, most testable.

2. **Callback Injection**: Service accepts `onUpdate: (data) => void` callback.
   Caller passes `store.set` or a wrapper. Decouples without async overhead.

3. **Event Emitter Pattern**: Service extends EventEmitter; emits typed events.
   Store subscribes. Best for services with multiple consumers.

4. **Dependency Injection**: Service constructor/factory accepts a store interface.
   Most flexible but highest complexity. Use for services shared across contexts.

### Migration Order

Phase 5 should address these in dependency order:

1. Leaf services first (wigle-service, gps-service) -- fewest callers
2. WebSocket services (hackrf, kismet) -- central but isolated
3. HackRF sweep services (signal, display, control, frequency) -- tightly coupled cluster
4. Tactical map services (map, hackrf, kismet) -- depend on multiple stores
5. Example usage last (just update imports)

---

## Verification Commands

```bash
# Count remaining services-to-stores VALUE imports (both quote styles):
grep -rn "from ['\"]\\$lib/stores" src/lib/services/ --include="*.ts" | grep -v "import type" | wc -l

# Count remaining server-to-services VALUE imports:
grep -rn "from ['\"]\\$lib/services" src/lib/server/ --include="*.ts" | grep -v "import type" | wc -l

# Should both be 0 after Phase 5 completion:
# grep -rn "from ['\"]\\$lib/stores" src/lib/services/ --include="*.ts" | wc -l
# grep -rn "from ['\"]\\$lib/services" src/lib/server/ --include="*.ts" | wc -l
```
