# Quickstart: Constitutional Audit Remediation Testing

**Feature**: Constitutional Audit Remediation
**Branch**: `001-audit-remediation`
**Date**: February 13, 2026

## Overview

This quickstart guide provides practical testing scenarios to verify each phase of the constitutional compliance remediation works correctly. Each scenario can be executed independently to validate specific functionality after migration.

---

## Phase 1: Type Safety Validation

### Scenario 1.1: Validate Zod Catches Type Errors (API Responses)

**Goal**: Verify Zod validation catches invalid API responses before they cause crashes

**Prerequisites**:

- P1 migration complete
- Zod schemas created for API responses
- Development server running (`npm run dev`)

**Steps**:

1. **Trigger API call with valid data**:

    ```bash
    curl -X POST http://localhost:5173/api/hackrf/sweep \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${ARGOS_API_KEY}" \
      -d '{"startFreq": 88, "endFreq": 108, "stepSize": 1}'
    ```

    **Expected**: API returns 200 OK with sweep results

2. **Trigger API call with invalid frequency**:

    ```bash
    curl -X POST http://localhost:5173/api/hackrf/sweep \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${ARGOS_API_KEY}" \
      -d '{"startFreq": -100, "endFreq": 108, "stepSize": 1}'
    ```

    **Expected**: API returns 400 Bad Request with Zod validation error:

    ```json
    {
    	"error": "Validation failed",
    	"details": {
    		"startFreq": "Number must be greater than or equal to 0"
    	}
    }
    ```

3. **Check Docker logs for validation details**:

    ```bash
    docker logs argos-dev | grep "\[API\] Validation failed"
    ```

    **Expected**: Console log shows full diagnostic details (error message, failed field, input data, stack trace)

4. **Trigger API call with missing required field**:

    ```bash
    curl -X POST http://localhost:5173/api/hackrf/sweep \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${ARGOS_API_KEY}" \
      -d '{"startFreq": 88}'
    ```

    **Expected**: API returns 400 with error: "endFreq is required"

**Success Criteria**:

- ✅ Valid data passes Zod validation
- ✅ Invalid data fails with descriptive error messages
- ✅ Console logs include full diagnostic details
- ✅ No crashes from undefined/null values

---

### Scenario 1.2: Validate Zod with WebSocket Messages

**Goal**: Verify Zod validation catches malformed WebSocket messages from HackRF FFT stream

**Prerequisites**:

- P1 migration complete
- HackRF hardware connected
- Development server running

**Steps**:

1. **Start HackRF scan** (triggers WebSocket FFT stream):

    ```bash
    curl -X POST http://localhost:5173/api/hackrf/sweep \
      -H "X-API-Key: ${ARGOS_API_KEY}" \
      -d '{"startFreq": 88, "endFreq": 108}'
    ```

2. **Monitor WebSocket connection** in browser DevTools:
    - Open Dashboard: `http://localhost:5173`
    - Open DevTools → Network → WS tab
    - Click "HackRF" panel
    - Verify WebSocket messages arriving

3. **Check console logs for validation**:

    ```bash
    docker logs argos-dev | grep "\[WS\] Signal message received"
    ```

    **Expected**: Logs show successful validation:

    ```
    [WS] Signal message received: frequency=92.5MHz, power=-45.2dBm
    [WS] Signal message received: frequency=93.5MHz, power=-42.1dBm
    ```

4. **Simulate malformed WebSocket message** (for testing, inject via browser console):

    ```javascript
    // In browser DevTools console
    const ws = new WebSocket('ws://localhost:5173/ws/hackrf');
    ws.send(JSON.stringify({ invalid: 'data', missing: 'fields' }));
    ```

5. **Check console logs for validation failure**:

    ```bash
    docker logs argos-dev | grep "\[WS\] Malformed signal message"
    ```

    **Expected**: Warning log with validation error, connection remains stable (no crash)

**Success Criteria**:

- ✅ Valid WebSocket messages pass Zod validation
- ✅ Malformed messages log warnings but don't crash connection
- ✅ Real-time FFT stream continues working after validation errors

---

### Scenario 1.3: Run Constitutional Audit (Post-P1)

**Goal**: Verify compliance score improves from 42% → 60% after P1

**Prerequisites**:

- P1 migration complete
- All 581 type assertions migrated to Zod

**Steps**:

1. **Run constitutional audit**:

    ```bash
    npx tsx scripts/run-audit.ts
    ```

2. **Check compliance report**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/README.md
    ```

    **Expected Output**:

    ```
    # Constitutional Audit Report

    **Compliance Score**: 60.2% (was 42.0%)

    ## Violations by Severity
    - CRITICAL: 10 (unchanged - service layer)
    - HIGH: 0 (was 581 - type assertions FIXED)
    - MEDIUM: 269 (unchanged - hardcoded colors)
    - LOW: 4 (unchanged - component reuse)
    ```

3. **Verify type safety folder shows zero violations**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/03-type-safety-violations/README.md
    ```

    **Expected**: "✅ ALL VIOLATIONS REMEDIATED"

**Success Criteria**:

- ✅ Compliance score ≥ 60%
- ✅ Zero HIGH violations (type assertions)
- ✅ CRITICAL/MEDIUM/LOW unchanged (not affected by P1)

---

## Phase 2: UI Design System Migration

### Scenario 2.1: Visual Regression Baseline Capture

**Goal**: Capture before/after screenshots for Army EW operator approval

**Prerequisites**:

- P2 NOT started yet (capture BEFORE migration)
- Playwright installed
- Development server running

**Steps**:

1. **Capture visual baseline** (6-8 dashboard states):

    ```bash
    npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
    ```

2. **Verify screenshots saved**:

    ```bash
    ls -lh tests/e2e/visual-regression.spec.ts-snapshots/
    ```

    **Expected Files**:
    - `dashboard-default-chromium-linux.png`
    - `dashboard-hackrf-active-chromium-linux.png`
    - `dashboard-kismet-active-chromium-linux.png`
    - `dashboard-gps-active-chromium-linux.png`
    - `dashboard-tactical-map-active-chromium-linux.png`
    - `dashboard-multi-panel-active-chromium-linux.png`
    - `dashboard-error-state-chromium-linux.png` (optional)
    - `dashboard-responsive-chromium-linux.png` (optional)

3. **Review screenshots manually**:
    - Open screenshot files
    - Verify all UI states captured correctly
    - Archive baseline for comparison after P2

**Success Criteria**:

- ✅ 6-8 screenshots captured
- ✅ All dashboard states visible
- ✅ Baseline archived for post-P2 comparison

---

### Scenario 2.2: Shadcn Component Migration Verification

**Goal**: Verify Shadcn components render correctly and maintain functionality

**Prerequisites**:

- P2 migration complete
- Shadcn components installed
- Development server running

**Steps**:

1. **Test Button component** (click handlers work):
    - Navigate to Dashboard: `http://localhost:5173`
    - Click "Start Scan" button (HackRF panel)
    - **Expected**: Button has rounded corners, shadow, modern styling + click triggers scan

2. **Test Input component** (form validation works):
    - Enter invalid frequency: `-100` in Start Frequency input
    - **Expected**: Input shows error state with red border + validation message

3. **Test Card component** (content layout preserved):
    - Verify HackRF panel displays in Card component
    - **Expected**: Card has rounded corners, subtle shadow, content layout identical to before

4. **Test keyboard navigation** (accessibility):
    - Tab through interactive elements
    - **Expected**: Visible focus rings on all buttons/inputs, no keyboard traps

5. **Run visual regression comparison**:

    ```bash
    npx playwright test tests/e2e/visual-regression.spec.ts
    ```

    **Expected**: Playwright shows visual diffs (rounded corners, shadows) but layout/functionality identical

6. **Run accessibility audit**:

    ```bash
    npx playwright test tests/e2e/accessibility.spec.ts
    ```

    **Expected**: Zero WCAG 2.1 AA violations

**Success Criteria**:

- ✅ All Shadcn components render with modern styling
- ✅ All click handlers/form validation work identically
- ✅ Keyboard navigation passes (visible focus rings)
- ✅ WCAG 2.1 AA compliance achieved

---

### Scenario 2.3: Run Constitutional Audit (Post-P2)

**Goal**: Verify compliance score improves from 60% → 68% after P2

**Prerequisites**:

- P2 migration complete
- All 269 hardcoded hex colors replaced with Tailwind theme

**Steps**:

1. **Run constitutional audit**:

    ```bash
    npx tsx scripts/run-audit.ts
    ```

2. **Check compliance report**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/README.md
    ```

    **Expected Output**:

    ```
    # Constitutional Audit Report

    **Compliance Score**: 68.5% (was 60.2%)

    ## Violations by Severity
    - CRITICAL: 10 (unchanged - service layer)
    - HIGH: 0 (unchanged - type assertions already fixed)
    - MEDIUM: 0 (was 269 - hardcoded colors FIXED)
    - LOW: 4 (unchanged - component reuse auto-resolved by Shadcn)
    ```

3. **Verify UI modernization folder shows zero violations**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/01-ui-modernization/README.md
    ```

    **Expected**: "✅ ALL VIOLATIONS REMEDIATED"

**Success Criteria**:

- ✅ Compliance score ≥ 68%
- ✅ Zero MEDIUM violations (hardcoded colors)
- ✅ LOW violations may auto-resolve to 0 (component reuse)

---

## Phase 3: Service Layer Refactor

### Scenario 3.1: Kismet WebSocket Connection (Phase 1 of 7)

**Goal**: Verify Kismet WebSocket works after migrating from service layer to feature module

**Prerequisites**:

- P3 Phase 1 complete (Kismet migrated to `src/lib/kismet/`)
- Alfa WiFi adapter connected
- Kismet service running (`npm run kismet:start`)
- Development server running

**Steps**:

1. **Start Kismet scan**:
    - Navigate to Dashboard: `http://localhost:5173`
    - Click "Kismet" panel
    - Click "Start Scan"

2. **Verify WebSocket connection**:
    - Open DevTools → Network → WS tab
    - **Expected**: WebSocket connection to `/ws/kismet` established

3. **Verify WiFi networks display**:
    - **Expected**: List of WiFi networks populates in real-time
    - SSID, BSSID, signal strength, encryption type displayed

4. **Check import paths**:

    ```bash
    grep -r "from.*services.*kismet" src/
    ```

    **Expected**: No results (all imports now from `src/lib/kismet/`)

5. **Run integration tests**:

    ```bash
    npm run test:integration -- tests/integration/websocket/kismet.test.ts
    ```

    **Expected**: All tests pass

**Success Criteria**:

- ✅ Kismet WebSocket connection works identically
- ✅ WiFi networks display in real-time
- ✅ No broken imports from old service layer
- ✅ Integration tests pass

---

### Scenario 3.2: HackRF FFT Stream (Phase 2 of 7)

**Goal**: Verify HackRF FFT stream works after migrating to feature module

**Prerequisites**:

- P3 Phase 2 complete (HackRF migrated to `src/lib/hackrf/`)
- HackRF hardware connected
- Development server running

**Steps**:

1. **Start HackRF scan**:
    - Navigate to Dashboard
    - Click "HackRF" panel
    - Enter frequency range: 88-108 MHz (FM broadcast)
    - Click "Start Scan"

2. **Verify FFT stream displays**:
    - **Expected**: Real-time FFT waterfall display updates
    - Signal peaks visible at broadcast frequencies (e.g., 92.5, 98.7)

3. **Check WebSocket data flow**:
    - Open DevTools → Network → WS tab
    - **Expected**: WebSocket messages arriving at ~30-60 Hz

4. **Verify import paths**:

    ```bash
    grep -r "from.*services.*hackrf" src/
    ```

    **Expected**: No results (all imports now from `src/lib/hackrf/`)

5. **Run integration tests**:

    ```bash
    npm run test:integration -- tests/integration/websocket/hackrf.test.ts
    ```

    **Expected**: All tests pass

**Success Criteria**:

- ✅ HackRF FFT stream works identically
- ✅ Real-time visualization updates at 30-60 Hz
- ✅ No broken imports
- ✅ Integration tests pass

---

### Scenario 3.3: GPS Positioning (Phase 3 of 7)

**Goal**: Verify GPS positioning works after migrating to feature module

**Prerequisites**:

- P3 Phase 3 complete (GPS migrated to `src/lib/gps/`)
- GPS receiver connected
- GPS has fix (clear sky view)
- Development server running

**Steps**:

1. **Open GPS panel**:
    - Navigate to Dashboard
    - Click "GPS" panel

2. **Verify GPS position displays**:
    - **Expected**: Latitude, longitude, altitude, speed displayed
    - Position updates every 1-5 seconds

3. **Verify tactical map integration**:
    - Click "Tactical Map" panel
    - **Expected**: Blue marker shows current GPS position on map

4. **Check import paths**:

    ```bash
    grep -r "from.*services.*gps" src/
    ```

    **Expected**: No results (all imports now from `src/lib/gps/`)

5. **Run integration tests**:

    ```bash
    npm run test:integration -- tests/integration/api/gps.test.ts
    ```

    **Expected**: All tests pass

**Success Criteria**:

- ✅ GPS positioning works identically
- ✅ Position updates in real-time
- ✅ Tactical map shows GPS marker
- ✅ No broken imports
- ✅ Integration tests pass

---

### Scenario 3.4: Run Constitutional Audit (Post-P3)

**Goal**: Verify compliance score improves from 68% → 70%+ after P3

**Prerequisites**:

- P3 all 7 phases complete
- `src/lib/services/` directory deleted

**Steps**:

1. **Verify service layer directory deleted**:

    ```bash
    ls src/lib/services/
    ```

    **Expected**: `ls: cannot access 'src/lib/services/': No such file or directory`

2. **Run constitutional audit**:

    ```bash
    npx tsx scripts/run-audit.ts
    ```

3. **Check compliance report**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/README.md
    ```

    **Expected Output**:

    ```
    # Constitutional Audit Report

    **Compliance Score**: 70.8% (was 68.5%)

    ## Violations by Severity
    - CRITICAL: 0 (was 10 - service layer FIXED)
    - HIGH: 0 (was 0 - already fixed)
    - MEDIUM: 0 (was 0 - already fixed)
    - LOW: 4 (unchanged - component reuse, explicitly out of scope)
    ```

4. **Verify service layer folder shows zero violations**:

    ```bash
    cat docs/reports/$(ls -t docs/reports/ | head -1)/02-service-layer-violations/README.md
    ```

    **Expected**: "✅ ALL VIOLATIONS REMEDIATED"

**Success Criteria**:

- ✅ Compliance score ≥ 70%
- ✅ Zero CRITICAL violations (service layer)
- ✅ `src/lib/services/` directory deleted
- ✅ All feature modules working

---

## Full End-to-End Workflow Test (Post-P3)

### Scenario E2E: Complete Spectrum Scan Workflow

**Goal**: Verify entire user workflow works after all three phases complete

**Prerequisites**:

- All phases P1, P2, P3 complete
- HackRF, Kismet, GPS hardware connected
- Development server running

**Steps**:

1. **Navigate to Dashboard**: `http://localhost:5173`

2. **Start HackRF scan** (type safety + UI + service layer):
    - Click "HackRF" panel (Shadcn Card component)
    - Enter frequency range: 88-108 MHz (Shadcn Input components, Zod validation)
    - Click "Start Scan" (Shadcn Button component)
    - **Expected**: FFT stream displays (WebSocket from `src/lib/hackrf/websocket.ts`)

3. **Start Kismet scan** (type safety + UI + service layer):
    - Click "Kismet" panel
    - Click "Start Scan"
    - **Expected**: WiFi networks list populates (WebSocket from `src/lib/kismet/websocket.ts`)

4. **View GPS position** (type safety + UI + service layer):
    - Click "GPS" panel
    - **Expected**: GPS position displays (API from `src/lib/gps/api.ts`)

5. **Verify tactical map** (type safety + service layer):
    - Click "Tactical Map" panel
    - **Expected**: Map shows GPS marker + WiFi network markers (from `src/lib/tactical-map/`)

6. **Test error handling** (type safety):
    - Enter invalid frequency: `-100`
    - Click "Start Scan"
    - **Expected**: Zod validation error displays in toast notification (Shadcn component)
    - **Expected**: Console log shows validation details

7. **Verify all UI states** (UI migration):
    - Empty state: No signals detected
    - Loading state: Scanning...
    - Success state: Signals displayed
    - Error state: Validation error toast

**Success Criteria**:

- ✅ All hardware modules work (HackRF, Kismet, GPS)
- ✅ All UI components use Shadcn (modern styling)
- ✅ All data validated with Zod (runtime safety)
- ✅ All code organized by feature (no service layer)
- ✅ Zero crashes, zero regressions
- ✅ Compliance score ≥ 70%

---

## Verification Checklist

After completing all phases, run this checklist to verify everything works:

```bash
# 1. Type safety (P1)
npm run typecheck
# Expected: 0 errors

# 2. Code quality (P1, P2, P3)
npm run lint
# Expected: 0 warnings, 0 errors

# 3. Unit tests (P1, P2, P3)
npm run test:unit
# Expected: All tests pass

# 4. Integration tests (P1, P2, P3)
npm run test:integration
# Expected: All tests pass

# 5. E2E tests (P2, P3)
npm run test:e2e
# Expected: All tests pass

# 6. Visual regression (P2)
npx playwright test tests/e2e/visual-regression.spec.ts
# Expected: Intentional diffs only (rounded corners, shadows)

# 7. Accessibility (P2)
npx playwright test tests/e2e/accessibility.spec.ts
# Expected: 0 WCAG violations

# 8. Constitutional audit (P1, P2, P3)
npx tsx scripts/run-audit.ts
# Expected: Compliance ≥ 70%

# 9. Build verification (P1, P2, P3)
npm run build
# Expected: Build succeeds, bundle size increase < 5%

# 10. Performance benchmarks (P1, P2)
npx tsx scripts/benchmark-zod-validation.ts
# Expected: < 5ms per validation
npx tsx scripts/benchmark-shadcn-render.ts
# Expected: < 16ms per render
```

---

## Troubleshooting

### P1 Issues

**Issue**: Zod validation errors flooding console

- **Fix**: Adjust log levels, use `.safeParse()` for non-critical paths

**Issue**: TypeScript errors after Zod migration

- **Fix**: Use `z.infer<typeof Schema>` for type extraction

### P2 Issues

**Issue**: Shadcn components don't match cyberpunk theme

- **Fix**: Customize `tailwind.config.js` theme colors

**Issue**: Visual regression tests fail

- **Fix**: Review diffs, update baseline if intentional changes

### P3 Issues

**Issue**: WebSocket connections break after migration

- **Fix**: Revert phase commit, check import paths, verify WebSocket base code

**Issue**: Circular dependencies between feature modules

- **Fix**: Extract shared code to `src/lib/server/` or inline into modules

---

## Summary

This quickstart provides practical, executable test scenarios for each phase:

- **P1 (Type Safety)**: API validation, WebSocket validation, audit verification
- **P2 (UI Migration)**: Visual baseline, Shadcn components, accessibility
- **P3 (Service Layer)**: Feature module migration (7 phases), WebSocket verification

Run these scenarios after each phase to ensure compliance remediation succeeds without regressions.
