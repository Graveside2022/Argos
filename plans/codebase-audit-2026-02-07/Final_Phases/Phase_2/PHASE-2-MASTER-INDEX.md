# Phase 2: Security Hardening -- Master Index

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: OWASP Top 10 (2021), CERT C STR02-C, NIST SP 800-53 AC-3, DISA STIG Application Security, NASA/JPL Power of Ten
**Review Panel**: US Cyber Command Engineering Review Board

---

## Purpose

This document serves as the master index and execution tracker for Phase 2: Security Hardening. Phase 2 addresses exploitable vulnerabilities in a field-deployed SDR & Network Analysis Console that controls RF hardware (HackRF One) and collects IMSI identifiers, WiFi device data, and GPS positions. All 114 API endpoints, 3 WebSocket endpoints, and 8 SSE streaming endpoints currently operate with zero authentication. Phase 2 establishes authentication, eliminates injection vectors, removes hardcoded credentials, and systematically hardens the application, OS, and data layers.

## Execution Constraints

| Constraint              | Value                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| Risk Level              | HIGH -- Addresses exploitable vulnerabilities in a system controlling RF hardware |
| Prerequisites           | Phase 0 complete (file structure must be stable before security patches)          |
| Parallel-safe with      | Phase 1                                                                           |
| Estimated Files Touched | ~95                                                                               |
| Total Tasks             | 21 (7 in Phase 2.1 + 14 in Phase 2.2)                                             |
| Git Commits Produced    | 21 (one atomic commit per task)                                                   |

## Sub-Task Files

| File                                             | Task   | Description                                                                             | Dependencies       | Commit Required         |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------- | ------------------ | ----------------------- |
| `Phase-2.0.1-Pre-Execution-Security-Snapshot.md` | 2.0.1  | Create git tag `phase2-pre-execution`, capture baseline security metrics                | Phase 0 complete   | No (tag only)           |
| `Phase-2.1.0-Threat-Model-Trust-Boundaries.md`   | 2.1.0  | Threat model, trust boundary diagram, key rotation procedure                            | None               | No (reference document) |
| `Phase-2.1.1-API-Authentication-Fail-Closed.md`  | 2.1.1  | Implement fail-closed API key authentication for all 114 endpoints                      | Task 2.0.1         | Yes                     |
| `Phase-2.1.2-Shell-Injection-Elimination.md`     | 2.1.2  | Eliminate all shell injection vectors (3 CRITICAL, 4 HIGH, ~15 MEDIUM)                  | Task 2.1.1         | Yes                     |
| `Phase-2.1.3-Hardcoded-Credential-Removal.md`    | 2.1.3  | Remove all 21 hardcoded credentials across source, config, Docker, scripts              | Task 2.1.1         | Yes                     |
| `Phase-2.1.4-SSRF-Elimination.md`                | 2.1.4  | Fix SSRF via HackRF proxy catch-all and external API parameter validation               | Task 2.1.1         | Yes                     |
| `Phase-2.1.5-Stack-Trace-Removal.md`             | 2.1.5  | Remove 2 client-facing stack trace exposures, create safe error response helper         | Task 2.1.1         | Yes                     |
| `Phase-2.1.6-WebSocket-Authentication.md`        | 2.1.6  | Add authentication, origin checking, and maxPayload limits to all 3 WebSocket endpoints | Task 2.1.1         | Yes                     |
| `Phase-2.1.7-Request-Body-Size-Limits.md`        | 2.1.7  | Add request body size limits (64KB hardware, 10MB general) to prevent DoS               | Task 2.1.1         | Yes                     |
| `Phase-2.2.1-Swallowed-Error-Remediation.md`     | 2.2.1  | Fix 39 exact `.catch(() => {})` patterns + ~83 broader error-suppression patterns       | Phase 2.1 complete | Yes                     |
| `Phase-2.2.2-CORS-Restriction.md`                | 2.2.2  | Replace 15 CORS wildcard instances across 9 files with origin allowlist                 | Phase 2.1 complete | Yes                     |
| `Phase-2.2.3-Security-Headers-CSP.md`            | 2.2.3  | Add CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy headers               | Phase 2.1 complete | Yes                     |
| `Phase-2.2.4-JSON-Parse-Validation.md`           | 2.2.4  | Wrap all 49 JSON.parse calls with try-catch or Zod-backed safeJsonParse                 | Phase 2.1 complete | Yes                     |
| `Phase-2.2.5-Rate-Limiting.md`                   | 2.2.5  | Token bucket rate limiter for hardware control endpoints (10 req/min)                   | Phase 2.1 complete | Yes                     |
| `Phase-2.2.6-Security-Testing-NPM-Audit.md`      | 2.2.6  | Resolve 19 npm audit vulns (14 high), create security test suite, property-based tests  | Phase 2.1 complete | Yes                     |
| `Phase-2.2.7-Uncaught-Exception-Handlers.md`     | 2.2.7  | Add global uncaughtException and unhandledRejection handlers with globalThis guard      | Phase 2.1 complete | Yes                     |
| `Phase-2.2.8-Authentication-Audit-Logging.md`    | 2.2.8  | Structured JSON audit logging for all auth events (success, failure, rate limit, WS)    | Phase 2.1 complete | Yes                     |
| `Phase-2.2.9-Debug-Endpoint-Removal.md`          | 2.2.9  | Remove or gate 7 debug/test endpoints exposing internal state                           | Phase 2.1 complete | Yes                     |
| `Phase-2.2.10-Incident-Response-Procedure.md`    | 2.2.10 | Document 3-level incident response plan (unauthorized access, compromise, device loss)  | Phase 2.1 complete | Yes                     |
| `Phase-2.2.11-OS-Level-Hardening.md`             | 2.2.11 | iptables firewall rules, /tmp noexec mount, AppArmor profile                            | Phase 2.1 complete | Yes                     |
| `Phase-2.2.12-Log-Management-Architecture.md`    | 2.2.12 | Configure logrotate, structured JSON log format, persistent audit storage               | Phase 2.1 complete | Yes                     |
| `Phase-2.2.13-Data-At-Rest-Encryption.md`        | 2.2.13 | Replace better-sqlite3 with SQLCipher for AES-256 database encryption                   | Phase 2.1 complete | Yes                     |
| `Phase-2.2.14-AST-Validation-ESLint-Rules.md`    | 2.2.14 | Custom ESLint rules enforcing no-template-exec and JSON.parse-try-catch at AST level    | Phase 2.1 complete | Yes                     |

## Execution Order

Phase 2.1 tasks execute in **STRICT SEQUENCE** (each step depends on the previous). Phase 2.2 MUST NOT begin until all of Phase 2.1 is complete. Within Phase 2.2, tasks are independent and may execute in any order.

```
MANDATORY FIRST: Task 2.0.1 (Pre-Execution Security Snapshot)
         |
         v
    Task 2.1.0 (Threat Model -- reference document, no commit)
         |
         v
=== PHASE 2.1: STRICT SEQUENCE (authentication + foundational security) ===
         |
    Task 2.1.1 (API Authentication -- fail-closed)
         |
    Task 2.1.6 (WebSocket Authentication + maxPayload)
         |
    Task 2.1.7 (Request Body Size Limits)
         |
    Task 2.1.2 (Shell Injection Elimination)
         |
    Task 2.1.3 (Hardcoded Credential Removal)
         |
    Task 2.1.4 (SSRF Elimination)
         |
    Task 2.1.5 (Stack Trace Removal)
         |
         v
    PHASE 2.1 VERIFICATION CHECKLIST (all 15 checks must pass)
         |
         v
=== PHASE 2.2: INDEPENDENT TASKS (systematic hardening) =================
         |
    +----+----+----+----+----+----+----+----+----+----+----+----+----+----+
    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
  2.2.1 2.2.2 2.2.3 2.2.4 2.2.5 2.2.6 2.2.7 2.2.8 2.2.9 2.2.10 2.2.11 2.2.12 2.2.13 2.2.14
    |    |    |    |    |    |    |    |    |    |    |    |    |    |    |
    v    v    v    v    v    v    v    v    v    v    v    v    v    v    v
  COMMIT (x14)
         |
         v
    PHASE 2.2 VERIFICATION CHECKLIST (all 12 checks must pass)
         |
         v
    PHASE 2 COMPLETE
```

Tasks 2.2.1 through 2.2.14 are independent and may execute in any order after Phase 2.1 is complete. However, the recommended serial order is 2.2.1 through 2.2.14 numerically to allow incremental build verification.

**Rationale for strict Phase 2.1 sequence**: Task 2.1.1 creates the `auth-middleware.ts` and `validateApiKey()` function. Task 2.1.6 imports `validateApiKey()` for WebSocket auth. Task 2.1.2 creates `input-sanitizer.ts`. Tasks 2.1.3-2.1.5 depend on the `.env` configuration established by 2.1.1. All Phase 2.2 tasks depend on the authentication middleware and input sanitization library created in Phase 2.1.

## Verified Attack Surface (2026-02-08 -- corrected per regrade)

| Metric                                           | Verified Count                        | Prior Count      | Verification Command                                                         |
| ------------------------------------------------ | ------------------------------------- | ---------------- | ---------------------------------------------------------------------------- |
| Total API endpoint files                         | **114**                               | 114              | `find src/routes/api/ -name "+server.ts" \| wc -l`                           |
| API endpoints with zero authentication           | **114** (all of them)                 | 114              | No auth middleware exists                                                    |
| **WebSocket endpoints with zero authentication** | **3** (CRITICAL)                      | Not assessed     | `websocket-server.ts`, `hooks.server.ts` (ws upgrade), `webSocketManager.ts` |
| hostExec/exec/spawn calls (codebase-wide)        | **110** across 14 files               | 110              | `grep -rln "hostExec" src/ --include="*.ts"`                                 |
| exec/spawn calls in API routes                   | **121** across 32 files               | 121              | `grep -rn "hostExec\|exec\|spawn" src/routes/api/`                           |
| **Command injection vectors (CRITICAL)**         | **3**                                 | 1                | Regrade Section 1.1 (cell-towers, usrp-power, gsm-evil/control)              |
| **Command injection vectors (total)**            | **3C + 4H + ~15M**                    | 13 (no severity) | Regrade Section 1.1, -1 false positive (rtl-433)                             |
| **Hardcoded credentials (total)**                | **21**                                | 14 (9+3+2)       | Regrade Section 1.2 (expanded search scope)                                  |
| Hardcoded credentials in source                  | **9** instances across 7 files        | 9 across 6       | +1 DashboardMap.svelte client-side API key                                   |
| Hardcoded credentials in config                  | **1** (git-tracked JSON)              | Not counted      | `config/opencellid.json`                                                     |
| Hardcoded credentials in Docker                  | **3** instances                       | 3                | `docker/docker-compose.portainer-dev.yml`                                    |
| Hardcoded credentials in scripts                 | **8** instances                       | 2                | Expanded search found 6 additional locations                                 |
| **CORS wildcard instances**                      | **15** across 9 files                 | 14 across 8      | +1 Express `cors()` in `gsm-evil/server.ts`                                  |
| **Swallowed error patterns (exact)**             | **39** across 17 files                | 38 across 16     | +1 missed in `cell-towers/+server.ts:92`                                     |
| **Swallowed error patterns (all forms)**         | **~122**                              | 38               | Including `.catch(() => literal)`, bare `catch {}`, unused `_error`          |
| **Unvalidated JSON.parse calls**                 | **49** across 23+ files               | 43 across 21     | +6 undercounted                                                              |
| **JSON.parse without try-catch**                 | **18 (37%)**                          | Not stated       | Regrade Section 1.6                                                          |
| **Stack traces exposed to clients**              | **2** (client-facing)                 | 5                | 3 reclassified as console-only (server logs)                                 |
| **Debug endpoints exposing internal state**      | **7**                                 | Not assessed     | Regrade Section 2.9                                                          |
| **npm audit vulnerabilities**                    | **19 (14 high)**                      | Not assessed     | `npm audit`                                                                  |
| Unauthenticated deploy server                    | **1** (netcat on port 8099)           | 1                | `scripts/deploy-master.sh:347`                                               |
| Sudoers wildcards                                | **4** lines (kill \*, /tmp execution) | 4                | `scripts/setup-droneid-sudoers.sh:22-23,32-33`                               |

## Commit Message Format

```
security(phase2.X.Y): <description>

Phase 2.X Task Y: <full task name>
Verified: <verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

| Scope                      | Command                                                   | Notes                                                           |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Single task (git-tracked)  | `git reset --soft HEAD~1`                                 | Preserves staging area                                          |
| Single task (npm involved) | `git reset --soft HEAD~1 && npm install`                  | Restores node_modules                                           |
| Full Phase 2.1 rollback    | `git reset --hard phase2-pre-execution && npm install`    | Destroys all Phase 2.1 commits; Phase 2.2 must not have started |
| Full Phase 2.2 rollback    | `git reset --hard <last-phase-2.1-commit> && npm install` | Destroys all Phase 2.2 commits; preserves Phase 2.1             |
| Full Phase 2 rollback      | `git reset --hard phase2-pre-execution && npm install`    | Destroys all Phase 2 commits (2.1 + 2.2)                        |

## Completion Criteria

Phase 2 is complete when ALL verification checks from both sub-phases pass with zero failures.

### Phase 2.1 Verification Checklist (15 checks)

| #   | Check                                     | Command                                                                                                                                                                                                                                   | Expected                               |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Authentication works (fail-closed)        | `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/system/info`                                                                                                                                                            | 401                                    |
| 2   | No API key accepted via query string      | `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/system/info?api_key=$ARGOS_API_KEY"`                                                                                                                                   | 401                                    |
| 3   | API key accepted only via header          | `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info`                                                                                                                             | 200                                    |
| 4   | System refuses to start without API key   | `ARGOS_API_KEY="" npm run dev 2>&1 \| head -5`                                                                                                                                                                                            | FATAL error, process exits             |
| 5   | WebSocket without auth rejected           | `wscat -c ws://localhost:5173/ws 2>&1 \| head -1`                                                                                                                                                                                         | error: Unexpected server response: 401 |
| 6   | WebSocket with auth accepted              | `wscat -c "ws://localhost:5173/ws?token=$ARGOS_API_KEY" 2>&1 \| head -1`                                                                                                                                                                  | Connected                              |
| 7   | No hardcoded passwords remain             | `grep -rn "'password'" src/ --include="*.ts" --include="*.svelte" \| grep -v "node_modules\|\.d\.ts\|security_analyzer" \| wc -l`                                                                                                         | 0                                      |
| 8   | No hardcoded API keys remain              | `grep -rn "pk\." src/ config/ --include="*.ts" --include="*.json" --include="*.svelte" \| grep -v "node_modules\|process\.env" \| wc -l`                                                                                                  | 0                                      |
| 9   | No hardcoded credentials in scripts       | `grep -rn "password\|admin:admin\|argos123\|hackrf" scripts/ --include="*.sh" \| grep -v ':-\|:?\|process\.env\|#' \| wc -l`                                                                                                              | 0                                      |
| 10  | No template literal injection in hostExec | `grep -rn 'hostExec(\`._\${' src/ --include="_.ts" \| wc -l`                                                                                                                                                                              | 0                                      |
| 11  | No execAsync with template interpolation  | `grep -rn 'execAsync(\`._\${' src/ --include="_.ts" \| wc -l`                                                                                                                                                                             | 0                                      |
| 12  | No stack traces in JSON responses         | `grep -rn "stack:" src/routes/ --include="*.ts" \| grep -v "node_modules\|// \|import\|type \|console\." \| wc -l`                                                                                                                        | 0                                      |
| 13  | Large payload rejected                    | `dd if=/dev/zero bs=65537 count=1 2>/dev/null \| curl -s -o /dev/null -w "%{http_code}" -X POST -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/octet-stream" --data-binary @- http://localhost:5173/api/hackrf/start-sweep` | 413                                    |
| 14  | Build and tests pass                      | `npm run typecheck && npm run build && npm run test:unit`                                                                                                                                                                                 | exit code 0                            |
| 15  | Manual injection test                     | `curl -X POST http://localhost:5173/api/gsm-evil/control -H "X-API-Key: $ARGOS_API_KEY" -H "Content-Type: application/json" -d '{"action":"start","frequency":"$(rm -rf /)"}'`                                                            | 400 with validation error              |

### Phase 2.2 Verification Checklist (12 checks)

| #   | Check                               | Command                                                                                                | Expected                   |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| 1   | Zero swallowed errors (exact match) | `grep -rn "\.catch(\s*(\s*)\s*=>" src/ --include="*.ts" \| wc -l`                                      | 0                          |
| 2   | Zero CORS wildcards                 | `grep -rn "Allow-Origin.*\*" src/ --include="*.ts" \| wc -l`                                           | 0                          |
| 3   | CSP header present                  | `curl -sI http://localhost:5173/ \| grep -c "Content-Security-Policy"`                                 | 1                          |
| 4   | Rate limiting active                | Burst 15 requests to `/api/hackrf/status`; first 10 return 200, last 5 return 429                      | 429 after limit            |
| 5   | npm audit clean                     | `npm audit --audit-level=high`                                                                         | exit code 0                |
| 6   | Security tests pass                 | `npm run test -- tests/security/`                                                                      | all pass                   |
| 7   | Global error handlers registered    | `grep -rn "uncaughtException\|unhandledRejection" src/ --include="*.ts" \| wc -l`                      | >= 2                       |
| 8   | Auth audit logging active           | Trigger AUTH_FAILURE, verify JSON log entry in server output                                           | AUTH_FAILURE entry present |
| 9   | Debug endpoints removed or gated    | `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/test` | 404 (in production)        |
| 10  | JSON.parse all wrapped              | `grep -rn "JSON\.parse" src/ --include="*.ts" \| grep -v "safeJsonParse\|try" \| wc -l`                | 0                          |
| 11  | ESLint security rules pass          | `npx eslint src/routes/api/ --config config/eslint.config.js 2>&1 \| grep -c "error"`                  | 0                          |
| 12  | Build passes                        | `npm run typecheck && npm run build && npm run test:unit`                                              | exit code 0                |

## Execution Tracking

| Task   | Description                                    | Status       | Started    | Completed  | Verified By     | Notes                                                                                                                                                                                                           |
| ------ | ---------------------------------------------- | ------------ | ---------- | ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.0.1  | Pre-Execution Security Snapshot                | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 | Tag `phase2-pre-execution` at `19723c6`. All baselines recorded.                                                                                                                                                |
| 2.1.0  | Threat Model and Trust Boundaries              | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 | All counts re-verified. 13 corrections applied. OWASP A07 fixed. Trust boundary diagram updated with missing services. Key rotation prerequisites documented.                                                   |
| 2.1.1  | API Authentication (fail-closed)               | **COMPLETE** | 2026-02-08 | 2026-02-08 | Claude Opus 4.6 | Fail-closed auth gate in hooks.server.ts. 106 endpoints protected. HMAC session cookie for browser. X-API-Key header for programmatic. 10/10 verification tests pass. MCP server updated with dotenv + API key. |
| 2.1.2  | Shell Injection Elimination                    | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.1.3  | Hardcoded Credential Removal (21 instances)    | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.1.4  | SSRF Elimination                               | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.1.5  | Stack Trace Removal                            | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.1.6  | WebSocket Authentication + maxPayload          | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.1.7  | Request Body Size Limits                       | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.1  | Swallowed Error Remediation (39 + ~83 broader) | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.2  | CORS Restriction (15 instances)                | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.3  | Security Headers (CSP)                         | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.4  | JSON.parse Validation (49 instances)           | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.5  | Rate Limiting (hardware endpoints)             | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.6  | Security Testing + npm Audit (19 vulns)        | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.7  | Uncaught Exception/Rejection Handlers          | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.8  | Authentication Audit Logging                   | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.9  | Debug Endpoint Removal (7 endpoints)           | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.10 | Incident Response Procedure                    | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.11 | OS-Level Hardening                             | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.12 | Log Management Architecture                    | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.13 | Data-at-Rest Encryption (SQLCipher)            | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |
| 2.2.14 | AST-Based Validation ESLint Rules              | PENDING      | --         | --         | --              | --                                                                                                                                                                                                              |

## Audit Finding Traceability

Every finding from the independent regrade audit (`FINAL-AUDIT-REPORT-PHASE-2-REGRADE.md`, 2026-02-08) is resolved by a specific sub-task. The regrade findings are organized by priority: A (Immediate), B (Required for compliance), C (Required for stated standard).

### Priority 1 (Immediate) -- Regrade IDs A1-A7

| Regrade ID | Finding                                                                                        | Severity | Sub-Task File                                   | Resolution                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| A1         | 2 CRITICAL injection vectors missed (cell-towers Python injection, usrp-power shell injection) | CRITICAL | `Phase-2.1.2-Shell-Injection-Elimination.md`    | Added to injection vector table as entries #1 and #2                                    |
| A2         | rtl-433/control false positive (uses spawn with array args)                                    | INFO     | `Phase-2.1.2-Shell-Injection-Elimination.md`    | Removed from injection table; moved to "Files verified as safe"                         |
| A3         | Auth middleware was fail-open (localhost fallback)                                             | CRITICAL | `Phase-2.1.1-API-Authentication-Fail-Closed.md` | Redesigned as fail-closed; removed isLocalhostRequest(); added validateSecurityConfig() |
| A4         | API key accepted via query string                                                              | HIGH     | `Phase-2.1.1-API-Authentication-Fail-Closed.md` | X-API-Key header only; query string rejected                                            |
| A5         | WebSocket endpoints have zero authentication                                                   | CRITICAL | `Phase-2.1.6-WebSocket-Authentication.md`       | New task: verifyClient callback + origin checking for all 3 WS endpoints                |
| A6         | WebSocket servers have no maxPayload limits                                                    | HIGH     | `Phase-2.1.6-WebSocket-Authentication.md`       | Added maxPayload: 1MB (main), 256KB (Kismet)                                            |
| A7         | No request body size limits anywhere                                                           | HIGH     | `Phase-2.1.7-Request-Body-Size-Limits.md`       | New task: 64KB hardware endpoints, 10MB general                                         |

### Priority 2 (Required for compliance) -- Regrade IDs B1-B8

| Regrade ID | Finding                                              | Severity | Sub-Task File                                  | Resolution                                                             |
| ---------- | ---------------------------------------------------- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| B1         | No trust boundary diagram                            | HIGH     | `Phase-2.1.0-Threat-Model-Trust-Boundaries.md` | 4-layer trust boundary diagram with architectural decisions            |
| B2         | No uncaughtException/unhandledRejection handlers     | HIGH     | `Phase-2.2.7-Uncaught-Exception-Handlers.md`   | New task: global handlers with globalThis guard                        |
| B3         | 19 npm audit vulnerabilities (14 high) not addressed | HIGH     | `Phase-2.2.6-Security-Testing-NPM-Audit.md`    | Expanded task: enumerate, resolve, add CI gate                         |
| B4         | No authentication audit logging                      | HIGH     | `Phase-2.2.8-Authentication-Audit-Logging.md`  | New task: structured JSON logging for all auth events                  |
| B5         | No key rotation procedure                            | MEDIUM   | `Phase-2.1.0-Threat-Model-Trust-Boundaries.md` | API key, service credential, and compromise response procedures        |
| B6         | No incident response procedure                       | MEDIUM   | `Phase-2.2.10-Incident-Response-Procedure.md`  | New task: 3-level incident response plan                               |
| B7         | Only 14 of 21 hardcoded credentials found            | HIGH     | `Phase-2.1.3-Hardcoded-Credential-Removal.md`  | Expanded from 14 to 21 (client-side key, config JSON, 6 shell scripts) |
| B8         | 7 debug endpoints expose internal state              | HIGH     | `Phase-2.2.9-Debug-Endpoint-Removal.md`        | New task: delete or gate behind NODE_ENV check                         |

### Priority 3 (Required for stated standard) -- Regrade IDs C1-C6

| Regrade ID | Finding                                                  | Severity | Sub-Task File                                 | Resolution                                             |
| ---------- | -------------------------------------------------------- | -------- | --------------------------------------------- | ------------------------------------------------------ |
| C1         | No OS-level hardening (firewall, noexec, AppArmor)       | MEDIUM   | `Phase-2.2.11-OS-Level-Hardening.md`          | New task: iptables, /tmp noexec, AppArmor profile      |
| C2         | No log management (rotation, structured format)          | MEDIUM   | `Phase-2.2.12-Log-Management-Architecture.md` | New task: logrotate config, JSON log format            |
| C3         | No data-at-rest encryption for SQLite                    | HIGH     | `Phase-2.2.13-Data-At-Rest-Encryption.md`     | New task: SQLCipher AES-256 encryption                 |
| C4         | Only 39 of ~122 error-suppression patterns addressed     | MEDIUM   | `Phase-2.2.1-Swallowed-Error-Remediation.md`  | Expanded scope: exact + broader patterns               |
| C5         | Grep-based verification insufficient for security claims | LOW      | `Phase-2.2.14-AST-Validation-ESLint-Rules.md` | New task: AST-level ESLint security rules              |
| C6         | No property-based testing for input validators           | MEDIUM   | `Phase-2.2.6-Security-Testing-NPM-Audit.md`   | Added subtask 2.2.6.4: fast-check property-based tests |

## Regrade Adjustments Summary -- Corrected Metrics

| Metric                       | Prior Plan Value | Regrade-Corrected Value   | Change            |
| ---------------------------- | ---------------- | ------------------------- | ----------------- |
| Injection vectors (CRITICAL) | 1                | **3**                     | +2                |
| Injection vectors (total)    | 13               | **~22** (3C+4H+15M) -1 FP | +9, -1            |
| Hardcoded credentials        | 14               | **21**                    | +7                |
| Stack traces (client-facing) | 5                | **2**                     | -3 (reclassified) |
| CORS wildcards               | 14               | **15**                    | +1                |
| Swallowed errors (exact)     | 38               | **39**                    | +1                |
| Swallowed errors (all forms) | 38               | **~122**                  | +84               |
| JSON.parse instances         | 43               | **49**                    | +6                |
| WebSocket auth               | Not assessed     | **0**                     | Critical gap      |
| npm audit vulnerabilities    | Not assessed     | **19 (14 high)**          | Critical gap      |
| Debug endpoints              | Not assessed     | **7**                     | New finding       |
| Phase 2.1 tasks              | 5                | **7**                     | +2 new tasks      |
| Phase 2.2 tasks              | 6                | **14**                    | +8 new tasks      |
| **Total Phase 2 tasks**      | **11**           | **21**                    | **+10**           |

---

**Document End**
