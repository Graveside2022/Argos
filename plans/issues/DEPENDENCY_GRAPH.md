# TypeScript Error Dependency Graph

**Purpose**: Shows what must be fixed BEFORE other fixes can work
**Rule**: Always fix dependencies before dependents

---

## Visual Dependency Graph

```
LAYER 0: Type Definitions (Must fix FIRST)
=========================================
┌─────────────────────────────────────────┐
│ Create Missing Type Definitions         │
│  - KismetStatusResponse                  │
│  - KismetDevice (with index signature)  │
│  - GPSState (extended)                   │
│  - KismetState (extended)                │
│  - SignalMarker (extended)               │
│  - SignalMetadata                        │
│  - SignalSource (aligned)                │
│  - AuthEventType (enum updated)          │
│  - AuthAuditRecord (index signature)     │
└─────────────────────────────────────────┘
           │
           │ BLOCKS ↓
           │
LAYER 1: Service Methods (Fix SECOND)
======================================
┌─────────────────────────────────────────┐
│ Update Service Return Types              │
│  - KismetService.getStatus()             │
│    BEFORE: Promise<Record<string, any>>  │
│    AFTER:  Promise<KismetStatusResponse> │
│                                          │
│  - KismetService.getDevices()            │
│    BEFORE: Promise<KismetDevice[]>       │
│    AFTER:  Promise<KismetDevice[]>       │
│            (with index signature)        │
└─────────────────────────────────────────┘
           │
           │ BLOCKS ↓
           │
LAYER 2: API Endpoints (Fix THIRD)
===================================
┌─────────────────────────────────────────┐
│ src/routes/api/kismet/status/+server.ts │
│  - Await status promise (10 errors)     │
│  - Use KismetStatusResponse type        │
│                                          │
│ src/routes/api/kismet/devices/+server.ts│
│  - Await status promise (4 errors)      │
│  - Use KismetDevice with index sig      │
└─────────────────────────────────────────┘
           │
           │ BLOCKS ↓
           │
LAYER 3: Stores & Components (Fix FOURTH)
==========================================
┌─────────────────────────────────────────┐
│ src/lib/stores/dashboard/               │
│  agent-context-store.ts (18 errors)     │
│   - Depends on KismetDevice types       │
│   - Depends on GPSState extended        │
│   - Depends on KismetState extended     │
└─────────────────────────────────────────┘
```

---

## Dependency Chains in Detail

### Chain 1: Kismet Status Errors

```
KismetStatusResponse (missing)
    ↓ BLOCKS
KismetService.getStatus() return type
    ↓ BLOCKS
src/routes/api/kismet/status/+server.ts (10 errors)
    ↓ BLOCKS
src/routes/api/kismet/devices/+server.ts (4 errors on status)
    ↓ BLOCKS
src/lib/stores/dashboard/agent-context-store.ts (cascading errors)
```

**FIX ORDER**:

1. Create `src/lib/types/service-responses.ts` with `KismetStatusResponse`
2. Update `src/lib/services/kismet/kismet-service.ts` method return types
3. Add `await` in `src/routes/api/kismet/status/+server.ts` (fixes 10 errors)
4. Add `await` in `src/routes/api/kismet/devices/+server.ts` (fixes 4 errors)
5. Store will automatically fix when services are typed

---

### Chain 2: KismetDevice Bracket Notation

```
KismetDevice interface (no index signature)
    ↓ BLOCKS
src/lib/stores/dashboard/agent-context-store.ts (13 bracket notation errors)
```

**FIX ORDER**:

1. Update `src/lib/types/kismet.ts`:
    ```typescript
    export interface KismetDevice {
    	[key: string]: any; // ADD THIS LINE
    	// ... existing properties
    }
    ```
2. Fixes 13 errors in agent-context-store.ts immediately

**ALTERNATIVE FIX** (better type safety):

1. Create helper functions in `src/lib/utils/kismet-accessors.ts`:
    ```typescript
    export function getDeviceProperty<T>(device: KismetDevice, path: string): T | undefined {
    	return (device as any)[path] as T;
    }
    ```
2. Replace bracket notation with helper calls

---

### Chain 3: GPS State Properties

```
GPSState interface (missing properties)
    ↓ BLOCKS
src/lib/stores/dashboard/agent-context-store.ts (3 errors: accuracy, heading, speed)
```

**FIX ORDER**:

1. Update `src/lib/types/gps.ts`:
    ```typescript
    export interface GPSState {
    	position: { lat: number; lon: number };
    	fix: boolean;
    	satellites: number;
    	accuracy?: number; // ADD THIS
    	heading?: number; // ADD THIS
    	speed?: number; // ADD THIS
    }
    ```
2. Fixes 3 errors in agent-context-store.ts

---

### Chain 4: Auth Event Type

```
AuthEventType enum (missing value)
    ↓ BLOCKS
src/hooks.server.ts (2 errors: RATE_LIMIT_EXCEEDED)
```

**FIX ORDER**:

1. Update `src/lib/server/security/auth-audit.ts`:
    ```typescript
    export enum AuthEventType {
    	LOGIN = 'LOGIN',
    	LOGOUT = 'LOGOUT',
    	API_KEY_AUTH = 'API_KEY_AUTH',
    	SESSION_AUTH = 'SESSION_AUTH',
    	AUTH_FAILURE = 'AUTH_FAILURE',
    	RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED' // ADD THIS
    }
    ```
2. Fixes 2 errors in hooks.server.ts immediately

---

### Chain 5: Auth Audit Record Logger

```
AuthAuditRecord interface (no index signature)
    ↓ BLOCKS
src/lib/server/security/auth-audit.ts (3 errors: logger calls)
```

**FIX ORDER**:

1. Update `src/lib/server/security/auth-audit.ts`:
    ```typescript
    export interface AuthAuditRecord {
    	[key: string]: unknown; // ADD THIS LINE
    	eventType: AuthEventType;
    	timestamp: number;
    	// ... existing properties
    }
    ```
2. Fixes 3 errors immediately

---

### Chain 6: Signal Types

```
SignalMetadata interface (wrong type)
    ↓ BLOCKS
src/lib/services/db/signal-database.ts (2 errors)
src/lib/server/db/geo.ts (1 error)

SignalSource type (misaligned)
    ↓ BLOCKS
src/lib/services/db/signal-database.ts (2 errors)

SignalMarker (missing properties)
    ↓ BLOCKS
src/lib/server/db/signal-repository.ts (2 errors: altitude)
src/routes/api/signals/batch/+server.ts (1 error: position)
```

**FIX ORDER**:

1. Update `src/lib/types/signal.ts`:

    ```typescript
    export interface SignalMetadata {
    	[key: string]: string | number | boolean | undefined;
    	bandwidth?: number;
    	modulation?: string;
    	encryption?: string;
    	// ... other properties
    }

    export type SignalSource = 'kismet' | 'hackrf' | 'rtl-sdr' | 'other';

    export interface SignalMarker {
    	id: string;
    	lat: number;
    	lon: number;
    	altitude?: number; // ADD THIS
    	position: [number, number]; // ADD THIS
    	frequency: number;
    	power: number;
    	// ... existing properties
    }
    ```

2. Fixes 7 errors across 4 files

---

### Chain 7: Independent Single Fixes (No Dependencies)

These can be fixed in any order AFTER type definitions:

```
src/routes/api/kismet/start/+server.ts (1 error)
  - Remove unused _url parameter

src/routes/api/gsm-evil/health/+server.ts (1 error)
  - Create missing module or fix import path

src/lib/server/kismet/web-socket-manager.ts (1 error)
  - Add index signature to KismetDevice (same as Chain 2)

src/lib/server/kismet/kismet-proxy.ts (1 error)
  - Fix signal property type mismatch

src/lib/components/dashboard/DashboardMap.svelte (1 error)
  - Add missing argument to spreadClientPosition()

src/lib/components/dashboard/TerminalPanel.svelte (1 error)
  - Fix sessionIds type (string | null)[] → string[]
```

---

## Optimal Fix Sequence

### Phase 1: Type Definitions (15 minutes)

**Creates foundation for all other fixes**

1. Create `src/lib/types/service-responses.ts`
2. Update `src/lib/types/kismet.ts` (add index signature)
3. Update `src/lib/types/gps.ts` (add properties)
4. Update `src/lib/types/signal.ts` (SignalMetadata, SignalSource, SignalMarker)
5. Update `src/lib/server/security/auth-audit.ts` (enum + interface)

**Result**: Fixes 8 errors immediately (auth-audit + hooks.server)
**Unblocks**: All service method updates

---

### Phase 2: Service Methods (30 minutes)

**Updates service return types**

1. Update `src/lib/services/kismet/kismet-service.ts`:
    - `getStatus()`: `Promise<Record<...>>` → `Promise<KismetStatusResponse>`
    - `getDevices()`: Ensure returns `KismetDevice[]` with index signature

**Result**: Fixes 0 errors directly (enables next phase)
**Unblocks**: API endpoint fixes

---

### Phase 3: API Endpoints (30 minutes)

**Fixes Promise property access**

1. Fix `src/routes/api/kismet/status/+server.ts`:
    - Add `await` before `kismetService.getStatus()`
    - Access properties from awaited result

2. Fix `src/routes/api/kismet/devices/+server.ts`:
    - Add `await` before `kismetService.getStatus()`
    - Remove type assertion for devices

**Result**: Fixes 14 errors (10 + 4)
**Unblocks**: Store updates

---

### Phase 4: Stores & Components (1 hour)

**Leverages all previous fixes**

1. Fix `src/lib/stores/dashboard/agent-context-store.ts`:
    - KismetDevice bracket notation works (index signature added)
    - GPSState properties work (extended in Phase 1)
    - KismetState properties work (fix type or add message)

2. Fix remaining single-file errors

**Result**: Fixes 21 errors (18 + 3)

---

## Critical Path Analysis

**Longest dependency chain** (must be done in order):

```
Type definitions → Service methods → API endpoints → Stores
   (15 min)          (30 min)         (30 min)      (1 hour)
```

**Total sequential time**: 2 hours 15 minutes

**Parallelizable work**:

- Single-file fixes can happen anytime after Phase 1
- Test file skips/fixes are independent

---

## Validation Commands

After each phase:

```bash
# Phase 1: Should reduce errors from 72 → 64
npm run typecheck 2>&1 | grep "found.*errors"

# Phase 2: Should stay at 64 (enables Phase 3)
npm run typecheck 2>&1 | grep "found.*errors"

# Phase 3: Should reduce errors from 64 → 50
npm run typecheck 2>&1 | grep "found.*errors"

# Phase 4: Should reduce errors from 50 → ~29 (only test errors remain)
npm run typecheck 2>&1 | grep "found.*errors"
```

---

## Rollback Points

| Phase         | Git Commit | Errors | Rollback Command            |
| ------------- | ---------- | ------ | --------------------------- |
| Start         | current    | 72     | N/A                         |
| After Phase 1 | commit-1   | 64     | `git reset --hard commit-1` |
| After Phase 2 | commit-2   | 64     | `git reset --hard commit-2` |
| After Phase 3 | commit-3   | 50     | `git reset --hard commit-3` |
| After Phase 4 | commit-4   | 29     | `git reset --hard commit-4` |

**Best Practice**: Commit after each phase with verification passing

---

**Next**: See MISSING_PIECES.md for complete code snippets of all type definitions needed
