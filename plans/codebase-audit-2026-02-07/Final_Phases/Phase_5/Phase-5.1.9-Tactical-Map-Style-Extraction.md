# Phase 5.1.9 -- Tactical Map: Extract Style Section

| Field             | Value                                                             |
| ----------------- | ----------------------------------------------------------------- |
| **Phase**         | 5.1.9                                                             |
| **Title**         | Tactical Map: Extract Style Section                               |
| **Risk Level**    | ZERO                                                              |
| **Prerequisites** | None (can execute independently; recommended as first extraction) |
| **Files Touched** | 2 (1 modified, 1 created)                                         |
| **Standards**     | MISRA C:2023 Rule 1.1, Barr C Ch. 8                               |
| **Audit Date**    | 2026-02-08                                                        |
| **Auditor**       | Alex Thompson, Principal Quantum Software Architect               |

---

## 1. Objective

Extract the entire `<style>` block (1,306 lines) from the tactical-map-simple god
page into an external CSS file. CSS has no runtime behavior. It cannot cause functional
regressions. This extraction reduces the god page by 33% with zero risk of breaking
logic. This should execute first in the decomposition sequence to produce an immediate
line-count reduction and validate the extraction workflow.

---

## 2. Current State

**Source file**: `src/routes/tactical-map-simple/+page.svelte` (3,978 lines)

| Section         | Location    | Lines |
| --------------- | ----------- | ----- |
| `<style>` block | L2673-L3978 | 1,306 |

**Additional issue**: The template section contains 166 inline `style=` attributes.
Converting these to CSS classes is a follow-on task (low risk, high tedium) and is
NOT part of this extraction.

---

## 3. Implementation Steps

### Step 1: Create the External CSS File

Create `src/routes/tactical-map-simple/tactical-map.css`:

```bash
# Extract the style content (everything between <style> and </style> tags):
# Copy lines L2674 through L3977 (the content INSIDE the style tags, not the tags themselves)
# into the new CSS file.
```

### Step 2: Replace the Style Block in the God Page

Replace the entire `<style>...</style>` block (L2673-L3978) with:

```svelte
<style lang="css">
	@import './tactical-map.css';
</style>
```

**IMPORTANT -- Svelte style scoping**: Svelte scopes `<style>` blocks to the
component. When extracting to an external file, styles lose automatic scoping
unless imported correctly.

**Two scoping strategies**:

1. **Recommended**: Use `@import` within a `<style>` block (as shown above).
   The `@import` inside a `<style>` block is processed by the Svelte compiler
   and maintains scoping behavior.

2. **Alternative**: Use `:global()` wrapper for styles that target dynamically
   generated elements (e.g., Leaflet popup content, which is DOM-injected and
   not Svelte-rendered). For example:

    ```css
    :global(.signal-popup) {
    	/* styles for Leaflet popups */
    }
    ```

### Step 3: Verify Inline Style Attributes

The 166 inline `style=` attributes in the template are NOT affected by this
extraction. They remain in the template section. Converting them to CSS classes
in the extracted stylesheet is a follow-on task.

---

## 4. Verification Commands

```bash
# Verify CSS file created with correct size:
wc -l src/routes/tactical-map-simple/tactical-map.css
# Expected: ~1,306

# Verify god page reduced:
wc -l src/routes/tactical-map-simple/+page.svelte
# Expected: ~2,675 (3,978 - 1,306 + 3 lines for @import block)

# Verify the style block is now just the @import:
grep -c '@import.*tactical-map.css' src/routes/tactical-map-simple/+page.svelte
# Expected: 1

# Verify no style content remains inline:
grep -c '<style>' src/routes/tactical-map-simple/+page.svelte
# Expected: 1 (the @import wrapper)

# Build verification (most important):
npm run build
# Expected: 0 errors (CSS extraction cannot break JS logic)

# Visual spot-check (manual):
# Start dev server and navigate to /tactical-map-simple
# Verify layout, colors, fonts, spacing match pre-extraction state
```

---

## 5. Risk Assessment

| Risk                               | Severity | Likelihood | Mitigation                                              |
| ---------------------------------- | -------- | ---------- | ------------------------------------------------------- |
| Svelte style scoping lost          | MEDIUM   | MEDIUM     | Use @import inside <style> block to preserve scoping    |
| Leaflet popup styles not applied   | MEDIUM   | LOW        | Use :global() for DOM-injected elements (popup classes) |
| CSS syntax error in extracted file | LOW      | LOW        | npm run build catches CSS parse errors                  |

**Overall risk**: ZERO for functional regression. The only risk is cosmetic
(style scoping), which is immediately visible and non-breaking.

**CAUTION -- Svelte style scoping detail**: Styles that use `:global()` in the
original `<style>` block will continue to work after extraction. Styles that are
scoped (no `:global()`) will be scoped to the component when imported via `@import`.
However, styles targeting elements generated by Leaflet's DOM API (popup content,
tile layers, etc.) may need `:global()` wrapping if they don't already have it.

---

## 6. Standards Compliance

| Standard              | Requirement                           | How This Sub-Task Satisfies It                     |
| --------------------- | ------------------------------------- | -------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | Code shall conform to standard syntax | CSS file passes build validation                   |
| Barr C Ch. 8          | Each module shall have a header       | CSS file is a standalone module with clear purpose |

---

## 7. Rollback Strategy

```bash
# Revert to pre-extraction state:
git checkout -- src/routes/tactical-map-simple/+page.svelte
rm -f src/routes/tactical-map-simple/tactical-map.css
```

Instant revert. Zero cascading dependencies. This is the safest possible extraction.

---

## 8. Step Summary (Task 5.1.1 Context)

This step is Step 9 of the tactical-map-simple decomposition (Task 5.1.1). Despite
its Step 9 numbering, it executes FIRST in the overall execution order because it
carries ZERO risk.

| Metric             | Value                               |
| ------------------ | ----------------------------------- |
| Lines extracted    | 1,306                               |
| Risk level         | ZERO                                |
| Execution priority | 1 of 19                             |
| Functional impact  | None                                |
| Cosmetic impact    | Possible scoping change (mitigated) |

---

_Phase 5.1.9 -- Tactical Map: Extract Style Section_
_Execution priority: 1 of 19 (see Phase-5.1.20 for full execution order)_
_Estimated LOC change: -1,306 lines from god page_
