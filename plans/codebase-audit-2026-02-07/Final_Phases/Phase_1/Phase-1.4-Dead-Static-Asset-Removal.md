# Phase 1.4: Dead Static Asset Removal

**Task ID**: 1.4
**Risk Level**: ZERO
**Produces Git Commit**: Yes
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: CERT MEM51-CPP (minimize resource footprint), OWASP A05:2021 (security misconfiguration)
**Audit Findings Resolved**: CE-4, MO-2, NF-2
**Estimated Savings**: ~430 KB (18 files)
**Commit Message**: `cleanup(phase1.4): delete 18 dead static CSS/JS/HTML files, remove empty hackrf/ dir (~430 KB)`

---

## Purpose

Delete 18 static files that have zero references from `src/`. These files are stale copies, legacy scripts, and dead HTML pages that serve no runtime purpose and unnecessarily increase the attack surface. One file (`static/imsi-live-only.html`) contains plaintext HTTP CDN requests that leak DNS queries and are vulnerable to MITM injection in tactical environments.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] No running processes serve files from `static/` (dev server should be stopped)

---

## Subtask 1.4.1: Pre-Deletion Verification

Before deleting any file, confirm it has zero references from source code.

### Verify Each File Is Unreferenced

```bash
# CSS files (8 files)
for f in "custom-components-exact.css" "geometric-backgrounds.css" "monochrome-theme.css" "saasfly-buttons.css"; do
    echo "--- static/$f ---"
    grep -rn "$f" src/ --include="*.svelte" --include="*.ts" --include="*.html" --include="*.css" | grep -v "node_modules"
    echo "--- static/hackrf/$f ---"
    grep -rn "hackrf/$f" src/ --include="*.svelte" --include="*.ts" --include="*.html" --include="*.css" | grep -v "node_modules"
done

# JS files (4 files)
for f in "script.js" "api-config.js"; do
    echo "--- static/$f ---"
    grep -rn "\"/$f\"\|'/$f'" src/ --include="*.svelte" --include="*.ts" --include="*.html" | grep -v "node_modules"
    echo "--- static/hackrf/$f ---"
    grep -rn "\"hackrf/$f\"\|'hackrf/$f'" src/ --include="*.svelte" --include="*.ts" --include="*.html" | grep -v "node_modules"
done

# Additional files (NF-2: 6 files)
for f in "logger.js" "imsi-clean.html" "gsm-evil-proxy.html" "imsi-live-only.html" "debug-gsm-socket.html" "imsi-with-history.html"; do
    echo "--- static/$f ---"
    grep -rn "$f" src/ --include="*.svelte" --include="*.ts" --include="*.html" | grep -v "node_modules"
done
```

**Expected**: Zero results for every file. If any file shows references, DO NOT delete it -- investigate.

**HALT condition**: If any `grep` returns results indicating active usage, remove that file from the deletion list and document the finding.

---

## Subtask 1.4.2: Delete Dead Files

### CSS Files (8 files, 156,314 bytes)

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

```bash
rm static/custom-components-exact.css
rm static/geometric-backgrounds.css
rm static/monochrome-theme.css
rm static/saasfly-buttons.css
rm static/hackrf/custom-components-exact.css
rm static/hackrf/geometric-backgrounds.css
rm static/hackrf/monochrome-theme.css
rm static/hackrf/saasfly-buttons.css
```

### JS Files (4 files, 245,155 bytes)

| #   | File                          | Size (bytes) | Reason Dead                                    |
| --- | ----------------------------- | ------------ | ---------------------------------------------- |
| 9   | `static/script.js`            | 125,358      | Unreferenced legacy script                     |
| 10  | `static/hackrf/script.js`     | 118,300      | Unreferenced legacy script (different version) |
| 11  | `static/api-config.js`        | 131          | Unreferenced config stub                       |
| 12  | `static/hackrf/api-config.js` | 1,366        | Unreferenced config (different version)        |

```bash
rm static/script.js
rm static/hackrf/script.js
rm static/api-config.js
rm static/hackrf/api-config.js
```

### Additional Dead Files (NF-2: 6 files, 29,141 bytes)

| #   | File                            | Size (bytes) | Reason Dead               | Security Note                              |
| --- | ------------------------------- | ------------ | ------------------------- | ------------------------------------------ |
| 13  | `static/logger.js`              | 2,056        | Zero references from src/ | None                                       |
| 14  | `static/imsi-clean.html`        | 4,221        | Zero references from src/ | None                                       |
| 15  | `static/gsm-evil-proxy.html`    | 1,879        | Zero references from src/ | None                                       |
| 16  | `static/imsi-live-only.html`    | 8,860        | Zero references from src/ | **HTTP CDN leaks (maxcdn + Google Fonts)** |
| 17  | `static/debug-gsm-socket.html`  | 2,402        | Zero references from src/ | None                                       |
| 18  | `static/imsi-with-history.html` | 9,723        | Zero references from src/ | None                                       |

**SECURITY NOTE**: `static/imsi-live-only.html` lines 12-13 contain plaintext HTTP CDN requests to `maxcdn.bootstrapcdn.com` and `fonts.googleapis.com`. These leak DNS queries and are vulnerable to MITM injection in tactical environments. Deleting the file eliminates the vulnerability. Per OWASP A05:2021 (Security Misconfiguration).

```bash
rm static/logger.js
rm static/imsi-clean.html
rm static/gsm-evil-proxy.html
rm static/imsi-live-only.html
rm static/debug-gsm-socket.html
rm static/imsi-with-history.html
```

### Remove Empty Directory

After all 6 `static/hackrf/*` files are deleted, the directory is empty and should be removed:

```bash
rmdir static/hackrf/
```

**NOTE**: `rmdir` (not `rm -rf`) is used intentionally. `rmdir` fails if the directory is not empty, which would indicate an unexpected file exists and needs investigation.

---

## Subtask 1.4.3: Confirm KEEP Files Intact

These static files ARE referenced from `src/` and MUST be preserved. Verify they still exist after the deletion operation.

| File                                    | Size (bytes) | Referenced By                                 | Line |
| --------------------------------------- | ------------ | --------------------------------------------- | ---- |
| `static/workers/gridProcessor.js`       | 12,421       | `src/lib/services/map/gridProcessor.ts`       | 89   |
| `static/workers/interpolationWorker.js` | 4,699        | `src/lib/services/map/signalInterpolation.ts` | 51   |
| `static/fonts/firacode-nerd-font.css`   | 1,076        | `src/app.html`                                | 235  |

Leaflet assets (also KEEP):

| File                                | Purpose                    |
| ----------------------------------- | -------------------------- |
| `static/leaflet/marker-icon.png`    | Map marker icon            |
| `static/leaflet/marker-icon-2x.png` | Map marker icon (retina)   |
| `static/leaflet/marker-shadow.png`  | Map marker shadow          |
| `static/leaflet/layers.png`         | Map layer control          |
| `static/leaflet/layers-2x.png`      | Map layer control (retina) |

```bash
# Verify KEEP files exist
test -f static/workers/gridProcessor.js && echo "PASS" || echo "FAIL: worker missing!"
test -f static/workers/interpolationWorker.js && echo "PASS" || echo "FAIL: worker missing!"
test -f static/fonts/firacode-nerd-font.css && echo "PASS" || echo "FAIL: font CSS missing!"

# Verify Leaflet assets exist
for f in static/leaflet/marker-icon.png static/leaflet/marker-icon-2x.png static/leaflet/marker-shadow.png static/leaflet/layers.png static/leaflet/layers-2x.png; do
    test -f "$f" && echo "PASS: $f" || echo "FAIL: $f missing!"
done
```

**Expected**: All PASS. Any FAIL is a critical error -- restore from git immediately.

---

## Subtask 1.4.4: Final Verification

```bash
# 1. All 18 dead files are gone
for f in static/custom-components-exact.css static/geometric-backgrounds.css static/monochrome-theme.css static/saasfly-buttons.css static/hackrf/custom-components-exact.css static/hackrf/geometric-backgrounds.css static/hackrf/monochrome-theme.css static/hackrf/saasfly-buttons.css static/script.js static/hackrf/script.js static/api-config.js static/hackrf/api-config.js static/logger.js static/imsi-clean.html static/gsm-evil-proxy.html static/imsi-live-only.html static/debug-gsm-socket.html static/imsi-with-history.html; do
    test -f "$f" && echo "FAIL: $f still exists" || echo "PASS: $f deleted"
done
# Expected: all PASS

# 2. Empty hackrf directory removed
test -d static/hackrf/ && echo "FAIL: empty dir remains" || echo "PASS: dir removed"
# Expected: PASS

# 3. No external CDN references remain in static/ or src/
grep -rn "fonts.googleapis.com\|maxcdn.bootstrapcdn" static/ src/
# Expected: 0 results (assuming Task 1.1 CDN removal is also complete)

# 4. KEEP files still exist (critical safety check)
test -f static/workers/gridProcessor.js && echo "PASS" || echo "CRITICAL FAIL: worker missing!"
test -f static/workers/interpolationWorker.js && echo "PASS" || echo "CRITICAL FAIL: worker missing!"

# 5. Build passes (no broken references)
npm run build
# Expected: exit 0
```

---

## Rollback Procedure

```bash
git reset --soft HEAD~1
```

All changes in this task are git-tracked files. No `npm install` required.

## Risk Assessment

| Risk                        | Level | Mitigation                                                |
| --------------------------- | ----- | --------------------------------------------------------- |
| Deleting a referenced file  | ZERO  | Each file verified with zero src/ references              |
| Breaking worker scripts     | ZERO  | Workers on explicit KEEP list with reference verification |
| Missing a file              | ZERO  | Expanded from 12 to 18 files per NF-2 audit               |
| Empty directory not removed | ZERO  | rmdir fails safely if directory not empty                 |

## Completion Criteria

- [ ] 18 dead static files deleted
- [ ] `static/hackrf/` directory removed (empty)
- [ ] All KEEP files verified present (workers, font CSS, leaflet)
- [ ] Zero CDN references in `static/` and `src/`
- [ ] `npm run build` exits 0
- [ ] Git commit created with correct message format
