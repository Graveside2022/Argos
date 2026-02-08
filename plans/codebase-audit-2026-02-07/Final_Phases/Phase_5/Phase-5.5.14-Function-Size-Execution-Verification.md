# Phase 5.5.14 -- Function Size Execution and Verification

| Field                | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| **Document ID**      | ARGOS-AUDIT-P5.5.14                                                        |
| **Phase**            | 5.5.14                                                                     |
| **Title**            | Function Size Enforcement -- Execution Order and Verification              |
| **Risk Level**       | LOW                                                                        |
| **Prerequisites**    | All Phase 5.5.x sub-tasks complete                                         |
| **Estimated Effort** | 0.5 hours (verification only)                                              |
| **Files Touched**    | 0 (verification only)                                                      |
| **Standards**        | MISRA C:2023 Rule 1.1 (60-line limit), NASA/JPL Rule 2.4, Barr C Section 7 |
| **Audit Date**       | 2026-02-08                                                                 |
| **Auditor**          | Alex Thompson, Principal Quantum Software Architect                        |
| **Classification**   | UNCLASSIFIED // FOR OFFICIAL USE ONLY                                      |

---

## 1. Purpose

This document specifies the execution order for all Phase 5.5 sub-tasks, the batch verification scripts to run after completion, and the acceptance criteria that must be satisfied before Phase 5.5 can be marked complete.

---

## 2. Execution Sequence

### 2.1 Execution Order

| Order | Sub-task | Title                                    | Functions | Effort | Dependencies                                      |
| ----- | -------- | ---------------------------------------- | --------- | ------ | ------------------------------------------------- |
| 0     | 5.5.0    | Assessment and Scanner Corrections       | 0         | 1 hr   | None                                              |
| 1     | 5.5.1    | CRITICAL: God Store Decomposition        | 3         | 2 hr   | None (stores are leaf nodes in dependency graph)  |
| 2     | 5.5.2    | CRITICAL: Wireshark/OUI Decomposition    | 2         | 1.5 hr | None                                              |
| 3     | 5.5.3    | CRITICAL: Route Handler Decomposition    | 2         | 1.5 hr | None                                              |
| 4     | 5.5.4    | CRITICAL: Signal System Decomposition    | 3         | 2 hr   | Phase 5.4 complete for AirSignalOverlay (item 07) |
| 5     | 5.5.5    | CRITICAL: Remaining 150+ Functions       | 15        | 3 hr   | Items 01-10 complete (pattern established)        |
| 6     | 5.5.6    | HIGH: Visualization/MCP Decomposition    | 3         | 1.5 hr | CRITICAL functions in same files complete         |
| 7     | 5.5.7    | HIGH: DB/Recovery/Hardware Decomposition | 5         | 2.5 hr | CRITICAL functions in same files complete         |
| 8     | 5.5.8    | HIGH: Remaining 100-149 Functions        | 20        | 3 hr   | Items 01-08 complete (pattern established)        |
| 9     | 5.5.9    | STANDARD: server/ Directory Batch        | 18        | 2 hr   | HIGH functions in same files complete             |
| 10    | 5.5.10   | STANDARD: services/ Directory Batch      | 13        | 1.5 hr | None                                              |
| 11    | 5.5.11   | STANDARD: components/ Directory Batch    | 14        | 1.5 hr | HIGH-08 complete (FlightPathVisualization)        |
| 12    | 5.5.12   | STANDARD: routes/ + stores/ Batch        | 7         | 1 hr   | Phase 5.1 complete for God Pages                  |
| 13    | 5.5.14   | Verification (this document)             | 0         | 0.5 hr | All decompositions complete                       |

### 2.2 Parallelizable Tasks

The following sub-tasks have NO mutual dependencies and can be executed in parallel:

- **Parallel Group A** (CRITICAL, order 1-3): 5.5.1, 5.5.2, 5.5.3
- **Parallel Group B** (HIGH, order 6-7): 5.5.6, 5.5.7
- **Parallel Group C** (STANDARD, order 9-10): 5.5.9, 5.5.10

### 2.3 Blocking Dependencies

```
Phase 5.4 (File Size) ─────> 5.5.4 (toggleRFDetection in RFDetectionService.ts)
Phase 5.1 (God Pages) ─────> 5.5.12 (routes remaining after God Page extraction)
CRITICAL (5.5.1-5.5.5) ────> HIGH (5.5.6-5.5.8) ────> STANDARD (5.5.9-5.5.12)
```

### 2.4 Total Effort

| Category      | Decomposition | Test Writing | Total      |
| ------------- | ------------- | ------------ | ---------- |
| CRITICAL (25) | 10 hr         | 3 hr         | 13 hr      |
| HIGH (28)     | 5 hr          | 2 hr         | 7 hr       |
| STANDARD (95) | 6 hr          | 4 hr         | 10 hr      |
| Verification  | 0.5 hr        | 0 hr         | 0.5 hr     |
| **TOTAL**     | **21.5 hr**   | **9 hr**     | **~30 hr** |

---

## 3. Commit Strategy

### 3.1 Commit Granularity

One commit per file or per closely-related file group.

### 3.2 Commit Message Format

```
refactor(phase-5.5): decompose <functionName> in <fileName>

Extract <N> sub-functions from <functionName> (<originalLines> lines -> <newLines> lines).
New functions: <list>.
Zero behavioral change. All existing callers unchanged.

Verification: npm run build && npm run typecheck
```

### 3.3 Multi-Function File Commits

When a single file contains 2+ oversized functions (e.g., `SpectrumChart.svelte` has 2, `flightPathAnalyzer.ts` has 3, `kismet_controller.ts` has 2, `gps/position/+server.ts` has 2), decompose ALL oversized functions in that file in a SINGLE commit. This prevents intermediate states where some functions are decomposed and others are not, which complicates rollback.

### 3.4 Rollback Procedure

If any commit breaks the build or test suite:

1. `git revert <commit-hash>` -- create a revert commit (do NOT use `git reset --hard`)
2. Identify which extracted function introduced the breakage
3. Examine whether the extraction changed error-handling semantics (most common cause: a `return` inside a `try` block that previously exited the outer function now only exits the extracted function)
4. Fix the extraction to preserve original error-handling flow
5. Create a NEW commit with the corrected extraction

---

## 4. Per-Function Verification

After each CRITICAL or HIGH function decomposition, run:

```bash
# 1. Verify no functions >60 lines in the modified file
python3 scripts/audit-function-sizes-v2.py <modified-file>
# TARGET: 0 functions >60 lines

# 2. Verify TypeScript compilation
npm run typecheck
# TARGET: Exit code 0

# 3. Verify build
npm run build
# TARGET: Exit code 0
```

---

## 5. Full-Codebase Verification (After All Decompositions)

### 5.1 Function Size Enforcement

```bash
echo "=== FUNCTIONS >60 LINES ==="
python3 scripts/audit-function-sizes-v2.py src/
# TARGET: 0 functions >60 lines
```

### 5.2 Manual Spot-Check

```bash
echo "=== SPOT CHECK: Previously largest files ==="
for f in src/lib/stores/gsmEvilStore.ts \
         src/lib/stores/rtl433Store.ts \
         src/lib/stores/kismet.ts \
         src/lib/server/wireshark.ts \
         src/lib/server/kismet/device_intelligence.ts \
         src/lib/services/gsm-evil/server.ts \
         src/lib/services/map/signalClustering.ts \
         src/routes/api/system/info/+server.ts \
         src/routes/api/gsm-evil/health/+server.ts; do
    echo "--- $f ---"
    wc -l "$f"
done
# All files should show reasonable line counts (well under original sizes)
```

### 5.3 Build Verification

```bash
echo "=== BUILD ==="
npm run build
# TARGET: Exit code 0

echo "=== TYPECHECK ==="
npm run typecheck
# TARGET: Exit code 0
```

### 5.4 Unit Tests

```bash
echo "=== UNIT TESTS ==="
npm run test:unit
# TARGET: All tests pass
```

### 5.5 ESLint Size Rules (Phase 5.6 Gate)

```bash
echo "=== ESLint max-lines-per-function ==="
npx eslint src/ --rule '{"max-lines-per-function": ["error", {"max": 60, "skipBlankLines": true, "skipComments": true, "IIFEs": true}]}' 2>&1 | head -50
# TARGET: 0 violations
```

### 5.6 Circular Dependency Check

```bash
echo "=== CIRCULAR DEPENDENCIES ==="
npx madge --circular --extensions ts,svelte src/ 2>&1 | tail -5
# TARGET: "No circular dependency found!" (or same pre-existing cycles only)
```

### 5.7 Store Import Boundary Check

```bash
echo "=== STORE-SERVICE BOUNDARY ==="
grep -rn "from.*stores/" src/lib/services/ src/lib/server/ --include="*.ts" | grep -v "import type" | grep -v "stores/.*Actions"
# TARGET: Same count as before Phase 5.5 (no new violations introduced)
```

### 5.8 Scanner Validation

The function-size scanner (`scripts/audit-function-sizes-v2.py`) must itself be validated before being used as the final gate:

```bash
# Create a test file with a known 65-line function
cat > /tmp/test-scanner.ts << 'EOF'
export function bigFunction() {
    const a = 1;
    const b = 2;
    return a + b;
}
EOF

# Add 60 lines of content
for i in $(seq 1 60); do
    sed -i "3i\\    const v$i = $i;" /tmp/test-scanner.ts
done

python3 scripts/audit-function-sizes-v2.py /tmp/test-scanner.ts
# EXPECTED: Reports bigFunction as >60 lines

# Test with arrow function
cat > /tmp/test-arrow.ts << 'EOF'
export const bigArrow = async () => {
    const a = 1;
    return a;
};
EOF

for i in $(seq 1 60); do
    sed -i "3i\\    const v$i = $i;" /tmp/test-arrow.ts
done

python3 scripts/audit-function-sizes-v2.py /tmp/test-arrow.ts
# EXPECTED: Reports bigArrow as >60 lines

# Cleanup
rm -f /tmp/test-scanner.ts /tmp/test-arrow.ts
```

---

## 6. Risk Mitigations Summary

### 6.1 Error-Handling Semantics Preservation

**Risk**: Extracting code from inside a `try/catch` block changes error-handling flow.

**Mitigation**: When extracting code from within `try/catch`:

1. If the extracted code contains `return` statements that exit the outer function on error, the extracted function must `throw` instead, and the caller must handle it.
2. If the extracted code catches errors internally and continues, it can safely be extracted as-is.
3. Document the error-handling boundary in a comment above the extraction call site.

**Verification**: After each extraction, confirm that error paths produce the same HTTP status codes and error response formats.

### 6.2 Svelte Reactivity Preservation

**Risk**: Extracting code from Svelte `<script>` blocks may break reactivity.

**Mitigation**:

1. Only extract PURE functions (no reactive dependencies) to external `.ts` files.
2. Functions using `$state`, `$derived`, `$effect`, `$:` must remain in `.svelte`.
3. Large reactive functions: decompose into pure computation (extracted) + thin reactive wrapper (stays in `.svelte`).

### 6.3 Store Action Extraction -- Closure Variables

**Risk**: Store action handlers close over `update`, `set`, `subscribe`.

**Mitigation**: All extracted action functions receive `update` as their first parameter. `subscribe` is NOT passed to action handlers.

### 6.4 Import Path Stability

**Risk**: Moving store files to subdirectories breaks imports.

**Mitigation**: Create barrel re-exports at original paths during migration. Remove after all consumers updated.

### 6.5 Canvas/WebGL Context Loss

**Risk**: Extracted rendering functions operate on stale canvas context.

**Mitigation**: Accept `ctx` as parameter, never cache at module level. Validate before rendering.

### 6.6 Performance -- Function Call Overhead

**Risk**: Decomposing hot-path functions adds call overhead.

**Mitigation**: V8 inlines functions under ~30 lines automatically. All sub-functions target 10-35 lines. Verify with `node --trace-opt` if regression detected.

---

## 7. Acceptance Criteria

Phase 5.5 is COMPLETE when ALL of the following conditions are satisfied:

| #   | Criterion                              | Verification Command                              | Expected Result                                  |
| --- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| 1   | Zero functions >60 lines in `src/`     | `python3 scripts/audit-function-sizes-v2.py src/` | 0 violations                                     |
| 2   | Build succeeds                         | `npm run build`                                   | Exit code 0                                      |
| 3   | TypeScript compilation succeeds        | `npm run typecheck`                               | Exit code 0                                      |
| 4   | All unit tests pass                    | `npm run test:unit`                               | All pass                                         |
| 5   | No new circular dependencies           | `npx madge --circular src/`                       | Same as pre-Phase 5.5                            |
| 6   | No new store-service violations        | `grep` command from Section 5.7                   | Same count as pre-Phase 5.5                      |
| 7   | ESLint `max-lines-per-function` passes | ESLint with rule enabled                          | 0 violations                                     |
| 8   | All CRITICAL functions documented      | Sub-tasks 5.5.1-5.5.5                             | 25/25 decomposed (10 detailed + 15 via patterns) |
| 9   | All HIGH functions documented          | Sub-tasks 5.5.6-5.5.8                             | 28/28 decomposed (8 detailed + 20 via patterns)  |
| 10  | All STANDARD functions documented      | Sub-tasks 5.5.9-5.5.12                            | 95/95 decomposed (52 detailed + 43 via patterns) |

### 7.1 Test Requirements for Extracted Functions

Every decomposition that produces a new pure function must include a corresponding unit test:

| Function Category                                     | Test Requirement                                      | Coverage Target      |
| ----------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| Pure data transformer (parser, formatter, normalizer) | 3+ test cases: valid input, edge case, invalid input  | 90% line coverage    |
| Configuration builder (config object assembly)        | 2+ test cases: default config, custom config          | 80% line coverage    |
| Validator/guard (input validation, type guard)        | 4+ test cases: valid, each invalid category, boundary | 100% branch coverage |
| Decision function (if/switch routing)                 | 1 test per branch minimum                             | 100% branch coverage |
| UI helper (SVG generation, CSS class computation)     | 2+ test cases: representative inputs                  | 80% line coverage    |

Tests are created alongside the decomposition, in the same commit.

---

## 8. Traceability to Phase 5.0 Defect IDs

| Phase 5.0 Defect ID | Description                                       | Phase 5.5 Coverage                                   | Status  |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------- |
| P5-016              | **30** functions >150 lines (corrected from 10)   | Task 5.5.1-5.5.5 (**25** CRITICAL after deductions)  | PLANNED |
| P5-017              | **30** functions 100-149 lines (corrected from 9) | Task 5.5.6-5.5.8 (**28** HIGH after deductions)      | PLANNED |
| P5-018              | **97** functions 60-99 lines                      | Task 5.5.9-5.5.12 (**95** STANDARD after deductions) | PLANNED |

**Cross-phase traceability**:

- 4 CRITICAL functions traced to Phase 5.1 (God Page extraction)
- 5 functions (1 CRITICAL, 2 HIGH, 2 STANDARD) traced to Phase 5.2 (Service Layer)
- 1 CRITICAL function has dual handling: Phase 5.4 (relocation) + Phase 5.5 (decomposition)
- Total **157** functions accounted for: **148** in Phase 5.5 + **9** in other phases

---

## 9. Post-Completion Handoff to Phase 5.6

After Phase 5.5 completes, Phase 5.6 (ESLint Enforcement Gates) permanently enforces the 60-line limit via ESLint configuration:

```javascript
// config/eslint.config.js
rules: {
    'max-lines-per-function': ['error', {
        max: 60,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
    }]
}
```

This prevents regression. Any new function exceeding 60 lines will fail CI.

---

**END OF DOCUMENT**
