# Phase 5.6.5: Developer Documentation and Scenarios

| Attribute            | Value                                 |
| -------------------- | ------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.6.5                    |
| **Phase**            | 5.6 -- ESLint Enforcement Gates       |
| **Risk Level**       | LOW                                   |
| **Prerequisites**    | Tasks 5.6.1-5.6.4 COMPLETE            |
| **Estimated Effort** | 15 minutes                            |
| **Standards**        | MISRA C:2023 Rule 1.1                 |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY |
| **Author**           | Claude Opus 4.6 (Lead Audit Agent)    |
| **Date**             | 2026-02-08                            |

---

## 1. Objective

Document the size enforcement rules in CLAUDE.md (project instructions file), provide a quick reference card for developers, and document three common developer scenarios with expected output. This ensures all team members understand the rules, how to check compliance, and how to resolve violations.

---

## 2. CLAUDE.md Addition

**File**: `/home/kali/Documents/Argos/Argos/CLAUDE.md`

**Location**: Append to the `## Important Development Notes` section, after the existing item 7.

**Text to add**:

```markdown
8. **File and Function Size Limits**: ESLint enforces strict size limits on all source files:
    - Maximum **300 lines** per file (blank lines and comments excluded)
    - Maximum **60 lines** per function (blank lines and comments excluded)
    - These rules are enforced at three layers: ESLint config, pre-commit hook, and CI/CD
    - Violations block commits and fail CI/CD pipelines
    - To check a specific file: `npx eslint <file> --config config/eslint.config.js`
    - To check all files: `npm run lint:size`
    - Exemptions: Only pure data files (zero functions, zero logic) may be exempted.
      Add `/* eslint-disable max-lines */` with justification referencing ARGOS-AUDIT-P5.6.
      Requires lead engineer approval. Functions may NEVER be exempted.
```

**Net change**: +9 lines in CLAUDE.md.

---

## 3. Quick Reference Card

The following commands are available for size-related checks:

| Task                                     | Command                                                                      | Speed |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ----- |
| Check one file for size violations       | `npx eslint <file> --config config/eslint.config.js`                         | <1s   |
| Check all files for size violations only | `npm run lint:size`                                                          | ~10s  |
| Check all files for all lint violations  | `npm run lint`                                                               | ~30s  |
| Count lines in a file (raw)              | `wc -l <file>`                                                               | <1s   |
| Count executable lines in a file         | `grep -cv '^\s*$\|^\s*//' <file>`                                            | <1s   |
| Find all files >300 lines (raw count)    | `find src -name '*.ts' -o -name '*.svelte' \| xargs wc -l \| awk '$1 > 300'` | ~2s   |
| Scan function sizes (Python scanner)     | `python3 scripts/verify-function-length.py`                                  | ~5s   |

### Terminology Note

- **Raw line count** (`wc -l`): Counts ALL lines including blanks and comments. A file may have 350 raw lines but only 280 executable lines, which is compliant.
- **Executable line count** (ESLint): Excludes blank lines and comment-only lines. This is the count that determines compliance.
- **max-lines rule**: Uses executable line count (skipBlankLines: true, skipComments: true).
- **max-lines-per-function rule**: Same counting semantics applied to individual functions.

---

## 4. Developer Scenario 1: File Exceeds 300 Lines

**Situation**: Developer adds code to a file, pushing it to 310 executable lines.

**Developer action**: `git commit -m "feat: add new endpoint"`

**Expected output**:

```
================================================================
  COMMIT BLOCKED: File/Function Size Violations Detected
  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)
================================================================

  src/lib/services/kismet/scanner.ts
    1:1  error  File has too many lines (310). Maximum allowed is 300  max-lines

To fix:
  - Files >300 lines: Split into smaller modules
  - Functions >60 lines: Extract helper functions
  - Data-only files: See exemption policy in Phase_5.6 Section 3

To bypass (EMERGENCY ONLY, requires CI/CD approval):
  git commit --no-verify
```

**Resolution steps**:

1. Identify which section(s) of the file can be extracted into a separate module
2. Create a new file for the extracted logic (e.g., `scanner-helpers.ts`)
3. Move 10+ lines of related functions/constants to the new file
4. Add import statement in the original file
5. Verify: `npx eslint src/lib/services/kismet/scanner.ts --config config/eslint.config.js`
6. Re-stage and commit

---

## 5. Developer Scenario 2: Function Exceeds 60 Lines

**Situation**: Developer creates a 70-line validation function.

**Developer action**: `git commit -m "feat: complex validation logic"`

**Expected output**:

```
================================================================
  COMMIT BLOCKED: File/Function Size Violations Detected
  Policy: ARGOS-AUDIT-P5.6 (max 300 lines/file, 60 lines/function)
================================================================

  src/lib/services/validation/inputValidator.ts
    15:1  error  Function 'validateInput' has too many lines (70).
                 Maximum allowed is 60  max-lines-per-function

To fix:
  - Files >300 lines: Split into smaller modules
  - Functions >60 lines: Extract helper functions
  - Data-only files: See exemption policy in Phase_5.6 Section 3

To bypass (EMERGENCY ONLY, requires CI/CD approval):
  git commit --no-verify
```

**Resolution steps**:

1. Identify logical sub-sections within the function
2. Extract each sub-section into a named helper function
3. Example decomposition:
    - `validateInput` (70 lines) becomes:
    - `validateInputFormat` (25 lines) -- checks structural validity
    - `validateInputSemantics` (25 lines) -- checks business rules
    - `validateInput` (20 lines) -- orchestrator calling both helpers
4. Each function handles one concern (Single Responsibility Principle)
5. Verify: `npx eslint src/lib/services/validation/inputValidator.ts --config config/eslint.config.js`
6. Re-stage and commit

---

## 6. Developer Scenario 3: Exempted Lookup Table File

**Situation**: Developer needs to add new entries to a GSM carrier lookup table that is already exempted.

**Developer action**: `git commit -m "feat: add new GSM carrier codes"`

**Expected output**:

```
# Commits successfully -- the file has /* eslint-disable max-lines */ at top
```

**Why this is correct behavior**: The exempted file is allowed to grow because it contains only static data. The exemption was approved by the lead engineer per Section 3 of the exemption policy (Task 5.6.2).

**Developer responsibility**: After adding entries:

1. Verify the file still contains ZERO functions: `grep -c "function\|=>" src/lib/data/gsmLookupTables.ts` should return `0`
2. If you need to add a function to the file, the exemption no longer applies. Move the function to a separate module.

---

## 7. Verification Commands

| #   | Check             | Command                      | Expected Result                |
| --- | ----------------- | ---------------------------- | ------------------------------ |
| V13 | CLAUDE.md updated | `grep "max-lines" CLAUDE.md` | Shows size limit documentation |

### Additional Verification

```bash
# Verify the exact text was added
grep -A 8 "File and Function Size Limits" CLAUDE.md
# EXPECTED: Shows all 9 lines from Section 2 of this document

# Verify item numbering is correct
grep -n "^\s*[0-9]\+\." CLAUDE.md | tail -5
# EXPECTED: Item 8 is the new size limits entry
```

---

## 8. Risk Mitigations

| Risk                                         | Impact | Mitigation                                                                         |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Developer friction -- rules feel restrictive | MEDIUM | Documentation provides rationale, concrete resolution examples, and quick commands |
| Developers ignore documentation              | LOW    | Pre-commit hook provides inline instructions on every violation                    |
| CLAUDE.md not read by new team members       | LOW    | Pre-commit error messages are self-explanatory                                     |

---

## 9. Rollback Strategy

Remove the added text from CLAUDE.md:

```bash
# Revert CLAUDE.md to pre-5.6.5 state
git checkout HEAD~1 -- CLAUDE.md
```

No production code is affected.

---

## 10. Standards Compliance

| Standard              | Requirement                                | Resolution                              |
| --------------------- | ------------------------------------------ | --------------------------------------- |
| MISRA C:2023 Rule 1.1 | All code shall conform to coding standards | Standards documented for all developers |

---

**END OF DOCUMENT**
