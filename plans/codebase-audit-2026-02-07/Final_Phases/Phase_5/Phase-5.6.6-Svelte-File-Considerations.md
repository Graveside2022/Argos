# Phase 5.6.6: Svelte File Considerations

| Attribute            | Value                                             |
| -------------------- | ------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.6                                |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                   |
| **Risk Level**       | LOW                                               |
| **Prerequisites**    | Task 5.6.1 COMPLETE (size rules in ESLint config) |
| **Estimated Effort** | 10 minutes (verification only)                    |
| **Standards**        | MISRA C:2023 Rule 1.1                             |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY             |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                |
| **Date**             | 2026-02-08                                        |

---

## 1. Objective

Document how ESLint's `max-lines` and `max-lines-per-function` rules interact with Svelte's multi-section file format. Identify potential false positives from template and style sections, define mitigation strategies, and provide verification commands.

---

## 2. Svelte File Structure

Svelte files have three sections:

```svelte
<script lang="ts">
	// TypeScript code
</script>

<!-- HTML template -->
<div>...</div>

<style>
	/* CSS */
</style>
```

---

## 3. How ESLint Counts Lines in .svelte Files

### 3.1 max-lines Rule Behavior

When ESLint processes `.svelte` files through `svelte-eslint-parser` (v1.2.0, installed in this project), the `max-lines` rule counts ALL lines in the file, including the `<template>` and `<style>` sections. This is because ESLint sees the entire file as a single source unit.

**Implication**: A Svelte file with 100 lines of TypeScript, 150 lines of template HTML, and 50 lines of CSS totals 300+ raw lines. After `skipBlankLines` and `skipComments`, the count may still exceed 300 if the template is large.

### 3.2 Line Counting Example

| Section    | Raw Lines | Blank Lines | Comment Lines | Counted Lines |
| ---------- | --------- | ----------- | ------------- | ------------- |
| `<script>` | 100       | 10          | 15            | 75            |
| Template   | 150       | 5           | 3             | 142           |
| `<style>`  | 50        | 3           | 5             | 42            |
| **Total**  | **300**   | **18**      | **23**        | **259**       |

In this example: 300 raw lines - 18 blank - 23 comments = 259 counted lines. Compliant.

### 3.3 Problematic Example

| Section    | Raw Lines | Blank Lines | Comment Lines | Counted Lines |
| ---------- | --------- | ----------- | ------------- | ------------- |
| `<script>` | 120       | 5           | 10            | 105           |
| Template   | 200       | 3           | 0             | 197           |
| `<style>`  | 30        | 2           | 2             | 26            |
| **Total**  | **350**   | **10**      | **12**        | **328**       |

In this example: 350 - 10 - 12 = 328 counted lines. **VIOLATION** (exceeds 300).

The violation is caused by a dense 200-line HTML template, even though the TypeScript logic section is manageable at 105 lines.

---

## 4. max-lines-per-function and Svelte

The `max-lines-per-function` rule applies to functions defined in the `<script>` section. It does NOT count template lines or style lines as part of any function. This rule works correctly with `svelte-eslint-parser` and requires no special handling for Svelte files.

**Behavior summary**:

| Rule                     | Counts `<script>` | Counts Template | Counts `<style>` |
| ------------------------ | ----------------- | --------------- | ---------------- |
| `max-lines`              | YES               | YES             | YES              |
| `max-lines-per-function` | YES (functions)   | NO              | NO               |

---

## 5. Mitigation Strategies

### 5.1 Template Size Reduction (Primary Strategy)

Phase 5.1 (God Page Decomposition) addresses this by:

1. **Extracting large template sections into child components** -- reduces template lines
2. **Extracting CSS to Tailwind utility classes or shared stylesheets** -- reduces style lines
3. **Extracting TypeScript logic to service modules** -- reduces script lines

After Phase 5.1, the largest Svelte pages should fit within 300 total lines.

### 5.2 Component Extraction (Resolution for Edge Cases)

If edge cases arise where a Svelte file exceeds 300 lines due to template density (many short HTML elements, each on its own line), the resolution is **component extraction**, NOT an exemption.

**Example**: A page with a 200-line data table template should extract the table into a `<DataTable>` child component:

```svelte
<!-- BEFORE: 350 lines total -->
<script lang="ts">
    // 100 lines of logic
</script>

<div class="container">
    <table>
        <!-- 200 lines of table rows, columns, headers -->
    </table>
</div>

<!-- AFTER: 180 lines total -->
<script lang="ts">
    import DataTable from './DataTable.svelte';
    // 60 lines of logic (40 lines moved to DataTable)
</script>

<div class="container">
    <DataTable {data} {columns} />
</div>
```

### 5.3 No Svelte-Specific Exemptions

Svelte files are NOT eligible for `max-lines` exemptions. The exemption policy (Task 5.6.2) requires files to contain ZERO functions, ZERO control flow, ZERO side effects. Svelte files inherently contain reactive code and template logic, disqualifying them from exemption.

---

## 6. Verification Commands

### 6.1 Identify Svelte-Specific Size Issues

After enabling the rules, run the following to identify any Svelte-specific issues:

```bash
npx eslint src/ --config config/eslint.config.js 2>&1 \
  | grep -E "\.svelte" \
  | grep -E "max-lines" \
  | tee /tmp/svelte-size-issues.txt

echo "Svelte-specific size issues: $(wc -l < /tmp/svelte-size-issues.txt)"
```

**Expected output**: `Svelte-specific size issues: 0`

### 6.2 Audit Svelte File Sizes

```bash
# List all Svelte files by raw line count (descending)
find src -name "*.svelte" -exec wc -l {} \; | sort -rn | head -20

# List Svelte files approaching the limit (>250 raw lines)
find src -name "*.svelte" -exec wc -l {} \; | awk '$1 > 250' | sort -rn
```

### 6.3 Breakdown by Section

For a specific Svelte file, count lines per section:

```bash
FILE="src/routes/hackrf/+page.svelte"

SCRIPT_LINES=$(sed -n '/<script/,/<\/script>/p' "$FILE" | wc -l)
STYLE_LINES=$(sed -n '/<style/,/<\/style>/p' "$FILE" | wc -l)
TOTAL_LINES=$(wc -l < "$FILE")
TEMPLATE_LINES=$((TOTAL_LINES - SCRIPT_LINES - STYLE_LINES))

echo "Total: $TOTAL_LINES"
echo "Script: $SCRIPT_LINES"
echo "Template: $TEMPLATE_LINES"
echo "Style: $STYLE_LINES"
```

---

## 7. Risk Mitigations

| Risk                                           | Impact | Mitigation                                                                     |
| ---------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Svelte template density causes false positives | MEDIUM | Component extraction resolves all cases; no exemptions for Svelte files        |
| Style section inflates line count              | LOW    | Tailwind utility classes minimize `<style>` sections; extraction to shared CSS |
| svelte-eslint-parser version change            | LOW    | Parser behavior is stable; pinned to v1.2.0                                    |
| Developers confused by Svelte line counting    | LOW    | Section 3-4 documents exact behavior; breakdown command in Section 6.3         |

---

## 8. Rollback Strategy

No changes are made in this sub-task. This is a documentation and verification task. If Svelte-specific issues are found during verification, they are resolved via component extraction (Phase 5.1 techniques), not configuration changes.

---

## 9. Standards Compliance

| Standard              | Requirement                                | Resolution                                                 |
| --------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| MISRA C:2023 Rule 1.1 | All code shall conform to coding standards | Svelte files subject to same standards as TypeScript files |

---

**END OF DOCUMENT**
