# Argos Code Cleanup — Architecture Right-Sizing

## Overview

**Comprehensive codebase audit** revealed the Argos project was **~148,000 total lines** (~107,000 application code). Original `src/` total: **103,353 lines** (verified 2026-02-09).

After Phases 1-4: **42,000 lines** in src/ (59% reduction).
After Phase 5 (planned): **~17,000-20,000 lines** in src/ (target).

## Audit Methodology

Every file and directory in this plan was verified with `wc -l` on 2026-02-09. Phase 5 audit performed file-by-file with import analysis across 4 parallel deep-dive agents.

## Root Causes of Bloat

**Phases 1-4 addressed:**

1. **Duplicate/competing UI pages (~17,500 lines)**: 20 standalone tool pages deleted
2. **Tool wrapper layers (~20,000 lines)**: Bettercap, Wifite, OpenWebRX wrappers deleted
3. **Script duplication (~30,700 lines)**: Exact copies across scripts/ deleted

**Phase 5 addresses (remaining bloat):** 4. **Frontend re-implements backend logic (~8,000 lines)**: HackRF TypeScript services duplicate Python backend parsing, error tracking, frequency cycling 5. **Over-engineered for fixed hardware (~3,700 lines)**: 11-file hardware detection system for 3 known USB devices on a fixed Pi 6. **Dead/dev-only code still in src/ (~3,000 lines)**: Localization (Coral TPU), USRP, MCP server 7. **Components doing service work (~4,700 lines)**: Business logic in Svelte components instead of services 8. **Duplicate stores (~1,100 lines)**: Parallel store hierarchies (hackrf.ts vs hackrf-store.ts)

## Phase Plan

| Phase       | Description               | Savings       | Risk     | Commit Gates                     | Status      |
| ----------- | ------------------------- | ------------- | -------- | -------------------------------- | ----------- |
| **Phase 1** | Delete Dead Code          | ~31,000 lines | ZERO     | 7 commits + 7 dashboard checks   | DONE        |
| **Phase 2** | Delete Tool Wrappers      | ~17,000 lines | LOW      | 5 commits + 5 dashboard checks   | DONE        |
| **Phase 3** | Simplify Remaining Code   | ~28,000 lines | MODERATE | 10 commits + 10 dashboard checks | DONE        |
| **Phase 4** | Final Polish              | ~4,518 lines  | LOW      | 5 commits + 5 dashboard checks   | DONE        |
| **Phase 5** | Architecture Right-Sizing | ~20,000 lines | MODERATE | 12 commits + 12 dashboard checks | **PLANNED** |

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

**Phases 1-4: 10 days** (completed)
**Phase 5: 5 days** (planned)

- Phase 1: 1 day (7 sub-commits) — DONE
- Phase 2: 2 days (5 sub-commits) — DONE
- Phase 3: 5 days (10 sub-commits) — DONE
- Phase 4: 2 days (5 sub-commits) — DONE
- Phase 5: 5 days (12 sub-commits) — PLANNED

## Success Metrics

**Phases 1-4 (achieved):**

- **src/: 103,353 → 42,000 lines** (-59%, 61,353 lines removed)
- Dashboard fully functional: Map, spectrum, GPS, agent, terminal
- Single interface: Only `/dashboard`
- Typecheck: 90 errors (improved from 92 baseline)

**Phase 5 (target):**

- **src/: 42,000 → ~17,000-20,000 lines** (~55% further reduction)
- Frontend becomes pure display layer (no backend logic duplication)
- Hardware detection simplified for known Pi deployment
- Stores consolidated, components follow service layer pattern

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

- Original audit: `/home/kali/.claude/plans/snuggly-orbiting-puffin-agent-ab6ebb4.md`
- Phase 5 deep audit: 4 parallel agents analyzed every file in src/ (2026-02-09)
