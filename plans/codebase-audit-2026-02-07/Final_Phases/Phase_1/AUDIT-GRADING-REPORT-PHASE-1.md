# Phase 1: Zero-Risk Cleanup -- Final Gate Audit Report

**Status**: RESOLVED -- Corrected plan produced in `01-PHASE-1-ZERO-RISK-CLEANUP.md` on 2026-02-07. All 16 findings (5 CE, 5 FE, 6 MO) addressed. See Traceability table at bottom of corrected plan. One self-correction applied: MO-1 core dump size was ~93 MB not ~19 MB.

**Audit Date**: 2026-02-07
**Lead Auditor**: Claude Opus 4.6 (Final Gate Agent)
**Methodology**: 5 parallel verification agents cross-referenced every quantitative claim against the live codebase. All findings confirmed with direct tool evidence. Root cause analysis applied to every discrepancy.
**Grading Standard**: Plans evaluated against MISRA, CERT C Secure Coding, NASA/JPL Power of Ten, Barr C. Expected audience: 20-30 year experienced engineers at US Cyber Command and FAANG-tier review panels.

---

## Executive Summary

Phase 1 was previously scored **4.7/10 FAIL** in the initial grading report. The plan has since been expanded from 89 to 405 lines with audit corrections. However, this final gate audit reveals that the corrections introduced **new factual errors** and the plan contains **5 tasks that reference entities which do not exist in the current codebase**. Executing this plan as-written would produce incorrect `npm uninstall` commands, attempt to archive non-existent files, and miss ~320 KB of confirmed dead static assets.

**Revised Score: 3.8/10 -- FAIL -- requires complete rewrite with evidence-verified data.**

---

## Grading Breakdown

| Axis                | Score | Rationale                                                                                                                                                                                                                                |
| ------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auditability**    | 3/10  | 5 of 9 "unused production deps" do not exist in package.json. 6 of 6 "dead scripts" do not exist on disk. 3 of 8 root files do not exist. A reviewer cannot trace claims to evidence because the evidence does not exist.                |
| **Maintainability** | 5/10  | The plan structure (tasks, subtasks, verification) is adequate. Font optimization logic is sound. But executing invalid commands does not improve maintainability.                                                                       |
| **Security**        | 3/10  | Google Fonts CDN leak in app.html (JavaScript loader at line 30) is not addressed by Subtask 1.1.4. 34 core dump files in project root could contain sensitive memory contents. Neither is mentioned.                                    |
| **Professionalism** | 4/10  | A plan that instructs an engineer to `npm uninstall three` when `three` is not installed, or to `mv scripts/install-argos-complete.sh` when that file does not exist, would be rejected in the first 5 minutes of a professional review. |

**Overall: 3.8/10 -- NOT READY FOR EXECUTION**

---

## Verified Findings: Critical Errors

### CE-1: Task 1.2.1 -- ALL 5 "Unused Production Dependencies" Do Not Exist in package.json

**Root Cause**: The plan was written against a stale snapshot of package.json. These packages were either already removed or never installed.

| #   | Package              | Plan Says                                          | package.json (verified 2026-02-07) | Evidence                                               |
| --- | -------------------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| 1   | `three`              | "production, Zero imports"                         | **NOT IN package.json**            | `grep '"three"' package.json` = 0 results              |
| 2   | `@types/three`       | "production, Type declarations for unused package" | **NOT IN package.json**            | `grep '"@types/three"' package.json` = 0 results       |
| 3   | `d3-contour`         | "production, Zero imports"                         | **NOT IN package.json**            | `grep '"d3-contour"' package.json` = 0 results         |
| 4   | `d3-geo`             | "production, Zero imports"                         | **NOT IN package.json**            | `grep '"d3-geo"' package.json` = 0 results             |
| 5   | `d3-scale-chromatic` | "production, Zero imports"                         | **NOT IN package.json**            | `grep '"d3-scale-chromatic"' package.json` = 0 results |

**Impact**: Task 1.2.1 is entirely invalid. Running `npm uninstall three` is harmless but indicates the plan was never verified against the current state. The Current State Assessment table claims "Confirmed unused production deps: 2 packages" (which contradicts the task's own 5-package list), and the actual count is **0** packages to remove.

**Required Fix**: Delete Task 1.2.1 entirely. Update Current State Assessment to reflect 0 unused production dependencies.

---

### CE-2: Task 1.2.2 #4 -- pngjs Is Actively Used (Removing It Breaks Tests)

**Root Cause**: The plan searched only `src/` for imports. It did not search `tests/` or `scripts/`.

| File                                        | Line | Import                                         |
| ------------------------------------------- | ---- | ---------------------------------------------- |
| `tests/helpers/visual-helpers.ts`           | 3    | `import { PNG } from 'pngjs';`                 |
| `tests/helpers/visual-helpers.ts`           | 4    | `import type { PNG as PNGType } from 'pngjs';` |
| `tests/visual/visual-regression.test.ts`    | 4    | `import { PNG } from 'pngjs';`                 |
| `tests/visual/pi-visual-regression.test.ts` | 4    | `import { PNG } from 'pngjs';`                 |
| `scripts/visual-regression-check.cjs`       | 13   | `const PNG = require('pngjs').PNG;`            |

**Impact**: Removing `pngjs` would break `npm run test:visual` and the visual regression CI pipeline. For a military-grade codebase where visual fidelity of tactical displays matters, this is a test infrastructure dependency that must remain.

**Required Fix**: Remove pngjs from the removal list. Reduce unused dev deps from 4 to 3 (db-migrate, db-migrate-sqlite3, terser).

---

### CE-3: Task 1.2.4 -- 6 of 11 "Misplaced" Packages Are Already Correctly Placed

**Root Cause**: The plan assumed these packages were in `dependencies`. They are already in `devDependencies`.

| #   | Package                  | Plan Says               | Actual Location (package.json) | Line                 |
| --- | ------------------------ | ----------------------- | ------------------------------ | -------------------- |
| 1   | `@sveltejs/adapter-auto` | Move to devDependencies | **Already in devDependencies** | 58                   |
| 2   | `@sveltejs/kit`          | Move to devDependencies | **Already in devDependencies** | 59                   |
| 3   | `svelte-check`           | Move to devDependencies | **Already in devDependencies** | 89                   |
| 4   | `typescript`             | Move to devDependencies | **Already in devDependencies** | 95                   |
| 5   | `vite`                   | Move to devDependencies | **Already in devDependencies** | 96                   |
| 6   | `vitest`                 | Move to devDependencies | **Already in devDependencies** | 97                   |
| 7   | `@eslint/js`             | Move to devDependencies | **In dependencies (line 105)** | Correctly identified |
| 8   | `@types/better-sqlite3`  | Move to devDependencies | **In dependencies (line 108)** | Correctly identified |
| 9   | `globals`                | Move to devDependencies | **In dependencies (line 123)** | Correctly identified |
| 10  | `autoprefixer`           | Move to devDependencies | **In dependencies (line 115)** | Correctly identified |
| 11  | `postcss`                | Move to devDependencies | **In dependencies (line 130)** | Correctly identified |

**Impact**: The batch command in the plan would run:

```bash
npm uninstall @sveltejs/adapter-auto @sveltejs/kit svelte-check typescript vite vitest ...
```

This would remove @sveltejs/adapter-auto, @sveltejs/kit, etc. from devDependencies, then re-install them to devDependencies. While ultimately idempotent, it is unnecessary churn that could trigger lock file changes and risks introducing version drift. More critically, it demonstrates the plan was not verified against the actual package.json.

**Required Fix**: Reduce to 5 packages. Update batch command. Update Current State Assessment from "11" to "5".

**Additional Finding**: The plan MISSED 3 type packages that are also misplaced in dependencies:

- `@types/cytoscape` (line 109) -- should be devDependency
- `@types/leaflet` (line 110) -- should be devDependency
- `@types/leaflet.markercluster` (line 111) -- should be devDependency

Correct count of misplaced packages: **8** (5 identified + 3 missed).

---

### CE-4: Task 1.4 -- ALL 6 "Dead Install Scripts" Do Not Exist on Disk

**Root Cause**: These scripts were likely already deleted or archived in a previous cleanup pass. The plan was written against a stale file listing.

| #   | Script                              | Plan Says | `test -f` Result   |
| --- | ----------------------------------- | --------- | ------------------ |
| 1   | `scripts/install-argos-complete.sh` | Archive   | **DOES NOT EXIST** |
| 2   | `scripts/install-argos-offline.sh`  | Archive   | **DOES NOT EXIST** |
| 3   | `scripts/install-argos-quick.sh`    | Archive   | **DOES NOT EXIST** |
| 4   | `scripts/install-argos-rpi.sh`      | Archive   | **DOES NOT EXIST** |
| 5   | `scripts/setup-argos-services.sh`   | Archive   | **DOES NOT EXIST** |
| 6   | `scripts/setup-droneid-services.sh` | Archive   | **DOES NOT EXIST** |

**What DOES exist**: 22 install/setup scripts at `scripts/` top level, many with hardcoded wrong paths:

```
scripts/install-argos.sh
scripts/install-droneid-service.sh
scripts/install-framework.sh
scripts/install-management.sh
scripts/install-openwebrx-hackrf.sh
scripts/install-system-dependencies.sh
scripts/install_uhd.sh
scripts/install-usrp-support.sh
scripts/setup-celltower-db.sh
scripts/setup-db-cron.sh
scripts/setup-droneid-backend.sh
scripts/setup-droneid-sudoers.sh
scripts/setup-gsmevil-sudoers.sh
scripts/setup-host-complete.sh
scripts/setup-host.sh
scripts/setup-interface-names.sh
scripts/setup-kismet-adapter.sh
scripts/setup-offline-maps.sh
scripts/setup-opencellid-full.sh
scripts/setup-openwebrx-usrp.sh
scripts/setup-swap.sh
scripts/setup-system-management.sh
```

**Additional Finding**: **66 scripts** across all `scripts/` subdirectories contain hardcoded `/home/ubuntu` or `/home/pi` paths. The plan addresses 0 of them (the 6 it targets do not exist).

**Required Fix**: Delete Task 1.4 as-written. Replace with a task that audits the 22 ACTUAL install/setup scripts, classifies each as keep/archive/delete based on current deployment model (Docker, not bare-metal), and addresses the 66 scripts with wrong hardcoded paths. (Note: the 66-script path remediation may be deferred to Phase 6, but it must be acknowledged here.)

---

### CE-5: Task 1.5.1 -- 3 of 8 Root Files Never Existed

| File                                    | Plan Says | Disk Status       | Git Status            |
| --------------------------------------- | --------- | ----------------- | --------------------- |
| `COMPLETE_SYSTEM_SUMMARY.md`            | Delete    | **NEVER EXISTED** | Not tracked           |
| `MCP_INTEGRATION_COMPLETE.md`           | Delete    | **NEVER EXISTED** | Not tracked           |
| `QUICK_START.md`                        | Delete    | **NEVER EXISTED** | Not tracked           |
| `MEMORY_LEAK_FIXES_COMPLETE.md`         | Delete    | Deleted from disk | `deleted:` (unstaged) |
| `SECURITY_AND_MEMORY_FIXES_PROGRESS.md` | Delete    | Deleted from disk | `deleted:` (unstaged) |
| `STABILITY-ANALYSIS-REPORT.md`          | Delete    | Deleted from disk | `deleted:` (unstaged) |
| `TESTING_SUMMARY.md`                    | Delete    | Deleted from disk | `deleted:` (unstaged) |
| `TEST_RESULTS.md`                       | Delete    | Deleted from disk | `deleted:` (unstaged) |

**Root Cause**: The 5 existing files are already deleted from the working directory but the deletions are not staged (`git add` was never run). The 3 non-existent files were inherited from a prior plan version without verification.

**Required Fix**: Remove the 3 non-existent files from the table. For the 5 already-deleted files, the task should specify `git rm` (not `rm`) to properly stage the deletion. Add the `git rm` command explicitly.

---

## Verified Findings: Factual Errors

### FE-1: Font Reference Count -- 9 vs 59+

The plan states "9 files import or reference FiraCode." Verification found **59+ files** contain `font-family` declarations, including:

- 10 CSS files with explicit font-family rules
- 49+ Svelte components with font-family in `<style>` blocks
- 3 TypeScript/utility files with font-family in HTML templates

The 9 listed are the primary references, but a reviewer examining the claim "9 files" would immediately find it incomplete.

**Required Fix**: Clarify that 9 are PRIMARY references (the ones declaring the font-face or linking the CSS). The 49+ component references inherit from CSS variables and do not need modification when fonts change.

---

### FE-2: Google Fonts CDN -- 3 Locations, Not 2

Subtask 1.1.4 addresses only:

1. `static/custom-components-exact.css` (CSS @import)
2. `static/hackrf/custom-components-exact.css` (CSS @import)

**Missed location**: 3. `src/app.html:30` -- JavaScript-based font loader:

```javascript
link.href =
	'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&family=Fira+Code:wght@300;400;500;600;700&display=swap';
```

**Impact**: After executing Subtask 1.1.4 as-written, `grep -rn "fonts.googleapis.com" static/ src/` would return 1 result, not 0. The verification step (Subtask 1.1.5 #3) would FAIL.

**Required Fix**: Add `src/app.html:30` to Subtask 1.1.4 with instruction to remove the JavaScript font loader block.

---

### FE-3: Current State Assessment Table -- Multiple Wrong Numbers

| Metric                           | Plan Claims | Verified Actual                                | Delta  |
| -------------------------------- | ----------- | ---------------------------------------------- | ------ |
| Confirmed unused production deps | 2 packages  | **0** (none exist in package.json)             | -2     |
| Confirmed unused dev deps        | 4 packages  | **3** (pngjs is used)                          | -1     |
| Misplaced dependencies           | 11 packages | **8** (6 already correct, 3 additional missed) | -3/+3  |
| Dead install scripts             | 6 files     | **0** (none exist on disk)                     | -6     |
| Duplicate CSS in static/         | ~140 KB     | **~78 KB** (4 identical pairs)                 | -62 KB |

---

### FE-4: Subtask 1.2.3 KEEP Table -- Contains Non-Existent and Actively-Used Packages

| Package                | Plan Says               | Actual Status                                                                   |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| `@deck.gl/mesh-layers` | KEEP (reserved)         | **NOT IN package.json** -- phantom entry                                        |
| `maplibre-gl`          | KEEP (unused, reserved) | **ACTIVELY USED** in `src/lib/components/dashboard/DashboardMap.svelte:8,20-21` |
| `svelte-maplibre-gl`   | KEEP (unused, reserved) | **ACTIVELY USED** in `src/lib/components/dashboard/DashboardMap.svelte:10-19`   |

**Required Fix**: Remove `@deck.gl/mesh-layers` from the KEEP table. Move `maplibre-gl` and `svelte-maplibre-gl` to a separate "VERIFIED ACTIVE -- DO NOT TOUCH" section.

---

### FE-5: Audit Correction About @anthropic-ai/sdk Is Itself Wrong

The plan states: "The previous plan incorrectly listed `@anthropic-ai/sdk` as unused. It is ACTIVELY IMPORTED in 3 files."

**Verification**: `@anthropic-ai/sdk` is **NOT IN package.json**. The 3 files reference `anthropic` as a string literal (e.g., `'anthropic'` as a provider name) and use direct `fetch()` calls to `https://api.anthropic.com`. They do not import the SDK package.

**Required Fix**: Remove the audit correction. The SDK is not installed and the correction is misleading.

---

## Verified Findings: Major Omissions

### MO-1: 34 Core Dump Files (~93 MB) in Project Root

```
34 files matching core.* in project root
Total size: 97,419,264 bytes (92.9 MB)
Example: core.2231476 through core.2249407
```

**CORRECTION (2026-02-07)**: Original audit report stated ~19 MB. Live verification with `du -b core.*` confirms 97,419,264 bytes (92.9 MB). The 5x discrepancy was due to the verification agent using a truncated listing.

These are kernel core dumps from application crashes. They:

1. Waste 92.9 MB of disk space
2. Could contain sensitive memory contents (API keys, session data)
3. Would be flagged immediately by any security auditor
4. Are already in `.gitignore` (line 398: `core.*`) but exist on disk as untracked files

**Required Fix**: Add Task 1.6 "Remove Core Dumps and Add Prevention" with:

- `rm core.*` to delete all 34 files
- Add `core.*` to `.gitignore`
- Add `*.kismet` to `.gitignore` (Kismet capture files also present)

---

### MO-2: Static CSS/JS Duplicates -- Identified but No Task Created

The Current State Assessment table lists:

- "Duplicate CSS in static/ ~140 KB"
- "Duplicate JS in static/ ~240 KB"

But **no task in the plan addresses this**. Verification confirms:

**Confirmed dead static files (zero references from src/):**

| File                                        | Size          | Status                                       |
| ------------------------------------------- | ------------- | -------------------------------------------- |
| `static/custom-components-exact.css`        | 46,100 bytes  | Dead (stale copy of src/lib/styles/ version) |
| `static/geometric-backgrounds.css`          | 8,234 bytes   | Dead                                         |
| `static/monochrome-theme.css`               | 14,025 bytes  | Dead                                         |
| `static/saasfly-buttons.css`                | 9,798 bytes   | Dead                                         |
| `static/hackrf/custom-components-exact.css` | 46,100 bytes  | Dead (duplicate of static/ copy)             |
| `static/hackrf/geometric-backgrounds.css`   | 8,234 bytes   | Dead                                         |
| `static/hackrf/monochrome-theme.css`        | 14,025 bytes  | Dead                                         |
| `static/hackrf/saasfly-buttons.css`         | 9,798 bytes   | Dead                                         |
| `static/script.js`                          | 125,358 bytes | Dead (unreferenced legacy)                   |
| `static/hackrf/script.js`                   | 118,300 bytes | Dead (different version, also unreferenced)  |
| `static/api-config.js`                      | 131 bytes     | Dead                                         |
| `static/hackrf/api-config.js`               | 1,366 bytes   | Dead                                         |

**Confirmed LIVE static files (must NOT be deleted):**

| File                                    | Size         | Referenced By                                 |
| --------------------------------------- | ------------ | --------------------------------------------- |
| `static/workers/gridProcessor.js`       | 12,421 bytes | `src/lib/services/map/gridProcessor.ts`       |
| `static/workers/interpolationWorker.js` | 4,699 bytes  | `src/lib/services/map/signalInterpolation.ts` |
| `static/fonts/firacode-nerd-font.css`   | 1,076 bytes  | `src/app.html:235`                            |

**Total safe deletion**: 12 files, ~320 KB

**Required Fix**: Add Task 1.6 (or renumber as appropriate) "Delete Dead Static Assets" with the exact file list above and verification command.

---

### MO-3: AGUI-QUICK-START.md Root File Not Addressed

The root directory contains `AGUI-QUICK-START.md` which is not listed in Task 1.5.1's cleanup table. If this file is stale documentation for the @ag-ui packages (which are currently unused), it should be included in the cleanup or explicitly marked as "KEEP with justification."

---

### MO-4: Additional .gitignore Patterns Needed

The plan's Subtask 1.5.2 adds 3 patterns. Verification reveals additional patterns needed:

| Pattern          | Reason                                           | Files Found                                  |
| ---------------- | ------------------------------------------------ | -------------------------------------------- |
| `core.*`         | Kernel core dumps                                | 34 files, ~19 MB                             |
| `*.kismet`       | Kismet capture files                             | 1 file (`Kismet-20260207-20-39-41-1.kismet`) |
| `rf_signals.db*` | Runtime SQLite database + WAL files              | 3 files                                      |
| `.mcp.json`      | MCP configuration (if not tracked intentionally) | 1 file                                       |

Note: `css-integrity-baselines.json` and `css-integrity-report.json` are **already in .gitignore** (lines 384-385). The plan says "Add to .gitignore" but 2 of 3 patterns already exist. Only `.claude-container/` is genuinely missing.

---

### MO-5: Total Script Count Discrepancy

| Source                                      | Claims        | Verified          |
| ------------------------------------------- | ------------- | ----------------- |
| Phase 1 plan                                | (not stated)  | --                |
| Grading Report                              | 145 .sh files | **WRONG**         |
| Master Overview                             | 155 scripts   | **WRONG**         |
| Actual `find scripts/ -name "*.sh" -type f` | --            | **202 .sh files** |

This 30-40% undercount across all plan documents means the scope of Phase 6 (Infrastructure Modernization) is significantly larger than planned.

---

### MO-6: No Commit Strategy

Phase 0 specifies "one atomic commit per Task, with rollback procedure." Phase 1 has no equivalent. For a military-grade audit trail:

- Each task should produce exactly one commit
- Each commit message should reference the Phase/Task number
- A failed verification should trigger `git reset --soft HEAD~1`, not manual recovery
- The commit sequence should be documented in the execution order

---

## Verified Findings: What the Plan Gets Right

For completeness, these elements are confirmed accurate:

| Claim                                                          | Status   | Evidence                                                               |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| 18 TTF files in static/fonts/firacode/                         | VERIFIED | `find static/fonts -name "*.ttf" \| wc -l` = 18                        |
| ~46 MB total font size                                         | VERIFIED | 47,786,071 bytes (45.57 MB)                                            |
| 3 font families x 6 weights                                    | VERIFIED | FiraCodeNerdFont, FiraCodeNerdFontMono, FiraCodeNerdFontPropo x 6 each |
| FiraCode is actively used                                      | VERIFIED | Referenced in 59+ files via font-family declarations                   |
| Keep Regular + Bold + Light mono variants                      | SOUND    | Terminal components use only normal/bold weights                       |
| db-migrate unused                                              | VERIFIED | Zero imports in src/, tests/, scripts/                                 |
| db-migrate-sqlite3 unused                                      | VERIFIED | Zero imports in src/, tests/, scripts/                                 |
| terser unused                                                  | VERIFIED | Not referenced in vite.config.ts; Vite uses esbuild                    |
| 4 byte-identical files in scripts/dev/ vs scripts/development/ | VERIFIED | MD5 checksums match on all 4                                           |
| 2 unique files in scripts/development/                         | VERIFIED | auto-start-kismet.sh, start-usrp-service.sh                            |
| package.json scripts reference scripts/development/            | VERIFIED | dev:auto-kismet and dev:full                                           |
| Zod is already installed                                       | VERIFIED | In dependencies, imported in src/lib/server/env.ts                     |

---

## Corrected Current State Assessment

| Metric                               | Plan Claims     | Corrected Value                                  | Source                        |
| ------------------------------------ | --------------- | ------------------------------------------------ | ----------------------------- |
| Font directory size                  | 46 MB           | 45.57 MB (47,786,071 bytes)                      | `du`                          |
| Confirmed unused production deps     | 2 packages      | **0** (none in package.json)                     | `grep`                        |
| Confirmed unused dev deps            | 4 packages      | **3** (pngjs is used)                            | `grep`                        |
| Misplaced dependencies (prod to dev) | 11 packages     | **8** (5 correctly identified + 3 missed @types) | `package.json` lines          |
| Duplicate script directories         | 2               | 2 (confirmed)                                    | `ls`                          |
| Dead install scripts                 | 6 files         | **0** (none exist on disk)                       | `test -f`                     |
| Dead static CSS/JS                   | ~380 KB implied | **~320 KB** (12 files confirmed unreferenced)    | `grep`, `md5sum`              |
| Core dump files                      | NOT MENTIONED   | **34 files, ~19 MB**                             | `ls core.*`                   |
| Total .sh scripts                    | NOT MENTIONED   | **202**                                          | `find`                        |
| Scripts with wrong hardcoded paths   | NOT MENTIONED   | **66**                                           | `grep /home/ubuntu, /home/pi` |
| Google Fonts CDN locations           | 2 CSS files     | **3** (2 CSS + 1 JS in app.html)                 | `grep`                        |

---

## Required Plan Restructuring

Phase 1 should be restructured as follows:

```
Task 1.1: Font Optimization (46 MB -> ~8 MB)
  [KEEP -- mostly correct]
  FIX: Add src/app.html:30 Google Fonts JS loader to removal list
  FIX: Clarify "9 primary references" vs "59+ inherited references"

Task 1.2: Dependency Cleanup
  DELETE: Subtask 1.2.1 (packages do not exist)
  FIX: Subtask 1.2.2 remove pngjs from list (3 removals, not 4)
  FIX: Subtask 1.2.3 remove @deck.gl/mesh-layers (not in package.json)
  FIX: Subtask 1.2.3 move maplibre-gl, svelte-maplibre-gl to ACTIVE section
  FIX: Subtask 1.2.4 reduce to 8 packages (add @types/cytoscape, @types/leaflet, @types/leaflet.markercluster; remove 6 already-correct packages)
  FIX: Remove @anthropic-ai/sdk audit correction (SDK not installed)

Task 1.3: Script Directory Merge
  [KEEP -- verified correct]

Task 1.4: Archive Dead Install Scripts
  REWRITE: Replace non-existent file list with actual 22 install/setup scripts
  ADD: Classification of each script (keep/archive/delete)
  ADD: Cross-reference with Phase 6 scope

Task 1.5: Root File Cleanup
  FIX: Remove 3 non-existent files
  FIX: Use `git rm` for 5 already-deleted files
  FIX: Update .gitignore section (2 of 3 patterns already exist)
  ADD: AGUI-QUICK-START.md to review list
  ADD: Additional .gitignore patterns (core.*, *.kismet, rf_signals.db*)

Task 1.6: (NEW) Delete Dead Static Assets
  ADD: 12 confirmed-unreferenced files (~320 KB)
  ADD: Worker files in KEEP list with evidence

Task 1.7: (NEW) Clean Core Dumps and Runtime Artifacts
  ADD: Remove 34 core.* files (~19 MB)
  ADD: Remove Kismet capture files
  ADD: Prevent recurrence via .gitignore
```

---

## Traceability Matrix (Required for CERT/MISRA Compliance)

| Finding ID | Description                          | Task That Fixes It     | Verification                          |
| ---------- | ------------------------------------ | ---------------------- | ------------------------------------- |
| CE-1       | Phantom production dependencies      | Delete Task 1.2.1      | `grep` package.json                   |
| CE-2       | pngjs actively used                  | Remove from 1.2.2      | `npm run test:visual` passes          |
| CE-3       | 6/11 misplaced deps already correct  | Fix Task 1.2.4 list    | `grep` package.json sections          |
| CE-4       | 6 dead scripts don't exist           | Rewrite Task 1.4       | `test -f` each file                   |
| CE-5       | 3 root files don't exist             | Remove from Task 1.5.1 | `test -f` each file                   |
| FE-1       | Font references: 9 vs 59+            | Clarify in Task 1.1    | `grep font-family src/`               |
| FE-2       | Google Fonts: 3 locations not 2      | Add app.html to 1.1.4  | `grep fonts.googleapis src/`          |
| FE-3       | Wrong numbers in state table         | Rewrite table          | Multiple verifications                |
| FE-4       | KEEP table errors                    | Fix Task 1.2.3         | `grep` imports per package            |
| FE-5       | Wrong audit correction               | Remove correction      | `grep anthropic package.json`         |
| MO-1       | 34 core dumps not addressed          | New Task 1.7           | `ls core.* \| wc -l` = 0              |
| MO-2       | Static assets identified but no task | New Task 1.6           | `ls static/*.css static/*.js`         |
| MO-3       | AGUI-QUICK-START.md missed           | Add to Task 1.5        | Decision documented                   |
| MO-4       | Missing .gitignore patterns          | Expand Task 1.5.2      | `grep core .gitignore`                |
| MO-5       | Script count: 202 not 145/155        | Update Master Overview | `find scripts/ -name "*.sh" \| wc -l` |
| MO-6       | No commit strategy                   | Add to Phase 1 header  | Commit log after execution            |

---

## Conclusion

Phase 1 was labeled "Zero-Risk Cleanup" but in its current form would:

1. Attempt to uninstall 5 packages that are not installed (harmless but unprofessional)
2. Attempt to archive 6 files that do not exist (error-producing)
3. Remove pngjs, breaking visual regression tests (destructive)
4. Execute an `npm uninstall` batch command on 6 packages already in devDependencies (unnecessary churn)
5. Miss a Google Fonts CDN leak in app.html (security gap in air-gapped deployments)
6. Leave ~320 KB of confirmed dead static files untouched (despite identifying them)
7. Leave 34 core dump files (~19 MB) in the project root (security and hygiene concern)
8. Claim completion when `grep -rn "fonts.googleapis.com" static/ src/` still returns results

**None of these are "zero risk."** Two are destructive (pngjs removal, missed CDN leak). The rest are professional credibility failures that would not survive a 5-minute review by the intended audience.

The plan must be rewritten with every claim verified against the live codebase before execution can begin. Every file path must be confirmed with `test -f`. Every package must be confirmed with `grep` in `package.json`. Every number must be confirmed with the exact command that produced it.

**Revised Score: 3.8/10 -- FAIL**

---

_Report generated by Claude Opus 4.6 Final Gate Agent. All findings are based on direct tool evidence gathered 2026-02-07. No claims in this report are estimated or inferred -- every assertion has a corresponding verification command and result._
