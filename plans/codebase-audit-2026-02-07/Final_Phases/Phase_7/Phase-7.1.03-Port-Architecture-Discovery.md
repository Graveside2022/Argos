# Phase 7.1.03: Port Architecture Discovery

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtasks 7.1.2.1 through 7.1.2.3)
**Risk Level**: LOW -- Read-only investigation. No production code modified.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md
**Estimated Duration**: 30-45 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

The Python-to-TypeScript migration requires severing all network connections between the SvelteKit frontend and the Python Flask backend. Before severing, you must know every connection point. The original Phase 7 plan incorrectly described the port architecture -- it conflated two distinct services on different ports and referenced a port (5000) that does not exist in the codebase. This sub-task resolves those inaccuracies with verified evidence.

Without this discovery, the migration would leave orphaned proxy routes, hardcoded URLs, and environment variables pointing to deleted services.

---

## Subtask 7.1.2.1: Identify All HackRF-Related Network Services

The original plan conflates two distinct services on different ports:

| Port | Service                                         | Protocol             | Source                    |
| ---- | ----------------------------------------------- | -------------------- | ------------------------- |
| 8092 | Flask backend (`hackrf_emitter/backend/app.py`) | HTTP REST + SocketIO | Docker compose, env vars  |
| 3002 | HackRF control API (UNDOCUMENTED in plan)       | HTTP REST            | SvelteKit proxy catch-all |

**CRITICAL FINDING**: The proxy at `src/routes/api/hackrf/[...path]/+server.ts` (line 4) targets `http://localhost:3002`, NOT `http://localhost:8092`. The plan incorrectly states this proxy forwards to the Flask backend.

**Required investigation**: Determine what runs on port 3002. Possible explanations:

1. The Flask backend is configured to run on 3002 in development (start.sh may override the Docker port)
2. There is a separate Node.js HackRF control service
3. Port 3002 is a stale reference from a previous architecture

**Investigation commands:**

```bash
# Check what start.sh configures for port numbers
grep -n "3002\|PORT" /home/kali/Documents/Argos/Argos/hackrf_emitter/start.sh

# Check if any process currently listens on 3002
ss -tlnp | grep 3002

# Check Docker compose for port 3002
grep -rn "3002" /home/kali/Documents/Argos/Argos/docker/docker-compose*.yml

# Check Flask app.py for port configuration
grep -n "port\|PORT\|3002\|8092\|5000" /home/kali/Documents/Argos/Argos/hackrf_emitter/backend/app.py

# Search entire codebase for port 3002 references
grep -rn "3002" /home/kali/Documents/Argos/Argos/src/ \
  --include="*.ts" --include="*.svelte" --include="*.js"

# Search static files for port references
grep -rn "3002" /home/kali/Documents/Argos/Argos/static/
```

**Deliverable**: A conclusive determination of what service runs on port 3002, with evidence. If port 3002 is stale, document when it was last valid (git log the proxy file).

---

## Subtask 7.1.2.2: Document All SvelteKit References to Python Backend

**Verified references (5 files, 7 total references):**

| File                                                          | Line    | Reference                                 | Type                     |
| ------------------------------------------------------------- | ------- | ----------------------------------------- | ------------------------ |
| `src/routes/api/hackrf/[...path]/+server.ts`                  | 4       | `http://localhost:3002`                   | Proxy target             |
| `src/lib/components/hackrf/AnalysisTools.svelte`              | 14      | `http://localhost:8092`                   | Client-side window.open  |
| `src/lib/server/hardware/detection/network-detector.ts`       | 125     | `http://localhost:8092`                   | Health check             |
| `src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh` | 63-64   | `hackrf_emitter/backend/sweep_bridge.py`  | Fallback script path     |
| `src/lib/server/hackrf/sweepManager.ts`                       | 949-951 | `pkill -9 -f sweep_bridge.py`             | Process kill command     |
| `static/script.js`                                            | 7       | `http://${window.location.hostname}:3002` | Client-side API base URL |
| `static/api-config.js`                                        | 2       | `http://100.68.185.86:3002`               | Hardcoded API base URL   |

**No references to port 5000 exist** in the SvelteKit source (the original plan mentioned port 5000 incorrectly).

**Verification commands:**

```bash
# Verify each reference exists at the documented file and line
grep -n "localhost:3002" /home/kali/Documents/Argos/Argos/src/routes/api/hackrf/\\[...path\\]/+server.ts
grep -n "localhost:8092" /home/kali/Documents/Argos/Argos/src/lib/components/hackrf/AnalysisTools.svelte
grep -n "localhost:8092" /home/kali/Documents/Argos/Argos/src/lib/server/hardware/detection/network-detector.ts
grep -n "sweep_bridge" /home/kali/Documents/Argos/Argos/src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh
grep -n "sweep_bridge" /home/kali/Documents/Argos/Argos/src/lib/server/hackrf/sweepManager.ts
grep -n "3002" /home/kali/Documents/Argos/Argos/static/script.js
grep -n "3002" /home/kali/Documents/Argos/Argos/static/api-config.js

# Confirm no port 5000 references exist
grep -rn "5000" /home/kali/Documents/Argos/Argos/src/ \
  --include="*.ts" --include="*.svelte" --include="*.js" | grep -i "port\|localhost\|hackrf"
```

---

## Subtask 7.1.2.3: Document Docker Environment Variables

The following environment variables in `docker/docker-compose.portainer-dev.yml` reference the Python backend:

```
PUBLIC_HACKRF_API_URL=http://localhost:8092
PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
PUBLIC_HACKRF_WS_URL=ws://localhost:8092
```

These must be removed or redirected after migration.

**Verification command:**

```bash
# Extract all HackRF/spectrum-related env vars from Docker compose
grep -n "HACKRF\|SPECTRUM\|8092\|3002" \
  /home/kali/Documents/Argos/Argos/docker/docker-compose.portainer-dev.yml
```

**Post-migration action**: After the TypeScript migration replaces the Flask backend, these variables should either:

- Be removed entirely (if the SvelteKit server handles all HackRF functionality internally), OR
- Be redirected to the new TypeScript service endpoint

---

## Verification Checklist

- [ ] Port 3002 service identity determined with evidence (git log, process list, or config file)
- [ ] Port 8092 Flask backend confirmed in Docker compose
- [ ] All 7 SvelteKit references verified at documented file paths and line numbers
- [ ] No port 5000 references exist (confirmed negative)
- [ ] All 3 Docker environment variables documented
- [ ] Investigation findings recorded with commands and output

---

## Definition of Done

This sub-task is complete when:

1. The port 3002 mystery is resolved with evidence (process identity, configuration source, or determination that it is stale).
2. All 7 references in the table above are verified to exist at the documented locations.
3. The Docker environment variables are documented.
4. A clear recommendation exists for each reference: remove, redirect, or leave as-is.

---

## Cross-References

- **Required by**: Phase-7.5-API-ROUTES-FRONTEND.md (must know which proxy routes to replace)
- **Required by**: Phase-7.7-DELETION-CLEANUP.md (must know which environment variables and references to clean up)
- **Informs**: Phase-7.1.04-Python-in-SvelteKit-Dependencies.md (auto_sweep.sh reference overlaps)
