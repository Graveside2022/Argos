# Phase 2: Dead Code Elimination Report

**Master Tracker:** Phase 2 complete - see section breakdowns below

---

## Phase 2.2: Python Dead Code Removal

**Agent:** DeadCode-Python
**Date:** 2026-02-12
**Status:** ✅ COMPLETE

### Summary

- **Total commits:** 5
- **Total LOC removed:** 398 LOC (5 Python files)
- **Files deleted:** 5
- **Bytecode cleaned:** All **pycache** directories (already gitignored)

### Dead Code Identified

#### 1. OpenWebRX Python Config Files (CONFIRMED DEAD)

**Reason:** OpenWebRX deployed as Docker container with pre-built image (`jketterl/openwebrx-hackrf:stable`). Docker uses JSON configs, not Python configs.

- `config/openwebrx/openwebrx-config.py` (48 LOC)
- `config/openwebrx/openwebrx-startup.py` (92 LOC)
- `config/openwebrx/openwebrx-usrp-auto-config/config_webrx.py` (46 LOC)
- `config/openwebrx/openwebrx-usrp-config/config_webrx.py` (61 LOC)

**References checked:**

- ❌ No references in package.json
- ❌ No references in shell scripts
- ❌ No references in Docker configs
- ❌ No references in systemd services
- ✅ Docker deployment verified: uses JSON settings only

#### 2. USRP Sweep Tool (CONFIRMED DEAD)

**Reason:** Project uses HackRF exclusively. auto_sweep.sh references non-existent `scripts/usrp_spectrum_scan.py`, not this file.

- `src/lib/services/hackrf/sweep-manager/usrp_sweep.py` (146 LOC)

**References checked:**

- ❌ No imports in TypeScript/JavaScript/Python
- ❌ Not called by auto_sweep.sh (calls different non-existent file)
- ❌ No references in process-manager.ts
- ✅ File location anomaly: USRP tool in HackRF directory

#### 3. Python Bytecode (CLEANUP)

- `hackrf_emitter/backend/__pycache__/` directories
- `*.pyc` files throughout project

**Justification:** Generated files, should not be in version control

### Active Python Code (NOT REMOVED)

#### hackrf_emitter/backend/ - ACTIVE

**Reason:** Deployed as Docker container `hackrf-backend-dev`, Flask app on port 8092

Files:

- `app.py` - Flask application
- `rf_workflows/*.py` - HackRF controller modules
- `utils/*.py` - Config and safety managers

**Verification:**

- ✅ Referenced in docker-compose.portainer-dev.yml
- ✅ Referenced in scripts/dev/start-all-services.sh
- ✅ Container actively deployed

### Removals (Chronological)

#### Removal #1: config/openwebrx/openwebrx-config.py

**Date:** 2026-02-12
**Commit:** e072d81
**LOC:** 49
**Reason:** OpenWebRX uses Docker JSON config, not Python config

#### Removal #2: config/openwebrx/openwebrx-startup.py

**Date:** 2026-02-12
**Commit:** dd389a4
**LOC:** 93
**Reason:** OpenWebRX uses Docker JSON config, not Python config

#### Removal #3: config/openwebrx/openwebrx-usrp-auto-config/config_webrx.py

**Date:** 2026-02-12
**Commit:** f2d203c
**LOC:** 47
**Reason:** OpenWebRX uses Docker JSON config, not Python config

#### Removal #4: config/openwebrx/openwebrx-usrp-config/config_webrx.py

**Date:** 2026-02-12
**Commit:** 67051f8
**LOC:** 62
**Reason:** OpenWebRX uses Docker JSON config, not Python config

#### Removal #5: src/lib/services/hackrf/sweep-manager/usrp_sweep.py

**Date:** 2026-02-12
**Commit:** c05b7fb
**LOC:** 147
**Reason:** Project uses HackRF exclusively, USRP code path is broken/unused

#### Removal #6: Python bytecode cleanup

**Date:** 2026-02-12
**Status:** ✅ Already handled by .gitignore (lines 6-8)
**Files:** **pycache** directories cleaned, future commits prevented
**Reason:** Generated files, should not be in version control

### Verification

After each removal:

- ✅ No broken imports
- ✅ OpenWebRX still accessible (Docker-based)
- ✅ HackRF services still functional
- ✅ No TypeScript compilation errors
- ✅ Git status clean after commits

### Notes

- **No Coral TPU code found**: Phase 1 report mentioned Coral TPU as potential dead code. Grep search of 193 files showed references only in documentation/plans, NOT in actual Python source code.
- **USRP vs HackRF**: Project exclusively uses HackRF now. USRP code paths in auto_sweep.sh are also broken (reference non-existent `scripts/usrp_spectrum_scan.py`).
- **hackrf_emitter active**: Confirmed active deployment via Docker, do NOT remove.

---

## Phase 2.1: TypeScript/Svelte Dead Code Elimination

[To be filled by DeadCode-TS agent]

---

## Phase 2.3: Infrastructure Dead Code Elimination

**Agent:** DeadCode-Infrastructure
**Date:** 2026-02-12 19:40 UTC
**Status:** COMPLETED

### Summary

- **Config files removed:** 3 directories (3.47 MB)
- **Scripts removed:** 0 (all 16 actively used ✅)
- **Docs removed:** 15 files (724 KB)
- **Dependencies removed:** 1 package (@testing-library/svelte)
- **Total space saved:** ~4.2 MB

### Details

#### Part A: Configuration Files

**OpenWebRX Duplicate Directories (REMOVED)**

Phase 1.2 identified 3 duplicate OpenWebRX config directories. Investigation confirmed only the root `config/openwebrx/` files are used by Docker deployment.

**Removed:**

- `config/openwebrx/openwebrx-usrp-auto-config/` (28 KB) - Duplicate auto-config
- `config/openwebrx/openwebrx-usrp-config/` (16 KB) - Duplicate manual config
- `config/openwebrx/openwebrx-usrp-working/` (3.4 MB!) - Duplicate with large data files (eibi.json, receivers.json)

**Verification:**

- ✅ Only `config/openwebrx/settings.json` referenced in README.md (line 27, 112)
- ✅ Docker deployment uses: `docker cp config/openwebrx/settings.json openwebrx-hackrf:/var/lib/openwebrx/`
- ✅ Subdirectories not referenced in src/, scripts/, or Docker configs
- ✅ Grep confirmed zero references to usrp-auto-config, usrp-config, usrp-working

**Coral TPU Configs (NOT FOUND)**

Phase 1.2 mentioned Coral TPU configs. Search found zero files matching:

- `coral*`, `tpu*`, `edgetpu*` patterns
- Already removed in previous cleanup

**Other Configs (KEPT)**

All remaining config/ files verified as actively used:

- `opencellid.json` - Used by cell-tower-service.ts, tower-location API
- `app.d.ts`, `playwright.config.ts`, `vite-plugin-terminal.ts` - Build/dev essentials
- `eslint.config.js`, `.prettierrc`, etc. - Code quality tools

#### Part B: Scripts Verification

Phase 3.3 audit claimed "15 scripts, all actively used". Re-audit found **16 scripts, all actively used**:

**Scripts inventory:**

- **4 .cjs** (build validation): css-integrity-check, html-structure-validator, visual-regression-check, logger
- **2 .ts** (MCP operations): mcp-install, mcp-config
- **5 .sh** (dev automation): auto-start-kismet, detect-alfa-adapter, start-all-services, start-kismet-with-alfa, install-framework
- **5 .sh** (terminal sessions): tmux-0, tmux-1, tmux-2, tmux-3, tmux-zsh-wrapper

**Verification:**

- ✅ All 16 scripts referenced in package.json, src/, or called by other scripts
- ✅ Build scripts: package.json lines 26-33 (framework validation)
- ✅ MCP scripts: package.json lines 57-60 (mcp:install-b/c, mcp:config-b/c)
- ✅ Dev scripts: package.json lines 10-13 (dev:auto-kismet, dev:full, kismet:start)
- ✅ Tmux scripts: referenced in terminal-store.ts, shells API
- ✅ detect-alfa-adapter.sh: called by start-kismet-with-alfa.sh line 19

**Result:** 0 scripts removed (100% active usage confirmed)

#### Part C: Documentation

**Hook Development Docs (REMOVED)**

Directory `docs/General Documentation/hook_documentation/` contained design artifacts from hooks system development (108 KB):

- claude-hooks-design-CORRECTED.md (18 KB)
- claude-hooks-design.md (20 KB) - duplicate of above
- claude-hooks-DEVELOPER-PROFILE.md (32 KB)
- claude-hooks-FINAL.md (15 KB)
- claude-hooks-survey.md (11 KB)

Also removed:

- `docs/General Documentation/claude-hooks-TEST-RESULTS.md` (12 KB)

**Verification:**

- ✅ Not referenced in CLAUDE.md or docs/General Documentation/README.md
- ✅ Only mentioned in phase-3-organization-completion-report.md (historical)
- ✅ Hooks system is implemented and working - design docs obsolete

**Prompt Templates Directory (REMOVED)**

Directory `docs/prompts/` contained 13 large prompt engineering reference files (616 KB):

- Prompt - Deep Research Agent.md (45 KB)
- Prompt - Dependency validation.md (45 KB)
- Prompt - Fixing Bugs and troubleshooting (detailed).md (63 KB)
- Prompt - Fixing Bugs and troubleshooting (simple).md (9 KB)
- Prompt for Creating CLAUDE.md Files.md (23 KB)
- Prompt - Getting a diagnostic state.md (9 KB)
- Prompt - Give a problem to the AI.md (11 KB)
- Prompt - Software Engineer.md (41 KB)
- Prompt - UI Construction.md (54 KB)
- Prompt - UI Diagnosis & Troubleshooting.md (55 KB)
- (+ 3 more step-by-step guides, MCP server creation, cleanup prompts)

**Verification:**

- ✅ Not referenced by src/ code or build scripts
- ✅ Only referenced in phase reports (historical)
- ✅ These were reference materials/templates, not active documentation
- ✅ Actual project guidance is in CLAUDE.md and docs/General Documentation/

**Active Docs Remaining (KEPT)**

Essential documentation retained:

- `docs/General Documentation/README.md` - Doc index
- `docs/General Documentation/security-architecture.md` - Auth, input validation, CORS
- `docs/General Documentation/hardware-patterns.md` - HackRF, Kismet, GPS, USB
- `docs/General Documentation/websocket-guide.md` - Real-time data flow
- `docs/General Documentation/database-guide.md` - R-tree spatial indexing
- `docs/General Documentation/testing-guide.md` - Hardware mocking, TDD
- `docs/General Documentation/deployment.md` - RPi5 setup, Docker, OOM protection
- `docs/General Documentation/mcp-servers.md` - MCP server documentation
- (+ 2 active reference docs: AG-UI-INTEGRATION.md, HOST_SETUP.md)

#### Part D: Dependencies

**npm prune:**

- Result: No extraneous packages found
- All installed packages are declared in package.json

**depcheck analysis:**

Flagged "unused" dependencies (FALSE POSITIVES - all verified as used):

- `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links` - Used in TerminalTabContent.svelte
- `maplibre-gl`, `svelte-maplibre-gl` - Used in DashboardMap.svelte
- `@vitest/coverage-v8` - Used by `npm run test:coverage` (package.json line 45)
- `css-tree` - Used in build-tools/package.json and scripts/build/css-integrity-check.cjs
- `tslib` - TypeScript runtime library (required)

**Genuinely unused (REMOVED):**

- `@testing-library/svelte` - NOT used in any test files
    - Searched tests/ directory: zero imports found
    - Removed with `npm uninstall @testing-library/svelte`
    - Removed 12 packages (including transitive dependencies)

**Note on depcheck limitations:**
Depcheck doesn't understand:

1. Svelte component imports (dynamic/compile-time)
2. Build-time only dependencies
3. Transitive package.json references (build-tools/)

### Quality Gate

- ✅ `npm run build`: Successful (built in 1m 28s)
- ✅ No broken config references (grep verified)
- ✅ No broken doc links (removed entire directories, no stray references)
- ✅ OpenWebRX still accessible via Docker
- ✅ All 16 scripts remain intact and functional

### Files Changed

**Deleted:**

- 3 config directories (config/openwebrx/openwebrx-usrp-\*)
- 15 documentation files (hook_documentation/, prompts/, claude-hooks-TEST-RESULTS.md)
- 1 npm package (@testing-library/svelte + 11 dependencies)

**Modified:**

- package.json (removed @testing-library/svelte from devDependencies)
- package-lock.json (updated after npm uninstall)

### Space Saved

Before cleanup:

- config/openwebrx/: ~3.5 MB
- docs/: ~800 KB
  Total: ~4.3 MB

After cleanup:

- config/openwebrx/: 24 KB
- docs/: 132 KB
  Total: 156 KB

**Disk space recovered: ~4.2 MB**
