# Phase 5.6.2: Exemption Policy Configuration

| Attribute            | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.2                                      |
| **Phase**            | 5.6 -- ESLint Enforcement Gates                         |
| **Risk Level**       | LOW                                                     |
| **Prerequisites**    | Task 5.6.1 COMPLETE (size rules added to ESLint config) |
| **Estimated Effort** | 15 minutes                                              |
| **Standards**        | MISRA C:2023 Rule 1.1, MISRA C:2023 Directive 4.14      |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                   |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)                      |
| **Date**             | 2026-02-08                                              |

---

## 1. Objective

Define and codify the exemption policy for `max-lines` rule enforcement. This policy governs when and how a file may be exempted from the 300-line limit, establishes the required comment format, identifies candidate files, and sets a quarterly audit schedule.

**Critical constraint**: No file may EVER be exempted from `max-lines-per-function`. There are zero legitimate engineering reasons for a function to exceed 60 lines of executable code.

---

## 2. Exemption Policy -- Five Mandatory Criteria

Exemptions from `max-lines` are granted ONLY for files meeting ALL of the following criteria:

| #   | Criterion                                                                  | Rationale                                                      |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | The file contains ONLY static data (lookup tables, constant arrays, enums) | Static data cannot be decomposed without artificial boundaries |
| 2   | The file contains ZERO functions, ZERO control flow, ZERO side effects     | Presence of any logic means the file should be decomposed      |
| 3   | The file is a pure declaration (compiles to a constant in any language)    | Runtime behavior files must fit within size limits             |
| 4   | A written justification is reviewed and approved by the lead engineer      | Human oversight prevents exemption abuse                       |
| 5   | The exemption comment references this document by ID (ARGOS-AUDIT-P5.6)    | Traceability to the governing policy                           |

### Absolute Prohibition

**No file may EVER be exempted from `max-lines-per-function`.** Any function claiming to need an exemption is a function that has not been properly decomposed. There are zero legitimate engineering reasons for a function to exceed 60 lines of executable code.

---

## 3. Candidate Exemption Files

| File                              | Expected Size                                 | Content                                                                   | Justification                                                                                                                                                         |
| --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/gsmLookupTables.ts` | ~800 lines                                    | Static MNC-to-carrier and MCC-to-country `Record<string, string>` objects | Pure data. No functions. No logic. Splitting would create artificial module boundaries within a single lookup table. ITU-T E.212 defines the structure; we mirror it. |
| `src/lib/server/kismet/types.ts`  | ~350 lines (after Phase 4 type consolidation) | Pure TypeScript `interface` and `type` definitions                        | No runtime code. No functions. Interfaces are compile-time only. Splitting type files by arbitrary line count reduces co-location of related types.                   |

### Candidate Evaluation Checklist

For each candidate file, verify all five criteria:

```bash
# Criterion 1 & 2: Verify zero functions, zero control flow
grep -cE "function |=> |if \(|for \(|while \(|switch \(" src/lib/data/gsmLookupTables.ts
# Expected: 0

# Criterion 3: Verify pure declarations
grep -cE "^export (const|type|interface|enum)" src/lib/data/gsmLookupTables.ts
# Expected: >0 (pure exports)

# Count executable lines (not blank, not comments)
grep -cv '^\s*$\|^\s*//' src/lib/data/gsmLookupTables.ts
# Expected: documents the actual size
```

---

## 4. Exemption Comment Format

The exemption comment MUST appear as the FIRST non-empty line of the file, before any imports:

```typescript
/* eslint-disable max-lines */
// EXEMPTION: ARGOS-AUDIT-P5.6 Section 3.2
// Reason: Pure static ITU-T E.212 lookup tables. Zero functions, zero control flow.
// Approved by: [Lead Engineer Name], [Date]
// Review date: [Next quarterly review date]

export const mncToCarrier: Record<string, string> = {
	// ...
};
```

### Comment Requirements

| #   | Requirement                                                  | Rationale                                  |
| --- | ------------------------------------------------------------ | ------------------------------------------ |
| 1   | References document ID (`ARGOS-AUDIT-P5.6 Section 3.2`)      | Traceability to governing policy           |
| 2   | States the specific reason (not generic "file is too large") | Prevents boilerplate exemptions            |
| 3   | Names the approving engineer                                 | Accountability and audit trail             |
| 4   | Includes a review date (quarterly)                           | Ensures exemptions do not become permanent |

### Invalid Exemption Comments (DO NOT USE)

```typescript
// WRONG: Generic reason
/* eslint-disable max-lines */
// This file is too large to split.

// WRONG: No document reference
/* eslint-disable max-lines */
// Contains lookup tables.

// WRONG: No approver
/* eslint-disable max-lines */
// EXEMPTION: ARGOS-AUDIT-P5.6 Section 3.2
// Reason: Pure data.
```

---

## 5. Quarterly Exemption Audit Schedule

All exemptions must be reviewed quarterly. During each review:

| #   | Audit Step                                                                     | Verification Command                            |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1   | Verify the file still meets all five criteria in Section 2                     | `grep -cE "function \|=> " <file>` returns 0    |
| 2   | Verify no functions have been added to the file                                | `grep -c "function" <file>` returns 0           |
| 3   | Verify file size has not grown beyond last-reviewed size without justification | `wc -l <file>` compared to previous review      |
| 4   | Update the review date in the exemption comment                                | Manual edit of `// Review date:` line           |
| 5   | Log the review in the project audit trail                                      | Entry in audit log with date, reviewer, finding |

### Audit Calendar

| Quarter | Review Window   | Reviewer Assignment |
| ------- | --------------- | ------------------- |
| Q1 2026 | March 15-31     | Lead Engineer       |
| Q2 2026 | June 15-30      | Lead Engineer       |
| Q3 2026 | September 15-30 | Lead Engineer       |
| Q4 2026 | December 15-31  | Lead Engineer       |

### Quarterly Audit Verification Script

```bash
#!/usr/bin/env bash
# Quarterly exemption audit script
# Run: bash scripts/audit-exemptions.sh

echo "=== ESLint max-lines Exemption Audit ==="
echo "Date: $(date)"
echo ""

EXEMPT_FILES=$(grep -rl "eslint-disable max-lines" src/ 2>/dev/null)
EXEMPT_COUNT=$(echo "$EXEMPT_FILES" | grep -c "." 2>/dev/null || echo 0)

echo "Total exempted files: ${EXEMPT_COUNT}"
echo ""

for FILE in $EXEMPT_FILES; do
    echo "--- $FILE ---"
    echo "  Lines: $(wc -l < "$FILE")"
    echo "  Functions: $(grep -cE 'function |=> ' "$FILE")"
    echo "  Control flow: $(grep -cE 'if \(|for \(|while \(|switch \(' "$FILE")"
    head -5 "$FILE" | sed 's/^/  /'
    echo ""
done

echo "=== Audit Complete ==="
```

---

## 6. Verification Commands

| #   | Check                                    | Command                                                  | Expected Result                                          |
| --- | ---------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| V10 | Exempted file has correct comment format | `head -4 src/lib/data/gsmLookupTables.ts`                | Shows `eslint-disable max-lines` + justification         |
| V11 | Exempted file contains zero functions    | `grep -c "function\|=>" src/lib/data/gsmLookupTables.ts` | `0` (or only type annotations, not function definitions) |
| V12 | All exemptions documented                | Count `eslint-disable max-lines` across `src/`           | Count matches number of approved exemptions in Section 3 |

### Exemption Count Verification

```bash
# Count actual eslint-disable max-lines comments in source
ACTUAL=$(grep -rl "eslint-disable max-lines" src/ | wc -l)
EXPECTED=2  # gsmLookupTables.ts + kismet/types.ts

if [ "$ACTUAL" -eq "$EXPECTED" ]; then
    echo "PASS: ${ACTUAL} exemptions match expected ${EXPECTED}"
else
    echo "FAIL: Found ${ACTUAL} exemptions, expected ${EXPECTED}"
    echo "Unapproved exemptions:"
    grep -rl "eslint-disable max-lines" src/
fi
```

---

## 7. Risk Mitigations

| Risk                                          | Impact | Mitigation                                                                      |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Exemption used to circumvent size limits      | HIGH   | Five mandatory criteria prevent abuse; lead engineer approval required          |
| Exempted file gains functions over time       | HIGH   | Quarterly audit verifies zero-function criterion; V11 verification catches this |
| Exemption comment missing required fields     | MEDIUM | Format template in Section 4 with explicit invalid examples                     |
| Exemptions proliferate beyond initial 2 files | MEDIUM | Quarterly audit counts and compares; V12 verification enforces expected count   |

---

## 8. Rollback Strategy

Remove `/* eslint-disable max-lines */` comments from exempted files. This will cause ESLint to report violations on those files, which is the correct behavior if the exemption policy is revoked.

```bash
# Find and remove all max-lines exemptions
grep -rl "eslint-disable max-lines" src/ | while read FILE; do
    sed -i '/eslint-disable max-lines/d' "$FILE"
    echo "Removed exemption from: $FILE"
done
```

---

## 9. Standards Compliance

| Standard                    | Requirement                                | Resolution                                          |
| --------------------------- | ------------------------------------------ | --------------------------------------------------- |
| MISRA C:2023 Rule 1.1       | All code shall conform to coding standards | Exemptions require documented justification         |
| MISRA C:2023 Directive 4.14 | Deviations shall be documented             | Exemption comment format provides full traceability |

---

**END OF DOCUMENT**
