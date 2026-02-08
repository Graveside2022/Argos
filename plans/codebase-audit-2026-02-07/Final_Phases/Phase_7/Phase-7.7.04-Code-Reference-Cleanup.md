# Phase 7.7.04: Code Reference Cleanup

**Decomposed from**: Phase-7.7-DELETION-CLEANUP.md (Tasks 7.7.9, 7.7.10, 7.7.12, 7.7.13)
**Risk Level**: HIGH -- Modifying active source files. Test after each change.
**Prerequisites**: Phase-7.7.03 complete (Docker and infrastructure cleanup done)
**Estimated Duration**: 30 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Remove all remaining source code references to the deleted Python backend, React frontend,
and associated ports/services. This includes the proxy catch-all route, sweep_bridge.py
references in shell and TypeScript, script references across the codebase, and the
decision on usrp_sweep.py preservation.

---

## Task 7.7.9: Delete Proxy Catch-All Route

**File**: `src/routes/api/hackrf/[...path]/+server.ts` (134 lines -- verified 2026-02-08)

**NOTE**: The original plan stated 102 lines. Actual line count is 134 (verified via `wc -l`).

This file proxied all unmatched `/api/hackrf/*` requests to `http://localhost:3002`. After
migration, the explicit route files in `src/routes/api/hackrf/transmit/` handle all endpoints
directly. The catch-all is dead code that would generate connection-refused errors if hit.

```bash
rm -rf src/routes/api/hackrf/\[...path\]/
```

**Verification**:

```bash
# Verify the catch-all directory is removed
test -d "src/routes/api/hackrf/[...path]" && echo "FAIL: catch-all still exists" || echo "PASS: catch-all removed"

# Verify the explicit transmit routes still exist
ls src/routes/api/hackrf/transmit/
# Expected: +server.ts and other route files

# Verify no references to localhost:3002 remain in src/
grep -rn "localhost:3002" src/ --include='*.ts' --include='*.svelte' --include='*.js'
# Expected: 0 results (the only reference was in the deleted catch-all)
```

**Commit**:

```bash
git add -A "src/routes/api/hackrf/[...path]/"
git commit -m "chore(phase7.7.9): delete proxy catch-all route for hackrf backend"
```

---

## Task 7.7.10: Clean auto_sweep.sh Reference

**File**: `src/lib/services/hackrf/sweep-manager/auto_sweep.sh`

**NOTE**: The original plan referenced path `.../process/auto_sweep.sh`. The actual path
is `.../sweep-manager/auto_sweep.sh` (no `process/` subdirectory). Verified 2026-02-08.

Remove the sweep_bridge.py fallback block (lines 62-67) that references the deleted Python file.

### Current Code (lines 60-71):

```bash
elif hackrf_info 2>/dev/null | grep -q "Serial number"; then
    echo "HackRF detected" >&2
    # Try python_hackrf sweep bridge first (native API, no subprocess overhead)
    SWEEP_BRIDGE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../../../../../hackrf_emitter/backend/sweep_bridge.py"
    if [ -f "$SWEEP_BRIDGE" ] && python3 -c "from python_hackrf import pyhackrf_sweep" 2>/dev/null; then
        echo "Using python_hackrf sweep bridge" >&2
        export PYTHONUNBUFFERED=1
        exec python3 -u "$SWEEP_BRIDGE" "$@"
    else
        echo "Falling back to hackrf_sweep binary" >&2
        exec hackrf_sweep "$@"
    fi
```

### Updated Code:

```bash
elif hackrf_info 2>/dev/null | grep -q "Serial number"; then
    echo "HackRF detected" >&2
    exec hackrf_sweep "$@"
```

**Rationale**: The sweep_bridge.py Python fallback is deleted. The `hackrf_sweep` native binary
is the only remaining sweep tool for HackRF hardware. The multi-line conditional that tested
for the Python bridge file is now dead code and should be simplified to a direct exec.

**Verification**:

```bash
# Verify no references to sweep_bridge.py remain in auto_sweep.sh
grep -n "sweep_bridge" src/lib/services/hackrf/sweep-manager/auto_sweep.sh
# Expected: no output

# Verify no references to hackrf_emitter remain in auto_sweep.sh
grep -n "hackrf_emitter" src/lib/services/hackrf/sweep-manager/auto_sweep.sh
# Expected: no output

# Verify the script is still syntactically valid
bash -n src/lib/services/hackrf/sweep-manager/auto_sweep.sh
echo "Syntax check exit code: $?"
# Expected: 0
```

---

## Task 7.7.10a: Clean sweepManager.ts sweep_bridge.py Reference

**File**: `src/lib/server/hackrf/sweep-manager.ts`

**NOTE**: The original plan stated lines 949-951. The actual lines are 1056-1059 (verified
2026-02-08 via grep). The file has grown since the plan was written.

### Current Code (lines 1056-1059):

```typescript
// Kill any sweep_bridge.py processes (python_hackrf sweep bridge)
await new Promise<void>((resolve) => {
	exec('pkill -9 -f sweep_bridge.py', () => resolve());
});
```

**Action**: Delete this entire block. The `sweep_bridge.py` process will no longer exist after
the Python backend deletion. The remaining `hackrf_sweep` process kill (which uses the native
binary, located nearby in the same function) MUST be preserved.

**CAUTION**: Do NOT delete adjacent pkill blocks. Only remove the sweep_bridge.py block.
The `hackrf_sweep`, `hackrf_info`, and `usrp_sweep` pkill blocks are for native binaries
that still exist.

### Verification

```bash
# Verify no references to sweep_bridge remain in sweepManager.ts
grep -n "sweep_bridge" src/lib/server/hackrf/sweep-manager.ts
# Expected: no output

# Verify the file still compiles
npm run typecheck
```

---

## Task 7.7.12: Clean Script References

Search all scripts in `scripts/` for references to the deleted Python backend and clean them.

### Known Scripts Requiring Updates (Verified 2026-02-08)

| Script                                        | Reference                                   | Action                              |
| --------------------------------------------- | ------------------------------------------- | ----------------------------------- |
| `scripts/dev/start-all-services.sh` (l.18-19) | `HACKRF_BACKEND_DIR`, `HACKRF_FRONTEND_DIR` | Remove hackrf-backend startup block |
| `scripts/dev/auto-start-hackrf.sh` (l.6-7)    | `HACKRF_BACKEND_DIR`, `HACKRF_FRONTEND_DIR` | Remove Python process check         |
| `scripts/setup-host.sh` (l.54)                | `docker build -t argos-hackrf-backend:dev`  | Remove Docker build step            |
| `scripts/deploy-containers.sh` (l.82-86,197)  | `hackrf-backend` image build + port 8092    | Remove hackrf-backend references    |
| `scripts/build-production.sh` (l.50,54,57)    | Port 8092 environment variables             | Remove or update env vars           |
| `scripts/docker-automation.sh`                | hackrf-backend references                   | Remove hackrf-backend references    |

**NOTE**: The original plan listed `scripts/development/start-all-services.sh` and
`scripts/development/auto-start-hackrf.sh`. The `scripts/development/` directory does NOT
exist (verified 2026-02-08). The actual paths are under `scripts/dev/`.

### Additional Scripts Found (Not in Original Plan)

These scripts also reference hackrf_emitter or port 8092:

| Script                                | Reference                   | Action            |
| ------------------------------------- | --------------------------- | ----------------- |
| `scripts/install/install.sh`          | hackrf-backend Docker build | Remove build step |
| `scripts/install/install-modified.sh` | hackrf-backend Docker build | Remove build step |
| `scripts/install/install-from-git.sh` | hackrf-backend Docker build | Remove build step |
| `scripts/deploy/install.sh`           | hackrf-backend Docker build | Remove build step |
| `scripts/deploy/install-modified.sh`  | hackrf-backend Docker build | Remove build step |
| `scripts/deploy/install-from-git.sh`  | hackrf-backend Docker build | Remove build step |
| `scripts/deploy/deploy-dragon-os.sh`  | hackrf-backend Docker build | Remove build step |

For each script, the action is the same pattern:

1. Remove lines that build the `argos-hackrf-backend` Docker image
2. Remove lines that start or reference the hackrf-backend container
3. Remove environment variable lines for `PUBLIC_HACKRF_API_URL`, `PUBLIC_SPECTRUM_ANALYZER_URL`, `PUBLIC_HACKRF_WS_URL`
4. Remove port 8092 references in hackrf context

### Comprehensive Search Commands

After manual cleanup, verify no references remain:

```bash
# Search for hackrf_emitter references in scripts
grep -rn "hackrf_emitter" scripts/
# Expected: 0 results

# Search for hackrf-backend references in scripts
grep -rn "hackrf-backend" scripts/
# Expected: 0 results

# Search for port 8092 references in scripts
grep -rn "8092" scripts/
# Expected: 0 results (or only in comments explaining removal)

# Search for python.*app.py references in scripts
grep -rn "python.*app.py" scripts/
# Expected: 0 results
```

### Additional Source References Not in Original Plan (Independent Audit Addition)

The original plan identified three additional files with stale references. Verification
status as of 2026-02-08:

| File                                  | Reference                                         | Status (2026-02-08)                      | Action                              |
| ------------------------------------- | ------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| `static/script.js` line 7             | `http://${window.location.hostname}:3002`         | FILE DOES NOT EXIST on disk              | No action needed                    |
| `static/api-config.js` line 2         | `http://100.68.185.86:3002` (hardcoded IP + port) | FILE DOES NOT EXIST on disk              | No action needed                    |
| `src/lib/constants/limits.ts` line 28 | `HACKRF_CONTROL: 3002`                            | File EXISTS, constant defined at line 28 | Update or remove depending on usage |

**CORRECTION**: `static/script.js` and `static/api-config.js` do NOT exist on disk (verified
2026-02-08 via `ls`). These files may have been deleted in a previous commit or may never have
existed on this deployment. No action needed for these two files.

**For `src/lib/constants/limits.ts` line 28** (`HACKRF_CONTROL: 3002`):

This constant in the `PORTS` object references port 3002, which was the HackRF control API
port served by the Python backend. After migration, HackRF control is handled by SvelteKit
API routes on port 5173 (the main application port).

**Action**: Check if `PORTS.HACKRF_CONTROL` is imported anywhere:

```bash
grep -rn "HACKRF_CONTROL" src/ --include='*.ts' --include='*.svelte'
```

- If imported: Update the value or add a deprecation comment
- If NOT imported: Remove the constant from the `PORTS` object

Additionally, check if `PORTS.HACKRF_API` (port 8092) is still referenced:

```bash
grep -rn "HACKRF_API" src/ --include='*.ts' --include='*.svelte'
```

- If only imported by `limits.ts` itself: Remove the constant
- If imported elsewhere: Update callers to use the SvelteKit API path

### Additional Source References: localhost:8092 in src/

Two additional references to `localhost:8092` exist in `src/` (verified 2026-02-08):

| File                                                    | Line | Reference                                                        | Action                                    |
| ------------------------------------------------------- | ---- | ---------------------------------------------------------------- | ----------------------------------------- |
| `src/lib/components/hackrf/AnalysisTools.svelte`        | 14   | `window.open('http://localhost:8092', '_blank')`                 | Update to SvelteKit URL or remove         |
| `src/lib/server/hardware/detection/network-detector.ts` | 125  | `process.env.PUBLIC_HACKRF_API_URL \|\| 'http://localhost:8092'` | Remove fallback to 8092 or update to 5173 |

These must be cleaned as part of this task.

---

## Task 7.7.13: Decision on usrp_sweep.py

**File**: `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py` (146 lines)

This Python file is INSIDE the SvelteKit source tree. It uses `numpy` and `gnuradio` for USRP
spectrum sweeping. It is NOT part of `hackrf_emitter/` and serves a different purpose (receive,
not transmit).

**Decision**: DO NOT DELETE.

This file supports USRP hardware which requires Python + gnuradio regardless of the
hackrf_emitter migration. The gnuradio Python bindings have no TypeScript equivalent.

**Action**: Add a documentation comment at the top of the file explaining why it remains:

```python
# NOTE: This file intentionally remains as Python. It requires gnuradio which
# has no TypeScript equivalent. USRP sweep support requires Python 3 + gnuradio
# installed on the host system. See Phase 7 migration documentation.
```

**Verification**:

```bash
# Verify the comment was added
head -5 src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py
# Expected: shows the NOTE comment at top

# Verify the file is still valid Python
python3 -c "import ast; ast.parse(open('src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py').read())" 2>/dev/null && echo "PASS: valid Python" || echo "INFO: Python syntax check skipped (python3 or gnuradio not available)"
```

---

## Commit

```bash
git add -A "src/routes/api/hackrf/[...path]/"
git add src/lib/services/hackrf/sweep-manager/auto_sweep.sh
git add src/lib/server/hackrf/sweep-manager.ts
git add src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py
git add src/lib/constants/limits.ts
git add src/lib/components/hackrf/AnalysisTools.svelte
git add src/lib/server/hardware/detection/network-detector.ts
git add scripts/
git commit -m "chore(phase7.7.9-13): remove all stale Python backend references from source and scripts"
```

---

## Verification Checklist

- [ ] Proxy catch-all route deleted (`src/routes/api/hackrf/[...path]/`)
- [ ] auto_sweep.sh sweep_bridge.py fallback block removed (lines 62-67)
- [ ] auto_sweep.sh syntax validates (`bash -n`)
- [ ] sweepManager.ts sweep_bridge.py pkill block removed (lines 1056-1059)
- [ ] sweepManager.ts compiles (`npm run typecheck`)
- [ ] `scripts/dev/start-all-services.sh` cleaned of hackrf_emitter references
- [ ] `scripts/dev/auto-start-hackrf.sh` cleaned of hackrf_emitter references
- [ ] `scripts/setup-host.sh` cleaned of hackrf-backend Docker build
- [ ] `scripts/deploy-containers.sh` cleaned of hackrf-backend references
- [ ] `scripts/build-production.sh` cleaned of port 8092 env vars
- [ ] `scripts/docker-automation.sh` cleaned of hackrf-backend references
- [ ] Install/deploy scripts cleaned (7 additional scripts)
- [ ] `src/lib/constants/limits.ts` HACKRF_CONTROL constant addressed
- [ ] `src/lib/components/hackrf/AnalysisTools.svelte` localhost:8092 updated
- [ ] `src/lib/server/hardware/detection/network-detector.ts` localhost:8092 fallback updated
- [ ] `static/script.js` confirmed does not exist (no action needed)
- [ ] `static/api-config.js` confirmed does not exist (no action needed)
- [ ] usrp_sweep.py preserved with documentation comment added
- [ ] `grep -rn "hackrf_emitter" src/` returns 0 results
- [ ] `grep -rn "localhost:3002" src/` returns 0 results
- [ ] `grep -rn "sweep_bridge" src/` returns 0 results
- [ ] All changes committed to git

---

## Definition of Done

This sub-task is complete when:

1. No references to `hackrf_emitter`, `localhost:3002`, or `sweep_bridge.py` remain in `src/`
2. All scripts in `scripts/` have been cleaned of Python backend references
3. The usrp_sweep.py file is preserved with a documentation comment
4. The proxy catch-all route is deleted
5. All changes compile and type-check successfully

---

## Cross-References

- **Previous**: Phase-7.7.03-Docker-and-Infrastructure-Cleanup.md
- **Next**: Phase-7.7.05-Post-Deletion-Verification.md (final verification)
- **Parent**: Phase-7.7-DELETION-CLEANUP.md
