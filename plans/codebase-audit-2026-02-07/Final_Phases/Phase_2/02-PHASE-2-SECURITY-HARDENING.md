# Phase 2: Security Hardening (Overview)

**Risk Level**: HIGH -- Addresses exploitable vulnerabilities in a system controlling RF hardware
**Parallel-safe with**: Phase 1
**Prerequisites**: Phase 0 (file structure must be stable before security patches)
**Standards**: OWASP Top 10 (2021), CERT C STR02-C, NIST SP 800-53 AC-3, DISA STIG Application Security

**Verification Date**: 2026-02-07
**Verification Method**: All quantitative claims verified against the live codebase via grep, find, and direct file inspection.

---

## Structure

Phase 2 is split into two sub-phases executed in strict sequence:

| Sub-Phase     | File                                    | Scope                                                                                                                                                                                                                                                                    | Tasks                | Prerequisite |
| ------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------ |
| **Phase 2.1** | `02a-PHASE-2.1-CRITICAL-SECURITY.md`    | Authentication (fail-closed), WebSocket auth, body size limits, injection elimination, credential removal (21 instances), SSRF, data exposure                                                                                                                            | **7 tasks** (was 5)  | Phase 0      |
| **Phase 2.2** | `02b-PHASE-2.2-SYSTEMATIC-HARDENING.md` | Swallowed errors (39+83 broader), CORS (15), CSP, JSON validation (49), rate limiting, security tests, npm audit, error handlers, audit logging, debug endpoint removal, incident response, OS hardening, log management, data-at-rest encryption, ESLint security rules | **14 tasks** (was 6) | Phase 2.1    |

Phase 2.2 MUST NOT begin until Phase 2.1 is complete. The authentication middleware and input sanitization library created in 2.1 are dependencies for 2.2.

**REGRADE NOTE**: Both sub-phases were expanded based on the independent regrade audit (`FINAL-AUDIT-REPORT-PHASE-2-REGRADE.md`, 2026-02-08). Phase 2.1 gained 2 new tasks (WebSocket auth, body size limits). Phase 2.2 gained 8 new tasks addressing gaps in error handling, operational security, OS hardening, data protection, and verification quality.

---

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

---

## Task Summary

### Phase 2.1: Critical Security (7 Tasks -- was 5, +2 from regrade)

| Task      | Description                                                  | Severity     | Files Affected                                                   | Regrade          |
| --------- | ------------------------------------------------------------ | ------------ | ---------------------------------------------------------------- | ---------------- |
| 2.1.1     | API Authentication middleware (**fail-closed**, header-only) | CRITICAL     | hooks.server.ts + all 114 API endpoints                          | Updated (A3, A4) |
| 2.1.2     | Eliminate shell injection vectors (**3 CRITICAL**, 4 HIGH)   | CRITICAL     | 17 files (was 11; +2 CRITICAL, +2 additional, -1 false positive) | Updated (A1, A2) |
| 2.1.3     | Remove hardcoded credentials (**21 total**)                  | HIGH         | 7 source + 1 config + 3 Docker + 8 scripts                       | Updated (B7)     |
| 2.1.4     | Fix SSRF vulnerabilities                                     | HIGH         | 3 proxy/fetch endpoints                                          | Unchanged        |
| 2.1.5     | Remove stack trace exposure (**2 client-facing**)            | MEDIUM       | 3 API route files (2 client, 3 console)                          | Corrected        |
| **2.1.6** | **WebSocket authentication + maxPayload limits**             | **CRITICAL** | **websocket-server.ts, hooks.server.ts, webSocketManager.ts**    | **NEW (A5, A6)** |
| **2.1.7** | **Request body size limits**                                 | **HIGH**     | **hooks.server.ts**                                              | **NEW (A7)**     |

### Phase 2.2: Systematic Hardening (14 Tasks -- was 6, +8 from regrade)

| Task       | Description                                           | Severity   | Files Affected                       | Regrade          |
| ---------- | ----------------------------------------------------- | ---------- | ------------------------------------ | ---------------- |
| 2.2.1      | Fix **39** swallowed error patterns + **~83 broader** | MEDIUM     | 17+ files                            | Updated (C4)     |
| 2.2.2      | CORS restriction (**15** instances)                   | HIGH       | 9 files (was 8; +1 Express cors())   | Updated          |
| 2.2.3      | Security headers (CSP)                                | MEDIUM     | hooks.server.ts                      | Unchanged        |
| 2.2.4      | Validate **49** JSON.parse calls                      | MEDIUM     | 23+ files (was 21)                   | Updated          |
| 2.2.5      | Rate limiting for hardware endpoints                  | MEDIUM     | hooks.server.ts                      | Unchanged        |
| 2.2.6      | Security testing + **resolve 19 npm audit vulns**     | HIGH       | New test files + package.json        | Updated (B3, C6) |
| **2.2.7**  | **Uncaught exception/rejection handlers**             | **HIGH**   | **hooks.server.ts**                  | **NEW (B2)**     |
| **2.2.8**  | **Authentication audit logging**                      | **HIGH**   | **auth-middleware.ts**               | **NEW (B4)**     |
| **2.2.9**  | **Remove/disable debug endpoints in production**      | **HIGH**   | **7 debug route directories**        | **NEW (B8)**     |
| **2.2.10** | **Incident response procedure**                       | **MEDIUM** | **New docs/INCIDENT-RESPONSE.md**    | **NEW (B6)**     |
| **2.2.11** | **OS-level hardening (iptables, noexec, AppArmor)**   | **MEDIUM** | **New scripts/security/**            | **NEW (C1)**     |
| **2.2.12** | **Log management architecture**                       | **MEDIUM** | **New logrotate config, log format** | **NEW (C2)**     |
| **2.2.13** | **Data-at-rest encryption (SQLCipher)**               | **HIGH**   | **database.ts, package.json**        | **NEW (C3)**     |
| **2.2.14** | **AST-based validation enforcement (ESLint rules)**   | **LOW**    | **config/eslint.config.js**          | **NEW (C5)**     |

---

## Commit Strategy

Each task produces one atomic commit:

```
security(phase2.X.Y): <description>

Phase 2.X Task Y: <full task name>
Verified: <verification command and result>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Rollback: `git reset --soft HEAD~1` if any verification fails.

---

## Corrections Applied (2026-02-07)

This overview was rewritten from the original 84-line version which contained outdated counts from the initial audit. Key corrections:

| Metric               | Original Claim | Corrected Value                        |
| -------------------- | -------------- | -------------------------------------- |
| Injection vectors    | 10             | 11 files with user-param interpolation |
| Swallowed errors     | 39             | 38                                     |
| CORS wildcards       | ~10 files      | 14 instances across 8 files            |
| JSON.parse           | not mentioned  | 43 instances                           |
| API endpoints        | not mentioned  | 114 files                              |
| Stack trace exposure | not mentioned  | 5 instances in 3 files                 |

---

## Regrade Adjustments Applied (2026-02-08)

**Source**: `FINAL-AUDIT-REPORT-PHASE-2-REGRADE.md` (Independent audit by 5 parallel verification sub-agents)

**Regrade scope**: Every quantitative claim re-verified, every referenced file read line-by-line, search conducted for vulnerability classes the plan did not address. Evaluated against OWASP Top 10, CERT Secure Coding, NIST SP 800-53, DISA STIG, and NASA/JPL Power of Ten standards.

### Key Findings from Regrade

1. **2 CRITICAL injection vectors missed** -- `cell-towers/+server.ts` (Python code injection via GET params, highest-value target in codebase) and `usrp-power/+server.ts` (shell injection via POST body)
2. **1 false positive removed** -- `rtl-433/control/+server.ts` uses `spawn()` with array args, not shell
3. **Auth design was fail-open** -- localhost fallback removed; now fail-closed (refuse to start without API key)
4. **API key in query string removed** -- X-API-Key header only
5. **WebSocket security was completely absent** -- 3 WebSocket endpoints with zero auth, zero origin checking, zero maxPayload limits
6. **7 additional credential locations found** -- total 21, not 14
7. **3 of 5 stack traces were console-only** -- only 2 are actually client-facing
8. **19 npm audit vulnerabilities** (14 high) including prototype pollution in `devalue`
9. **7 debug endpoints expose internal state** -- must be removed in production
10. **No operational security** -- added incident response, key rotation, audit logging

### Corrected Metrics Summary

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

### Additions by Regrade Priority

**Priority 1 (Immediate)**: A1-A7 -- injection vectors, false positive, fail-closed auth, header-only API key, WebSocket auth, maxPayload, body size limits

**Priority 2 (Required for compliance)**: B1-B8 -- trust boundary diagram, error handlers, npm audit, audit logging, key rotation, incident response, credential expansion, debug endpoints

**Priority 3 (Required for stated standard)**: C1-C6 -- OS hardening, log management, data-at-rest encryption, expanded error scope, AST validation, property-based testing

All adjustments have been incorporated into the sub-phase documents. See the "Regrade Adjustments Applied" sections at the end of each sub-phase document for detailed change logs.
