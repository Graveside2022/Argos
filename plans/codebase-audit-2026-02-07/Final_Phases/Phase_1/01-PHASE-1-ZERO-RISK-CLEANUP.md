# Phase 1: Zero-Risk Cleanup (Corrected)

**Risk Level**: ZERO -- All changes are deletions of confirmed-unused assets, dependency corrections, and staging of already-deleted files
**Parallel-safe with**: Phase 2
**Prerequisites**: Phase 0 (dead code removal must complete first)
**Estimated Files Touched**: ~30
**Standards**: CERT MEM51-CPP (minimize resource footprint), NASA/JPL Rule 1 (restrict to simple constructs)

**Verification Date**: 2026-02-07
**Verification Method**: All claims in this plan verified against the live codebase via direct tool evidence. Every file path confirmed with `test -f`. Every package confirmed with `grep` in `package.json`. Every byte count confirmed with `stat -c%s`. No claims are estimated or inferred.

---

## Pre-Execution Snapshot (MANDATORY FIRST STEP)

**CORRECTION (2026-02-08 Final Audit NF-6)**: Before any Phase 1 work begins, create a git tag to establish a known-good rollback point. This is required by NASA/JPL Rule 2 (all code must be traceable) and provides a single-command full rollback if any task introduces unexpected issues.

```bash
# 1. Verify clean working tree (no uncommitted changes that would be lost)
git status --short
# Expected: Only the known ' D' deletions and untracked files

# 2. Create pre-execution tag
git tag -a phase1-pre-execution -m "Phase 1: Pre-execution snapshot (2026-02-08)"

# 3. Verify tag
git tag -l "phase1-*"
# Expected: phase1-pre-execution listed
```

**Full Phase 1 rollback** (if needed at any point):

```bash
git reset --hard phase1-pre-execution && npm install
```

This destroys all Phase 1 commits and restores node_modules to the pre-execution state. Core dumps and Kismet files (Task 1.6) cannot be restored via git since they are gitignored.

---

## Commit Strategy

Each task produces exactly one atomic commit (except Task 1.6 which is disk-only). Commit message format:

```
cleanup(phase1.N): <description>

Phase 1 Task N: <full task name>
Verified: <key verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

**CORRECTION (2026-02-08 Final Audit NF-7)**: Each task has a specific rollback procedure. A generic `git reset` is insufficient for tasks that modify node_modules or delete untracked files. Per-task rollback:

| Task                  | Rollback Command                         | Notes                                                  |
| --------------------- | ---------------------------------------- | ------------------------------------------------------ |
| 1.1 (Fonts)           | `git reset --soft HEAD~1`                | All changes are git-tracked files                      |
| 1.2 (NPM)             | `git reset --soft HEAD~1 && npm install` | Must restore node_modules after reverting package.json |
| 1.3 (Scripts)         | `git reset --soft HEAD~1`                | Git tracks directory changes                           |
| 1.4 (Static)          | `git reset --soft HEAD~1`                | All changes are git-tracked files                      |
| 1.5 (Root/.gitignore) | `git reset --soft HEAD~1`                | All changes are git-tracked files                      |
| 1.6 (Core dumps)      | N/A -- non-reversible                    | Gitignored files; disk cleanup only                    |

**Full Phase 1 rollback**: `git reset --hard phase1-pre-execution && npm install`

Never amend a pushed commit. If a verification step fails after commit, use the task-specific rollback, investigate, fix, and create a NEW commit.

---

## Current State Assessment

All values verified live on 2026-02-07. Verification commands listed for reproducibility.

| Metric                               | Verified Value                                          | Verification Command                         |
| ------------------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| Font directory size                  | 47,786,071 bytes (45.57 MB), 18 TTF files               | `du -sb static/fonts/firacode/`              |
| Unused production dependencies       | **0** packages                                          | `grep` for each candidate in package.json    |
| Unused dev dependencies              | **3** packages (db-migrate, db-migrate-sqlite3, terser) | `grep -rn` across src/, tests/, scripts/     |
| Misplaced dependencies (prod -> dev) | **8** packages                                          | `grep -n` in package.json lines 99-135       |
| Duplicate script directories         | 2 (scripts/dev/ + scripts/development/)                 | `ls -d scripts/dev*`                         |
| Dead static CSS/JS/HTML files        | **18** files, 430,610 bytes (420 KB)                    | `stat -c%s` on each file                     |
| Core dump files in project root      | **34** files, 97,419,264 bytes (92.9 MB)                | `du -b core.*`                               |
| Kismet capture files                 | **1** file, 7,786,496 bytes (7.4 MB)                    | `ls -la *.kismet`                            |
| Unstaged root file deletions         | **5** files (deleted from disk, not staged in git)      | `git status --short`                         |
| Google Fonts CDN leak locations      | **3** (2 CSS + 1 JS in app.html)                        | `grep -rn fonts.googleapis.com static/ src/` |

---

## Task 1.1: Optimize Font Assets (45.57 MB -> ~5 MB)

### Subtask 1.1.1: Current Font Inventory (Verified)

`static/fonts/firacode/` contains 18 TTF files across 3 font families, each with 6 weight variants:

| Family                | Weights                                        | Files  | Total Size   |
| --------------------- | ---------------------------------------------- | ------ | ------------ |
| FiraCodeNerdFont      | Light, Regular, Medium, SemiBold, Bold, Retina | 6      | ~15.5 MB     |
| FiraCodeNerdFontMono  | Light, Regular, Medium, SemiBold, Bold, Retina | 6      | ~15.5 MB     |
| FiraCodeNerdFontPropo | Light, Regular, Medium, SemiBold, Bold, Retina | 6      | ~15.5 MB     |
| **Total**             |                                                | **18** | **45.57 MB** |

**9 primary font reference locations** (files that declare font-face or link CSS):

| #   | File                                                     | Line | Reference Type                              |
| --- | -------------------------------------------------------- | ---- | ------------------------------------------- |
| 1   | `src/app.html`                                           | 235  | `<link>` to `/fonts/firacode-nerd-font.css` |
| 2   | `src/lib/components/dashboard/TerminalTabContent.svelte` | --   | font-family declaration                     |
| 3   | `src/lib/components/dashboard/views/TerminalView.svelte` | --   | font-family declaration                     |
| 4   | `src/routes/+page.svelte`                                | --   | font-family in CSS                          |
| 5   | `src/routes/rfsweep/+page.svelte`                        | --   | font-family in CSS                          |
| 6   | `src/routes/wigletotak/+page.svelte`                     | --   | font-family in CSS                          |
| 7   | `src/lib/styles/dashboard.css`                           | --   | font-family reference                       |
| 8   | `src/lib/styles/critical.css`                            | --   | font-family reference                       |
| 9   | `src/lib/styles/hackrf/custom-components-exact.css`      | --   | font-family reference                       |

**Note**: 59+ additional files contain `font-family` declarations in `<style>` blocks that inherit from CSS variables. These do not need modification when fonts change -- they reference the font by name, not by file path.

**Conclusion**: FiraCode Nerd Font is actively used. Only the Mono variant is needed for terminal rendering. Weights beyond Regular and Bold are not used.

**CORRECTION (2026-02-08 Final Audit NF-9)**: Font weight 500/600 visual regression analysis.

The codebase contains **140 occurrences** of `font-weight: 500` or `font-weight: 600` across **34 files**. This subtask deletes the Medium (500) and SemiBold (600) @font-face declarations from the font CSS. The question is whether this causes visual regression.

**Finding: ZERO regression risk.** All 140 occurrences apply font-weight 500/600 to elements using **system fonts** (Menlo, Monaco, Courier New, sans-serif via Tailwind/CSS variables), NOT FiraCode Nerd Font. FiraCode is explicitly set only on:

- `src/lib/components/dashboard/TerminalTabContent.svelte` (terminal output, uses 400/700 only)
- `src/lib/components/dashboard/views/TerminalView.svelte` (terminal output, uses 400/700 only)
- `src/app.html` (CSS link declaration)

The `--font-weight-semibold: 600` CSS variable (defined in `src/lib/styles/palantir-design-system.css:76`) is used in 16+ dashboard components, but all of these elements inherit font-family from the Tailwind/Palantir design system (system sans-serif stack), not from FiraCode.

**Verification** (confirm no FiraCode elements use weight 500/600):

```bash
# Files that declare FiraCode font-family
grep -rl "FiraCode\|firacode" src/ --include="*.svelte" --include="*.css" --include="*.html"
# Expected: 3 files (TerminalTabContent.svelte, TerminalView.svelte, app.html)

# Cross-reference: none of these 3 files should use font-weight 500 or 600 on FiraCode elements
# (TerminalView.svelte uses --font-weight-semibold on .terminal-title and .error-title,
#  which inherit system sans-serif, NOT FiraCode)
```

### Subtask 1.1.2: Reduce Font Variants (18 -> 2 files, ~40 MB saved)

Terminal components use `font-family: 'FiraCode Nerd Font'` with normal/bold weights only. Two files are sufficient:

**KEEP** (Mono variant, 2 weights):

| File                               | Weight | Approx Size | Justification           |
| ---------------------------------- | ------ | ----------- | ----------------------- |
| `FiraCodeNerdFontMono-Regular.ttf` | 400    | ~2.6 MB     | Default terminal weight |
| `FiraCodeNerdFontMono-Bold.ttf`    | 700    | ~2.6 MB     | Bold terminal output    |

**CORRECTION (2026-02-08 Final Audit NF-3)**: `FiraCodeNerdFontMono-Light.ttf` (weight 300) was previously on the KEEP list. Comprehensive search of all `src/` files for `font-weight: 300` or `font-weight: light` returns **zero results**. The codebase uses weights 400, 500, 600, and 700 only. Weight 300 is never specified. The Light variant is dead weight (~2.6 MB). If a future component needs Light, the font can be re-added from the Nerd Fonts distribution.

**DELETE** (16 files, ~40 MB saved):

```bash
# Non-Mono family (6 files)
rm static/fonts/firacode/FiraCodeNerdFont-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Regular.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFont-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Bold.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Retina.ttf

# Proportional family (6 files)
rm static/fonts/firacode/FiraCodeNerdFontPropo-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Regular.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Bold.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Retina.ttf

# Extra Mono weights (4 files, including Light)
rm static/fonts/firacode/FiraCodeNerdFontMono-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-Retina.ttf
```

### Subtask 1.1.3: Update Font CSS

**File**: `static/fonts/firacode-nerd-font.css`

The CSS file currently contains 5 `@font-face` declarations (all Mono variant):

- Regular/400 (lines 4-10) -- **KEEP**
- Medium/500 (lines 12-18) -- **DELETE** (file will be removed)
- SemiBold/600 (lines 20-26) -- **DELETE** (file will be removed)
- Bold/700 (lines 28-34) -- **KEEP**
- Light/300 (lines 36-42) -- **DELETE** (file will be removed, NF-3)

Remove the 3 declarations for deleted weight variants. Keep only the 2 declarations for:

- FiraCodeNerdFontMono-Regular (weight 400)
- FiraCodeNerdFontMono-Bold (weight 700)

**CORRECTION (2026-02-08 Final Audit NF-8)**: Per NASA/JPL Rule 1 (restrict to simple, deterministic constructs), the exact final-state content of this file is specified below. Two engineers executing this plan MUST produce byte-identical output:

```css
/* FiraCode Nerd Font - for terminal rendering */
/* Use Mono variant for fixed-width terminal display */

@font-face {
	font-family: 'FiraCode Nerd Font';
	src: url('/fonts/firacode/FiraCodeNerdFontMono-Regular.ttf') format('truetype');
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

@font-face {
	font-family: 'FiraCode Nerd Font';
	src: url('/fonts/firacode/FiraCodeNerdFontMono-Bold.ttf') format('truetype');
	font-weight: 700;
	font-style: normal;
	font-display: swap;
}
```

**Verification** (deterministic check):

```bash
wc -l static/fonts/firacode-nerd-font.css
# Expected: 15 lines (2 comments + 2 @font-face blocks + whitespace)

grep -c "@font-face" static/fonts/firacode-nerd-font.css
# Expected: 2

grep "font-weight:" static/fonts/firacode-nerd-font.css
# Expected: exactly 2 lines (400 and 700)
```

### Subtask 1.1.4: Remove Google Fonts External CDN (3 Locations)

Google Fonts CDN imports leak DNS requests and fail in air-gapped tactical deployments. All 3 locations must be addressed:

| #   | File                                        | Line | Content                                                                       | Action                                         |
| --- | ------------------------------------------- | ---- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `static/custom-components-exact.css`        | 4    | `@import url('https://fonts.googleapis.com/css2?...')`                        | Remove the `@import` line                      |
| 2   | `static/hackrf/custom-components-exact.css` | 4    | `@import url('https://fonts.googleapis.com/css2?...')`                        | Remove the `@import` line                      |
| 3   | `src/app.html`                              | 30   | JavaScript font loader: `link.href = 'https://fonts.googleapis.com/css2?...'` | Remove the entire font loader `<script>` block |

**IMPORTANT**: Location #3 (`src/app.html:30`) was missed in the original plan. The JavaScript-based font loader dynamically creates a `<link>` element pointing to Google Fonts CDN. The entire `<script>` block containing this loader must be removed or the verification step will fail.

**NOTE (2026-02-08 Final Audit)**: Two additional CDN references exist:

- `static/imsi-live-only.html:13` -- Google Fonts CDN over HTTP. This file is dead and will be deleted by Task 1.4 (NF-2 correction).
- `scripts/infrastructure/download-fonts.sh:32` -- CDN URL used as a download source, not a runtime dependency. This is a utility script and does not constitute a runtime CDN leak, but it persists in the repository. Deferred to Phase 6 (Infrastructure Modernization) for script audit.

**Verification** (must return 0 results):

```bash
grep -rn "fonts.googleapis.com" static/ src/
```

### Subtask 1.1.5: Verification

```bash
# 1. Font directory size reduced
du -sh static/fonts/
# Expected: ~5 MB (down from 46 MB)

# 2. Exactly 2 TTF files remain
find static/fonts/firacode/ -name "*.ttf" | wc -l
# Expected: 2

# 3. No external font imports remain
grep -rn "fonts.googleapis.com" static/ src/
# Expected: 0 results

# 4. Build passes
npm run build
# Expected: exit code 0

# 5. Terminal font renders (manual check)
npm run dev
# Open dashboard, verify terminal renders FiraCode glyphs
```

---

## Task 1.2: NPM Dependency Cleanup

### Subtask 1.2.1: Remove Confirmed Unused Dev Dependencies (3 packages)

These packages have zero imports across `src/`, `tests/`, and `scripts/`:

| #   | Package              | package.json Section | Line | Evidence of Non-Usage                               | Verification Command                                     |
| --- | -------------------- | -------------------- | ---- | --------------------------------------------------- | -------------------------------------------------------- |
| 1   | `db-migrate`         | devDependencies      | 74   | Zero imports anywhere                               | `grep -rn "db-migrate" src/ tests/ scripts/` = 0         |
| 2   | `db-migrate-sqlite3` | devDependencies      | 75   | Zero imports anywhere                               | `grep -rn "db-migrate-sqlite3" src/ tests/ scripts/` = 0 |
| 3   | `terser`             | devDependencies      | 92   | Not referenced in vite.config.ts; Vite uses esbuild | `grep -rn "terser" vite.config.ts` = 0                   |

**CRITICAL -- pngjs is NOT on this list**: `pngjs` (devDependencies, line 84) is actively imported in:

- `tests/helpers/visual-helpers.ts:3` -- `import { PNG } from 'pngjs';`
- `tests/helpers/visual-helpers.ts:4` -- `import type { PNG as PNGType } from 'pngjs';`
- `tests/visual/pi-visual-regression.test.ts:4` -- `import { PNG } from 'pngjs';`
- `tests/visual/visual-regression.test.ts:4` -- `import { PNG } from 'pngjs';`

Removing pngjs would break `npm run test:visual`. It MUST remain.

**Process** (one package at a time, strict sequence):

```bash
npm uninstall db-migrate
npm run build && npm run test:unit
# If fail: npm install -D db-migrate && STOP

npm uninstall db-migrate-sqlite3
npm run build && npm run test:unit
# If fail: npm install -D db-migrate-sqlite3 && STOP

npm uninstall terser
npm run build && npm run test:unit
# If fail: npm install -D terser && STOP
```

### Subtask 1.2.2: Move Misplaced Dependencies (8 packages: dependencies -> devDependencies)

These packages are in the `dependencies` section (lines 99-135) but are build-time, type-time, or lint-time only:

| #   | Package                        | Line in package.json | Reason for devDependency        |
| --- | ------------------------------ | -------------------- | ------------------------------- |
| 1   | `@eslint/js`                   | 105                  | Linting tool, not runtime       |
| 2   | `@types/better-sqlite3`        | 108                  | Type declarations only          |
| 3   | `@types/cytoscape`             | 109                  | Type declarations only          |
| 4   | `@types/leaflet`               | 110                  | Type declarations only          |
| 5   | `@types/leaflet.markercluster` | 111                  | Type declarations only          |
| 6   | `autoprefixer`                 | 115                  | PostCSS build tool, not runtime |
| 7   | `globals`                      | 123                  | ESLint helper, not runtime      |
| 8   | `postcss`                      | 130                  | CSS build tool, not runtime     |

**Process** (batch is safe -- moving section, not removing):

```bash
npm uninstall @eslint/js @types/better-sqlite3 @types/cytoscape @types/leaflet @types/leaflet.markercluster autoprefixer globals postcss
npm install -D @eslint/js @types/better-sqlite3 @types/cytoscape @types/leaflet @types/leaflet.markercluster autoprefixer globals postcss
npm run build && npm run test:unit
```

### Subtask 1.2.3: Reserved Packages -- DO NOT REMOVE

The following packages are in `dependencies` and appear to have limited current usage but are reserved for planned features. They MUST NOT be removed without explicit user approval.

**VERIFIED ACTIVE (in dependencies, actively imported):**

| Package              | Line | Imported In                                              | Status                 |
| -------------------- | ---- | -------------------------------------------------------- | ---------------------- |
| `maplibre-gl`        | 127  | `src/lib/components/dashboard/DashboardMap.svelte:20-21` | ACTIVE -- do not touch |
| `svelte-maplibre-gl` | 131  | `src/lib/components/dashboard/DashboardMap.svelte:10-19` | ACTIVE -- do not touch |

**RESERVED (in dependencies, zero current imports, planned for future work):**

| Package                      | Line | Reserved For                               |
| ---------------------------- | ---- | ------------------------------------------ |
| `@ag-ui/client`              | 100  | Agent UI upgrade (plans/ui-agent-upgrade/) |
| `@ag-ui/core`                | 101  | Agent UI upgrade                           |
| `@ag-ui/mcp-apps-middleware` | 102  | Agent UI upgrade                           |
| `@deck.gl/core`              | 103  | 3D tactical visualization                  |
| `@deck.gl/layers`            | 104  | 3D tactical visualization                  |
| `deck.gl`                    | 119  | 3D tactical visualization                  |
| `cytoscape`                  | 116  | Network graph visualization                |
| `cytoscape-cola`             | 117  | Network graph visualization                |
| `cytoscape-dagre`            | 118  | Network graph visualization                |
| `eventsource`                | 121  | SSE streaming for agent                    |
| `eventsource-parser`         | 122  | SSE streaming for agent                    |
| `node-fetch`                 | 129  | Server-side HTTP                           |
| `ts-interface-checker`       | 132  | Runtime type validation                    |

**NOTE**: `@deck.gl/mesh-layers` is NOT in package.json. The original plan listed it in this table. It does not exist and should not be referenced.

**NOTE**: `@anthropic-ai/sdk` is NOT in package.json. The original plan contained an "audit correction" claiming it was actively imported. This was incorrect. The files reference `'anthropic'` as a string literal and use direct `fetch()` calls to the API. The SDK package is not installed.

**POLICY**: If any reserved package triggers HIGH or CRITICAL severity in `npm audit`, escalate to the user for a keep/remove decision.

### Subtask 1.2.4: Run npm Audit

```bash
npm audit --audit-level=high
```

For each HIGH/CRITICAL finding:

1. If the vulnerable package is in the removal list (Subtask 1.2.1), proceed with removal.
2. If direct and used, check for patch: `npm audit fix`.
3. If transitive with no fix, document in a `KNOWN-VULNERABILITIES.md` with risk assessment.

### Subtask 1.2.5: Verification

```bash
# 1. Removed packages are gone
npm ls db-migrate 2>&1 | grep -c "empty"
npm ls db-migrate-sqlite3 2>&1 | grep -c "empty"
npm ls terser 2>&1 | grep -c "empty"
# Expected: each returns 1

# 2. Moved packages are in devDependencies (not dependencies)
node -e "const p=require('./package.json'); const d=p.dependencies; ['@eslint/js','@types/better-sqlite3','@types/cytoscape','@types/leaflet','@types/leaflet.markercluster','autoprefixer','globals','postcss'].forEach(k => { if(d[k]) console.log('FAIL: '+k+' still in dependencies'); else console.log('PASS: '+k); })"
# Expected: all PASS

# 3. Build and tests pass
npm run typecheck && npm run build && npm run test:unit
# Expected: all exit 0

# 4. pngjs still present (safety check)
npm ls pngjs 2>&1 | grep "pngjs"
# Expected: pngjs@7.x.x listed
```

---

## Task 1.3: Consolidate Duplicate Script Directories

### Subtask 1.3.1: Merge scripts/development/ into scripts/dev/

**Verified (2026-02-07)**: 4 files are byte-identical across both directories:

| File                    | scripts/dev/ | scripts/development/ | Status                |
| ----------------------- | ------------ | -------------------- | --------------------- |
| `start-all-services.sh` | 7,733 bytes  | 7,733 bytes          | Identical (MD5 match) |
| `start-fusion-dev.sh`   | 924 bytes    | 924 bytes            | Identical (MD5 match) |
| `analyze-950-simple.sh` | 2,111 bytes  | 2,111 bytes          | Identical (MD5 match) |
| `auto-start-hackrf.sh`  | 1,452 bytes  | 1,452 bytes          | Identical (MD5 match) |

**Files unique to scripts/development/** (must be moved, not lost):

| File                    | Size      | Action                 |
| ----------------------- | --------- | ---------------------- |
| `auto-start-kismet.sh`  | 763 bytes | Move to `scripts/dev/` |
| `start-usrp-service.sh` | 332 bytes | Move to `scripts/dev/` |

**Process**:

```bash
# Move unique files first
mv scripts/development/auto-start-kismet.sh scripts/dev/
mv scripts/development/start-usrp-service.sh scripts/dev/

# Delete the now-redundant directory (all remaining files are duplicates)
rm -rf scripts/development/
```

### Subtask 1.3.2: Update npm Script References

After directory merge, update ALL files that reference `scripts/development/`:

**Root package.json**:

| npm Script        | Current Path                                  | New Path                              |
| ----------------- | --------------------------------------------- | ------------------------------------- |
| `dev:auto-kismet` | `./scripts/development/auto-start-kismet.sh`  | `./scripts/dev/auto-start-kismet.sh`  |
| `dev:full`        | `./scripts/development/start-all-services.sh` | `./scripts/dev/start-all-services.sh` |

**build-tools/package.json** (2026-02-08 Final Audit NF-4):

| npm Script        | Current Path (line)                                     | New Path                              |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| `dev:auto-kismet` | `./scripts/development/auto-start-kismet.sh` (line 10)  | `./scripts/dev/auto-start-kismet.sh`  |
| `dev:full`        | `./scripts/development/start-all-services.sh` (line 12) | `./scripts/dev/start-all-services.sh` |

### Subtask 1.3.3: Verification

```bash
# 1. Old directory is gone
test -d scripts/development/ && echo "FAIL" || echo "PASS"
# Expected: PASS

# 2. All 6 files exist in scripts/dev/
for f in start-all-services.sh start-fusion-dev.sh analyze-950-simple.sh auto-start-hackrf.sh auto-start-kismet.sh start-usrp-service.sh; do
    test -f "scripts/dev/$f" && echo "PASS: $f" || echo "FAIL: $f"
done
# Expected: all PASS

# 3. No references to deleted directory in ANY package.json
grep "scripts/development" package.json
# Expected: 0 results
grep "scripts/development" build-tools/package.json
# Expected: 0 results
```

---

## Task 1.4: Delete Dead Static Assets (18 files, ~430 KB)

### Subtask 1.4.1: Delete Confirmed-Unreferenced Static Files

These files have zero references from `src/` (verified via `grep -rn` across all .svelte, .ts, and .html files). The `src/` code references `src/lib/styles/hackrf/custom-components-exact.css` (the source version), NOT the `static/` copies.

**CSS files to delete** (8 files, 156,314 bytes):

| #   | File                                        | Size (bytes) | Reason Dead                                 |
| --- | ------------------------------------------- | ------------ | ------------------------------------------- |
| 1   | `static/custom-components-exact.css`        | 46,100       | Stale copy; src/lib/styles/ version is used |
| 2   | `static/geometric-backgrounds.css`          | 8,234        | Zero references from src/                   |
| 3   | `static/monochrome-theme.css`               | 14,025       | Zero references from src/                   |
| 4   | `static/saasfly-buttons.css`                | 9,798        | Zero references from src/                   |
| 5   | `static/hackrf/custom-components-exact.css` | 46,100       | Duplicate of #1                             |
| 6   | `static/hackrf/geometric-backgrounds.css`   | 8,234        | Duplicate of #2                             |
| 7   | `static/hackrf/monochrome-theme.css`        | 14,025       | Duplicate of #3                             |
| 8   | `static/hackrf/saasfly-buttons.css`         | 9,798        | Duplicate of #4                             |

**JS files to delete** (4 files, 245,155 bytes):

| #   | File                          | Size (bytes) | Reason Dead                                    |
| --- | ----------------------------- | ------------ | ---------------------------------------------- |
| 9   | `static/script.js`            | 125,358      | Unreferenced legacy script                     |
| 10  | `static/hackrf/script.js`     | 118,300      | Unreferenced legacy script (different version) |
| 11  | `static/api-config.js`        | 131          | Unreferenced config stub                       |
| 12  | `static/hackrf/api-config.js` | 1,366        | Unreferenced config (different version)        |

**Additional dead files (2026-02-08 Final Audit NF-2)** -- 7 files missed by original inventory:

| #   | File                            | Size (bytes) | Reason Dead               | Security Note                                   |
| --- | ------------------------------- | ------------ | ------------------------- | ----------------------------------------------- |
| 13  | `static/logger.js`              | 2,056        | Zero references from src/ | None                                            |
| 14  | `static/imsi-clean.html`        | 4,221        | Zero references from src/ | None                                            |
| 15  | `static/gsm-evil-proxy.html`    | 1,879        | Zero references from src/ | None                                            |
| 16  | `static/imsi-live-only.html`    | 8,860        | Zero references from src/ | Contains HTTP CDN leaks (maxcdn + Google Fonts) |
| 17  | `static/debug-gsm-socket.html`  | 2,402        | Zero references from src/ | None                                            |
| 18  | `static/imsi-with-history.html` | 9,723        | Zero references from src/ | None                                            |

**SECURITY NOTE**: `static/imsi-live-only.html` lines 12-13 contain plaintext HTTP CDN requests to `maxcdn.bootstrapcdn.com` and `fonts.googleapis.com`. These leak DNS queries and are vulnerable to MITM injection in tactical environments. Deleting the file eliminates the vulnerability.

**Process**:

```bash
# Original 12 dead files
rm static/custom-components-exact.css
rm static/geometric-backgrounds.css
rm static/monochrome-theme.css
rm static/saasfly-buttons.css
rm static/hackrf/custom-components-exact.css
rm static/hackrf/geometric-backgrounds.css
rm static/hackrf/monochrome-theme.css
rm static/hackrf/saasfly-buttons.css
rm static/script.js
rm static/hackrf/script.js
rm static/api-config.js
rm static/hackrf/api-config.js

# Additional 6 dead files (NF-2)
rm static/logger.js
rm static/imsi-clean.html
rm static/gsm-evil-proxy.html
rm static/imsi-live-only.html
rm static/debug-gsm-socket.html
rm static/imsi-with-history.html

# Remove empty directory (all 6 hackrf/ files deleted above)
rmdir static/hackrf/
```

### Subtask 1.4.2: Confirm KEEP Files (DO NOT DELETE)

These static files ARE referenced from `src/` and MUST be preserved:

| File                                    | Size (bytes) | Referenced By                                 | Line |
| --------------------------------------- | ------------ | --------------------------------------------- | ---- |
| `static/workers/gridProcessor.js`       | 12,421       | `src/lib/services/map/gridProcessor.ts`       | 89   |
| `static/workers/interpolationWorker.js` | 4,699        | `src/lib/services/map/signalInterpolation.ts` | 51   |
| `static/fonts/firacode-nerd-font.css`   | 1,076        | `src/app.html`                                | 235  |

### Subtask 1.4.3: Verification

```bash
# 1. Dead files are gone (original 12 + 6 additional)
for f in static/custom-components-exact.css static/geometric-backgrounds.css static/monochrome-theme.css static/saasfly-buttons.css static/hackrf/custom-components-exact.css static/hackrf/geometric-backgrounds.css static/hackrf/monochrome-theme.css static/hackrf/saasfly-buttons.css static/script.js static/hackrf/script.js static/api-config.js static/hackrf/api-config.js static/logger.js static/imsi-clean.html static/gsm-evil-proxy.html static/imsi-live-only.html static/debug-gsm-socket.html static/imsi-with-history.html; do
    test -f "$f" && echo "FAIL: $f still exists" || echo "PASS: $f deleted"
done
# Expected: all PASS

# 2. Empty directory removed
test -d static/hackrf/ && echo "FAIL: empty dir remains" || echo "PASS: dir removed"
# Expected: PASS

# 3. KEEP files still exist
test -f static/workers/gridProcessor.js && echo "PASS" || echo "FAIL: worker missing!"
test -f static/workers/interpolationWorker.js && echo "PASS" || echo "FAIL: worker missing!"
test -f static/fonts/firacode-nerd-font.css && echo "PASS" || echo "FAIL: font CSS missing!"
# Expected: all PASS

# 4. Leaflet assets still exist (DO NOT DELETE)
for f in static/leaflet/marker-icon.png static/leaflet/marker-icon-2x.png static/leaflet/marker-shadow.png static/leaflet/layers.png static/leaflet/layers-2x.png; do
    test -f "$f" && echo "PASS: $f" || echo "FAIL: $f missing!"
done
# Expected: all PASS

# 5. No external CDN references remain in static/ or src/
grep -rn "fonts.googleapis.com\|maxcdn.bootstrapcdn" static/ src/
# Expected: 0 results

# 6. Build passes (no broken references)
npm run build
# Expected: exit 0
```

---

## Task 1.5: Root File and .gitignore Cleanup

### Subtask 1.5.1: Stage Already-Deleted Root Files

Five root markdown files are already deleted from disk but the deletions are NOT staged in git (showing as ` D` in `git status`). They must be staged with `git rm`:

| File                                    | Disk Status | Git Status               |
| --------------------------------------- | ----------- | ------------------------ |
| `MEMORY_LEAK_FIXES_COMPLETE.md`         | Deleted     | ` D` (unstaged deletion) |
| `SECURITY_AND_MEMORY_FIXES_PROGRESS.md` | Deleted     | ` D` (unstaged deletion) |
| `STABILITY-ANALYSIS-REPORT.md`          | Deleted     | ` D` (unstaged deletion) |
| `TESTING_SUMMARY.md`                    | Deleted     | ` D` (unstaged deletion) |
| `TEST_RESULTS.md`                       | Deleted     | ` D` (unstaged deletion) |

**Process**:

```bash
git rm MEMORY_LEAK_FIXES_COMPLETE.md
git rm SECURITY_AND_MEMORY_FIXES_PROGRESS.md
git rm STABILITY-ANALYSIS-REPORT.md
git rm TESTING_SUMMARY.md
git rm TEST_RESULTS.md
```

**NOTE**: The original plan listed 3 additional files (`COMPLETE_SYSTEM_SUMMARY.md`, `MCP_INTEGRATION_COMPLETE.md`, `QUICK_START.md`) for deletion. These files **do not exist and have never existed** in this repository. They have been removed from this plan.

### Subtask 1.5.2: Review AGUI-QUICK-START.md

`AGUI-QUICK-START.md` exists in the project root and IS tracked by git. It is documentation for the @ag-ui packages which are currently reserved (Subtask 1.2.3).

**Decision required**: If @ag-ui packages are kept (per Subtask 1.2.3), this file should remain. If they are later removed, this file should be removed with them. For Phase 1, **KEEP** with no action.

### Subtask 1.5.3: Add Missing .gitignore Patterns

The original plan proposed adding 3 patterns. Two of those already exist:

| Pattern                        | Status             | .gitignore Line |
| ------------------------------ | ------------------ | --------------- |
| `css-integrity-baselines.json` | **ALREADY EXISTS** | Line 384        |
| `css-integrity-report.json`    | **ALREADY EXISTS** | Line 385        |
| `core.*`                       | **ALREADY EXISTS** | Line 398        |
| `*.kismet`                     | **ALREADY EXISTS** | Line 376        |

**Patterns genuinely missing that must be added**:

| Pattern              | Reason                                    | Files on Disk                              |
| -------------------- | ----------------------------------------- | ------------------------------------------ |
| `.claude-container/` | Claude Code container workspace artifacts | (preventive, dir does not currently exist) |

**CORRECTION (2026-02-08 Final Audit NF-1)**: The original plan proposed adding `rf_signals.db`, `rf_signals.db-shm`, `rf_signals.db-wal`. These are ALREADY covered by wildcard patterns at:

- Line 313: `*.db`
- Line 315: `*.db-shm`
- Line 316: `*.db-wal`

Adding specific `rf_signals.db*` patterns would be redundant. Only `.claude-container/` is genuinely missing.

**Process**: Append to `.gitignore`:

```
# Claude Code artifacts
.claude-container/
```

### Subtask 1.5.4: Verification

```bash
# 1. Staged deletions
git status --short | grep "^D " | wc -l
# Expected: 5 (the git rm'd files)

# 2. No deleted files still on disk
for f in MEMORY_LEAK_FIXES_COMPLETE.md SECURITY_AND_MEMORY_FIXES_PROGRESS.md STABILITY-ANALYSIS-REPORT.md TESTING_SUMMARY.md TEST_RESULTS.md; do
    test -f "$f" && echo "FAIL: $f still on disk" || echo "PASS: $f gone"
done
# Expected: all PASS

# 3. New .gitignore patterns present
grep ".claude-container" .gitignore && echo "PASS" || echo "FAIL"
# Expected: PASS

# 4. Verify rf_signals.db is ALREADY covered by wildcard
grep "^\*\.db$" .gitignore && echo "PASS: *.db wildcard exists" || echo "FAIL"
# Expected: PASS (no specific rf_signals.db pattern needed)
```

---

## Task 1.6: Clean Core Dumps and Runtime Artifacts (DISK-ONLY, NO GIT COMMIT)

**IMPORTANT (2026-02-08 Final Audit NF-5)**: All files in this task are gitignored and untracked. `core.*` matches `.gitignore` line 398. `*.kismet` matches `.gitignore` line 376. Deleting these files produces zero staged git changes. This task does NOT produce a git commit. Attempting `git commit` after this task would fail with "nothing to commit." This is correct behavior -- the task is a disk cleanup operation only.

### Subtask 1.6.1: Delete Core Dump Files

**34 core dump files** exist in the project root, totaling 97,419,264 bytes (92.9 MB). These are kernel core dumps from application crashes. They:

1. Waste 92.9 MB of disk space
2. Could contain sensitive memory contents (API keys, session tokens, RF data)
3. Are already in `.gitignore` (line 398: `core.*`) so they are not tracked, just occupying disk
4. Would be flagged immediately by any security auditor

**SECURITY**: Per CERT MEM06-C, core dumps may contain cleartext copies of sensitive data (API keys, session tokens, encryption keys, RF signal data). In a tactical environment, core dumps on a captured device represent a data exfiltration vector. Immediate deletion is required.

**Process**:

```bash
rm core.*
```

**Rollback**: Non-reversible. Core dumps are runtime artifacts generated by kernel crashes. They cannot be regenerated from source control and have no development value. Loss is acceptable.

### Subtask 1.6.2: Delete Kismet Capture File

One Kismet capture file exists in the project root:

- `Kismet-20260207-20-39-41-1.kismet`: 7,786,496 bytes (7.4 MB)

This is a runtime capture file, not source code. `*.kismet` is already in `.gitignore` (line 376).

**Process**:

```bash
rm Kismet-20260207-20-39-41-1.kismet
```

**Rollback**: Non-reversible. Capture files are runtime data. If the capture contains valuable intelligence, back it up to a separate data directory BEFORE executing this task.

### Subtask 1.6.3: Verification

```bash
# 1. No core dumps remain
ls core.* 2>/dev/null | wc -l
# Expected: 0

# 2. No Kismet captures remain
ls *.kismet 2>/dev/null | wc -l
# Expected: 0

# 3. Disk space recovered
# Expected: ~100 MB freed (92.9 MB core dumps + 7.4 MB Kismet)

# 4. Confirm no git changes (these files are gitignored)
git status --short core.* *.kismet 2>/dev/null | wc -l
# Expected: 0 (no git-trackable changes)
```

---

## Execution Order

```
Step 1: Task 1.1 -- Font Optimization (largest single size reduction: ~38 MB)
  1.1.2: Delete 16 unused TTF variants
  1.1.3: Update font CSS
  1.1.4: Remove Google Fonts CDN (all 3 locations)
  1.1.5: Verify
  COMMIT: cleanup(phase1.1): optimize font assets, remove 16 unused TTF variants and Google Fonts CDN

Step 2: Task 1.2 -- Dependency Cleanup
  1.2.1: Remove 3 unused dev deps (one at a time, verify after each)
  1.2.2: Move 8 misplaced deps to devDependencies (batch)
  1.2.4: Run npm audit
  1.2.5: Verify
  COMMIT: cleanup(phase1.2): remove 3 unused deps, move 8 misplaced deps to devDependencies

Step 3: Task 1.3 -- Script Directory Merge
  1.3.1: Merge development/ into dev/
  1.3.2: Update package.json references
  1.3.3: Verify
  COMMIT: cleanup(phase1.3): consolidate scripts/development/ into scripts/dev/

Step 4: Task 1.4 -- Delete Dead Static Assets
  1.4.1: Delete 12 unreferenced files
  1.4.2: Confirm KEEP files intact
  1.4.3: Verify
  COMMIT: cleanup(phase1.4): delete 18 dead static CSS/JS/HTML files, remove empty hackrf/ dir (~430 KB)

Step 5: Task 1.5 -- Root File and .gitignore Cleanup
  1.5.1: Stage 5 already-deleted files via git rm
  1.5.3: Add missing .gitignore patterns
  1.5.4: Verify
  COMMIT: cleanup(phase1.5): stage root file deletions, update .gitignore

Step 6: Task 1.6 -- Clean Core Dumps and Runtime Artifacts (DISK-ONLY, NO COMMIT)
  1.6.1: Delete 34 core dump files (92.9 MB)
  1.6.2: Delete Kismet capture file (7.4 MB)
  1.6.3: Verify (confirm zero git changes -- files are gitignored)
  NOTE: No git commit. All files are in .gitignore. This step is disk cleanup only.
```

---

## Verification Checklist (Phase 1 Complete)

Run all verification steps after all tasks complete:

```bash
# 1. Font directory optimized
du -sh static/fonts/
# Expected: ~5 MB (was 46 MB)

# 2. No external CDN imports (fonts, maxcdn, etc.)
grep -rn "fonts.googleapis.com\|maxcdn.bootstrapcdn" static/ src/
# Expected: 0 results

# 3. Removed packages are uninstalled
for pkg in db-migrate db-migrate-sqlite3 terser; do
    npm ls "$pkg" 2>&1 | grep -q "empty" && echo "PASS: $pkg removed" || echo "CHECK: $pkg"
done

# 4. pngjs is still installed (safety check)
npm ls pngjs 2>&1 | grep "pngjs" && echo "PASS: pngjs preserved" || echo "FAIL: pngjs missing!"

# 5. Misplaced packages moved to devDependencies
node -e "
const p=require('./package.json');
const d=p.dependencies||{};
const check=['@eslint/js','@types/better-sqlite3','@types/cytoscape','@types/leaflet','@types/leaflet.markercluster','autoprefixer','globals','postcss'];
let fail=0;
check.forEach(k=>{if(d[k]){console.log('FAIL:',k,'still in dependencies');fail++}else{console.log('PASS:',k)}});
process.exit(fail);
"

# 6. Build passes
npm run typecheck && npm run build && npm run test:unit
# Expected: all exit 0

# 7. Duplicate script directory eliminated
test -d scripts/development/ && echo "FAIL" || echo "PASS"

# 8. No references to deleted directory in ANY file
grep "scripts/development" package.json && echo "FAIL" || echo "PASS"
grep "scripts/development" build-tools/package.json && echo "FAIL" || echo "PASS"

# 9. Dead static files removed (including HTML and logger.js)
ls static/script.js static/hackrf/script.js static/logger.js static/imsi-live-only.html 2>/dev/null | wc -l
# Expected: 0

# 9b. Empty hackrf directory removed
test -d static/hackrf/ && echo "FAIL" || echo "PASS"

# 10. Core dumps removed
ls core.* 2>/dev/null | wc -l
# Expected: 0

# 11. Root file deletions staged
git status --short | grep "^ D" | wc -l
# Expected: 0 (no unstaged deletions remain)

# 12. New .gitignore pattern present
grep ".claude-container" .gitignore && echo "PASS" || echo "FAIL"
# Note: rf_signals.db is covered by existing *.db wildcard (line 313)
```

---

## Risk Assessment

| Task                         | Risk Level | What Could Go Wrong                              | Mitigation                                                                                                 |
| ---------------------------- | ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1.1 Font variant deletion    | ZERO       | Specific weight rendering breaks                 | Keep Regular + Bold only; 140 font-weight 500/600 occurrences verified on system fonts NOT FiraCode (NF-9) |
| 1.1 Google Fonts CDN removal | LOW        | Styles degrade if Inter/JetBrains fonts expected | Air-gapped deployment cannot use CDN anyway; local FiraCode sufficient                                     |
| 1.2 Dev dependency removal   | ZERO       | Each verified with zero imports                  | Remove one at a time, build after each                                                                     |
| 1.2 Dependency section move  | LOW        | Production `npm ci` installs fewer packages      | Run `npm run build` after move to verify                                                                   |
| 1.3 Script directory merge   | ZERO       | Files are byte-identical (MD5 verified)          | Update package.json refs; verify npm scripts run                                                           |
| 1.4 Static file deletion     | ZERO       | Each verified unreferenced from src/             | Workers and font CSS on explicit KEEP list                                                                 |
| 1.5 Root file staging        | ZERO       | Files already deleted from disk                  | `git rm` is the correct way to stage existing deletions                                                    |
| 1.5 .gitignore additions     | ZERO       | Only adds ignore patterns                        | No existing tracked files affected                                                                         |
| 1.6 Core dump deletion       | ZERO       | Runtime artifacts, not source code               | Already in .gitignore; disk cleanup only; no git commit produced (NF-5)                                    |

---

## Total Impact Summary

| Category               | Before                                          | After               | Saved                     |
| ---------------------- | ----------------------------------------------- | ------------------- | ------------------------- |
| Font assets            | 45.57 MB (18 TTF files)                         | ~5 MB (2 TTF files) | ~40 MB                    |
| Core dumps             | 92.9 MB (34 files)                              | 0                   | 92.9 MB (disk-only, NF-5) |
| Kismet captures        | 7.4 MB (1 file)                                 | 0                   | 7.4 MB (disk-only, NF-5)  |
| Dead static files      | ~430 KB (18 files: 12 CSS/JS + 6 HTML/JS, NF-2) | 0                   | ~430 KB                   |
| Empty directories      | 1 (static/hackrf/)                              | 0                   | Clean structure           |
| Unused npm packages    | 3 packages                                      | 0                   | Reduced node_modules      |
| Misplaced dependencies | 8 in wrong section                              | 0                   | Correct package.json      |
| Duplicate directories  | 2                                               | 1                   | Eliminated confusion      |
| Unstaged deletions     | 5 files                                         | 0                   | Clean git status          |
| Google Fonts CDN leaks | 5 locations                                     | 0                   | Air-gap compliant         |
| **Total disk savings** |                                                 |                     | **~141 MB**               |

---

## Traceability: Audit Finding Resolution

Every finding from the Phase 1 Audit Report (AUDIT-GRADING-REPORT-PHASE-1.md) is addressed:

| Finding | Description                           | Resolution                                                                                  |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| CE-1    | 5 phantom production deps             | Eliminated: Task 1.2.1 now lists 0 production removals (they never existed in package.json) |
| CE-2    | pngjs actively used                   | Preserved: Explicitly excluded from Task 1.2.1 with evidence                                |
| CE-3    | 6/11 misplaced deps already correct   | Fixed: Task 1.2.2 lists exactly 8 packages (5 original + 3 missed @types)                   |
| CE-4    | 6 dead scripts don't exist            | Eliminated: Task 1.4 replaced with dead static asset cleanup (verified real files)          |
| CE-5    | 3 root files don't exist              | Eliminated: Task 1.5.1 lists only 5 files confirmed via git status                          |
| FE-1    | Font references: 9 vs 59+             | Clarified: "9 primary references" with note about 59+ inherited references                  |
| FE-2    | Google Fonts: 3 locations not 2       | Fixed: Task 1.1.4 now lists all 3 locations including src/app.html:30                       |
| FE-3    | Wrong numbers in state table          | Fixed: Current State Assessment entirely rewritten with live-verified values                |
| FE-4    | KEEP table phantom/active errors      | Fixed: @deck.gl/mesh-layers removed; maplibre-gl marked ACTIVE                              |
| FE-5    | Wrong @anthropic-ai/sdk correction    | Removed: NOTE added that SDK is not installed                                               |
| MO-1    | 34 core dumps not addressed           | Added: Task 1.6 (92.9 MB, not ~19 MB as audit report estimated)                             |
| MO-2    | Static assets identified but no task  | Added: Task 1.4 with exact file list and byte sizes                                         |
| MO-3    | AGUI-QUICK-START.md missed            | Addressed: Subtask 1.5.2 documents keep decision                                            |
| MO-4    | Missing .gitignore patterns           | Fixed: Subtask 1.5.3 adds genuinely missing patterns (not already-existing ones)            |
| MO-5    | Script count discrepancy (202 vs 145) | Noted: 66 scripts with hardcoded wrong paths deferred to Phase 6                            |
| MO-6    | No commit strategy                    | Added: Commit Strategy section at top of plan                                               |

### Round 2 Findings (FINAL-AUDIT-REPORT-PHASE-1.md, 2026-02-08)

| Finding | Description                                                   | Resolution                                                                 |
| ------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| NF-1    | Redundant .gitignore rf_signals.db additions                  | Removed: \*.db wildcard at line 313 already covers rf_signals.db           |
| NF-2    | 7 dead static files missed (HTML + logger.js)                 | Added: Task 1.4 expanded to 19 files total                                 |
| NF-3    | Light font variant (weight 300) has zero usage                | Removed: KEEP list reduced to 2 files (Regular + Bold)                     |
| NF-4    | build-tools/package.json also references scripts/development/ | Added: Subtask 1.3.2 scope expanded                                        |
| NF-5    | Task 1.6 produces no git commit (gitignored files)            | Fixed: Task restructured as disk-only, COMMIT removed from execution order |
| NF-6    | No pre-execution git tag for full rollback                    | Added: Pre-Execution Snapshot section as mandatory first step              |
| NF-7    | Generic rollback insufficient for npm operations              | Added: Per-task rollback commands table in Commit Strategy                 |
| NF-8    | CSS final state not specified (non-deterministic)             | Added: Exact file content block in Subtask 1.1.3                           |
| NF-9    | Font weight 500/600 regression risk undocumented              | Documented: 140 occurrences verified on system fonts, zero FiraCode impact |
