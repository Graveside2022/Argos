# Phase 1.1: Font Asset Optimization

**Task ID**: 1.1
**Risk Level**: ZERO
**Produces Git Commit**: Yes
**Dependencies**: Task 1.0 (pre-execution snapshot)
**Standards**: CERT MEM51-CPP (minimize resource footprint), NASA/JPL Rule 1 (restrict to simple constructs)
**Audit Findings Resolved**: FE-1, FE-2, NF-3, NF-8, NF-9
**Estimated Savings**: ~40 MB (font files) + CDN leak elimination
**Commit Message**: `cleanup(phase1.1): optimize font assets, remove 16 unused TTF variants and Google Fonts CDN`

---

## Purpose

Reduce the font asset footprint from 45.57 MB (18 TTF files) to ~5 MB (2 TTF files) by removing unused font families and weight variants. Simultaneously eliminate all Google Fonts CDN references that leak DNS requests and fail in air-gapped tactical deployments.

## Pre-Conditions

- [ ] Task 1.0 (pre-execution snapshot) is complete
- [ ] `phase1-pre-execution` git tag exists
- [ ] Working tree is clean (no uncommitted changes to font files)

---

## Subtask 1.1.1: Font Inventory Verification

Before deleting any files, verify the current state matches the plan assumptions.

### Verify Font Directory Contents

```bash
ls -la static/fonts/firacode/
```

**Expected**: 18 TTF files across 3 families (FiraCodeNerdFont, FiraCodeNerdFontMono, FiraCodeNerdFontPropo), each with 6 weight variants (Light, Regular, Medium, SemiBold, Bold, Retina).

### Verify Total Size

```bash
du -sb static/fonts/firacode/
```

**Expected**: ~47,786,071 bytes (45.57 MB)

### Verify Font Usage in Source Code

Only 3 source files declare `font-family` referencing FiraCode directly:

| File                                                     | Purpose              |
| -------------------------------------------------------- | -------------------- |
| `src/app.html` (line 235)                                | `<link>` to CSS file |
| `src/lib/components/dashboard/TerminalTabContent.svelte` | Terminal font-family |
| `src/lib/components/dashboard/views/TerminalView.svelte` | Terminal font-family |

**Verification**:

```bash
grep -rl "FiraCode\|firacode" src/ --include="*.svelte" --include="*.css" --include="*.html"
```

**Expected**: Exactly the files listed above (plus CSS files that reference the font name, not the file path).

### Verify No FiraCode Elements Use Weight 500/600 (NF-9)

The codebase has 140 occurrences of `font-weight: 500` or `font-weight: 600` across 34 files. None of these apply to FiraCode elements -- they all apply to system fonts via Tailwind/CSS variables.

```bash
# Confirm: TerminalTabContent.svelte and TerminalView.svelte use only weight 400/700
grep -n "font-weight" src/lib/components/dashboard/TerminalTabContent.svelte
grep -n "font-weight" src/lib/components/dashboard/views/TerminalView.svelte
```

**Expected**: Only 400 and 700 weights referenced in FiraCode-using components.

**HALT condition**: If any FiraCode-using component references weight 300, 500, or 600, DO NOT proceed with font deletion. Re-evaluate the KEEP list.

---

## Subtask 1.1.2: Delete Unused Font Variants (18 -> 2 files)

### Files to KEEP (2 files)

| File                               | Weight | Approx Size | Justification           |
| ---------------------------------- | ------ | ----------- | ----------------------- |
| `FiraCodeNerdFontMono-Regular.ttf` | 400    | ~2.6 MB     | Default terminal weight |
| `FiraCodeNerdFontMono-Bold.ttf`    | 700    | ~2.6 MB     | Bold terminal output    |

### Files to DELETE (16 files, ~40 MB)

Execute the following deletions. Each `rm` is a single file -- no wildcards, no recursion. This ensures deterministic execution per NASA/JPL Rule 1.

```bash
# Non-Mono family (6 files) -- entire family unused
rm static/fonts/firacode/FiraCodeNerdFont-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Regular.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFont-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Bold.ttf
rm static/fonts/firacode/FiraCodeNerdFont-Retina.ttf

# Proportional family (6 files) -- entire family unused
rm static/fonts/firacode/FiraCodeNerdFontPropo-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Regular.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Bold.ttf
rm static/fonts/firacode/FiraCodeNerdFontPropo-Retina.ttf

# Extra Mono weights (4 files) -- unused weights including Light (NF-3)
rm static/fonts/firacode/FiraCodeNerdFontMono-Light.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-Medium.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-SemiBold.ttf
rm static/fonts/firacode/FiraCodeNerdFontMono-Retina.ttf
```

### Post-Deletion Verification

```bash
# Exactly 2 TTF files remain
find static/fonts/firacode/ -name "*.ttf" | wc -l
# Expected: 2

# Correct files remain
ls static/fonts/firacode/
# Expected: FiraCodeNerdFontMono-Bold.ttf  FiraCodeNerdFontMono-Regular.ttf

# Size reduced
du -sh static/fonts/firacode/
# Expected: ~5 MB
```

---

## Subtask 1.1.3: Update Font CSS (NF-8)

**File**: `static/fonts/firacode-nerd-font.css`

The CSS currently contains 5 `@font-face` declarations. Reduce to exactly 2 (Regular/400 and Bold/700).

Per NASA/JPL Rule 1 (deterministic output), the exact final-state content is specified below. Two engineers executing this plan MUST produce byte-identical output:

### Exact Final Content

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

### Verification (Deterministic Check)

```bash
wc -l static/fonts/firacode-nerd-font.css
# Expected: 15 lines (2 comments + 2 @font-face blocks + whitespace)

grep -c "@font-face" static/fonts/firacode-nerd-font.css
# Expected: 2

grep "font-weight:" static/fonts/firacode-nerd-font.css
# Expected: exactly 2 lines (400 and 700)
```

---

## Subtask 1.1.4: Remove Google Fonts External CDN (3 Locations)

Google Fonts CDN imports leak DNS requests and fail in air-gapped tactical deployments. All 3 runtime locations must be eliminated.

### Location 1: `static/custom-components-exact.css` (line 4)

Remove the `@import` line:

```
@import url('https://fonts.googleapis.com/css2?...')
```

### Location 2: `static/hackrf/custom-components-exact.css` (line 4)

Remove the `@import` line:

```
@import url('https://fonts.googleapis.com/css2?...')
```

**NOTE**: This file is scheduled for deletion in Task 1.4. If Task 1.1 executes before Task 1.4, remove the import. If Task 1.4 has already deleted this file, this step is a no-op.

### Location 3: `src/app.html` (line 30)

Remove the entire JavaScript font loader `<script>` block that dynamically creates a `<link>` element pointing to Google Fonts CDN:

```javascript
link.href = 'https://fonts.googleapis.com/css2?...';
```

The entire `<script>` block containing this loader must be removed.

### Additional CDN References (Informational)

Two additional CDN references exist but are handled elsewhere:

| File                                          | CDN                        | Disposition         |
| --------------------------------------------- | -------------------------- | ------------------- |
| `static/imsi-live-only.html:13`               | Google Fonts CDN over HTTP | Deleted by Task 1.4 |
| `scripts/infrastructure/download-fonts.sh:32` | Download source URL        | Deferred to Phase 6 |

### Verification (Must Return 0 Results)

```bash
grep -rn "fonts.googleapis.com" static/ src/
# Expected: 0 results

# Also check for maxcdn (found in imsi-live-only.html, should be gone after Task 1.4)
grep -rn "maxcdn.bootstrapcdn" static/ src/
# Expected: 0 results (if Task 1.4 complete) or 1 result (if Task 1.4 pending)
```

---

## Subtask 1.1.5: Final Verification

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

# 4. Font CSS has exactly 2 @font-face declarations
grep -c "@font-face" static/fonts/firacode-nerd-font.css
# Expected: 2

# 5. Build passes
npm run build
# Expected: exit code 0

# 6. Terminal font renders (manual check)
# Open dashboard, verify terminal renders FiraCode glyphs correctly
# Verify Regular (400) and Bold (700) weights render
```

---

## Rollback Procedure

```bash
git reset --soft HEAD~1
```

All changes in this task are git-tracked files. No `npm install` required.

## Risk Assessment

| Risk                                         | Level | Mitigation                                                                        |
| -------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| Font weight rendering breaks                 | ZERO  | 140 font-weight 500/600 occurrences verified on system fonts, NOT FiraCode (NF-9) |
| Styles degrade without Inter/JetBrains fonts | LOW   | Air-gapped deployment cannot use CDN anyway; local FiraCode sufficient            |
| Wrong files deleted                          | ZERO  | Explicit file-by-file rm, no wildcards. KEEP files listed.                        |

## Completion Criteria

- [ ] 16 TTF files deleted, 2 remain (Regular + Bold Mono)
- [ ] Font CSS contains exactly 2 `@font-face` declarations
- [ ] Zero Google Fonts CDN references in `static/` and `src/`
- [ ] `npm run build` exits 0
- [ ] Git commit created with correct message format
