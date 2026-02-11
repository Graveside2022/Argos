# TypeScript Error Fix - Verification Checklist

**Purpose**: Pass/fail criteria for each phase
**Rule**: Do NOT proceed to next phase until current phase passes ALL checks

---

## Pre-Flight Checks (Before Starting)

### ✅ Checkpoint 0: Baseline State

- [ ] Record current error count

    ```bash
    npm run typecheck 2>&1 | tee /tmp/baseline_errors.txt
    npm run typecheck 2>&1 | grep "found.*errors" | tee /tmp/baseline_count.txt
    ```

    **Expected**: `svelte-check found 72 errors and 21 warnings in 28 files`

- [ ] Verify git status is clean or committed

    ```bash
    git status
    ```

    **Expected**: No uncommitted changes OR all changes committed

- [ ] Create working branch

    ```bash
    git checkout -b fix/typescript-errors-phase-1
    ```

    **Expected**: `Switched to a new branch 'fix/typescript-errors-phase-1'`

- [ ] Backup current state
    ```bash
    git branch backup/before-typescript-fixes
    ```
    **Expected**: Backup branch created

---

## Phase 1: Type Definitions

### ✅ Checkpoint 1.1: File Creation

- [ ] Create `src/lib/types/service-responses.ts`

    ```bash
    test -f src/lib/types/service-responses.ts && echo "✓ File exists" || echo "✗ File missing"
    ```

    **Expected**: `✓ File exists`

- [ ] Verify file has all required exports
    ```bash
    grep -c "export interface" src/lib/types/service-responses.ts
    ```
    **Expected**: `4` (KismetStatusResponse, ServiceHealthResponse, GPSStateResponse, HackRFStatusResponse)

### ✅ Checkpoint 1.2: Interface Modifications

- [ ] Verify KismetDevice has index signature

    ```bash
    grep -A2 "interface KismetDevice" src/lib/types/kismet.ts | grep "\[key: string\]"
    ```

    **Expected**: Match found for `[key: string]: any;`

- [ ] Verify KismetState has message property

    ```bash
    grep "message?" src/lib/types/kismet.ts
    ```

    **Expected**: Match found for `message?: string;`

- [ ] Verify GPSState has new properties

    ```bash
    grep -E "(accuracy|heading|speed)\?:" src/lib/types/gps.ts | wc -l
    ```

    **Expected**: `3` (three properties found)

- [ ] Verify SignalMetadata has index signature

    ```bash
    grep "\[key: string\]:" src/lib/types/signal.ts | grep "SignalMetadata" -A5
    ```

    **Expected**: Match found

- [ ] Verify SignalMarker has altitude and position
    ```bash
    grep -E "(altitude|position)\?:" src/lib/types/signal.ts | wc -l
    ```
    **Expected**: `2` (both properties found)

### ✅ Checkpoint 1.3: Enum Update

- [ ] Verify AuthEventType has RATE_LIMIT_EXCEEDED

    ```bash
    grep "RATE_LIMIT_EXCEEDED" src/lib/server/security/auth-audit.ts
    ```

    **Expected**: Match found in enum

- [ ] Verify AuthAuditRecord has index signature
    ```bash
    grep "\[key: string\]: unknown" src/lib/server/security/auth-audit.ts
    ```
    **Expected**: Match found

### ✅ Checkpoint 1.4: Type Check After Phase 1

- [ ] Run typecheck and count errors

    ```bash
    npm run typecheck 2>&1 | grep "found.*errors"
    ```

    **Expected**: `svelte-check found 64 errors` (down from 72)
    **Fixes**: 8 errors (5 auth + 2 hooks.server + 1 status comparison)

- [ ] Verify specific fixes
    ```bash
    npm run typecheck 2>&1 | grep -c "RATE_LIMIT_EXCEEDED.*not assignable"
    ```
    **Expected**: `0` (error no longer appears)

### ✅ Checkpoint 1.5: Build Still Works

- [ ] Verify build doesn't break
    ```bash
    npm run build 2>&1 | tail -1
    ```
    **Expected**: Contains `✓ built in` (no errors)

### ✅ Checkpoint 1.6: Commit Phase 1

- [ ] Commit changes

    ```bash
    git add src/lib/types/ src/lib/server/security/auth-audit.ts
    git commit -m "fix(types): add missing type definitions (Phase 1/4)

    - Create service-responses.ts with KismetStatusResponse, GPSStateResponse
    - Add index signatures to KismetDevice, AuthAuditRecord, SignalMetadata
    - Add RATE_LIMIT_EXCEEDED to AuthEventType enum
    - Extend GPSState with accuracy, heading, speed
    - Extend SignalMarker with altitude, position

    Fixes: 8/72 errors (auth + hooks.server)
    Remaining: 64 errors

    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    ```

    **Expected**: Commit successful

---

## Phase 2: Service Methods

### ✅ Checkpoint 2.1: Import Statements

- [ ] Verify service imports new types
    ```bash
    grep "KismetStatusResponse" src/lib/services/kismet/kismet-service.ts
    ```
    **Expected**: Import statement found

### ✅ Checkpoint 2.2: Method Signatures

- [ ] Verify getStatus() return type

    ```bash
    grep -A1 "async getStatus()" src/lib/services/kismet/kismet-service.ts | grep "Promise<KismetStatusResponse>"
    ```

    **Expected**: Match found

- [ ] Verify method returns correct shape
    ```bash
    grep -A20 "return {" src/lib/services/kismet/kismet-service.ts | grep -E "(running|uptime|interface|deviceCount|metrics|channels)"
    ```
    **Expected**: All properties found

### ✅ Checkpoint 2.3: Type Check After Phase 2

- [ ] Run typecheck

    ```bash
    npm run typecheck 2>&1 | grep "found.*errors"
    ```

    **Expected**: Still `64 errors` (service changes don't fix errors yet, but enable Phase 3)

- [ ] Verify no NEW errors introduced
    ```bash
    npm run typecheck 2>&1 | wc -l > /tmp/phase2_errors.txt
    diff /tmp/baseline_errors.txt /tmp/phase2_errors.txt
    ```
    **Expected**: Error count same or lower, no new files with errors

### ✅ Checkpoint 2.4: Build Still Works

- [ ] Verify build
    ```bash
    npm run build 2>&1 | tail -1
    ```
    **Expected**: `✓ built in`

### ✅ Checkpoint 2.5: Commit Phase 2

- [ ] Commit changes

    ```bash
    git add src/lib/services/kismet/
    git commit -m "fix(services): update KismetService return types (Phase 2/4)

    - Change getStatus() return type to Promise<KismetStatusResponse>
    - Ensure getDevices() returns KismetDevice[] with index signature
    - Import service-responses types

    Fixes: 0 errors (enables Phase 3)
    Remaining: 64 errors

    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    ```

---

## Phase 3: API Endpoints

### ✅ Checkpoint 3.1: Status Endpoint

- [ ] Verify await added

    ```bash
    grep "const status = await kismetService.getStatus()" src/routes/api/kismet/status/+server.ts
    ```

    **Expected**: Match found (not missing await)

- [ ] Verify property access is direct (not on Promise)
    ```bash
    grep "status.running" src/routes/api/kismet/status/+server.ts | wc -l
    ```
    **Expected**: At least 3 occurrences

### ✅ Checkpoint 3.2: Devices Endpoint

- [ ] Verify await added

    ```bash
    grep "const status = await kismetService.getStatus()" src/routes/api/kismet/devices/+server.ts
    ```

    **Expected**: Match found

- [ ] Verify type assertion removed
    ```bash
    grep "as Record<string, unknown>" src/routes/api/kismet/devices/+server.ts
    ```
    **Expected**: No match (assertion removed)

### ✅ Checkpoint 3.3: Type Check After Phase 3

- [ ] Run typecheck

    ```bash
    npm run typecheck 2>&1 | grep "found.*errors"
    ```

    **Expected**: `svelte-check found 50 errors` (down from 64)
    **Fixes**: 14 errors (10 status + 4 devices)

- [ ] Verify specific fixes
    ```bash
    npm run typecheck 2>&1 | grep "Property.*does not exist on type 'Promise" | wc -l
    ```
    **Expected**: `0` (Promise errors gone from these files)

### ✅ Checkpoint 3.4: Build Still Works

- [ ] Verify build
    ```bash
    npm run build
    ```
    **Expected**: Successful build

### ✅ Checkpoint 3.5: Runtime Test (Optional but Recommended)

- [ ] Start dev server

    ```bash
    npm run dev &
    sleep 5
    ```

- [ ] Test status endpoint

    ```bash
    curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status | jq .
    ```

    **Expected**: JSON response with running, interface, deviceCount properties

- [ ] Test devices endpoint

    ```bash
    curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/devices | jq .
    ```

    **Expected**: JSON response with devices array and status object

- [ ] Stop dev server
    ```bash
    pkill -f "vite.*dev"
    ```

### ✅ Checkpoint 3.6: Commit Phase 3

- [ ] Commit changes

    ```bash
    git add src/routes/api/kismet/
    git commit -m "fix(api): await Kismet service calls in endpoints (Phase 3/4)

    - Add await to kismetService.getStatus() in status/+server.ts
    - Add await to kismetService.getStatus() in devices/+server.ts
    - Remove unnecessary type assertions

    Fixes: 14/72 errors (status + devices Promise property access)
    Remaining: 50 errors

    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    ```

---

## Phase 4: Stores & Single Fixes

### ✅ Checkpoint 4.1: Agent Context Store

- [ ] Verify store compiles without bracket notation errors

    ```bash
    npm run typecheck 2>&1 | grep "agent-context-store" | grep "bracket notation" | wc -l
    ```

    **Expected**: `0` (bracket notation errors gone)

- [ ] Fix status comparison
    ```bash
    grep "status === 'running'" src/lib/stores/dashboard/agent-context-store.ts
    ```
    **Expected**: Match found (changed from 'connected')

### ✅ Checkpoint 4.2: Single File Fixes

- [ ] Fix kismet/start unused parameter

    ```bash
    grep "({ _url })" src/routes/api/kismet/start/+server.ts
    ```

    **Expected**: No match (parameter removed)

- [ ] Fix kismet/proxy signal property

    ```bash
    npm run typecheck 2>&1 | grep "kismet-proxy.*Type.*not assignable"
    ```

    **Expected**: No match (error fixed)

- [ ] Fix DashboardMap argument count
    ```bash
    npm run typecheck 2>&1 | grep "DashboardMap.*Expected 6"
    ```
    **Expected**: No match (6th argument added)

### ✅ Checkpoint 4.3: Type Check After Phase 4

- [ ] Run typecheck

    ```bash
    npm run typecheck 2>&1 | grep "found.*errors"
    ```

    **Expected**: `svelte-check found 29 errors` or lower (only test files)

- [ ] Verify production code is clean
    ```bash
    npm run typecheck 2>&1 | grep "src/" | grep -v "tests/" | wc -l
    ```
    **Expected**: `0` or very low (< 5)

### ✅ Checkpoint 4.4: Build Still Works

- [ ] Full build
    ```bash
    npm run build
    ```
    **Expected**: Successful

### ✅ Checkpoint 4.5: Full Test Suite (Optional)

- [ ] Run unit tests

    ```bash
    npm run test:unit
    ```

    **Expected**: Tests pass (or known failures documented)

- [ ] Run integration tests
    ```bash
    npm run test:integration
    ```
    **Expected**: Tests pass or skipped

### ✅ Checkpoint 4.6: Commit Phase 4

- [ ] Commit changes

    ```bash
    git add src/lib/stores/ src/lib/components/ src/routes/
    git commit -m "fix(stores): fix agent-context-store and single-file errors (Phase 4/4)

    - Fix status comparison in agent-context-store (running vs connected)
    - Remove unused _url parameter in kismet/start
    - Fix signal property type in kismet-proxy
    - Add missing argument in DashboardMap spreadClientPosition

    Fixes: 21/72 errors
    Total fixed: 43/72 production code errors
    Remaining: 29 errors (test files only)

    Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    ```

---

## Final Verification

### ✅ Checkpoint F.1: Error Reduction

- [ ] Compare before/after
    ```bash
    echo "BEFORE: 72 errors"
    npm run typecheck 2>&1 | grep "found.*errors"
    ```
    **Expected**: `svelte-check found 29 errors` (60% reduction)

### ✅ Checkpoint F.2: Production Code Clean

- [ ] Verify no production errors
    ```bash
    npm run typecheck 2>&1 | grep "src/" | grep -v "tests/" | grep "Error:"
    ```
    **Expected**: No output (all production errors fixed)

### ✅ Checkpoint F.3: Build Success

- [ ] Full clean build
    ```bash
    rm -rf .svelte-kit build
    npm run build
    ```
    **Expected**: Build succeeds

### ✅ Checkpoint F.4: Lint Check

- [ ] Run linter
    ```bash
    npm run lint
    ```
    **Expected**: No new lint errors (warnings acceptable)

### ✅ Checkpoint F.5: Git History Clean

- [ ] Review commit history

    ```bash
    git log --oneline | head -5
    ```

    **Expected**: 4-5 commits for phases 1-4

- [ ] Verify all changes staged
    ```bash
    git status
    ```
    **Expected**: Working tree clean

---

## Merge to Dev Branch

### ✅ Checkpoint M.1: Final Tests

- [ ] All verification checkpoints passed
- [ ] Documentation updated in /plans/issues/

### ✅ Checkpoint M.2: Merge

- [ ] Switch to dev_branch

    ```bash
    git checkout dev_branch
    ```

- [ ] Merge feature branch

    ```bash
    git merge --no-ff fix/typescript-errors-phase-1
    ```

    **Expected**: Merge successful

- [ ] Final typecheck on dev_branch

    ```bash
    npm run typecheck 2>&1 | grep "found.*errors"
    ```

    **Expected**: `29 errors` (test files only)

- [ ] Push to remote
    ```bash
    git push origin dev_branch
    ```

---

## Success Criteria Summary

| Phase         | Expected Errors | Key Fixes                         |
| ------------- | --------------- | --------------------------------- |
| Baseline      | 72              | N/A                               |
| After Phase 1 | 64              | Type definitions                  |
| After Phase 2 | 64              | Service methods (enables Phase 3) |
| After Phase 3 | 50              | API endpoints                     |
| After Phase 4 | 29              | Stores + singles                  |
| **FINAL**     | **29**          | **Production code: 0 errors**     |

---

## Rollback Procedures

If any checkpoint fails, see ROLLBACK_PLAN.md for recovery steps.
