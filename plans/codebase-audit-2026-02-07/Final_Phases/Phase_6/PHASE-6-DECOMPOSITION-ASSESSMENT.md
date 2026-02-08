# Phase 6 Sub-Task File Decomposition Assessment

**Document ID**: ARGOS-AUDIT-P6-DECOMP-ASSESS
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Scope**: All 42 sub-task files + 4 parent files in Phase 6
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY

---

## 1. Assessment Criteria

A sub-task file is flagged for **further decomposition** if it meets ANY of the following:

| Criterion                              | Threshold                                     |
| -------------------------------------- | --------------------------------------------- |
| C1: Independent sub-tasks              | >3 independent, separable sub-tasks           |
| C2: File length with multiple sections | >300 lines with multiple independent sections |
| C3: Mixed concerns                     | Combines unrelated problem domains            |
| C4: Estimated effort                   | >4 hours of engineer work                     |

---

## 2. Structured Assessment Table

### 2.1 Phase 6.1: Docker and Container Modernization (11 sub-task files)

| #   | File                                                      | Lines | Sub-Tasks | Est. Hours | Risk | Decompose?     | Criteria Met | Notes                                                                    |
| --- | --------------------------------------------------------- | ----: | --------: | ---------: | ---- | -------------- | ------------ | ------------------------------------------------------------------------ |
| 1   | Phase-6.1.01-Dockerfile-Multi-Stage-Build-Optimization.md |   344 |         4 |        2-3 | MED  | NO             | --           | 4 subtasks but tightly coupled (same Dockerfile)                         |
| 2   | Phase-6.1.02-Docker-Compose-Security-Hardening.md         |   546 |         6 |        3-4 | HIGH | **BORDERLINE** | C1, C2, C4   | 6 subtasks, P0 CRITICAL RCE (6.1.2.6). But all target same compose file. |
| 3   | Phase-6.1.03-Resource-Limits-and-Health-Checks.md         |   365 |         4 |        2-3 | MED  | NO             | --           | 4 subtasks, cohesive scope (same compose file)                           |
| 4   | Phase-6.1.04-Dockerignore-Audit-and-Improvement.md        |   235 |         1 |        0.5 | LOW  | NO             | --           | Single focused task                                                      |
| 5   | Phase-6.1.05-Credential-Externalization.md                |   353 |         3 |        2-3 | MED  | NO             | --           | Well-scoped, single concern                                              |
| 6   | Phase-6.1.06-Layer-Optimization-and-Non-Root-User.md      |   237 |         2 |        1-2 | MED  | NO             | --           | Small, focused                                                           |
| 7   | Phase-6.1.07-HackRF-Dockerfile-Hardening.md               |   256 |         1 |        1-2 | MED  | NO             | --           | Single Dockerfile target                                                 |
| 8   | Phase-6.1.08-Ollama-Compose-Verification.md               |   189 |         1 |        0.5 | LOW  | NO             | --           | Verification only                                                        |
| 9   | Phase-6.1.09-Docker-Build-Cache-and-Cleanup.md            |   215 |         2 |          1 | LOW  | NO             | --           | Small                                                                    |
| 10  | Phase-6.1.10-Docker-Network-Security.md                   |   327 |         3 |        1-2 | LOW  | NO             | --           | Disk reclamation, focused                                                |
| 11  | Phase-6.1.11-HostExec-Dependency-Analysis.md              |   514 |         7 |        4-6 | HIGH | **BORDERLINE** | C1, C2, C4   | 7 independent subtasks across different code areas                       |

### 2.2 Phase 6.2: Shell Script Consolidation (8 sub-task files)

| #   | File                                                    | Lines | Sub-Tasks | Est. Hours | Risk | Decompose?     | Criteria Met   | Notes                                                                         |
| --- | ------------------------------------------------------- | ----: | --------: | ---------: | ---- | -------------- | -------------- | ----------------------------------------------------------------------------- |
| 12  | Phase-6.2.01-Eliminate-Duplicate-Directories.md         |   435 |         6 |        2-3 | MED  | NO             | --             | 6 sections but sequential (verify, relocate, archive, verify)                 |
| 13  | Phase-6.2.02-GSM-Evil-Script-Consolidation.md           |   479 |       3+3 |        4-6 | MED  | **BORDERLINE** | C1, C4         | 3 new scripts to create, each with sub-subtasks                               |
| 14  | Phase-6.2.03-Kismet-Script-Consolidation.md             |   239 |         1 |        1-2 | LOW  | NO             | --             | 1 consolidated script                                                         |
| 15  | Phase-6.2.04-WiFi-Adapter-Script-Consolidation.md       |   334 |         2 |        2-3 | MED  | NO             | --             | 2 consolidated scripts                                                        |
| 16  | Phase-6.2.05-Keepalive-Process-Script-Consolidation.md  |   227 |         1 |        0.5 | LOW  | NO             | --             | Minimal: 1 file archived                                                      |
| 17  | Phase-6.2.06-Install-Script-Consolidation.md            |   240 |         1 |        0.5 | LOW  | NO             | --             | 3 files archived                                                              |
| 18  | Phase-6.2.07-Remaining-Top-Level-Script-Organization.md |   518 |        16 |        3-4 | LOW  | **BORDERLINE** | C1, C2         | 16 classification sub-sections, but most are trivial (archive/keep decisions) |
| 19  | Phase-6.2.08-Security-Remediation.md                    |   717 |         6 |      12-15 | CRIT | **YES**        | C1, C2, C3, C4 | 6 independent security categories, 331 instances, each a different concern    |

### 2.3 Phase 6.3: SystemD, Paths, and Deployment Pipeline (10 sub-task files)

| #   | File                                                      | Lines | Sub-Tasks | Est. Hours | Risk     | Decompose?     | Criteria Met | Notes                                                                           |
| --- | --------------------------------------------------------- | ----: | --------: | ---------: | -------- | -------------- | ------------ | ------------------------------------------------------------------------------- |
| 20  | Phase-6.3.01-SystemD-Service-File-Templating.md           |   219 |         3 |        2-3 | MED      | NO             | --           | 3 sequential steps (1a/1b/1c)                                                   |
| 21  | Phase-6.3.02-SystemD-Security-Hardening.md                |   311 |       3+1 |        2-3 | HIGH     | NO             | --           | 3 per-service subtasks + baseline block                                         |
| 22  | Phase-6.3.03-Hardcoded-Path-Elimination-TypeScript.md     |   343 |         2 |        2-3 | MED      | NO             | --           | Action A (create paths.ts) + Action B (update 17 files)                         |
| 23  | Phase-6.3.04-Hardcoded-Path-Elimination-Shell-Scripts.md  |   343 |        10 |        4-6 | MED      | **BORDERLINE** | C1, C4       | 147 refs across 64 files in 10 batches, but all same transformation             |
| 24  | Phase-6.3.05-Hardcoded-Path-Elimination-Service-Config.md |   226 |         1 |        0.5 | LOW      | NO             | --           | Verification/catch-all                                                          |
| 25  | Phase-6.3.06-Configuration-Conflict-Resolution.md         |   370 |         3 |        1-2 | MED      | NO             | --           | 3 actions (vm.swappiness, NODE_OPTIONS, console.log). Combines 6.3.6 + 6.3.6b.  |
| 26  | Phase-6.3.07-CI-CD-Pipeline-Repair.md                     |   533 |         5 |        3-4 | HIGH     | **BORDERLINE** | C1, C2, C3   | 5 fixes across ESLint, env validation, adapter switch, error fixes, release.yml |
| 27  | Phase-6.3.08-Additional-CI-CD-Workflows.md                |   370 |         4 |        1-2 | LOW      | NO             | --           | 4 additive actions (Dependabot, security scan, npm audit, SECURITY.md)          |
| 28  | Phase-6.3.09-Branch-Protection-and-CODEOWNERS.md          |   332 |         4 |          1 | MED      | NO             | --           | 4 quick actions, all git hygiene                                                |
| 29  | Phase-6.3.10-SvelteKit-Adapter-and-Production-Build.md    |   376 |         5 |        2-3 | MED-HIGH | NO             | --           | 5 actions but tightly coupled deployment chain                                  |

### 2.4 Phase 6.4: Shell Script Standardization and Quality (13 sub-task files)

| #   | File                                                  | Lines | Sub-Tasks | Est. Hours | Risk | Decompose?     | Criteria Met   | Notes                                                                      |
| --- | ----------------------------------------------------- | ----: | --------: | ---------: | ---- | -------------- | -------------- | -------------------------------------------------------------------------- |
| 30  | Phase-6.4.01-Shebang-Standardization.md               |   236 |         1 |        0.5 | LOW  | NO             | --             | Single sed transformation                                                  |
| 31  | Phase-6.4.02-Strict-Mode-Enforcement.md               |   262 |         1 |        2-3 | HIGH | NO             | --             | 1 task with 3 known incompatibility patterns                               |
| 32  | Phase-6.4.03-Header-Block-Standardization.md          |   208 |         1 |        2-3 | LOW  | NO             | --             | Repetitive header insertion                                                |
| 33  | Phase-6.4.04-ShellCheck-Compliance.md                 |   355 |         1 |        4-6 | MED  | **BORDERLINE** | C4             | 342 findings, 8 remediation patterns. Effort is high but all same concern. |
| 34  | Phase-6.4.05-Variable-Quoting-and-Input-Validation.md |   284 |         4 |        3-4 | HIGH | NO             | --             | 4 sections but all quoting/validation concern                              |
| 35  | Phase-6.4.06-Trap-and-Cleanup-Handlers.md             |   367 |         2 |        3-4 | HIGH | NO             | --             | Part A (audit) + Part B (traps). Sequential dependency.                    |
| 36  | Phase-6.4.07-Help-and-DryRun-Support.md               |   326 |         1 |        4-6 | LOW  | NO             | --             | Repetitive across ~55 scripts, same template                               |
| 37  | Phase-6.4.08-Idempotency-Fixes.md                     |   340 |         5 |        2-3 | MED  | NO             | --             | 5 patterns but same concern (idempotency)                                  |
| 38  | Phase-6.4.09-Logging-Standardization.md               |   305 |         1 |        3-4 | LOW  | NO             | --             | Replace 6 styles with centralized functions                                |
| 39  | Phase-6.4.10-Exit-Code-Conventions.md                 |   276 |         1 |        1-2 | LOW  | NO             | --             | Standardize exit codes 0-5                                                 |
| 40  | Phase-6.4.11-Shared-Library-Creation.md               |   325 |         5 |        4-6 | MED  | NO             | --             | 4 modules + wrapper. Foundational, sequential.                             |
| 41  | Phase-6.4.12-CI-Integration.md                        |   311 |         2 |          1 | LOW  | NO             | --             | CI job + pre-commit hook                                                   |
| 42  | Phase-6.4.13-Security-Critical-Pattern-Remediation.md |   816 |        10 |       8-12 | CRIT | **YES**        | C1, C2, C3, C4 | 10 independent subtasks, each a different CWE, largest file                |

### 2.5 Parent Files

| #   | File                                                  | Lines |                Tasks Defined |     Sub-Task Files | Orphans?                       |
| --- | ----------------------------------------------------- | ----: | ---------------------------: | -----------------: | ------------------------------ |
| P1  | Phase-6.1-DOCKER-AND-CONTAINER-MODERNIZATION.md       | 2,152 |            11 (6.1.1-6.1.11) | 11 (6.1.01-6.1.11) | NO                             |
| P2  | Phase-6.2-SHELL-SCRIPT-CONSOLIDATION.md               | 2,222 |              8 (6.2.1-6.2.8) |  8 (6.2.01-6.2.08) | SEE NOTES                      |
| P3  | Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md    | 1,908 | 10+1 (6.3.1-6.3.10 + 6.3.6b) | 10 (6.3.01-6.3.10) | NO (6.3.6b folded into 6.3.06) |
| P4  | Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md | 3,094 |            13 (6.4.1-6.4.13) | 13 (6.4.01-6.4.13) | NO                             |

---

## 3. Orphaned Task Analysis

### 3.1 Phase 6.1: No Orphans

All 11 tasks (6.1.1 through 6.1.11) in the parent document have corresponding sub-task files (Phase-6.1.01 through Phase-6.1.11). One-to-one mapping is complete.

### 3.2 Phase 6.2: One Decision Gate (Not an Orphan, But a Prerequisite)

The parent document (Section 3.3 addendum, lines 121-145) identifies **3 missing production-critical scripts** as a decision gate:

| Expected Script                       | Status              |
| ------------------------------------- | ------------------- |
| `scripts/deploy/deploy-production.sh` | MISSING - NOT FOUND |
| `scripts/deploy/rollback.sh`          | MISSING - NOT FOUND |
| `scripts/monitoring/health-check.sh`  | MISSING - NOT FOUND |

This is NOT an orphaned task -- it is an explicit prerequisite ("Do NOT proceed with Phase 6.2 consolidation until this decision is recorded"). However, no sub-task file addresses this decision. It is captured only in the parent document and in the acceptance criteria (item 16: "Missing production-critical scripts decision recorded: each marked CREATE or FORMALLY REMOVE").

**Recommendation**: This decision should be recorded in a lightweight document or directly in Phase-6.2.01 before execution begins. No new sub-task file needed; just a formal decision record.

Additionally, Phase 6.3.10 (SvelteKit-Adapter-and-Production-Build.md) Action C creates `scripts/deploy/deploy-to-pi.sh` which partially addresses the `deploy-production.sh` gap. Cross-reference this when making the decision.

### 3.3 Phase 6.3: No Orphans

- Task 6.3.6b (console cleanup) is explicitly folded into Phase-6.3.06-Configuration-Conflict-Resolution.md (confirmed: header reads "Original Task ID: 6.3.6 + 6.3.6b").
- Task 6.3.1a (argos-env.sh creation) is explicitly included as Step 6.3.1a within Phase-6.3.01-SystemD-Service-File-Templating.md (confirmed by grep).
- All 10 parent tasks have corresponding sub-task files.

### 3.4 Phase 6.4: No Orphans

All 13 tasks (6.4.1 through 6.4.13) have corresponding sub-task files. The execution chain is fully documented in both parent and sub-task files: 6.4.11 -> 6.4.1 -> 6.4.6 -> 6.4.2 -> 6.4.3 -> 6.4.4 -> 6.4.5 -> (6.4.7 || 6.4.8) -> 6.4.9 -> 6.4.10 -> 6.4.13 -> 6.4.12.

---

## 4. Decomposition Recommendations

### 4.1 STRONG DECOMPOSITION CANDIDATES (2 files)

#### 4.1.1 Phase-6.4.13-Security-Critical-Pattern-Remediation.md (816 lines, 10 subtasks, CRITICAL)

**Why decompose**: This is the largest sub-task file in Phase 6. It contains 10 independent subtasks, each addressing a different CWE vulnerability class. The subtasks target different files, use different remediation techniques, and can be executed and verified independently. Total estimated effort is 8-12 engineer-hours. Mixed concerns include code execution (eval), supply chain (curl|bash), permissions (chmod 777), credentials (hardcoded passwords), path security (sudo paths), and temp file safety (/tmp).

**Proposed decomposition into 3 files**:

| New File                                             | Contains                                                                     | Subtasks               | Lines (est.) | Risk     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------- | -----------: | -------- |
| Phase-6.4.13a-Code-Execution-Prevention.md           | eval elimination, backtick remediation, curl\|bash replacement               | 13.1, 13.2, 13.3       |         ~280 | CRITICAL |
| Phase-6.4.13b-Permission-and-Credential-Hardening.md | chmod 777, sudo path validation, hardcoded credentials, NOPASSWD restriction | 13.4, 13.5, 13.6, 13.7 |         ~320 | HIGH     |
| Phase-6.4.13c-Runtime-Safety.md                      | while-true watchdog, unsafe /tmp, world-writable log dirs                    | 13.8, 13.9, 13.10      |         ~250 | MEDIUM   |

**Benefit**: Enables parallel execution by separate agents. A (code execution) is CRITICAL and must go first. B and C can run in parallel after A completes.

#### 4.1.2 Phase-6.2.08-Security-Remediation.md (717 lines, 6 subtasks, CRITICAL)

**Why decompose**: 6 independent security categories, each targeting different files and using different remediation patterns. Total 331 security instances across: API token externalization (2), curl|bash replacement (22 in 14 files), NOPASSWD restriction (2), hardcoded password removal (3), IP address externalization (55 in 30+ files), and unsafe /tmp replacement (185 in 60+ files). Estimated effort is 12-15 engineer-hours. The categories are completely independent.

**Proposed decomposition into 3 files**:

| New File                                              | Contains                                               | Categories | Lines (est.) | Risk     |
| ----------------------------------------------------- | ------------------------------------------------------ | ---------- | -----------: | -------- |
| Phase-6.2.08a-Credential-and-Token-Security.md        | API token externalization + hardcoded password removal | S1, S4     |         ~180 | CRITICAL |
| Phase-6.2.08b-Supply-Chain-and-Privilege-Hardening.md | curl\|bash replacement + NOPASSWD restriction          | S2, S3     |         ~250 | CRITICAL |
| Phase-6.2.08c-Network-and-Filesystem-Safety.md        | Hardcoded IP externalization + unsafe /tmp replacement | S5, S6     |         ~320 | HIGH     |

**Benefit**: The CRITICAL credential/token issues (S1, S4) can be fixed first and fast. S5 (55 IP instances) and S6 (185 /tmp instances) are the bulk of the work and benefit from parallel execution.

### 4.2 BORDERLINE CANDIDATES (6 files) -- Decomposition NOT Recommended

These files meet 1-2 criteria but decomposition would create more organizational overhead than it saves. Reasons for keeping as-is:

| #   | File                                   | Lines | Why NOT Decompose                                                                                                           |
| --- | -------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------- |
| 2   | Phase-6.1.02 (Docker Compose Security) |   546 | All 6 subtasks target the SAME docker-compose file. Splitting would require repeated context loading.                       |
| 11  | Phase-6.1.11 (HostExec Analysis)       |   514 | Analysis document, not implementation. 7 subtasks are logical sections of a single analysis.                                |
| 13  | Phase-6.2.02 (GSM Consolidation)       |   479 | 3 new scripts to create, but they share the same GSM domain knowledge and dependency graph.                                 |
| 18  | Phase-6.2.07 (Remaining Organization)  |   518 | 16 sub-sections, but each is a trivial archive/keep decision (1-3 min each). No independent work units.                     |
| 23  | Phase-6.3.04 (Shell Path Elimination)  |   343 | 147 paths across 64 files, but all use the identical transformation (hardcoded -> ${ARGOS_DIR}).                            |
| 26  | Phase-6.3.07 (CI/CD Pipeline Repair)   |   533 | 5 fixes with mixed concerns, but Fix 3 (adapter-node) is upstream of Fixes 4-5. Sequential dependency prevents parallelism. |

### 4.3 Additionally Considered But Rejected

| File                                 | Lines | Reason for Rejection                                                                |
| ------------------------------------ | ----- | ----------------------------------------------------------------------------------- |
| Phase-6.4.04 (ShellCheck Compliance) | 355   | High effort (4-6h) but single concern. 8 patterns are all ShellCheck remediation.   |
| Phase-6.4.07 (Help/DryRun)           | 326   | High effort (4-6h) but purely repetitive template application across ~55 scripts.   |
| Phase-6.4.11 (Shared Library)        | 325   | 5 modules to create but they are tightly coupled (common.sh sources all 4 modules). |
| Phase-6.3.10 (Build/Deploy)          | 376   | 5 actions but tightly coupled deployment pipeline. Sequential dependency chain.     |

---

## 5. Summary Statistics

### 5.1 File Distribution

| Metric                         | Count  |
| ------------------------------ | ------ |
| Total sub-task files           | 42     |
| Total parent files             | 4      |
| Total lines (sub-task files)   | 14,604 |
| Total lines (parent files)     | 9,376  |
| Grand total (all Phase 6 docs) | 23,980 |

### 5.2 Decomposition Verdict

| Category                          | Count | Files                                          |
| --------------------------------- | ----- | ---------------------------------------------- |
| DECOMPOSE (strong recommendation) | 2     | 6.2.08, 6.4.13                                 |
| BORDERLINE (keep as-is)           | 6     | 6.1.02, 6.1.11, 6.2.02, 6.2.07, 6.3.04, 6.3.07 |
| NO DECOMPOSITION NEEDED           | 34    | All remaining                                  |

### 5.3 Effort Distribution

| Risk Level | Files  | Total Est. Hours |
| ---------- | ------ | ---------------- |
| CRITICAL   | 2      | 20-27            |
| HIGH       | 7      | 22-33            |
| MEDIUM     | 18     | 30-50            |
| LOW        | 15     | 14-25            |
| **TOTAL**  | **42** | **86-135**       |

### 5.4 Orphaned Tasks

| Phase | Orphans Found       | Details                                                  |
| ----- | ------------------- | -------------------------------------------------------- |
| 6.1   | 0                   | Complete 1:1 mapping                                     |
| 6.2   | 0 (1 decision gate) | 3 missing production scripts need CREATE/REMOVE decision |
| 6.3   | 0                   | 6.3.6b folded into 6.3.06; 6.3.1a folded into 6.3.01     |
| 6.4   | 0                   | Complete 1:1 mapping                                     |

---

## 6. Action List

### 6.1 Required Actions (must complete before Phase 6 execution begins)

| #   | Action                                                                             | Priority | Effort |
| --- | ---------------------------------------------------------------------------------- | -------- | ------ |
| A1  | Decompose Phase-6.4.13 into 3 files (6.4.13a/b/c)                                  | HIGH     | 1 hour |
| A2  | Decompose Phase-6.2.08 into 3 files (6.2.08a/b/c)                                  | HIGH     | 1 hour |
| A3  | Record CREATE/REMOVE decision for 3 missing production scripts in Phase 6.2 parent | MEDIUM   | 15 min |

### 6.2 Optional Actions (would improve but not required)

| #   | Action                                                                                               | Priority | Effort |
| --- | ---------------------------------------------------------------------------------------------------- | -------- | ------ |
| A4  | Add cross-reference notes to Phase-6.3.07 linking Fix 3 to Phase-6.3.10 (both address adapter-node)  | LOW      | 10 min |
| A5  | Add note to Phase-6.2.08 and Phase-6.4.13 about overlap (both address curl\|bash, /tmp, credentials) | LOW      | 10 min |

### 6.3 Overlap Detection

Two security remediation tasks have significant scope overlap:

| Topic                  | Phase 6.2.08 (Shell Scripts)   | Phase 6.4.13 (Shell Quality) |
| ---------------------- | ------------------------------ | ---------------------------- |
| curl\|bash replacement | S2: 22 instances in 14 files   | 13.3: same scope             |
| Unsafe /tmp            | S6: 185 instances in 60+ files | 13.9: same scope             |
| Hardcoded credentials  | S4: 3 passwords                | 13.6: same scope             |
| NOPASSWD restriction   | S3: 2 sudoers entries          | 13.7: same scope             |

**Risk**: If Phase 6.2.08 executes first (as the dependency graph requires), Phase 6.4.13 subtasks 13.3, 13.6, 13.7, and 13.9 become verification-only tasks (confirming the fixes from 6.2.08 are still in place). The sub-task files should explicitly acknowledge this overlap to prevent double-work.

**Recommendation**: Add a note to each Phase-6.4.13 decomposed file stating: "If Phase 6.2.08 has already remediated these patterns, this task reduces to VERIFICATION ONLY. Run the detection commands first; if all return 0, mark as pre-completed."

---

## 7. Document Status

```
END OF ASSESSMENT
Status:   FINAL
Version:  1.0
Date:     2026-02-08
Files Assessed: 42 sub-task files + 4 parent files (46 total)
```
