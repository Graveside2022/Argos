# Phase 7.7.03: Docker and Infrastructure Cleanup

**Decomposed from**: Phase-7.7-DELETION-CLEANUP.md (Tasks 7.7.8 and 7.7.11)
**Risk Level**: HIGH -- Modifying Docker compose and package.json affects deployment infrastructure.
**Prerequisites**: Phase-7.7.02 complete (all hackrf_emitter files deleted)
**Estimated Duration**: 15 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Remove the hackrf-backend Docker service from the compose configuration and clean up the
package.json kill-all script that references the now-deleted Python process. These changes
ensure the infrastructure layer reflects the removal of the Python backend.

---

## Task 7.7.8: Remove hackrf-backend from Docker Compose

**File**: `docker/docker-compose.portainer-dev.yml`

### Step 1: Remove the Dockerfile build reference from the header comment

**Current** (line 9):

```yaml
#   docker build -t argos-hackrf-backend:dev -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/
```

**Action**: Delete line 9 entirely.

### Step 2: Remove the hackrf-backend service block

**Current** (lines 79-107 -- verified 2026-02-08):

```yaml
# ============================================
# HACKRF BACKEND - DEV MODE
# ============================================
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
        # Mount backend code for hot reload
        - ${ARGOS_DIR:?Run setup-host.sh first}/hackrf_emitter/backend:/app:rw
    privileged: true
    networks:
        - argos-dev-network
    restart: unless-stopped
    command: ['python', '-m', 'flask', 'run', '--host=0.0.0.0', '--port=8092', '--reload']
    logging:
        driver: 'json-file'
        options:
            max-size: '100m'
            max-file: '3'
```

**Action**: Delete all lines from `  # ============================================` (the HACKRF
BACKEND comment block) through the closing `max-file: "3"` line of the hackrf-backend logging
section. This is the entire block from line 79 through line 107.

**NOTE ON LINE NUMBERS**: The original plan stated lines 77-105. Verified on 2026-02-08 that
the actual line range is 79-107. The discrepancy is due to the header comment block shifting
line numbers. Always verify with `grep -n` before editing.

### Step 3: Remove hackrf-backend environment variables from argos service

**Current** (lines 32, 35, 36 within the argos service environment block):

```yaml
- PUBLIC_HACKRF_API_URL=http://localhost:8092
- PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
- PUBLIC_HACKRF_WS_URL=ws://localhost:8092
```

**Action**: Delete these three lines. The SvelteKit application now handles HackRF communication
directly through TypeScript services, not through a separate Python backend on port 8092.

**CAUTION**: There are TWO references to port 8092 in the environment block:

- `PUBLIC_HACKRF_API_URL=http://localhost:8092` -- DELETE (Python backend URL)
- `PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092` -- DELETE (Python backend URL)
- `PUBLIC_HACKRF_WS_URL=ws://localhost:8092` -- DELETE (Python backend WebSocket)

The remaining environment variables (`PUBLIC_KISMET_API_URL`, `PUBLIC_OPENWEBRX_URL`, etc.)
are for other services and MUST be preserved.

### Step 4: Remove the Dockerfile build reference comment

**Current** (line 9):

```yaml
#   docker build -t argos-hackrf-backend:dev -f hackrf_emitter/backend/Dockerfile hackrf_emitter/backend/
```

**Action**: Delete this line from the header comment block.

### Verification

```bash
# Verify Docker compose is syntactically valid
docker compose -f docker/docker-compose.portainer-dev.yml config --quiet
echo "Docker compose validation exit code: $?"
# Expected: 0

# Verify hackrf-backend service is no longer defined
docker compose -f docker/docker-compose.portainer-dev.yml config --services | grep hackrf-backend
# Expected: no output (grep returns 1)

# Verify argos service still exists and is valid
docker compose -f docker/docker-compose.portainer-dev.yml config --services | grep argos
# Expected: "argos"

# Verify no references to port 8092 remain
grep -n "8092" docker/docker-compose.portainer-dev.yml
# Expected: no output

# Verify no references to hackrf_emitter remain
grep -n "hackrf_emitter" docker/docker-compose.portainer-dev.yml
# Expected: no output

# Verify no references to hackrf-backend remain
grep -n "hackrf-backend" docker/docker-compose.portainer-dev.yml
# Expected: no output
```

---

## Task 7.7.11: Update package.json Kill Script

**File**: `package.json`

The `kill-all` npm script currently kills Python processes that no longer exist after the
backend removal.

### Current Value (verified 2026-02-08, line 15):

```json
"kill-all": "pkill -f 'npm.*run.*dev' 2>/dev/null || true; pkill -f 'python.*app.py' 2>/dev/null || true; pkill -f 'npm.*start.*3000' 2>/dev/null || true"
```

### Updated Value:

```json
"kill-all": "pkill -f 'npm.*run.*dev' 2>/dev/null || true"
```

**Rationale**:

- `pkill -f 'python.*app.py'` -- REMOVE: No Python backend processes to kill after migration
- `pkill -f 'npm.*start.*3000'` -- REMOVE: Port 3000 was the React frontend dev server, which is deleted

### Verification

```bash
# Verify the updated script
node -e "const pkg = require('./package.json'); console.log('kill-all:', pkg.scripts['kill-all'])"
# Expected: kill-all: pkill -f 'npm.*run.*dev' 2>/dev/null || true

# Verify the script executes without error
npm run kill-all
echo "kill-all exit code: $?"
# Expected: 0 (the || true ensures success even if no processes match)
```

---

## Commit

```bash
git add docker/docker-compose.portainer-dev.yml package.json
git commit -m "chore(phase7.7.8,7.7.11): remove hackrf-backend from Docker compose and clean kill-all script"
```

---

## Verification Checklist

- [ ] hackrf-backend service block removed from docker-compose.portainer-dev.yml
- [ ] PUBLIC_HACKRF_API_URL env var removed from argos service
- [ ] PUBLIC_SPECTRUM_ANALYZER_URL env var removed from argos service
- [ ] PUBLIC_HACKRF_WS_URL env var removed from argos service
- [ ] Dockerfile build comment removed from header
- [ ] Docker compose validates without errors (`config --quiet` exit 0)
- [ ] No references to port 8092 remain in docker compose
- [ ] No references to hackrf_emitter remain in docker compose
- [ ] No references to hackrf-backend remain in docker compose
- [ ] package.json kill-all script updated (Python and React kills removed)
- [ ] `npm run kill-all` executes without error
- [ ] Changes committed to git

---

## Definition of Done

This sub-task is complete when:

1. Docker compose validates cleanly without the hackrf-backend service
2. No references to port 8092, hackrf_emitter, or hackrf-backend remain in the compose file
3. The package.json kill-all script no longer references Python or React processes
4. All changes are committed

---

## Cross-References

- **Previous**: Phase-7.7.02-File-Deletion-Sequence.md (file deletion)
- **Next**: Phase-7.7.04-Code-Reference-Cleanup.md (source code reference cleanup)
- **Parent**: Phase-7.7-DELETION-CLEANUP.md
