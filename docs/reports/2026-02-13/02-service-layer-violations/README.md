# Service Layer Violations Analysis

**Violation Category:** CRITICAL (Article II §2.7)
**Violation Count:** 10 files in `src/lib/services/`
**Impact:** Architectural anti-pattern, violates feature-based organization
**Status:** Pre-existing (created before constitution ratification)
**Priority:** 🔴 **CRITICAL** - Requires architectural refactoring

---

## 🎯 **USER DECISION: Option A - Full Architectural Refactor APPROVED**

**Decision Date:** February 13, 2026
**Approved By:** User
**Implementation Status:** Pending implementation planning

**What This Means:**

- ✅ Full migration from service layer pattern to feature-based architecture
- ✅ Move from `src/lib/services/` to `src/lib/<feature>/`
- ✅ 7-phase refactoring plan (Kismet, HackRF, GPS, USRP, Tactical Map, WebSocket Base, Cleanup)
- ✅ Feature cohesion - everything for a feature in one place
- ✅ Improved encapsulation and testability

**Target Architecture:**

```
src/lib/
├── kismet/            ← WebSocket, API, types, stores
├── hackrf/            ← WebSocket, spectrum, sweep, stores
├── gps/               ← API, positioning, stores
├── usrp/              ← API, power management, types
└── tactical-map/      ← Map engine, layers, stores
```

**Next Steps:**

1. Create implementation branch: `refactor/feature-based-architecture`
2. Execute 7-phase refactoring plan sequentially
3. Run tests after each phase (validate before proceeding)
4. Update all imports throughout codebase
5. Delete old `src/lib/services/` directory when complete

**Timeline:** 1-2 weeks
**Risk:** MEDIUM (requires careful migration and testing)
**Compliance Impact:** 42% → ~45% (resolves 10 CRITICAL violations)

**Phases:**

- Phase 1: Kismet Feature Module (2-3 days)
- Phase 2: HackRF Feature Module (2-3 days)
- Phase 3: GPS Feature Module (1 day)
- Phase 4: USRP Feature Module (1 day)
- Phase 5: Tactical Map Integration (1-2 days)
- Phase 6: WebSocket Base (1 day)
- Phase 7: Cleanup & Validation (1 day)

---

## 📊 Quick Summary

**Problem:** Service layer pattern (`src/lib/services/`) forbidden by constitution
**Constitution Rule:** Article II §2.7 - "No service layer pattern"
**Why Forbidden:** Promotes feature-based organization over technical layering
**Solution:** Refactor to feature modules in `src/lib/<feature>/`

---

## 🔍 Detected Violations

### WebSocket Services (4 files)

1. `src/lib/services/websocket/kismet.ts` (since 2025-07-13)
2. `src/lib/services/websocket/index.ts` (since 2026-02-08)
3. `src/lib/services/websocket/hackrf.ts` (since 2025-07-13)
4. `src/lib/services/websocket/base.ts` (since 2025-07-13)

### USRP Services (2 files)

5. `src/lib/services/usrp/index.ts` (since 2026-02-08)
6. `src/lib/services/usrp/api.ts` (since 2025-07-22)

### Tactical Map Services (4 files)

7. `src/lib/services/tactical-map/map-service.ts` (since 2026-02-12)
8. `src/lib/services/tactical-map/kismet-service.ts` (since 2026-02-12)
9. `src/lib/services/tactical-map/hackrf-service.ts` (since 2025-07-13)
10. `src/lib/services/tactical-map/gps-service.ts` (since 2026-02-08)

---

## 🎯 Why This Matters

### Current Architecture (Service Layer Pattern)

```
src/lib/services/
├── websocket/         ← Technical grouping
│   ├── kismet.ts
│   ├── hackrf.ts
│   └── base.ts
├── usrp/
└── tactical-map/
```

**Problems:**

- ❌ **Technical coupling:** Features split across multiple technical layers
- ❌ **Hard to understand:** Need to jump between service/component/route to understand feature
- ❌ **Difficult to test:** Service dependencies complex
- ❌ **Poor encapsulation:** Services become "god objects" knowing about everything

### Target Architecture (Feature-Based)

```
src/lib/
├── kismet/            ← Feature grouping
│   ├── websocket.ts   (WebSocket logic)
│   ├── api.ts         (API client)
│   ├── types.ts       (Kismet-specific types)
│   └── stores.ts      (Kismet state)
├── hackrf/
│   ├── websocket.ts
│   ├── spectrum.ts
│   └── stores.ts
└── tactical-map/
    ├── map-engine.ts
    ├── layers/
    └── stores.ts
```

**Benefits:**

- ✅ **Feature cohesion:** Everything for a feature in one place
- ✅ **Easy to understand:** Read one directory to understand feature
- ✅ **Easy to test:** Feature modules self-contained
- ✅ **Good encapsulation:** Features don't need to know about each other's internals

---

## 🔄 Refactoring Strategy

### Option A: Full Architectural Refactoring (RECOMMENDED)

**Impact:** HIGH (code reorganization)
**Timeline:** 1-2 weeks
**Risk:** MEDIUM (requires careful migration, testing)

**Approach:**

1. Create new feature-based structure
2. Move code file-by-file to new locations
3. Update imports throughout codebase
4. Run tests after each move
5. Delete old `services/` directory when complete

**Deliverable:** Clean feature-based architecture, constitutional compliance

---

### Option B: Constitutional Exemption

**Impact:** ZERO (no code changes)
**Timeline:** 1 hour (documentation only)
**Risk:** ZERO

**Approach:**
Add exemption annotation to each service file:

```typescript
// @constitutional-exemption: Article II §2.7 issue:#123
// Justification: Legacy service layer, planned refactor in Q2 2026
// Rationale: Service pattern predates constitution, functional and tested
```

**Deliverable:** Violations acknowledged, audit passes, refactor deferred

---

## 📋 Detailed Refactoring Plan (Option A)

### Phase 1: Kismet Feature Module (2-3 days)

**Create:**

```
src/lib/kismet/
├── websocket.ts       ← Move from services/websocket/kismet.ts
├── api.ts             ← Kismet API client logic
├── types.ts           ← Kismet types
└── stores.ts          ← Kismet state management
```

**Steps:**

1. Create `src/lib/kismet/` directory
2. Move `services/websocket/kismet.ts` → `kismet/websocket.ts`
3. Extract Kismet types to `kismet/types.ts`
4. Update imports in:
    - `src/routes/api/kismet/` (API routes)
    - `src/lib/components/dashboard/` (components using Kismet)
    - `src/lib/stores/` (if Kismet stores exist)
5. Run tests: `npm run test:integration`
6. Commit: `refactor(kismet): migrate to feature-based architecture`

**Validation:**

- [ ] All Kismet tests passing
- [ ] Kismet WebSocket connection works
- [ ] Kismet iframe loads correctly
- [ ] No broken imports

---

### Phase 2: HackRF Feature Module (2-3 days)

**Create:**

```
src/lib/hackrf/
├── websocket.ts       ← Move from services/websocket/hackrf.ts
├── spectrum.ts        ← HackRF spectrum analysis logic
├── sweep.ts           ← Sweep configuration
└── stores.ts          ← HackRF state management
```

**Steps:**

1. Create `src/lib/hackrf/` directory
2. Move `services/websocket/hackrf.ts` → `hackrf/websocket.ts`
3. Move `services/tactical-map/hackrf-service.ts` logic → `hackrf/` (merge with websocket or spectrum)
4. Update imports in:
    - `src/routes/api/hackrf/` (API routes)
    - `src/lib/components/dashboard/` (components using HackRF)
5. Run tests: `npm run test:integration`
6. Commit: `refactor(hackrf): migrate to feature-based architecture`

**Validation:**

- [ ] HackRF FFT stream works
- [ ] Spectrum visualization renders
- [ ] Sweep controls functional

---

### Phase 3: GPS Feature Module (1 day)

**Create:**

```
src/lib/gps/
├── api.ts             ← GPS API client
├── positioning.ts     ← Position calculations
└── stores.ts          ← GPS state management
```

**Steps:**

1. Create `src/lib/gps/` directory
2. Move `services/tactical-map/gps-service.ts` → `gps/api.ts`
3. Update imports in tactical map components
4. Run tests
5. Commit: `refactor(gps): migrate to feature-based architecture`

---

### Phase 4: USRP Feature Module (1 day)

**Create:**

```
src/lib/usrp/
├── api.ts             ← Move from services/usrp/api.ts
├── power.ts           ← USRP power management
└── types.ts           ← USRP types
```

**Steps:**

1. Create `src/lib/usrp/` directory
2. Move `services/usrp/` contents → `usrp/`
3. Update imports in API routes
4. Run tests
5. Commit: `refactor(usrp): migrate to feature-based architecture`

---

### Phase 5: Tactical Map Integration (1-2 days)

**Create:**

```
src/lib/tactical-map/
├── map-engine.ts      ← Move from services/tactical-map/map-service.ts
├── layers/
│   ├── device-layer.ts
│   ├── signal-layer.ts
│   └── grid-layer.ts
└── stores.ts          ← Map state
```

**Steps:**

1. Create `src/lib/tactical-map/` directory
2. Move `services/tactical-map/map-service.ts` → `tactical-map/map-engine.ts`
3. **Note:** `tactical-map/kismet-service.ts`, `hackrf-service.ts`, `gps-service.ts` should be DELETED (logic moved to respective feature modules in Phases 1-3)
4. Update imports in DashboardMap.svelte
5. Run tests
6. Commit: `refactor(tactical-map): migrate to feature-based architecture`

---

### Phase 6: WebSocket Base (1 day)

**Decision:**

- `services/websocket/base.ts` is shared infrastructure, NOT feature-specific
- **Move to:** `src/lib/server/websocket-base.ts` (server infrastructure)
- **OR:** Inline into each feature's websocket.ts if logic is simple

**Steps:**

1. Evaluate if base.ts is actually reused
2. If yes: Move to `src/lib/server/websocket-base.ts`
3. If no: Delete and inline into feature modules
4. Update imports
5. Commit: `refactor(websocket): consolidate base infrastructure`

---

### Phase 7: Cleanup & Validation (1 day)

**Steps:**

1. Delete empty `src/lib/services/` directory
2. Run full test suite: `npm run test:all`
3. Run constitutional audit: `npx tsx scripts/run-audit.ts`
4. Verify 10 CRITICAL violations resolved
5. Commit: `refactor: complete service layer elimination`

**Final validation:**

- [ ] Zero CRITICAL violations (service layer)
- [ ] All tests passing
- [ ] All features functional
- [ ] Constitutional compliance improved

---

## ⚖️ Risk Assessment

### 🔴 HIGH RISKS

**1. Breaking Existing Imports**
**Probability:** HIGH (inevitable during refactor)
**Impact:** HIGH (build errors, runtime errors)

**Mitigation:**

- Use TypeScript compiler to find all imports
- Run `npm run typecheck` after each move
- Update imports before committing

**2. WebSocket Connection Failures**
**Probability:** MEDIUM (if WebSocket logic incorrectly moved)
**Impact:** HIGH (real-time data broken)

**Mitigation:**

- Test WebSocket connections manually after each phase
- Monitor browser console for connection errors
- Keep old code in git until validated

### 🟡 MEDIUM RISKS

**3. State Management Confusion**
**Probability:** MEDIUM (stores might depend on service structure)
**Impact:** MEDIUM (state synchronization issues)

**Mitigation:**

- Review store dependencies before moving
- Update stores incrementally
- Test state changes thoroughly

**4. Tactical Map Integration**
**Probability:** MEDIUM (map uses services from multiple features)
**Impact:** MEDIUM (map features broken)

**Mitigation:**

- Test map after each feature migration
- Verify device markers, signal visualization, GPS positioning

### 🟢 LOW RISKS

**5. API Route Breakage**
**Probability:** LOW (API routes rarely import services directly)
**Impact:** LOW (isolated to specific endpoint)

**Mitigation:**

- Test API endpoints with Postman/curl
- Run integration tests

---

## 🎯 Recommendation

### ✅ **Choose Option A (Full Refactoring)** IF:

- [ ] You want constitutional compliance
- [ ] You plan long-term development on this project
- [ ] You can allocate 1-2 weeks for refactoring
- [ ] You want cleaner architecture going forward

### ⏸️ **Choose Option B (Exemption)** IF:

- [ ] No time for refactoring now
- [ ] Service layer is working fine
- [ ] Other priorities more urgent
- [ ] Plan to refactor in future (Q2 2026)

**My Recommendation:** **Option B (Exemption for now)**, then refactor later.

**Rationale:**

- Service layer is pre-existing, functional, tested
- No immediate harm from keeping it
- Can refactor incrementally (feature-by-feature) as you touch code
- Focuses development time on new features (GSM Evil, etc.) rather than refactoring

---

## 📖 Next Steps

### If Choosing Option A (Refactoring):

1. Review detailed refactoring plan above
2. Allocate 1-2 weeks timeline
3. Create git branch: `refactor/feature-based-architecture`
4. Execute phases 1-7 sequentially
5. Merge after full validation

### If Choosing Option B (Exemption):

1. Add `@constitutional-exemption` annotations to 10 files
2. Create GitHub issue #123: "Refactor service layer to feature-based architecture (deferred)"
3. Update audit report with exemption status
4. Re-run audit: `npx tsx scripts/run-audit.ts`
5. Verify CRITICAL violations now marked as exempted

---

## 📊 Impact on Compliance Score

**Current:** 42% compliance, 54 CRITICAL violations

**After Option A (Refactoring):**

- **CRITICAL violations:** 54 → 44 (10 resolved)
- **Overall compliance:** 42% → ~45%

**After Option B (Exemption):**

- **CRITICAL violations:** 54 → 54 (but 10 marked exempted)
- **Overall compliance:** 42% (unchanged, but violations acknowledged)

---

**Decision required:** Option A (Refactor) or Option B (Exempt)?
