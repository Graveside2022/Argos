# Phase 4.1.5: Remove Example/Test Files

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                           |
| **Task ID**            | 4.1.5                                                                  |
| **Title**              | Remove Example/Test Files                                              |
| **Status**             | PLANNED                                                                |
| **Risk Level**         | LOW -- example and test utility files with zero production consumers   |
| **Estimated Duration** | 5 minutes                                                              |
| **Dependencies**       | Phase 4.1.0 (Pre-Deletion Verification Gate) must PASS                 |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                           |
| **Commit Message**     | `refactor: remove 5 example/test utility files (708 lines)`            |

---

## Objective

Remove 5 example and test utility files that are not part of the test suite and have no production consumers. These files were created during development as usage demonstrations or test harnesses and were never integrated into the application.

---

## Current State Assessment

| Metric                            | Verified Value | Target  | Verification Command            |
| --------------------------------- | -------------- | ------- | ------------------------------- |
| Example/test files in source tree | 5 files        | 0       | Pre-deletion check script below |
| Total lines                       | 708            | Removed | `wc -l` on each file            |
| External consumers                | 0 for all 5    | 0       | Pre-deletion check script below |

---

## Files to Delete

| #   | File                                                            | Lines | Verification                                        |
| --- | --------------------------------------------------------------- | ----- | --------------------------------------------------- |
| 1   | `src/lib/services/websocket/test-connection.ts`                 | 109   | Test utility, zero imports                          |
| 2   | `src/lib/services/localization/coral/integration-example.ts`    | 75    | Example code, zero imports                          |
| 3   | `src/lib/services/api/example-usage.ts`                         | 173   | Example code, zero imports                          |
| 4   | `src/lib/server/agent/tool-execution/examples/example-tools.ts` | 219   | Example tools, zero imports                         |
| 5   | `src/routes/tactical-map-simple/integration-example.svelte`     | 132   | Example component, not referenced by `+page.svelte` |

**Total**: 708 lines

---

## Execution Steps

### Step 1: Pre-Deletion Check

```bash
for f in \
  src/lib/services/websocket/test-connection.ts \
  src/lib/services/localization/coral/integration-example.ts \
  src/lib/services/api/example-usage.ts \
  src/lib/server/agent/tool-execution/examples/example-tools.ts \
  src/routes/tactical-map-simple/integration-example.svelte; do

  BASENAME=$(basename "$f" | sed 's/\.\(ts\|svelte\)$//')
  HITS=$(grep -rn "$BASENAME" src/ --include="*.ts" --include="*.svelte" | grep -v "^${f}:" | grep -v "example" || true)
  if [ -n "$HITS" ]; then
    echo "WARN: $f may have consumers:"
    echo "$HITS"
  else
    echo "PASS: $f is dead"
  fi
done
```

If any file reports WARN, investigate the consumer before proceeding. Do NOT delete a file with an active consumer.

### Step 2: Delete Files

```bash
rm src/lib/services/websocket/test-connection.ts
rm src/lib/services/localization/coral/integration-example.ts
rm src/lib/services/api/example-usage.ts
rm src/lib/server/agent/tool-execution/examples/example-tools.ts
rm src/routes/tactical-map-simple/integration-example.svelte
```

### Step 3: Intermediate Verification

```bash
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

### Step 4: Stage and Commit

```bash
git add -A src/lib/services/websocket/test-connection.ts \
         src/lib/services/localization/coral/integration-example.ts \
         src/lib/services/api/example-usage.ts \
         src/lib/server/agent/tool-execution/examples/example-tools.ts \
         src/routes/tactical-map-simple/integration-example.svelte

git commit -m "$(cat <<'EOF'
refactor: remove 5 example/test utility files (708 lines)

Delete 5 development-time example and test utility files with zero consumers:
- websocket/test-connection.ts (109 lines, test harness)
- coral/integration-example.ts (75 lines, usage example)
- api/example-usage.ts (173 lines, usage example)
- examples/example-tools.ts (219 lines, example agent tools)
- integration-example.svelte (132 lines, example component)

Standards: NASA/JPL Rule 31, MISRA Rule 3.1, CERT MSC12-C

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Post-Task Verification

```bash
# Confirm files are gone
for f in \
  src/lib/services/websocket/test-connection.ts \
  src/lib/services/localization/coral/integration-example.ts \
  src/lib/services/api/example-usage.ts \
  src/lib/server/agent/tool-execution/examples/example-tools.ts \
  src/routes/tactical-map-simple/integration-example.svelte; do
  [ -f "$f" ] && echo "ERROR: $f still exists" || echo "OK: $f deleted"
done

# TypeScript compilation must succeed
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

---

## Risk Assessment

| Risk                                            | Likelihood | Impact            | Mitigation                                                    |
| ----------------------------------------------- | ---------- | ----------------- | ------------------------------------------------------------- |
| Example file has an undiscovered consumer       | VERY LOW   | LOW (build break) | Pre-deletion check script; `npm run typecheck` after deletion |
| Examples directory becomes empty after deletion | LOW        | VERY LOW          | Task 4.1.6 handles empty directory cleanup                    |

---

## Rollback Strategy

### Revert This Task Only

```bash
git revert HEAD
```

### Restore Specific Files

```bash
git checkout pre-phase-4.1-backup -- src/lib/services/api/example-usage.ts
# Repeat for any other file needed
```

### Post-Rollback Verification

```bash
npm run typecheck && npm run build
# Both must pass after rollback
```

---

## Standards Traceability

| Standard         | Rule                          | Relevance                                        |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| NASA/JPL Rule 31 | No dead code                  | Example files are dead code in delivered product |
| MISRA Rule 3.1   | No commented/unreachable code | Files serve no production purpose                |
| CERT MSC12-C     | Detect and remove dead code   | Systematic removal of development-time artifacts |

---

## Execution Tracking

| Step | Description               | Status  | Started | Completed | Verified By |
| ---- | ------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Pre-deletion check        | PENDING | --      | --        | --          |
| 2    | Delete 5 files            | PENDING | --      | --        | --          |
| 3    | Intermediate verification | PENDING | --      | --        | --          |
| 4    | Stage and commit          | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 4.1.0](Phase-4.1.0-Pre-Deletion-Verification-Gate.md) -- Gate must pass
- **Enables**: [Phase 4.1.6](Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md) -- `services/api/index.ts` barrel's sole consumer (`services/api/example-usage.ts:128`) is deleted by this task; `examples/` directory may become empty
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.6
