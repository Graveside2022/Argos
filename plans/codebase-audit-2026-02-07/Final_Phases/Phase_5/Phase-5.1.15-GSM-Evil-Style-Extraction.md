# Phase 5.1.15 -- GSM Evil: Extract Styles

| Field             | Value                                                           |
| ----------------- | --------------------------------------------------------------- |
| **Phase**         | 5.1.15                                                          |
| **Title**         | GSM Evil: Extract Styles                                        |
| **Risk Level**    | ZERO                                                            |
| **Prerequisites** | None (can execute independently; recommended early in sequence) |
| **Files Touched** | 2 (1 modified, 1 created)                                       |
| **Standards**     | MISRA C:2023 Rule 1.1, Barr C Ch. 8                             |
| **Audit Date**    | 2026-02-08                                                      |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect             |

---

## 1. Objective

Extract the entire `<style>` block (971 lines) from the GSM Evil god page into an
external CSS file. CSS has no runtime behavior. This extraction reduces the god page
by 37.5% with zero risk of breaking logic.

---

## 2. Current State

**Source file**: `src/routes/gsm-evil/+page.svelte` (2,591 lines)

| Section         | Location    | Lines |
| --------------- | ----------- | ----- |
| `<style>` block | L1621-L2591 | 971   |

---

## 3. Implementation Steps

### Step 1: Create the External CSS File

Create `src/routes/gsm-evil/gsm-evil.css`:

```bash
# Copy lines L1622 through L2590 (content INSIDE the style tags)
# into the new CSS file.
```

### Step 2: Replace the Style Block in the God Page

Replace the entire `<style>...</style>` block (L1621-L2591) with:

```svelte
<style lang="css">
	@import './gsm-evil.css';
</style>
```

**Svelte scoping**: Same caveats as Phase 5.1.9 (Tactical Map style extraction).
Use `@import` within `<style>` tag to preserve Svelte's scoping behavior. For
styles targeting dynamically generated elements, use `:global()` wrapper.

### Step 3: Consider Component-Scoped Styles

After Phase 5.1.14 (template panel extraction), some styles may need to be moved
from `gsm-evil.css` to the individual component files
(`ScanResultsPanel.svelte`, etc.). This is a follow-on optimization, not a
requirement for this step.

---

## 4. Verification Commands

```bash
# Verify CSS file created with correct size:
wc -l src/routes/gsm-evil/gsm-evil.css
# Expected: ~971

# Verify god page reduced:
wc -l src/routes/gsm-evil/+page.svelte
# Expected: ~1,623 (2,591 - 971 + 3 lines for @import block)

# Verify the style block is now just the @import:
grep -c '@import.*gsm-evil.css' src/routes/gsm-evil/+page.svelte
# Expected: 1

# Build verification:
npm run build
# Expected: 0 errors

# After all GSM Evil extractions complete:
wc -l src/routes/gsm-evil/+page.svelte
# Expected: ~300 (down from 2,591)
```

---

## 5. Risk Assessment

| Risk                               | Severity | Likelihood | Mitigation                                           |
| ---------------------------------- | -------- | ---------- | ---------------------------------------------------- |
| Svelte style scoping lost          | MEDIUM   | MEDIUM     | Use @import inside <style> block to preserve scoping |
| CSS syntax error in extracted file | LOW      | LOW        | npm run build catches CSS parse errors               |

**Overall risk**: ZERO for functional regression. Only cosmetic risk (style scoping),
immediately visible and non-breaking.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It   |
| --------------------- | ------------------------------------- | -------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | CSS file passes build validation |
| Barr C Ch. 8          | Each module shall have a header       | CSS file is a standalone module  |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/gsm-evil/+page.svelte
rm -f src/routes/gsm-evil/gsm-evil.css
```

Instant revert. Zero cascading dependencies.

---

## 8. Step Summary (Task 5.1.2 Context)

| Metric             | Value   |
| ------------------ | ------- |
| Lines extracted    | 971     |
| Risk level         | ZERO    |
| Execution priority | 3 of 19 |
| Functional impact  | None    |

---

_Phase 5.1.15 -- GSM Evil: Extract Styles_
_Execution priority: 3 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -971 lines from god page_
