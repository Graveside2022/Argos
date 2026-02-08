# Phase 5.1.19 -- Sweep: Extract and Deduplicate Styles

| Field             | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **Phase**         | 5.1.19                                                          |
| **Title**         | Sweep: Extract and Deduplicate Styles                           |
| **Risk Level**    | ZERO                                                            |
| **Prerequisites** | None (can execute independently; recommended early in sequence) |
| **Files Touched** | 4 (2 modified, 2-3 created)                                     |
| **Standards**     | MISRA C:2023 Rule 1.1, MISRA C:2023 Dir 4.4, Barr C Ch. 8       |
| **Audit Date**    | 2026-02-08                                                      |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect             |

---

## 1. Objective

Extract and deduplicate the style sections from both sweep pages. Both style blocks
share a high degree of structural similarity (same class names, same color schemes,
same layout patterns). Extract shared styles into a common CSS file and keep only
device-specific overrides in each page. This produces a net reduction in total CSS
lines through deduplication.

---

## 2. Current State

| Source File                           | Style Location | Lines     |
| ------------------------------------- | -------------- | --------- |
| `src/routes/rfsweep/+page.svelte`     | L1557-L2245    | 689       |
| `src/routes/hackrfsweep/+page.svelte` | L1315-L1830    | 516       |
| **Total**                             |                | **1,205** |

Both style blocks share the same class names, color schemes, and layout patterns
because both pages implement the same sweep workflow UI.

---

## 3. Implementation Steps

### Step 1: Analyze Style Overlap

Before extracting, diff the two style blocks to identify shared vs device-specific rules:

```bash
# Extract style sections for comparison:
sed -n '1557,2245p' src/routes/rfsweep/+page.svelte > /tmp/rfsweep-styles.css
sed -n '1315,1830p' src/routes/hackrfsweep/+page.svelte > /tmp/hackrf-styles.css
sdiff -s /tmp/rfsweep-styles.css /tmp/hackrf-styles.css | wc -l
# This shows the number of DIFFERING lines
```

### Step 2: Create Shared CSS File

Create `src/lib/components/sweep/sweep-common.css` (~500 lines):

```css
/* src/lib/components/sweep/sweep-common.css */
/* Shared styles for RF sweep pages (HackRF + USRP) */
/* Extracted from rfsweep and hackrfsweep page styles */

/* Layout */
.sweep-container { ... }
.sweep-header { ... }
.sweep-controls { ... }

/* Signal gauge */
.signal-gauge { ... }
.signal-bar { ... }

/* Frequency list */
.frequency-list { ... }
.frequency-item { ... }

/* Cycle status */
.cycle-card { ... }
.progress-bar { ... }

/* ... all shared class definitions ... */
```

### Step 3: Create Device-Specific Override Files

Create `src/routes/rfsweep/rfsweep-overrides.css` (~100 lines):

```css
/* src/routes/rfsweep/rfsweep-overrides.css */
/* USRP-specific style overrides */

.power-measurement { ... }
/* ... USRP-specific class definitions ... */
```

Create `src/routes/hackrfsweep/hackrf-overrides.css` (~50 lines):

```css
/* src/routes/hackrfsweep/hackrf-overrides.css */
/* HackRF-specific style overrides */

/* ... HackRF-specific class definitions (if any) ... */
```

### Step 4: Update Both Pages

Replace the `<style>` block in `rfsweep/+page.svelte`:

```svelte
<style lang="css">
	@import '$lib/components/sweep/sweep-common.css';
	@import './rfsweep-overrides.css';
</style>
```

Replace the `<style>` block in `hackrfsweep/+page.svelte`:

```svelte
<style lang="css">
	@import '$lib/components/sweep/sweep-common.css';
	@import './hackrf-overrides.css';
</style>
```

**Svelte scoping**: Same caveats as Phase 5.1.9. Use `@import` within `<style>` tag
to preserve Svelte's scoping behavior.

### Step 5: Build Verification

```bash
npm run build
```

---

## 4. Verification Commands

```bash
# Verify shared CSS file created:
wc -l src/lib/components/sweep/sweep-common.css
# Expected: ~500

# Verify override files created:
wc -l src/routes/rfsweep/rfsweep-overrides.css
# Expected: ~100

wc -l src/routes/hackrfsweep/hackrf-overrides.css
# Expected: ~50

# Verify page sizes reduced:
wc -l src/routes/rfsweep/+page.svelte src/routes/hackrfsweep/+page.svelte
# Expected: significantly reduced (style sections removed)

# Build verification:
npm run build
# Expected: 0 errors

# Visual regression (manual):
# Navigate to /rfsweep and /hackrfsweep
# Verify layout, colors, fonts, spacing match pre-extraction state
```

---

## 5. Metrics

| Metric                      | Before | After       | Change |
| --------------------------- | ------ | ----------- | ------ |
| rfsweep style lines         | 689    | 4 (@import) | -685   |
| hackrfsweep style lines     | 516    | 4 (@import) | -512   |
| Total style lines extracted | 1,205  | --          | --     |
| Net new CSS lines           | --     | ~650        | --     |
| Deduplication savings       | --     | ~555        | -46%   |

**Total extracted**: 1,205 lines
**Net new lines**: ~650 (500 shared + 100 + 50)
**Savings from deduplication**: ~555 lines (the overlap between the two style blocks)

---

## 6. Risk Assessment

| Risk                                 | Severity | Likelihood | Mitigation                                                  |
| ------------------------------------ | -------- | ---------- | ----------------------------------------------------------- |
| Svelte style scoping lost            | MEDIUM   | MEDIUM     | Use @import inside <style> block to preserve scoping        |
| Shared style accidentally overridden | LOW      | LOW        | Override files only contain device-specific rules           |
| CSS specificity conflicts            | LOW      | LOW        | Shared styles come first; overrides have higher specificity |
| Visual difference between pages      | LOW      | LOW        | Manual visual comparison after extraction                   |

**Overall risk**: ZERO for functional regression. CSS cannot break JavaScript logic.
Only cosmetic risk (style scoping, specificity), immediately visible.

---

## 7. Standards Compliance

| Standard              | Requirement                                    | How This Sub-Task Satisfies It                          |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax          | CSS files pass build validation                         |
| MISRA C:2023 Dir 4.4  | Sections of code should not be "commented out" | Duplicated CSS consolidated into shared file            |
| Barr C Ch. 8          | Each module shall have a header                | Each CSS file is a standalone module with clear purpose |

---

## 8. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/rfsweep/+page.svelte
git checkout -- src/routes/hackrfsweep/+page.svelte
rm -f src/lib/components/sweep/sweep-common.css
rm -f src/routes/rfsweep/rfsweep-overrides.css
rm -f src/routes/hackrfsweep/hackrf-overrides.css
```

Instant revert. Zero cascading dependencies.

---

_Phase 5.1.19 -- Sweep: Extract and Deduplicate Styles_
_Execution priority: 4 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -1,205 lines from god pages, +650 net new CSS lines_
