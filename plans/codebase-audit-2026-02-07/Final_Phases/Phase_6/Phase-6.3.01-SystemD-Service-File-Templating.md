# Phase 6.3.01: SystemD Service File Templating

**Document ID**: ARGOS-AUDIT-P6.3.01
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.1
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM-HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

All 11 service files contain hardcoded usernames (pi, ubuntu, root) and paths (/home/pi/projects/Argos, /home/ubuntu/projects/Argos). The actual deployment target uses user `kali` at path `/home/kali/Documents/Argos/Argos`. Every service file will fail on the current system without manual editing.

This task converts all service files to parameterized templates and creates a generator script that produces deployment-ready `.service` files from environment variables.

### Audit Corrections (from Section 1)

**Service File Count (Section 1.3):** 11 unique service files exist. Two are byte-identical duplicates:

- `config/systemd/coral-worker.service` (duplicate)
- `deployment/systemd/coral-worker.service` (canonical)

Verified with: `diff config/systemd/coral-worker.service deployment/systemd/coral-worker.service` (exit 0, no output).

---

## 2. Prerequisites

- None. This is the first task in the Phase 6.3 execution chain.
- The `scripts/lib/` directory must exist (or be created as part of this task for `argos-env.sh`).

---

## 3. Dependencies

- **Downstream**: Task 6.3.2 (Security Hardening) depends on templates created here.
- **Downstream**: Task 6.3.5 (Service/Config Path Verification) depends on generated output from this task.
- **Cross-dependency with 6.3.3**: Circular dependency resolved by splitting this task into sub-steps (see Section 10).
- **Cross-dependency with 6.3.4**: `argos-env.sh` created here (Step 6.3.1a) is sourced by shell scripts in Task 6.3.4.

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- deployment/ config/systemd/ scripts/*.service
```

Critical: No task in this phase modifies the running system. Service files must be manually installed with `sudo cp` and `sudo systemctl daemon-reload`. CI changes take effect only on push to GitHub.

---

## 5. Current State / Inventory

### 5.1 Service File Inventory (11 files, verified 2026-02-08)

| Service File                             | User=  | WorkingDirectory/Path Base   |
| ---------------------------------------- | ------ | ---------------------------- |
| deployment/argos-dev.service             | pi     | /home/pi/projects/Argos      |
| deployment/argos-final.service           | pi     | /home/pi/projects/Argos      |
| deployment/argos-cpu-protector.service   | pi     | /home/pi/projects/Argos      |
| deployment/argos-process-manager.service | pi     | /home/pi/projects/Argos      |
| deployment/argos-wifi-resilience.service | pi     | /home/pi/projects/Argos      |
| deployment/argos-droneid.service         | root   | /home/ubuntu/projects/Argos  |
| deployment/gsmevil-patch.service         | (none) | **(NONE)** -- see note below |
| deployment/systemd/coral-worker.service  | ubuntu | /home/ubuntu/projects/Argos  |
| config/systemd/coral-worker.service      | ubuntu | /home/ubuntu/projects/Argos  |
| scripts/dev-server-keepalive.service     | pi     | /home/pi/projects/Argos      |
| scripts/simple-keepalive.service         | pi     | /home/pi/projects/Argos      |
| scripts/wifi-keepalive.service           | root   | **(NONE)** -- see note below |

**Services with no WorkingDirectory= directive:**

- `deployment/gsmevil-patch.service` -- no `User=`, no `WorkingDirectory=` (defaults to root and `/`)
- `scripts/wifi-keepalive.service` -- `User=root`, no `WorkingDirectory=` (defaults to `/`)

Services without `WorkingDirectory=` default to `/`, which means relative path references in ExecStart scripts will resolve against the filesystem root. Combined with running as root, this is a privilege escalation risk if the ExecStart script path is writable by non-root users.

---

## 6. Actions / Changes

### Action A: Create `deployment/generate-services.sh`

This script reads environment variables and generates all service files from templates. It replaces hardcoded values at generation time, not runtime.

Required variables (read from `deployment/.env.services` or environment):

```
ARGOS_USER=kali
ARGOS_GROUP=kali
ARGOS_DIR=/home/kali/Documents/Argos/Argos
ARGOS_NODE_BIN=/usr/bin/npm
ARGOS_PYTHON_BIN=  # empty if not installed
ARGOS_CORAL_VENV=  # empty if no Coral TPU
```

The script:

1. Reads `deployment/.env.services` if present, or requires the above variables in environment.
2. For each `.service.template` file in `deployment/templates/`, performs `sed` substitution of `@@ARGOS_USER@@`, `@@ARGOS_GROUP@@`, `@@ARGOS_DIR@@`, etc.
3. Writes generated `.service` files to `deployment/generated/`.
4. Validates each generated file with `systemd-analyze verify` (if available) or at minimum checks that all `@@` tokens are resolved.
5. Prints a summary of generated files and a `sudo cp` command block the operator can run.

### Action B: Create template files in `deployment/templates/`

Convert each of the 11 service files (minus the duplicate) to templates. Example for `argos-dev.service.template`:

```ini
[Unit]
Description=Argos Development Server
After=network.target

[Service]
Type=simple
User=@@ARGOS_USER@@
Group=@@ARGOS_GROUP@@
WorkingDirectory=@@ARGOS_DIR@@
ExecStart=@@ARGOS_NODE_BIN@@ run dev
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=argos-dev
Environment="NODE_ENV=development"
Environment="PORT=5173"
Environment="NODE_OPTIONS=--max-old-space-size=1024"

[Install]
WantedBy=multi-user.target
```

**Template token contract** (must be identical across `argos-env.sh`, `paths.ts`, and `.service.template` files):

| Shell Variable (`argos-env.sh`) | TypeScript Env (`paths.ts`) | Template Token (`.service.template`) |
| ------------------------------- | --------------------------- | ------------------------------------ |
| `ARGOS_DIR`                     | `env.ARGOS_DIR`             | `@@ARGOS_DIR@@`                      |
| `ARGOS_USER`                    | N/A (server-only)           | `@@ARGOS_USER@@`                     |
| `ARGOS_GROUP`                   | N/A (server-only)           | `@@ARGOS_GROUP@@`                    |
| `ARGOS_HOME` / `HOME`           | `env.HOME`                  | N/A (derived from User=)             |

### Action C: Delete the duplicate `config/systemd/coral-worker.service`

Retain only `deployment/systemd/coral-worker.service` (converted to template). Add a note in `config/systemd/README.md` directing to the deployment directory.

---

## 7. Verification Commands

```bash
# 1. Verify generate-services.sh runs without error
cd /home/kali/Documents/Argos/Argos
ARGOS_USER=kali ARGOS_GROUP=kali ARGOS_DIR=/home/kali/Documents/Argos/Argos \
  bash deployment/generate-services.sh

# 2. Verify no @@tokens@@ remain in generated files
grep -r '@@' deployment/generated/
# Expected: no output

# 3. Verify duplicate is removed
test -f config/systemd/coral-worker.service && echo "FAIL: duplicate not removed" || echo "PASS"

# 4. Count generated service files (should be 10, excluding duplicate)
ls deployment/generated/*.service | wc -l
# Expected: 10
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                  | Command                                       | Expected           |
| --- | -------------------------------------- | --------------------------------------------- | ------------------ |
| 1   | No @@tokens in generated services      | `grep -r '@@' deployment/generated/`          | No output          |
| 21  | Duplicate coral-worker.service removed | `test -f config/systemd/coral-worker.service` | Exit 1 (not found) |

---

## 9. Traceability

| Finding                                    | Task                   | Status  |
| ------------------------------------------ | ---------------------- | ------- |
| 11 service files with wrong User/paths     | 6.3.1                  | PLANNED |
| Duplicate coral-worker.service             | 6.3.1 Action C         | PLANNED |
| User identity crisis (pi/ubuntu/root/kali) | 6.3.1 (via templating) | PLANNED |

### Risk Assessment

| Risk                                                 | Likelihood | Impact | Mitigation                                                                 |
| ---------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Service templates break on unforeseen path structure | Low        | Medium | Template generator validates all @@tokens resolved; dry-run before install |

---

## 10. Execution Order Notes

**This task is split into sub-steps to resolve a circular dependency with Task 6.3.3:**

1. **Step 6.3.1a**: Create `scripts/lib/argos-env.sh` with canonical path variable definitions (`ARGOS_DIR`, `ARGOS_USER`, `ARGOS_GROUP`, `ARGOS_HOME`). This is the "contract" that both `paths.ts` and service templates will follow. Includes auto-detection logic (walk up to find package.json).

2. **Step 6.3.1b** (after Task 6.3.3a completes): Create `deployment/templates/*.service.template` files referencing `@@ARGOS_*@@` tokens. Token names must match `argos-env.sh` variable names (e.g., `@@ARGOS_DIR@@` = `$ARGOS_DIR`).

3. **Step 6.3.1c**: Create `deployment/generate-services.sh` that sources `argos-env.sh` and performs `sed` substitution of `@@` tokens.

**Critical path**: 6.3.1a (argos-env.sh) -> 6.3.3a (paths.ts) -> 6.3.3b (update 17 files) -> 6.3.1b (templates) -> 6.3.2 (hardening) -> 6.3.5 (verification)

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation). The centralized path library (`argos-env.sh`) created here must be available for consolidated scripts to `source` from day one.

---

_End of Phase 6.3.01_
