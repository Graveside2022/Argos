# TypeScript Error Resolution - Next Actions

**Priority**: HIGH
**Target**: Production code type safety
**Goal**: Zero TypeScript errors in `src/` directory

---

## 🎯 IMMEDIATE PRIORITIES (Next 2-3 hours)

### 1. Fix auth-audit.ts (30 minutes) - EASY WIN ✨

**File**: `src/lib/server/security/auth-audit.ts`
**Errors**: 3
**Difficulty**: ⭐ LOW

**Quick Fixes**:

```typescript
// 1. Add missing enum value (line ~15)
export enum AuthEventType {
	LOGIN = 'LOGIN',
	LOGOUT = 'LOGOUT',
	API_KEY_AUTH = 'API_KEY_AUTH',
	SESSION_AUTH = 'SESSION_AUTH',
	AUTH_FAILURE = 'AUTH_FAILURE',
	RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED' // ADD THIS
}

// 2. Update function signature (line ~45)
function logAuditEvent(record: AuthAuditRecord) {
	// was: Record<string, unknown>
	// ...
}
```

**Impact**: Security audit logging now properly typed

---

### 2. Fix kismet/devices bracket notation (1 hour) - MEDIUM

**File**: `src/routes/api/kismet/devices/+server.ts`
**Errors**: 5
**Difficulty**: ⭐⭐ MEDIUM

**Strategy**: Create type-safe property accessors

```typescript
// Add to KismetDevice type or helpers
interface KismetDevice {
	[key: string]: any; // Add index signature
	// ... existing properties
}

// Or create helper functions
function getDeviceProperty<T>(device: KismetDevice, path: string): T | undefined {
	return device[path] as T;
}

// Usage
const signal = getDeviceProperty<number>(device, 'kismet.device.base.signal');
const manufacturer = getDeviceProperty<string>(device, 'kismet.device.base.manuf');
```

**Impact**: Device listing endpoint type-safe

---

### 3. Fix 6 single-error files (1 hour) - QUICK WINS ✨

**Files**:

- `src/routes/api/signals/batch/+server.ts` (1 error)
- `src/routes/api/kismet/start/+server.ts` (1 error)
- `src/routes/api/gsm-evil/health/+server.ts` (1 error)
- `src/lib/server/kismet/web-socket-manager.ts` (1 error)
- `src/lib/server/kismet/kismet-proxy.ts` (1 error)
- `src/lib/server/db/geo.ts` (1 error)

**Difficulty**: ⭐ LOW per file

**Strategy**: Individual type assertions or null checks

- Most are simple property existence checks
- Add `!` non-null assertions or optional chaining `?.`
- Add specific type casts where needed

**Impact**: 6 files become error-free

---

**TOTAL TIME**: 2.5 hours
**TOTAL ERRORS FIXED**: 14 errors
**NEW TOTAL**: 72 → 58 errors (19% reduction)

---

## 🔥 HIGH-PRIORITY NEXT (4-6 hours)

### 4. Define Service Response Types (2 hours)

**Files**: Create `src/lib/types/service-responses.ts`
**Impact**: Fixes cascading errors across multiple files

**Types to Define**:

```typescript
// src/lib/types/service-responses.ts

export interface KismetStatusResponse {
	running: boolean;
	uptime: number;
	interface: string;
	deviceCount: number;
	metrics: {
		packetsProcessed: number;
		devicesDetected: number;
		// ...
	};
	channels: string[];
	monitorInterfaces: string[];
	startTime?: number;
}

export interface ServiceHealthResponse {
	service: string;
	status: 'running' | 'stopped' | 'error';
	uptime?: number;
	message?: string;
	metrics?: Record<string, number>;
}

export interface GPSStateResponse {
	fix: boolean;
	latitude: number;
	longitude: number;
	altitude?: number;
	accuracy?: number;
	speed?: number;
	heading?: number;
	timestamp: number;
}
```

---

### 5. Fix kismet/status/+server.ts (2 hours)

**File**: `src/routes/api/kismet/status/+server.ts`
**Errors**: 10
**Difficulty**: ⭐⭐⭐ MEDIUM-HIGH

**Steps**:

1. Update KismetService methods to return `Promise<KismetStatusResponse>`
2. Add `await` before all service method calls
3. Access properties from awaited results
4. Type response construction

**Before**:

```typescript
const status = kismetService.getStatus(); // Promise<Record<string, unknown>>
const running = status.running; // ❌ ERROR
```

**After**:

```typescript
const status = await kismetService.getStatus(); // KismetStatusResponse
const running = status.running; // ✅ OK
```

**Impact**: Critical Kismet status endpoint type-safe

---

### 6. Fix signal-database.ts (1 hour)

**File**: `src/lib/services/db/signal-database.ts`
**Errors**: 4
**Difficulty**: ⭐⭐ MEDIUM

**Define Missing Types**:

```typescript
export interface SignalMetadata {
	bandwidth?: number;
	modulation?: string;
	encryption?: string;
	dataRate?: number;
	signalStrength?: number;
	noiseFloor?: number;
	snr?: number;
	deviceType?: string;
	manufacturer?: string;
	scanConfig?: Record<string, unknown>;
}

export type SignalSource = 'kismet' | 'hackrf' | 'rtl-sdr' | 'other';
```

**Impact**: Signal database operations type-safe

---

**TOTAL TIME**: 5 hours
**TOTAL ERRORS FIXED**: 14 errors
**NEW TOTAL**: 58 → 44 errors (23% reduction)

---

## 🎖️ ADVANCED (2-4 hours) - HIGH COMPLEXITY

### 7. Fix agent-context-store.ts (3 hours)

**File**: `src/lib/stores/dashboard/agent-context-store.ts`
**Errors**: 18
**Difficulty**: ⭐⭐⭐⭐ HIGH

**Challenge**: Complex reactive state with async service calls

**Strategy**:

1. Define all service response types first (see step 4)
2. Update service interfaces
3. Ensure all promises are awaited before state updates
4. Add proper error boundaries

**Risk**: HIGH - core agent functionality
**Recommendation**: Do this last, after testing other fixes

---

## 📊 PROGRESS TRACKING

### Current State

```
Total Errors: 72
├─ Production Code: 43 errors
│  ├─ Critical (P0): 33 errors
│  ├─ Medium (P1): 10 errors
│  └─ Low (P2): 6 errors
└─ Test Code: 29 errors (skippable)
```

### After Quick Wins (Steps 1-3)

```
Total Errors: 58 (-14)
├─ Production Code: 29 errors
└─ Test Code: 29 errors
```

### After High Priority (Steps 4-6)

```
Total Errors: 44 (-28 total)
├─ Production Code: 15 errors
└─ Test Code: 29 errors
```

### After Advanced (Step 7)

```
Total Errors: 26 (-46 total)
├─ Production Code: 0 errors ✅
└─ Test Code: 26 errors
```

---

## 🛠️ RECOMMENDED WORKFLOW

### Day 1: Quick Wins (2.5 hours)

```bash
# 1. Fix auth-audit
# 2. Fix kismet/devices
# 3. Fix 6 single-error files
# 4. Commit & test
```

### Day 2: Service Types (5 hours)

```bash
# 1. Create service response types
# 2. Fix kismet/status
# 3. Fix signal-database
# 4. Commit & test
```

### Day 3: Agent Store (3 hours)

```bash
# 1. Update agent-context-store
# 2. Extensive testing
# 3. Final commit
```

### Day 4: Test Cleanup (optional, 4 hours)

```bash
# 1. Rewrite broken tests
# 2. Skip outdated tests properly
```

---

## ⚡ QUICK REFERENCE COMMANDS

### Check current errors

```bash
npm run typecheck 2>&1 | tail -5
```

### Errors by file

```bash
npm run typecheck 2>&1 | grep "\.ts:" | sed 's/:.*//g' | sort | uniq -c | sort -rn
```

### Test changes don't break build

```bash
npm run build
```

### Run specific file typecheck

```bash
npx tsc --noEmit src/lib/server/security/auth-audit.ts
```

---

## 📝 CHECKLIST FOR EACH FIX

- [ ] Read current file state
- [ ] Identify exact error locations
- [ ] Apply minimal fix (no refactoring)
- [ ] Run typecheck to verify fix
- [ ] Check for new errors introduced
- [ ] Test in browser if API endpoint
- [ ] Commit with descriptive message

---

## 🚀 SUCCESS CRITERIA

### Phase 1 Complete (Steps 1-3)

- ✅ 14 errors fixed
- ✅ All single-error files clean
- ✅ No new errors introduced
- ✅ Build passes

### Phase 2 Complete (Steps 4-6)

- ✅ 28 total errors fixed
- ✅ Kismet endpoints type-safe
- ✅ Service response types defined
- ✅ Build passes

### Phase 3 Complete (Step 7)

- ✅ 46 total errors fixed
- ✅ Zero production code errors
- ✅ All API endpoints typed
- ✅ Ready for production deploy

---

**Last Updated**: 2026-02-11
**Next Review**: After Phase 1 completion
**Owner**: Development Team
