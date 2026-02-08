# Phase 3.2.7: Hardcoded IP Address Centralization

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: BARR-C Rule 8.1 (No Magic Numbers), MISRA Rule 7.1 (Octal/Hex Constants Defined), NASA/JPL Rule 20 (Named Constants for All Literals), CERT INT09-C (Define Numeric Constants), NIST SP 800-53 CM-6 (Configuration Settings)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.2 -- Constants Centralization and Magic Number Elimination
**Task ID**: 3.2.7
**Risk Level**: LOW
**Prerequisites**: Phase 3.2.0 (BIND_ADDRESSES defined), Phase 3.2.1 (Port Replacement complete -- most IPs already replaced via SERVICE_URLS)
**Blocks**: Phase 3.3 (ESLint `no-magic-numbers` rule), Phase 6 (Infrastructure Modernization)
**Estimated Files Touched**: ~10 (after Task 3.2.1 handles SERVICE_URLS replacements)
**Standards**: BARR-C Rule 8.1, MISRA Rule 7.1, NASA/JPL Rule 20, CERT INT09-C, NIST SP 800-53 CM-6

---

## Objective

Centralize all remaining hardcoded IP address literals (`localhost`, `127.0.0.1`, `0.0.0.0`) that were not already replaced by Task 3.2.1 (Port Replacement via SERVICE_URLS). After completion, all network address references use named constants from `SERVICE_URLS` or `BIND_ADDRESSES`.

## Current State Assessment (CORRECTED per Verification Audit 2026-02-08)

| Metric                      | Original Plan | Corrected Value | Delta                |
| --------------------------- | ------------- | --------------- | -------------------- |
| Total IP/localhost literals | 53            | **67**          | +14 (26% undercount) |

### IP Address Distribution

| Address     | Count  | Context                                     |
| ----------- | ------ | ------------------------------------------- |
| `localhost` | **56** | Service URLs, WebSocket URLs, API base URLs |
| `127.0.0.1` | **5**  | Bettercap API, GPSD, shell grep patterns    |
| `0.0.0.0`   | **6**  | Bind addresses for network listeners        |
| **TOTAL**   | **67** |                                             |

## Strategy

This task is deliberately placed LAST in the Phase 3.2 execution order because most IP address literals are embedded in `localhost:PORT` or `127.0.0.1:PORT` strings that are replaced wholesale by Task 3.2.1 using `SERVICE_URLS.*` constants.

### Breakdown by Handling

| Category                                      | Count | Handling                                                                     |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| Already replaced by Task 3.2.1 (SERVICE_URLS) | ~50   | No action in this task -- verify only                                        |
| `127.0.0.1` in shell command patterns         | ~2    | Leave as-is with explanatory comment (grep patterns matching tcpdump output) |
| `0.0.0.0` bind addresses                      | ~6    | Replace with `BIND_ADDRESSES.ALL_INTERFACES`                                 |
| `127.0.0.1` standalone (not URL context)      | ~3    | Replace with `BIND_ADDRESSES.LOCALHOST`                                      |
| Default values in UI forms (TAK settings)     | ~3    | Leave as-is -- user-facing defaults                                          |
| Remaining `localhost` not caught by 3.2.1     | ~3    | Replace with SERVICE_URLS or BIND_ADDRESSES                                  |

### BIND_ADDRESSES Constant (defined in Task 3.2.0)

```typescript
export const BIND_ADDRESSES = {
	ALL_INTERFACES: '0.0.0.0',
	LOCALHOST: '127.0.0.1'
} as const;
```

## Scope

### Category 1: Already Replaced by Task 3.2.1 (Verify Only)

Approximately 50 of the 67 IP address literals are `localhost:PORT` patterns that Task 3.2.1 replaces with `SERVICE_URLS.KISMET`, `SERVICE_URLS.HACKRF_API`, etc. These do not require action in this task, but the executor must verify they were actually replaced:

```bash
grep -Prn 'localhost:\d+' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "\.md" | wc -l
```

**Expected result**: `0` (if Task 3.2.1 is complete)

If this count is non-zero, the remaining `localhost:PORT` occurrences must be addressed here.

### Category 2: Shell Pattern Strings (Leave As-Is)

Some `127.0.0.1` occurrences appear in shell command grep patterns that match network traffic output (e.g., tcpdump). These reference the literal IP address as a match pattern, not as a connection target. Replacing them with a constant would obscure the grep intent.

**Action**: Add an explanatory comment at each site:

```typescript
// NOTE: 127.0.0.1 is a tcpdump output pattern, not a connection target.
// Do not replace with BIND_ADDRESSES constant.
```

### Category 3: 0.0.0.0 Bind Addresses (Replace)

| #   | File                     | Line | Current   | Replacement                     | Context                  |
| --- | ------------------------ | ---- | --------- | ------------------------------- | ------------------------ |
| 1   | WebSocket server bind    | --   | `0.0.0.0` | `BIND_ADDRESSES.ALL_INTERFACES` | WS listener bind address |
| 2   | GSM Evil Web server bind | --   | `0.0.0.0` | `BIND_ADDRESSES.ALL_INTERFACES` | GsmEvil2 listener        |
| 3   | Bettercap API bind       | --   | `0.0.0.0` | `BIND_ADDRESSES.ALL_INTERFACES` | Bettercap REST API       |
| 4-6 | Additional bind sites    | --   | `0.0.0.0` | `BIND_ADDRESSES.ALL_INTERFACES` | Various service binds    |

**SECURITY NOTE**: `0.0.0.0` binds expose services on all network interfaces. Phase 2.2.2 (CORS Restriction) and the Independent Security Audit address the security implications. This task only centralizes the literal; it does NOT change the bind behavior.

### Category 4: Standalone 127.0.0.1 (Replace)

| #   | File                          | Line | Current     | Replacement                | Context          |
| --- | ----------------------------- | ---- | ----------- | -------------------------- | ---------------- |
| 1   | GPSD connection config        | --   | `127.0.0.1` | `BIND_ADDRESSES.LOCALHOST` | GPSD host config |
| 2   | Bettercap API base URL prefix | --   | `127.0.0.1` | `BIND_ADDRESSES.LOCALHOST` | API client base  |
| 3   | Other standalone references   | --   | `127.0.0.1` | `BIND_ADDRESSES.LOCALHOST` | Various          |

### Category 5: UI Form Defaults (Leave As-Is)

Some IP addresses appear as default values in TAK (Team Awareness Kit) configuration forms visible to the user. These are user-facing strings that provide sensible defaults, not programmatic connection strings. They remain as-is:

```typescript
// User-facing default -- not a programmatic connection target
const defaultTakHost = '127.0.0.1';
```

## Execution Steps

1. **Verify prerequisite**: Confirm Task 3.2.1 (Port Replacement) is complete.
2. **Run verification grep** to count remaining `localhost` and IP literals after Task 3.2.1:
    ```bash
    grep -Prn '(localhost|127\.0\.0\.1|0\.0\.0\.0)' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v paths.ts | grep -v node_modules | grep -v "\.md" | wc -l
    ```
3. **Classify each remaining occurrence** into categories 2-5 above.
4. **Replace Category 3** (0.0.0.0 bind addresses) with `BIND_ADDRESSES.ALL_INTERFACES`.
5. **Replace Category 4** (standalone 127.0.0.1) with `BIND_ADDRESSES.LOCALHOST`.
6. **Add comments to Category 2** (shell pattern strings).
7. **Document Category 5** (UI form defaults) as accepted exceptions.
8. **Run** `npm run typecheck` -- must exit 0.
9. **Run** `npm run build` -- must exit 0.
10. **Run final verification**.

## Commit Message

```
refactor(constants): centralize IP address literals into BIND_ADDRESSES constants

Phase 3.2 Task 7: Hardcoded IP Address Centralization
- Replaced 0.0.0.0 bind addresses with BIND_ADDRESSES.ALL_INTERFACES
- Replaced standalone 127.0.0.1 references with BIND_ADDRESSES.LOCALHOST
- Documented shell grep patterns (127.0.0.1 in tcpdump matching) as accepted exceptions
- Documented UI form defaults (TAK config) as accepted exceptions
- Verified ~50 localhost:PORT strings already replaced by Task 3.2.1 (SERVICE_URLS)
Verified: remaining IP literals are only documented exceptions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Verification

**Command 1 -- No unaddressed localhost:PORT patterns**:

```bash
grep -Prn 'localhost:\d+' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "\.md" | wc -l
```

**Expected result**: `0`

**Command 2 -- Remaining 0.0.0.0 are only in limits.ts**:

```bash
grep -Prn '0\.0\.0\.0' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | wc -l
```

**Expected result**: `0`

**Command 3 -- Remaining 127.0.0.1 are only documented exceptions**:

```bash
grep -Prn '127\.0\.0\.1' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | grep -v node_modules | grep -v "NOTE:" | wc -l
```

**Expected result**: Small number (documented shell pattern exceptions + UI form defaults)

**Command 4 -- TypeScript compiles**:

```bash
npm run typecheck
```

**Expected result**: Exit 0.

**Command 5 -- Build succeeds**:

```bash
npm run build
```

**Expected result**: Exit 0.

---

## Phase 3.2 Verification Checklist (ALL TASKS COMPLETE)

This checklist is executed after ALL Phase 3.2 tasks (3.2.0 through 3.2.7) are complete. It provides the final gate before Phase 3.3 begins.

| #   | Check                                 | Command                                                                                                                                                              | Expected              |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | No hardcoded port literals            | `grep -Prn '\b(2501\|8092\|3002\|8073\|11434\|8081\|8080\|4729\|2947\|8088\|8002\|3001)\b' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l` | 0                     |
| 2   | No raw timeout literals in setTimeout | `grep -Prn '(setTimeout\|setInterval)\([^,]+,\s*\d{4,}\)' src/ --include="*.ts" --include="*.svelte" \| grep -v limits.ts \| wc -l`                                  | 0                     |
| 3   | No raw AbortSignal timeouts           | `grep -Prn 'AbortSignal\.timeout\(\d+\)' src/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                                        | 0                     |
| 4   | No hardcoded RF frequencies in server | `grep -Prn '\b(2400\|2500\|5150\|5850\|2485)\b' src/lib/server/ --include="*.ts" \| grep -v limits.ts \| wc -l`                                                      | 0                     |
| 5   | No /home/pi or /home/ubuntu paths     | `grep -Prn '/home/(pi\|ubuntu)/' src/ --include="*.ts" --include="*.svelte" \| wc -l`                                                                                | 0                     |
| 6   | limits.ts has 14+ constant groups     | `grep -c "as const" src/lib/constants/limits.ts`                                                                                                                     | 14+                   |
| 7   | paths.ts exists and uses env vars     | `grep -c "env\." src/lib/constants/paths.ts`                                                                                                                         | 10+                   |
| 8   | No duplicate retention configs        | `grep -c "604800000" src/ -r --include="*.ts"`                                                                                                                       | 1 (only in limits.ts) |
| 9   | TypeScript compiles                   | `npm run typecheck`                                                                                                                                                  | Exit 0                |
| 10  | Build succeeds                        | `npm run build`                                                                                                                                                      | Exit 0                |
| 11  | Unit tests pass                       | `npm run test:unit`                                                                                                                                                  | Exit 0                |

---

## Audit Corrections Applied

| Original Claim             | Corrected Value | Delta                | Source                                |
| -------------------------- | --------------- | -------------------- | ------------------------------------- |
| 53 hardcoded IPs/localhost | **67**          | +14 (26% undercount) | Verification Audit Claim 6, rated 2/5 |

The verification audit broke down the 67 total as: 56 `localhost`, 5 `127.0.0.1`, 6 `0.0.0.0`. The original plan's claim of 53 was 26% low. However, the practical impact is mitigated because Task 3.2.1 replaces ~50 of the 67 via SERVICE_URLS, leaving approximately 17 for this task to address (of which ~5 are documented exceptions).

## Risk Assessment

| Risk                                       | Likelihood | Impact | Mitigation                                                            |
| ------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------- |
| SERVICE_URLS not consumed by Task 3.2.1    | LOW        | MEDIUM | Verification grep in step 2 detects remaining localhost:PORT patterns |
| 0.0.0.0 bind change breaks network access  | NONE       | --     | Literal-for-literal replacement; bind behavior unchanged              |
| Shell pattern comment insufficient         | LOW        | LOW    | eslint-disable-next-line comment prevents lint warnings on exceptions |
| UI form default replacement confuses users | NONE       | --     | UI defaults left as-is; only programmatic strings centralized         |
| Phase 0 file renames break paths           | NONE       | --     | IP addresses are runtime connection strings, not source file paths    |

## Success Criteria

- `grep -Prn 'localhost:\d+' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l` returns **0**
- `grep -Prn '0\.0\.0\.0' src/ --include="*.ts" --include="*.svelte" | grep -v limits.ts | wc -l` returns **0**
- All 67 IP address occurrences accounted for: ~50 by Task 3.2.1, ~6 bind addresses, ~3 standalone 127.0.0.1, ~5 documented exceptions, ~3 remaining `localhost`
- `npm run typecheck` exits 0
- `npm run build` exits 0
- Phase 3.2 Verification Checklist (all 11 checks) passes

## Dependencies

- **Phase 3.1**: Must be complete (logger migration complete before constants work begins).
- **Phase 3.2.0**: BIND_ADDRESSES must be defined in limits.ts.
- **Phase 3.2.1**: Port replacement must be complete -- this task depends on SERVICE_URLS adoption.
- **Phase 3.3**: ESLint `no-magic-numbers` rule depends on constants being centralized first.
- **Phase 5**: Architecture decomposition benefits from centralized configuration.
- **Phase 6**: Infrastructure modernization (Docker, SystemD) benefits from env-var-based paths and centralized network config.

## Cross-References

- **Depends on**: Phase-3.2.0 (Constants Infrastructure Extension), Phase-3.2.1 (Port Replacement)
- **Blocks**: Phase-3.3 (ESLint enforcement), Phase 6 (Infrastructure Modernization)
- **Related**: Phase-2.2.2 (CORS Restriction -- 0.0.0.0 bind addresses flagged as security concern)
- **Related**: Independent Security Audit -- 0.0.0.0 binds with `Access-Control-Allow-Origin: *`
- **Related**: Phase-3.2.6 (File Path Centralization -- some paths co-locate with IPs)

## Execution Tracking

| Subtask | Description                                       | Status  | Started | Completed | Verified By |
| ------- | ------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 3.2.7.1 | Verify Task 3.2.1 SERVICE_URLS adoption (~50 IPs) | PENDING | --      | --        | --          |
| 3.2.7.2 | Replace 0.0.0.0 bind addresses (~6)               | PENDING | --      | --        | --          |
| 3.2.7.3 | Replace standalone 127.0.0.1 (~3)                 | PENDING | --      | --        | --          |
| 3.2.7.4 | Replace remaining localhost (~3)                  | PENDING | --      | --        | --          |
| 3.2.7.5 | Document shell pattern exceptions (~2)            | PENDING | --      | --        | --          |
| 3.2.7.6 | Document UI form default exceptions (~3)          | PENDING | --      | --        | --          |
| 3.2.7.7 | Run Phase 3.2 Verification Checklist (11 checks)  | PENDING | --      | --        | --          |
