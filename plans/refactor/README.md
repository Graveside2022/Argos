# Argos Code Cleanup - Aggressive Reduction to ~7,500 Lines

## Overview

**Comprehensive codebase audit** revealed the Argos project is **~148,000 total lines** (~107,000 application code). Current `src/` total: **103,353 lines** (verified 2026-02-09).

## Audit Methodology

Every file and directory in this plan was verified with `wc -l` on 2026-02-09. Discrepancies from the original audit have been corrected. All files confirmed to exist on disk.

## Root Causes of Bloat

1. **Duplicate/competing UI pages (~17,500 deletable lines)**: 20 standalone tool pages when only `/dashboard` is the actual UI
2. **Tool wrapper layers (20,000+ deletable lines)**: Massive re-implementations of external tool APIs (Kismet, Bettercap, etc.)
3. **Script duplication (30,700 lines, ~50% duplicates)**: Exact copies across scripts/deploy/, scripts/install/, scripts/testing/

## Phase Plan

| Phase       | Description             | Savings       | Risk     | Commit Gates                     |
| ----------- | ----------------------- | ------------- | -------- | -------------------------------- |
| **Phase 1** | Delete Dead Code        | ~31,000 lines | ZERO     | 7 commits + 7 dashboard checks   |
| **Phase 2** | Delete Tool Wrappers    | ~17,000 lines | LOW      | 5 commits + 5 dashboard checks   |
| **Phase 3** | Simplify Remaining Code | ~28,000 lines | MODERATE | 10 commits + 10 dashboard checks |
| **Phase 4** | Final Polish            | ~4,000 lines  | LOW      | 5 commits + 5 dashboard checks   |

## Verification Protocol (MANDATORY after every commit)

```bash
# Gate 1: Build check
npm run build && npm run typecheck
# MUST pass with 0 errors before proceeding

# Gate 2: Dev server starts
npm run dev &
sleep 5

# Gate 3: Dashboard loads (automated)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/dashboard
# MUST return 200

# Gate 4: API health check
curl -s http://localhost:5173/api/health | grep -q "ok"
# MUST return ok

# Gate 5: Kill dev server
kill %1
```

If ANY gate fails: `git revert HEAD` immediately, investigate, fix, re-commit.

## Timeline

**Total: 10 days** for ~80,000 line reduction

- Phase 1: 1 day (7 sub-commits)
- Phase 2: 2 days (5 sub-commits)
- Phase 3: 5 days (10 sub-commits)
- Phase 4: 2 days (5 sub-commits)

## Success Metrics

- **Application code: 103,353 -> ~7,500 lines** (-93%)
- **Total project: ~148,000 -> ~16,255 lines** (-89%)
- **Reduction factor: 14x smaller**
- **Dashboard continues working**: Map, spectrum, GPS, agent, terminal all functional
- **Single interface**: Only `/dashboard`, all standalone pages deleted
- **Minimal wrappers**: External tools proxied in ~100 lines each, not thousands

## What Remains After Cleanup

**Single UI Page:**

- `/dashboard` (367 lines) - unified interface

**~10 API Endpoints:**

- health, ws, gps/position, hackrf/_, kismet/_, signals/_, system/_, agent/\*, map-tiles, db/cleanup, terminal

**Core Infrastructure:**

- Auth middleware + security
- Database layer (SQLite + R-tree)
- WebSocket server
- MCP server (Claude integration)
- Minimal HackRF sweep manager
- Minimal Kismet proxy

**Dashboard Components:**

- 6 panels: Map, Status, Overview, Terminal, Agent, Devices
- Spectrum chart, signal overlays

**Python Backend (at `hackrf_emitter/backend/`):**

- Flask app with minimal HackRF controller
- Basic RF workflows (no jamming protocols)

**Scripts (~10 essential):**

- deploy-master, install-argos, setup-host, cpu-guardian, keepalive, build-production, docker-automation

## CRITICAL PATH NOTE

The `hackrf_emitter/` Python files are ALL under `hackrf_emitter/backend/`, not at root. Plans reference `hackrf_emitter/backend/rf_workflows/` for all workflow files and `hackrf_emitter/backend/utils/` for config/safety managers.

## Reference

Full audit details: `/home/kali/.claude/plans/snuggly-orbiting-puffin-agent-ab6ebb4.md`
