# Phase 7.7: Deletion, Cleanup, and Post-Migration Validation

**Risk Level**: HIGH -- Irreversible file deletion. Git tag required before execution.
**Prerequisites**: Phase 7.6 ALL gates passed (every test green)
**Estimated Files Deleted**: 45 project files
**Estimated Lines Removed**: ~12,182 hand-written lines
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Remove all Python backend code, React frontend code, and associated infrastructure now that the
TypeScript replacement has passed all verification gates.

---

## CORRECTED DELETION METRICS

The original Phase 7 plan contained the following false claims about deletion scope:

| Metric               | Original Claim      | Actual Value                              | Correction          |
| -------------------- | ------------------- | ----------------------------------------- | ------------------- |
| Startup script lines | ~19,000             | 689 (start.sh=495, start_services.sh=194) | 27.6x overstatement |
| Total lines removed  | ~30,000+            | ~12,182 hand-written lines                | 2.5x overstatement  |
| Files deleted        | ~25                 | 45 project files (excl. vendored)         | 1.8x understatement |
| Dockerfile target    | "docker/Dockerfile" | `hackrf_emitter/backend/Dockerfile`       | Wrong file          |

### Corrected Deletion Inventory

| Category                | Files   | Lines                                       |
| ----------------------- | ------- | ------------------------------------------- |
| Python backend (.py)    | 21      | 7,913                                       |
| React frontend (src/)   | 12      | 2,304                                       |
| Shell scripts           | 3       | 723                                         |
| Documentation           | 2       | 661                                         |
| Configuration           | 6       | 433                                         |
| Frontend config/build   | 5       | 17,830 (mostly generated package-lock.json) |
| Backend non-code        | 5       | 230                                         |
| **Total project files** | **45**  | **~29,990**                                 |
| **Total hand-written**  | **~40** | **~12,182**                                 |

---

## Pre-Deletion Safety

### Task 7.7.1: Create Git Tag

**This MUST execute before any file deletion.**

```bash
# Tag the last commit containing Python code
git tag -a pre-python-removal -m "Last commit containing hackrf_emitter Python backend and React frontend. Restore with: git checkout pre-python-removal -- hackrf_emitter/"

# Verify tag
git tag -l 'pre-python-removal'
git show pre-python-removal --stat | head -5
```

### Task 7.7.2: Final Gate Verification

Re-run ALL Phase 7.6 gates one final time immediately before deletion:

```bash
# Unit tests
npm run test:unit -- tests/unit/hackrf/ --reporter=verbose

# Integration tests
npm run test:integration -- tests/integration/hackrf-transmit.test.ts

# Type check
npm run typecheck

# Build
npm run build
```

**If ANY test fails at this point, ABORT the deletion. Do NOT proceed.**

---

## Deletion Sequence

Execute in the following order. Each step is atomic and can be committed individually.

### Task 7.7.3: Delete React Frontend

```bash
rm -rf hackrf_emitter/frontend/
```

**Files removed** (12 source files + config, 2,304 source lines + 17,705 package-lock.json):

- `hackrf_emitter/frontend/src/` (13 source files)
- `hackrf_emitter/frontend/public/` (2 files)
- `hackrf_emitter/frontend/package.json`
- `hackrf_emitter/frontend/package-lock.json`
- `hackrf_emitter/frontend/postcss.config.js`
- `hackrf_emitter/frontend/tailwind.config.js`
- `hackrf_emitter/frontend/tsconfig.json`

### Task 7.7.4: Delete Python Backend

```bash
# Delete backend source (excluding .venv which is in .gitignore)
rm -rf hackrf_emitter/backend/rf_workflows/
rm -rf hackrf_emitter/backend/utils/
rm hackrf_emitter/backend/app.py
rm hackrf_emitter/backend/sweep_bridge.py
rm hackrf_emitter/backend/initialize_cache.py
rm hackrf_emitter/backend/simple_test.py
rm hackrf_emitter/backend/__init__.py
rm hackrf_emitter/backend/Dockerfile
rm hackrf_emitter/backend/requirements.txt
rm hackrf_emitter/backend/README.md
rm hackrf_emitter/backend/.dockerignore
rm hackrf_emitter/backend/run_cache_init.sh
rm hackrf_emitter/backend/package-lock.json
```

**Files removed**: 28 files, 7,913 Python source lines

**NOTE**: The original plan listed `config/settings.json` (62 lines) in the backend inventory.
This file does not exist in the live codebase. No action needed for config/ directory.

### Task 7.7.5: Delete Python Virtual Environment

```bash
rm -rf hackrf_emitter/backend/.venv/
```

**Disk space freed**: ~270 MB, 6,749 files

### Task 7.7.6: Delete Root-Level hackrf_emitter Files

```bash
rm hackrf_emitter/start.sh
rm hackrf_emitter/start_services.sh
rm hackrf_emitter/.gitignore
rm hackrf_emitter/README.md
rm hackrf_emitter/pyproject.toml
rm hackrf_emitter/pyrightconfig.json
rm -rf hackrf_emitter/.vscode/
```

### Task 7.7.7: Delete Empty hackrf_emitter Directory

```bash
# Verify directory is empty (or contains only .venv remnants)
find hackrf_emitter/ -type f | head -5
# If empty:
rm -rf hackrf_emitter/
```

### Task 7.7.8: Remove hackrf-backend from Docker Compose

**File**: `docker/docker-compose.portainer-dev.yml`

Delete the entire `hackrf-backend` service block (lines 77-105):

```yaml
# DELETE THIS ENTIRE BLOCK:
hackrf-backend:
    image: argos-hackrf-backend:dev
    container_name: hackrf-backend-dev
    mem_limit: 256m
    memswap_limit: 384m
    ports:
        - '8092:8092'
    environment:
        - PYTHONUNBUFFERED=1
        - FLASK_ENV=development
        - FLASK_DEBUG=1
    devices:
        - '/dev/bus/usb:/dev/bus/usb'
    volumes:
        - ${ARGOS_DIR:?Run setup-host.sh first}/hackrf_emitter/backend:/app:rw
    privileged: true
    networks:
        - argos-dev-network
    restart: unless-stopped
    command: ['python', '-m', 'flask', 'run', '--host=0.0.0.0', '--port=8092', '--reload']
```

Also remove these environment variables from the main argos-dev service:

```yaml
# DELETE THESE LINES:
- PUBLIC_HACKRF_API_URL=http://localhost:8092
- PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
- PUBLIC_HACKRF_WS_URL=ws://localhost:8092
```

### Task 7.7.9: Delete Proxy Catch-All Route

**File**: `src/routes/api/hackrf/[...path]/+server.ts` (102 lines)

This file proxied all unmatched `/api/hackrf/*` requests to `http://localhost:3002`. After migration,
the explicit route files in `src/routes/api/hackrf/transmit/` handle all endpoints. The catch-all
is dead code.

```bash
rm -rf src/routes/api/hackrf/\[...path\]/
```

### Task 7.7.10: Clean Up auto_sweep.sh Reference

**File**: `src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh`

Remove the sweep_bridge.py fallback block (lines ~60-70) that references the deleted Python file:

```bash
# DELETE THIS BLOCK from auto_sweep.sh:
SWEEP_BRIDGE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../../../../../hackrf_emitter/backend/sweep_bridge.py"
if [ -f "$SWEEP_BRIDGE" ] && python3 -c "from python_hackrf import pyhackrf_sweep" 2>/dev/null; then
    echo "Using python-hackrf sweep bridge..."
    exec python3 "$SWEEP_BRIDGE" "$@"
fi
```

### Additional sweep_bridge.py Reference (Independent Audit Addition)

**File**: `src/lib/server/hackrf/sweepManager.ts` (lines 949-951)

```typescript
// Kill any sweep_bridge.py processes (python_hackrf sweep bridge)
await new Promise<void>((resolve) => {
	exec('pkill -9 -f sweep_bridge.py', () => resolve());
});
```

This process kill command references `sweep_bridge.py` which will no longer exist after deletion.
**Action**: Remove the sweep_bridge.py kill block from sweepManager.ts. The remaining `hackrf_sweep`
process kill (which uses the native binary) should be preserved.

### Task 7.7.11: Update package.json Kill Script

**File**: `package.json`

Update the `kill-all` script to remove the Python process kill:

Current:

```json
"kill-all": "pkill -f 'npm.*run.*dev' 2>/dev/null || true; pkill -f 'python.*app.py' 2>/dev/null || true; pkill -f 'npm.*start.*3000' 2>/dev/null || true"
```

Updated:

```json
"kill-all": "pkill -f 'npm.*run.*dev' 2>/dev/null || true"
```

### Task 7.7.12: Clean Script References

Search all scripts in `scripts/` for references to:

- `hackrf_emitter`
- `python.*app.py`
- Port 8092 in hackrf context
- `hackrf-backend` Docker container

For each reference found:

1. If the script is in a "development" or "startup" category, update to remove the Python backend
2. If the script is in an "installation" category, remove the hackrf-backend Docker build step
3. If the script is dead (no longer needed), mark for deletion in Phase 6

**Known scripts requiring updates** (from Phase 7.1 investigation):

| Script                                      | Reference                          | Action                              |
| ------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `scripts/development/start-all-services.sh` | Starts Python backend              | Remove hackrf-backend startup block |
| `scripts/dev/start-all-services.sh`         | Duplicate of above                 | Same                                |
| `scripts/development/auto-start-hackrf.sh`  | Checks for Python process          | Remove Python process check         |
| `scripts/dev/auto-start-hackrf.sh`          | Duplicate of above                 | Same                                |
| `scripts/setup-host.sh`                     | Builds hackrf-backend Docker image | Remove Docker build step            |
| `scripts/docker-automation.sh`              | Port 8092 mapping                  | Remove hackrf-backend references    |

### Additional References Not in Original Plan (Independent Audit Addition)

| File                                  | Reference                                         | Action                                                          |
| ------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| `static/script.js` line 7             | `http://${window.location.hostname}:3002`         | Update to use `/api/hackrf/transmit` or remove if dead code     |
| `static/api-config.js` line 2         | `http://100.68.185.86:3002` (hardcoded IP + port) | Remove or update. Hardcoded IP is a deployment hazard.          |
| `src/lib/constants/limits.ts` line 28 | `HACKRF_CONTROL: 3002`                            | Update constant to reflect new architecture or remove if unused |

### Task 7.7.13: Decision on usrp_sweep.py

**File**: `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py` (146 lines)

This Python file is INSIDE the SvelteKit source tree. It uses `numpy` and `gnuradio` for USRP
spectrum sweeping. It is NOT part of `hackrf_emitter/` and serves a different purpose (receive, not transmit).

**Decision**: DO NOT DELETE. This file supports USRP hardware which requires Python + gnuradio
regardless of the hackrf_emitter migration. Document that USRP sweep remains a Python dependency.

Add a comment at the top of the file:

```python
# NOTE: This file intentionally remains as Python. It requires gnuradio which
# has no TypeScript equivalent. USRP sweep support requires Python 3 + gnuradio
# installed on the host system. See Phase 7 migration documentation.
```

---

## Post-Deletion Verification

### Task 7.7.14: Verify No Python Files in Active Codebase

```bash
# Find any remaining .py files (excluding vendored, archived, and plans)
find . -name "*.py" -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.venv/*' \
  -not -path '*/archive/*' \
  -not -path '*/_archived/*' \
  -not -path '*/plans/*' \
  -not -path '*/__pycache__/*'
```

**Expected remaining Python files**:

- `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py` (USRP support, intentionally kept)
- Any GSM Evil Python scripts (separate subsystem, not part of this migration)

All other `.py` files should be gone.

### Task 7.7.15: Verify hackrf_emitter Directory Removed

```bash
test -d hackrf_emitter && echo "FAIL: hackrf_emitter still exists" || echo "PASS: hackrf_emitter removed"
```

### Task 7.7.16: Verify Docker Compose Valid

```bash
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
echo "Docker compose validation: $?"
```

### Task 7.7.17: Verify Application Builds and Runs

```bash
# Build
npm run build

# Start preview server
npm run preview &
sleep 5

# Test health endpoint (do not use python3 -- may not be available after cleanup)
curl -sf http://localhost:4173/api/hackrf/transmit/health && echo "PASS: health endpoint responds" || echo "FAIL: health endpoint unreachable"

# Test status endpoint
curl -sf http://localhost:4173/api/hackrf/transmit/status && echo "PASS: status endpoint responds" || echo "FAIL: status endpoint unreachable"

# Kill preview server
kill %1
```

### Task 7.7.18: Verify No Stale References

```bash
# Check for any remaining references to deleted paths
grep -rn "hackrf_emitter" src/ --include='*.ts' --include='*.svelte' --include='*.js' | grep -v node_modules
# Must return 0 results

# Check for remaining port references
grep -rn "localhost:8092" src/ --include='*.ts' --include='*.svelte' | grep -v node_modules
# Must return 0 results (feature flag path removed in Task 7.7.9)

# Check for remaining proxy references
grep -rn "localhost:3002" src/ --include='*.ts' --include='*.svelte' | grep -v node_modules
# Must return 0 results (catch-all deleted in Task 7.7.9)
```

### Task 7.7.19: Run Full Test Suite

```bash
npm run typecheck && npm run build && npm run test:unit && npm run test:integration
```

---

## Rollback Procedure

If issues are discovered after deletion:

```bash
# Restore the entire hackrf_emitter directory from the git tag
git checkout pre-python-removal -- hackrf_emitter/

# Restore the Docker compose hackrf-backend service
git checkout pre-python-removal -- docker/docker-compose.portainer-dev.yml

# Restore the proxy catch-all
git checkout pre-python-removal -- src/routes/api/hackrf/\[...path\]/

# Rebuild and restart
npm run build
cd hackrf_emitter && ./start.sh
```

---

## Verification Checklist

- [ ] Git tag `pre-python-removal` created and verified before any deletion
- [ ] Phase 7.6 ALL gates re-verified passing immediately before deletion
- [ ] React frontend directory deleted (`hackrf_emitter/frontend/`)
- [ ] Python backend directory deleted (`hackrf_emitter/backend/`)
- [ ] Python venv deleted (~270 MB freed)
- [ ] Root-level hackrf_emitter files deleted
- [ ] hackrf_emitter/ directory removed
- [ ] hackrf-backend service removed from Docker compose
- [ ] Docker environment variables (PUBLIC_HACKRF_API_URL, etc.) removed
- [ ] Proxy catch-all route deleted (`[...path]/+server.ts`)
- [ ] auto_sweep.sh sweep_bridge.py reference removed
- [ ] sweepManager.ts sweep_bridge.py pkill reference removed (lines 949-951)
- [ ] static/script.js port 3002 reference updated or removed
- [ ] static/api-config.js hardcoded IP:3002 reference removed
- [ ] src/lib/constants/limits.ts HACKRF_CONTROL: 3002 constant updated or removed
- [ ] package.json kill-all script updated
- [ ] Script references cleaned (6 scripts updated)
- [ ] usrp_sweep.py intentionally preserved with documentation comment
- [ ] No Python files remain in active codebase (except usrp_sweep.py and GSM Evil)
- [ ] hackrf_emitter/ directory no longer exists
- [ ] Docker compose validates without errors
- [ ] Application builds successfully
- [ ] Application runs and all endpoints respond
- [ ] No stale references to hackrf_emitter, localhost:8092, or localhost:3002
- [ ] Full test suite passes (typecheck + build + unit + integration)

---

## Definition of Done

This phase is complete when:

1. The `hackrf_emitter/` directory does not exist
2. The application builds, starts, and passes all tests without the Python backend
3. Docker compose validates and the hackrf-backend service is removed
4. No stale references to deleted files, ports, or services remain
5. The git tag `pre-python-removal` exists for emergency rollback
6. All 6 scripts in scripts/ are updated to remove Python backend references
