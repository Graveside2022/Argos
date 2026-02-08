# Phase 7.5.06: UI Component Updates

**Decomposed from**: Phase-7.5-API-ROUTES-FRONTEND.md (Task 7.5.5)
**Risk Level**: MEDIUM -- User-facing visual changes, potential regression
**Prerequisites**: Phase-7.5.04 frontend API client updates completed; Phase-7.5.05 transmit state store created
**Estimated Duration**: 3-4 hours
**Estimated Files Modified**: 3 (AnalysisTools, ConnectionStatus, StatusDisplay)
**Estimated Files Verified**: 5 (SweepControl, TimeFilterDemo, hackrf page, hackrfsweep page, rfsweep page)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Update the HackRF UI components that reference the Python Flask backend to use the new SvelteKit API routes and transmit state store. Verify that sweep (receive) components and pages are completely unaffected by the transmit migration.

---

## 1. Components Requiring Update or Verification

| #   | Component Path                                      | Lines | Change Description                                                       | Risk Level |
| --- | --------------------------------------------------- | ----- | ------------------------------------------------------------------------ | ---------- |
| 1   | `src/lib/components/hackrf/AnalysisTools.svelte`    | 170   | Remove `window.open('http://localhost:8092')` link (line 14)             | Low        |
| 2   | `src/lib/components/hackrf/ConnectionStatus.svelte` | 144   | Point to new health endpoint (`/api/hackrf/transmit/health`)             | Low        |
| 3   | `src/lib/components/hackrf/StatusDisplay.svelte`    | 182   | Update status field names to match new API response format               | Low        |
| 4   | `src/lib/components/hackrf/SweepControl.svelte`     | 209   | **No change** -- sweep (receive) is unaffected by transmit migration     | None       |
| 5   | `src/lib/components/hackrf/TimeFilterDemo.svelte`   | 287   | **No change** -- demo component, no Python backend references            | None       |
| 6   | `src/routes/hackrf/+page.svelte`                    | 123   | Update page-level data fetching if needed (verify imports/endpoints)     | Medium     |
| 7   | `src/routes/hackrfsweep/+page.svelte`               | 1830  | **No change** -- sweep page uses `hackrf_sweep` binary, not transmit API | None       |
| 8   | `src/routes/rfsweep/+page.svelte`                   | 2245  | **No change** -- RF sweep page uses sweep manager, not transmit API      | None       |

---

## 2. Detailed Change Specifications

### 2.1 AnalysisTools.svelte (170 lines) -- LOW RISK

**Current code at line 14**:

```typescript
window.open('http://localhost:8092', '_blank');
```

**Change**: Remove or replace this hardcoded URL. The Python backend web interface at port 8092 will not exist after migration. Options:

- **Option A (Preferred)**: Remove the external link entirely. The transmit functionality is now integrated into the SvelteKit app and does not have a separate web UI.
- **Option B**: Replace with a link to the HackRF transmit page within the app: `window.open('/hackrf', '_blank')` or navigate via SvelteKit's `goto('/hackrf')`.

**Verification**:

```bash
grep -n "localhost:8092" src/lib/components/hackrf/AnalysisTools.svelte
# Expected: 0 matches after fix
```

### 2.2 ConnectionStatus.svelte (144 lines) -- LOW RISK

**Current state**: Checks the Python backend health endpoint to determine HackRF connection status.

**Change**: Point health check to the new SvelteKit endpoint:

- **Before**: Fetches `http://localhost:8092/api/health` or `${PUBLIC_HACKRF_API_URL}/api/health`
- **After**: Fetches `/api/hackrf/transmit/health`

**Additional**: Update the response parsing to handle the new consistent format `{ success: true, data: { status: "ok", ... } }` instead of the raw Flask response.

**Verification**:

```bash
grep -n "localhost:8092\|PUBLIC_HACKRF_API_URL" src/lib/components/hackrf/ConnectionStatus.svelte
# Expected: 0 matches after fix
grep -n "/api/hackrf/transmit/health" src/lib/components/hackrf/ConnectionStatus.svelte
# Expected: 1+ matches
```

### 2.3 StatusDisplay.svelte (182 lines) -- LOW RISK

**Current state**: Displays transmit status fields using the Python backend's field naming conventions.

**Change**: Update field name mappings to match the new `TransmitState` interface (from Phase-7.5.05):

| Python Backend Field | New TypeScript Field |
| -------------------- | -------------------- |
| `frequency`          | `frequencyMhz`       |
| `gain`               | `gainDb`             |
| `sample_rate`        | `sampleRateMsps`     |
| `duration`           | `durationS`          |
| `elapsed`            | `elapsedS`           |
| `is_transmitting`    | `active`             |
| `current_workflow`   | `workflow`           |
| `device_connected`   | `deviceConnected`    |

**Recommended**: Import and subscribe to the `transmitState` store from `$lib/stores/hackrf-transmit` instead of making direct API calls, for reactive updates via SSE.

**Verification**:

```bash
grep -n "transmitState\|hackrf-transmit" src/lib/components/hackrf/StatusDisplay.svelte
# Expected: import of transmitState store
grep -n "sample_rate\|is_transmitting\|current_workflow\|device_connected" src/lib/components/hackrf/StatusDisplay.svelte
# Expected: 0 matches (old Python field names removed)
```

### 2.4 SweepControl.svelte (209 lines) -- NO CHANGE

**Reason**: This component controls `hackrf_sweep` (receive mode), which is a completely separate binary and service layer from `hackrf_transfer` (transmit mode). It does not reference the Python backend or any transmit-related APIs.

**Verification**:

```bash
grep -n "localhost:8092\|transmit\|hackrf_transfer" src/lib/components/hackrf/SweepControl.svelte
# Expected: 0 matches
```

### 2.5 TimeFilterDemo.svelte (287 lines) -- NO CHANGE

**Reason**: Demo component for time-window filtering of sweep data. Has no connection to the Python backend or transmit functionality.

**Verification**:

```bash
grep -n "localhost:8092\|transmit\|hackrf_transfer" src/lib/components/hackrf/TimeFilterDemo.svelte
# Expected: 0 matches
```

### 2.6 hackrf/+page.svelte (123 lines) -- VERIFY/UPDATE

**Risk**: Medium. This is the main HackRF page that may import components and make top-level data fetches.

**Action**: Verify all imports and API calls. If the page fetches transmit status on mount, update to use the new store or endpoint. If it only renders components that have been individually updated, no page-level changes may be needed.

**Verification**:

```bash
grep -n "localhost:8092\|PUBLIC_HACKRF_API_URL\|8092" src/routes/hackrf/+page.svelte
# Expected: 0 matches after verification
```

### 2.7 hackrfsweep/+page.svelte (1830 lines) -- NO CHANGE

**Reason**: This page handles HackRF sweep (receive mode) using `hackrf_sweep` binary through the sweep manager service layer. Completely separate from the transmit path.

**Verification**:

```bash
grep -n "localhost:8092\|transmit\|hackrf_transfer\|start_workflow\|stop_workflow" src/routes/hackrfsweep/+page.svelte
# Expected: 0 matches
```

### 2.8 rfsweep/+page.svelte (2245 lines) -- NO CHANGE

**Reason**: RF sweep page, similar to hackrfsweep. Uses sweep manager, not transmit APIs.

**Verification**:

```bash
grep -n "localhost:8092\|transmit\|hackrf_transfer\|start_workflow\|stop_workflow" src/routes/rfsweep/+page.svelte
# Expected: 0 matches
```

---

## 3. Verify Unaffected Subsystems

The following MUST be verified as completely unaffected by the transmit migration:

| Subsystem                       | File Path                                     | Lines | Reason Unaffected                                                              |
| ------------------------------- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------ |
| HackRF sweep (receive mode)     | `src/lib/services/hackrf/sweep-manager/`      | --    | Uses `hackrf_sweep` binary, not `hackrf_transfer`. Separate service layer.     |
| Tactical map HackRF integration | `src/lib/stores/tactical-map/hackrf-store.ts` | 121   | Reads sweep data, not transmit data. No Python backend references.             |
| USRP API                        | `src/lib/services/hackrf/usrp-api.ts`         | 460   | Separate hardware path. USRP does not go through the Python Flask backend.     |
| WebSocket HackRF service        | `src/lib/services/websocket/hackrf.ts`        | 408   | Handles sweep data streaming over WebSocket. Not related to transmit pipeline. |

**NOTE**: The source document references `hackrfStore.ts` (121 lines). The actual filename is `hackrf-store.ts` (hyphenated). Line count is verified correct at 121 lines.

**Verification for all 4 subsystems**:

```bash
# Verify zero Python backend references in unaffected subsystems
grep -rn "localhost:8092\|HACKRF_EMITTER\|PYTHON_BACKEND\|start_workflow\|stop_workflow" \
  src/lib/services/hackrf/sweep-manager/ \
  src/lib/stores/tactical-map/hackrf-store.ts \
  src/lib/services/hackrf/usrp-api.ts \
  src/lib/services/websocket/hackrf.ts
# Expected: 0 matches
```

---

## Verification Commands

```bash
# Global sweep: no localhost:8092 in any modified component
grep -rn "localhost:8092" \
  src/lib/components/hackrf/AnalysisTools.svelte \
  src/lib/components/hackrf/ConnectionStatus.svelte \
  src/lib/components/hackrf/StatusDisplay.svelte \
  src/routes/hackrf/+page.svelte
# Expected: 0 matches

# Verify "No change" components have no transmit references
for f in SweepControl.svelte TimeFilterDemo.svelte; do
  grep -c "localhost:8092\|transmit\|hackrf_transfer" src/lib/components/hackrf/$f
done
# Expected: 0 for both

# Verify sweep pages unaffected
grep -c "localhost:8092" src/routes/hackrfsweep/+page.svelte src/routes/rfsweep/+page.svelte
# Expected: 0 for both

# Verify unaffected subsystems
grep -rnc "localhost:8092" \
  src/lib/stores/tactical-map/hackrf-store.ts \
  src/lib/services/hackrf/usrp-api.ts \
  src/lib/services/websocket/hackrf.ts
# Expected: 0 for all

# Visual check: navigate to /hackrf in browser, no console errors
# Visual check: navigate to /hackrfsweep, verify sweep functionality works
# Visual check: navigate to /rfsweep, verify RF sweep functionality works

# Typecheck
npm run typecheck

# Build
npm run build
```

---

## Verification Checklist

- [ ] `AnalysisTools.svelte`: `localhost:8092` reference removed from line 14
- [ ] `ConnectionStatus.svelte`: Health check points to `/api/hackrf/transmit/health`
- [ ] `ConnectionStatus.svelte`: Response parsing handles new `{ success, data }` format
- [ ] `StatusDisplay.svelte`: Field names updated to match `TransmitState` interface
- [ ] `StatusDisplay.svelte`: Subscribes to `transmitState` store (recommended)
- [ ] `SweepControl.svelte`: Verified unmodified, no transmit references
- [ ] `TimeFilterDemo.svelte`: Verified unmodified, no transmit references
- [ ] `hackrf/+page.svelte`: Verified or updated, no Python backend references
- [ ] `hackrfsweep/+page.svelte` (1830 lines): Verified unmodified
- [ ] `rfsweep/+page.svelte` (2245 lines): Verified unmodified
- [ ] `tactical-map/hackrf-store.ts` (121 lines): Verified unaffected
- [ ] `hackrf/usrp-api.ts` (460 lines): Verified unaffected
- [ ] `websocket/hackrf.ts` (408 lines): Verified unaffected
- [ ] Sweep manager service layer: Verified unaffected
- [ ] No console errors when navigating to `/hackrf`
- [ ] No console errors when navigating to `/hackrfsweep`
- [ ] No console errors when navigating to `/rfsweep`
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Definition of Done

1. All 3 modified components compile and render without errors
2. No references to `localhost:8092` remain in any component or page file
3. Connection status correctly reports HackRF health via new endpoint
4. Status display shows correct field names from TransmitState
5. Sweep (receive) pages verified completely unaffected (manual navigation test)
6. Tactical map, USRP API, and WebSocket HackRF service verified unaffected
7. `npm run typecheck` and `npm run build` both pass

---

## Cross-References

- **Phase-7.5.01**: API routes that components now call (health, status)
- **Phase-7.5.04**: Frontend API client methods consumed by these components
- **Phase-7.5.05**: `transmitState` store subscribed by StatusDisplay and ConnectionStatus
- **Phase 7.6**: Verification suite includes UI smoke tests
- **Phase 7.7**: Final deletion of Python backend (no more feature flag path)
