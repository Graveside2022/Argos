# Phase 6.3.05: Hardcoded Path Elimination -- Service and Config Files

**Document ID**: ARGOS-AUDIT-P6.3.05
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.5
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

23 hardcoded path references exist in the 12 service files. These are addressed by the templating system in Task 6.3.1. This task covers verification that the template substitution has resolved all service file paths, AND sweeps for any remaining hardcoded paths in non-service config files (YAML, JSON, `.conf`, `.env` formats) across the `deployment/`, `config/`, and `docker/` directories.

This is primarily a **verification and catch-all task** that confirms the work done in Tasks 6.3.1, 6.3.2, 6.3.3, and 6.3.4 has eliminated all hardcoded paths across all file types.

### Current State vs Desired State

| Metric                                      | Current                 | Target                                |
| ------------------------------------------- | ----------------------- | ------------------------------------- |
| Hardcoded paths in service files            | 23 across 12 files      | 0 (resolved by template substitution) |
| Hardcoded paths in non-service config files | 0 (verified)            | 0                                     |
| Generated service files with wrong paths    | N/A (not yet generated) | 0                                     |
| `@@` tokens remaining in generated output   | N/A                     | 0                                     |

---

## 2. Prerequisites

- Task 6.3.01 must be complete: service templates and `generate-services.sh` must exist.
- Task 6.3.02 must be complete: security hardening directives must be in templates.
- Task 6.3.03 must be complete: TypeScript/Svelte paths must be centralized.
- Task 6.3.04 must be complete: shell script paths must use `argos-env.sh` variables.

---

## 3. Dependencies

- **Upstream**: Tasks 6.3.01, 6.3.02, 6.3.03, 6.3.04 (all path elimination tasks must be done)
- **Downstream**: None (this is a terminal verification task for the path elimination chain)
- **Position**: End of Track A critical path: 6.3.1a -> 6.3.3a -> 6.3.3b -> 6.3.1b -> 6.3.2 -> **6.3.5**

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- deployment/ config/systemd/
```

This task primarily performs verification. If it reveals missed hardcoded paths in config files, those config files are reverted with the command above. The template system itself is rolled back via Task 6.3.1's rollback.

---

## 5. Current State / Inventory

### 5.1 Service File Hardcoded Paths (resolved by Task 6.3.1 templating)

The 23 hardcoded path references in the 12 service files are resolved by the `@@ARGOS_*@@` token substitution system created in Task 6.3.1. After running `deployment/generate-services.sh`, the generated files in `deployment/generated/` should contain only the configured user's paths.

### 5.2 Non-Service Config Files Assessment

```bash
grep -rn '/home/ubuntu\|/home/pi' --include='*.yml' --include='*.yaml' --include='*.json' --include='*.conf' \
  deployment/ config/ docker/
```

**Assessment (verified 2026-02-08):**

- `docker/.env` correctly uses `/home/kali` already.
- Docker-compose files use `${ARGOS_DIR}` variable substitution.
- No additional config files beyond the service files require changes.

If `generate-services.sh` (Task 6.3.1) is implemented correctly, all 23 service-file references are resolved by template substitution. This task reduces to verifying that no other config format contains hardcoded paths.

### 5.3 Config File Formats to Sweep

| Directory               | File Types                              | Expected Hardcoded Paths               |
| ----------------------- | --------------------------------------- | -------------------------------------- |
| `deployment/`           | `.service`, `.template`, `.yml`, `.env` | 0 (after template substitution)        |
| `deployment/generated/` | `.service`                              | 0 (only configured user paths)         |
| `config/`               | `.yml`, `.json`, `.conf`, `.js`         | 0                                      |
| `config/systemd/`       | `.service`                              | 0 (duplicate removed in 6.3.1)         |
| `docker/`               | `.yml`, `.yaml`, `.env`, `Dockerfile`   | 0 (already uses variable substitution) |

---

## 6. Actions / Changes

### Action A: Verify Generated Service Files

Run `generate-services.sh` with the correct environment and verify the output.

```bash
cd /home/kali/Documents/Argos/Argos
ARGOS_USER=kali ARGOS_GROUP=kali ARGOS_DIR=/home/kali/Documents/Argos/Argos \
  bash deployment/generate-services.sh
```

Inspect all generated files for:

1. No `@@` tokens remaining.
2. No `/home/ubuntu` or `/home/pi` paths.
3. All paths reference the configured user (`/home/kali`).

### Action B: Sweep Non-Service Config Files

Run comprehensive grep across all config directories and file types:

```bash
grep -rn '/home/ubuntu\|/home/pi' \
  --include='*.yml' --include='*.yaml' --include='*.json' --include='*.conf' \
  --include='*.env' --include='*.service' --include='*.template' \
  deployment/ config/ docker/
```

Any output from this command indicates a missed hardcoded path that must be fixed.

### Action C: Verify Duplicate Removal

Confirm that the duplicate `config/systemd/coral-worker.service` was removed in Task 6.3.1 Action C.

### Action D: Cross-Reference All Path Sources

Produce a summary report confirming zero hardcoded paths remain across all file types:

| Scope              | File Types              | Detection Command                                                     | Expected Result |
| ------------------ | ----------------------- | --------------------------------------------------------------------- | --------------- |
| TypeScript source  | `*.ts`                  | `grep -rn '/home/ubuntu\|/home/pi\|/home/kali' --include='*.ts' src/` | No output       |
| Svelte source      | `*.svelte`              | `grep -rn '/home/ubuntu\|/home/pi' --include='*.svelte' src/`         | No output       |
| Shell scripts      | `*.sh`                  | `grep -rn '/home/ubuntu\|/home/pi' --include='*.sh' scripts/`         | No output       |
| Service files      | `*.service`             | `grep -rn '/home/ubuntu\|/home/pi' deployment/ config/ scripts/`      | No output       |
| Config files       | `*.yml, *.json, *.conf` | See Action B command                                                  | No output       |
| Generated services | `*.service`             | `grep -rn '/home/' deployment/generated/ \| grep -v '/home/kali'`     | No output       |

---

## 7. Verification Commands

```bash
# 1. Verify no hardcoded ubuntu/pi paths in any config file
grep -rn '/home/ubuntu\|/home/pi' deployment/ config/ docker/ \
  --include='*.yml' --include='*.yaml' --include='*.json' --include='*.conf' --include='*.env' \
  --include='*.service' --include='*.template'
# Expected: only *.service.template files contain @@ARGOS_*@@ tokens, no literal paths

# 2. Verify generated service files have correct paths
grep -rn '/home/' deployment/generated/*.service | grep -v '/home/kali'
# Expected: no output (all paths reference the configured user)

# 3. Verify no @@tokens remain in generated files
grep -r '@@' deployment/generated/
# Expected: no output

# 4. Verify duplicate coral-worker.service is removed
test -f config/systemd/coral-worker.service && echo "FAIL: duplicate not removed" || echo "PASS"
# Expected: PASS

# 5. Comprehensive cross-scope sweep (all file types, all directories)
grep -rn '/home/ubuntu\|/home/pi' \
  --include='*.ts' --include='*.svelte' --include='*.sh' \
  --include='*.yml' --include='*.yaml' --include='*.json' \
  --include='*.conf' --include='*.env' --include='*.service' \
  src/ scripts/ deployment/ config/ docker/
# Expected: no output (complete elimination across entire codebase)
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                          | Command                                                              | Expected           |
| --- | ---------------------------------------------- | -------------------------------------------------------------------- | ------------------ |
| 1   | No @@tokens in generated services              | `grep -r '@@' deployment/generated/`                                 | No output          |
| 5   | No hardcoded /home/ubuntu in src/_.ts,_.svelte | `grep -rn '/home/ubuntu' --include='*.ts' --include='*.svelte' src/` | No output          |
| 6   | No hardcoded /home/pi in src/_.ts,_.svelte     | `grep -rn '/home/pi' --include='*.ts' --include='*.svelte' src/`     | No output          |
| 7   | No hardcoded /home/ubuntu in scripts/\*.sh     | `grep -rn '/home/ubuntu' --include='*.sh' scripts/`                  | No output          |
| 8   | No hardcoded /home/pi in scripts/\*.sh         | `grep -rn '/home/pi' --include='*.sh' scripts/`                      | No output          |
| 21  | Duplicate coral-worker.service removed         | `test -f config/systemd/coral-worker.service`                        | Exit 1 (not found) |
| 26  | No hardcoded /home/kali in src/_.ts,_.svelte   | `grep -rn '/home/kali' --include='*.ts' --include='*.svelte' src/`   | No output          |

### Additional Pass/Fail Criteria

1. Generated service files contain only paths referencing the configured user.
2. No `@@` tokens remain in any generated output.
3. The comprehensive cross-scope sweep (all file types, all directories) returns no output.
4. The duplicate `config/systemd/coral-worker.service` has been deleted.

---

## 9. Traceability

| Finding                                              | Task                                             | Status  |
| ---------------------------------------------------- | ------------------------------------------------ | ------- |
| 23 hardcoded paths in 12 service files               | 6.3.5 (verified via 6.3.1 template substitution) | PLANNED |
| Non-service config files may contain hardcoded paths | 6.3.5 Action B (sweep and verify)                | PLANNED |
| Cross-scope path elimination completeness            | 6.3.5 Action D (summary report)                  | PLANNED |

### Risk Assessment

| Risk                                               | Likelihood | Impact | Mitigation                                                       |
| -------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------- |
| Template substitution misses an @@token            | Low        | Medium | Verification command 3 catches any remaining tokens              |
| Non-service config file with hardcoded path missed | Low        | Low    | Comprehensive sweep covers all file types across all directories |
| Generated service files reference wrong user       | Low        | Medium | Verification command 2 validates all `/home/` references         |

---

## 10. Execution Order Notes

This is a **terminal verification task** at the end of Track A.

**Position in critical path**: 6.3.1a (argos-env.sh) -> 6.3.3a (paths.ts) -> 6.3.3b (update 17 files) -> 6.3.1b (templates) -> 6.3.2 (hardening) -> **6.3.5 (this task)**

This task CANNOT begin until all upstream path elimination tasks (6.3.1 through 6.3.4) are complete. It serves as the final validation gate for the entire path elimination effort.

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation).

---

END OF DOCUMENT
