# Phase 4.1.4: Remove Test Route Directories

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NASA/JPL Rule 31 (no dead code in delivered product), MISRA Rule 3.1 (no commented-out or unreachable code), CERT MSC12-C (detect and remove dead code), OWASP ASVS 4.0 Section 14.2 (no debug features in production)
**Review Panel**: US Cyber Command Engineering Review Board

---

| Attribute              | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Phase**              | 4 -- Architecture Decomposition, Type Safety, and Structural Integrity                |
| **Sub-Phase**          | 4.1 -- Dead Code Elimination                                                          |
| **Task ID**            | 4.1.4                                                                                 |
| **Title**              | Remove Test Route Directories                                                         |
| **Status**             | PLANNED                                                                               |
| **Risk Level**         | LOW -- test routes are not consumed by production code; security-relevant cleanup     |
| **Estimated Duration** | 10 minutes                                                                            |
| **Dependencies**       | Phase 4.1.0 (Pre-Deletion Verification Gate) must PASS                                |
| **Branch**             | `agent/alex/phase-4.1-dead-code-elimination`                                          |
| **Commit Message**     | `fix(security): remove 8 publicly routable test/debug route directories (~821 lines)` |

---

## Objective

Remove 8 test/debug route directories that are publicly routable in production. This is a security-relevant cleanup -- these routes expose internal test pages, HackRF control interfaces, and database clients to any user who can reach the web interface. In a field-deployed military SIGINT system, these constitute an unacceptable attack surface.

---

## Current State Assessment

| Metric                             | Verified Value                  | Target       | Verification Command                                                                         |
| ---------------------------------- | ------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| Publicly routable test directories | 8 directories                   | 0            | `ls -d src/routes/test* src/routes/api/test* 2>/dev/null \| wc -l`                           |
| Total lines in test routes         | ~821                            | Removed      | `find src/routes/test* src/routes/api/test* -name "*.ts" -o -name "*.svelte" \| xargs wc -l` |
| debug/ routes retained             | `src/routes/api/debug/` present | Retained     | `[ -d "src/routes/api/debug" ] && echo EXISTS`                                               |
| Non-test imports from test routes  | 0                               | 0 (verified) | Pre-deletion check below                                                                     |

---

## Directories to Delete

| #   | Directory                      | Files | Lines | Security Risk                                 |
| --- | ------------------------------ | ----- | ----- | --------------------------------------------- |
| 1   | `src/routes/test/`             | 1     | 300   | Exposes internal test page at `/test`         |
| 2   | `src/routes/test-simple/`      | 1     | 49    | Exposes test page at `/test-simple`           |
| 3   | `src/routes/test-map/`         | 1     | 14    | Exposes test page at `/test-map`              |
| 4   | `src/routes/test-hackrf-stop/` | 1     | 93    | Exposes HackRF control at `/test-hackrf-stop` |
| 5   | `src/routes/test-time-filter/` | 1     | 138   | Exposes test page at `/test-time-filter`      |
| 6   | `src/routes/test-db-client/`   | 1     | 132   | Exposes database client at `/test-db-client`  |
| 7   | `src/routes/api/test/`         | 1     | 42    | Exposes test API at `/api/test`               |
| 8   | `src/routes/api/test-db/`      | 1     | 53    | Exposes database API at `/api/test-db`        |

**Total**: 8 directories, ~821 lines (page routes + API routes)

**NOTE**: `src/routes/api/debug/` is intentionally RETAINED. It provides field diagnostics functionality needed during deployment. This is a deliberate exception, not an oversight.

---

## Execution Steps

### Step 1: Pre-Deletion Check

Verify no live route imports from test routes:

```bash
# Check if any non-test file imports from test route directories
grep -rn "test-hackrf-stop\|test-simple\|test-map\|test-time-filter\|test-db-client" \
  src/ --include="*.ts" --include="*.svelte" \
  | grep -v "^src/routes/test"
# Must return 0 results
```

### Step 2: Check for E2E Test References

```bash
# Check if any E2E or integration tests reference these routes
grep -rn "/test\b\|/test-simple\|/test-map\|/test-hackrf-stop\|/test-time-filter\|/test-db-client\|/api/test\b\|/api/test-db" \
  tests/ --include="*.ts" --include="*.js" 2>/dev/null || echo "No test references found"
# If results found, update the affected test files to remove dead route references
```

### Step 3: Delete Directories

```bash
rm -r src/routes/test/
rm -r src/routes/test-simple/
rm -r src/routes/test-map/
rm -r src/routes/test-hackrf-stop/
rm -r src/routes/test-time-filter/
rm -r src/routes/test-db-client/
rm -r src/routes/api/test/
rm -r src/routes/api/test-db/
```

### Step 4: Intermediate Verification

```bash
npm run typecheck 2>&1 | tail -5
# Expected: "0 errors"
```

### Step 5: Stage and Commit

```bash
git add -A src/routes/test/ \
         src/routes/test-simple/ \
         src/routes/test-map/ \
         src/routes/test-hackrf-stop/ \
         src/routes/test-time-filter/ \
         src/routes/test-db-client/ \
         src/routes/api/test/ \
         src/routes/api/test-db/

git commit -m "$(cat <<'EOF'
fix(security): remove 8 publicly routable test/debug route directories (~821 lines)

Remove test routes that expose internal interfaces in production:
- /test (internal test page, 300 lines)
- /test-simple (test page, 49 lines)
- /test-map (test page, 14 lines)
- /test-hackrf-stop (HackRF control, 93 lines)
- /test-time-filter (test page, 138 lines)
- /test-db-client (database client, 132 lines)
- /api/test (test API, 42 lines)
- /api/test-db (database API, 53 lines)

RETAINED: /api/debug/ (field diagnostics, intentional exception)

Standards: NASA/JPL Rule 31, OWASP ASVS 14.2, CERT MSC12-C

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Post-Task Verification

```bash
# Confirm directories are gone
for d in \
  src/routes/test \
  src/routes/test-simple \
  src/routes/test-map \
  src/routes/test-hackrf-stop \
  src/routes/test-time-filter \
  src/routes/test-db-client \
  src/routes/api/test \
  src/routes/api/test-db; do
  [ -d "$d" ] && echo "ERROR: $d still exists" || echo "OK: $d deleted"
done

# Debug routes should still exist
[ -d "src/routes/api/debug" ] && echo "OK: debug/ retained" || echo "ERROR: debug/ was deleted"

# Build must pass
npm run typecheck 2>&1 | tail -5

# If server is running, verify routes return 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/test 2>/dev/null || echo "Server not running (OK for offline verification)"
# If server is running: REQUIRED: 404
```

---

## Risk Assessment

| Risk                                  | Likelihood | Impact                           | Mitigation                                              |
| ------------------------------------- | ---------- | -------------------------------- | ------------------------------------------------------- |
| Test route removal breaks E2E tests   | MEDIUM     | LOW (test-only)                  | Step 2 checks `tests/` for references before deletion   |
| Non-test code imports from test route | VERY LOW   | MEDIUM (build break)             | Step 1 pre-deletion grep check                          |
| debug/ accidentally deleted           | VERY LOW   | MEDIUM (loses field diagnostics) | Explicit exclusion in commands; post-verification check |

---

## Rollback Strategy

### Restore All Test Routes

```bash
git revert HEAD
```

### Restore Specific Directory

```bash
git checkout pre-phase-4.1-backup -- src/routes/test/
# Repeat for any other directory needed
```

### Post-Rollback Verification

```bash
npm run typecheck && npm run build
# Both must pass after rollback
```

---

## Standards Traceability

| Standard         | Rule                            | Relevance                                                 |
| ---------------- | ------------------------------- | --------------------------------------------------------- |
| NASA/JPL Rule 31 | No dead code                    | Test routes are dead code in production builds            |
| MISRA Rule 3.1   | No commented/unreachable code   | These routes serve no production purpose                  |
| CERT MSC12-C     | Detect and remove dead code     | Publicly routable dead endpoints removed                  |
| OWASP ASVS 14.2  | No debug features in production | Test/debug routes expose internal interfaces to attackers |

---

## Execution Tracking

| Step | Description               | Status  | Started | Completed | Verified By |
| ---- | ------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Pre-deletion import check | PENDING | --      | --        | --          |
| 2    | E2E test reference check  | PENDING | --      | --        | --          |
| 3    | Delete 8 directories      | PENDING | --      | --        | --          |
| 4    | Intermediate verification | PENDING | --      | --        | --          |
| 5    | Stage and commit          | PENDING | --      | --        | --          |

## Cross-References

- **Depends on**: [Phase 4.1.0](Phase-4.1.0-Pre-Deletion-Verification-Gate.md) -- Gate must pass
- **Enables**: [Phase 4.1.6](Phase-4.1.6-Barrel-Cleanup-Empty-Directories.md) -- `services/websocket/index.ts` barrel's sole consumer (`routes/test/+page.svelte:3`) is deleted by this task
- **Source**: [Phase 4.1 Master](Phase-4.1-DEAD-CODE-ELIMINATION.md) -- Task 4.1.5
