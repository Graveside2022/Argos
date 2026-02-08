# Phase 6.4.08: Idempotency Fixes

**Document ID**: ARGOS-AUDIT-P6.4.08
**Parent Document**: Phase-6.4-SHELL-SCRIPT-STANDARDIZATION-AND-QUALITY.md
**Original Task ID**: 6.4.8
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM (behavioral change -- modifies system configuration patterns; incorrect idempotency can corrupt system config files)
**Review Standard**: CERT Secure Coding (SH), MISRA (adapted), NASA/JPL Rule Set (adapted)
**Target Corpus**: ~75-80 active scripts surviving Phase 6.2 consolidation

---

## 1. Objective

Ensure all setup, installation, and configuration scripts are idempotent: running them N times MUST produce the same system state as running them once. This is a fundamental requirement for reliable deployment automation (Ansible, Terraform, and manual re-runs after partial failure all depend on idempotency).

**Current violations:**

1. **Config file append duplication:** `cat >> /etc/sysctl.conf` appends duplicate entries on every run.
2. **vm.swappiness conflict:** Three scripts set `vm.swappiness=10`, but the production system requires `vm.swappiness=60` for zram.
3. **Package install without check:** `apt-get install` without `dpkg -s` pre-check wastes time on re-runs.
4. **Service file overwrite without diff:** `cp` service files unconditionally triggers `daemon-reload`.

**Specific known violations (from parent document baseline):**

| File                                         | Target                             | Pattern                                |
| -------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `scripts/setup-host-complete.sh:312`         | `/etc/sysctl.conf`                 | `cat >>` (duplicate entries on re-run) |
| `scripts/setup-host-complete.sh:331`         | `/etc/security/limits.conf`        | `cat >>` (duplicate entries on re-run) |
| `scripts/install-system-dependencies.sh:289` | `/etc/security/limits.conf`        | `cat >>` (duplicate entries on re-run) |
| `scripts/install-system-dependencies.sh:302` | `/etc/sysctl.conf`                 | `cat >>` (duplicate entries on re-run) |
| `scripts/setup-swap.sh:116`                  | `/etc/sysctl.d/99-swappiness.conf` | `echo >` (overwrite, safe)             |

**vm.swappiness conflict:**

- `scripts/setup-host-complete.sh:324` sets `vm.swappiness = 10`
- `scripts/install-system-dependencies.sh:307` sets `vm.swappiness = 10`
- `scripts/setup-swap.sh:116` sets `vm.swappiness=10`
- Live system runs `vm.swappiness=60` (correct for zram configuration)
- Three scripts disagree with production configuration.

---

## 2. Prerequisites

| ID    | Prerequisite                                      | Verification Command                                                                 |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| PRE-1 | Phase 6.2 (consolidation) is complete             | `test -f plans/codebase-audit-2026-02-07/Final_Phases/Phase_6/Phase-6.2-COMPLETE.md` |
| PRE-2 | All dead scripts removed per Phase 6.2            | `find scripts/ -name "*.sh" -type f \| wc -l` returns 75-80                          |
| PRE-3 | No scripts reference deleted scripts              | `grep -rl "source.*deleted_script" scripts/ --include="*.sh" \| wc -l` returns 0     |
| PRE-4 | shellcheck 0.10.0+ installed                      | `shellcheck --version \| grep -q "version: 0.1"`                                     |
| PRE-5 | Git working tree clean                            | `git diff --quiet HEAD -- scripts/`                                                  |
| PRE-6 | Phase 6.3 (hardcoded paths) complete or in-flight | Document references Phase 6.3 for 62 hardcoded-path scripts                          |

**Execution environment:** Kali Linux 2025.4, aarch64 (RPi 5), kernel 6.12.34+rpt-rpi-2712.

### Task-Specific Prerequisites

- **Task 6.4.11 (Shared Library Creation) MUST be complete.** The `write_sysctl_conf`, `write_limits_conf`, `install_if_missing`, and `run_cmd` functions from `common.sh` must be available.
- **Task 6.4.7 (Help and DryRun Support) can execute in parallel.** These tasks have independent scopes.

---

## 3. Dependencies

| Dependency | Direction  | Task   | Reason                                                                 |
| ---------- | ---------- | ------ | ---------------------------------------------------------------------- |
| AFTER      | Upstream   | 6.4.11 | `write_sysctl_conf`, `write_limits_conf`, `run_cmd` must be available  |
| PARALLEL   | Peer       | 6.4.7  | Independent scopes; can execute in parallel                            |
| BEFORE     | Downstream | 6.4.9  | Logging standardization depends on idempotency patterns being in place |

---

## 4. Rollback Strategy

### Per-Task Commit

This task MUST be committed as a separate, atomic Git commit:

```
refactor(scripts): Phase 6.4.8 - idempotency fixes
```

This enables targeted rollback via `git revert <commit-sha>` without affecting other tasks.

### Rollback Decision Criteria

Immediate rollback if:

- System configuration files become corrupted after script execution
- `sysctl --system` fails after applying drop-in config
- Any service fails to start after idempotency changes

> **CAUTION:** This task modifies how system configuration files are written. Test on a non-production system first or use `--dry-run` (Task 6.4.7).

---

## 5. Baseline Metrics

| Metric                                          | Count |
| ----------------------------------------------- | ----- |
| `cat >>` to system config files                 | 4     |
| Scripts setting vm.swappiness=10 (should be 60) | 3     |
| `apt-get install` without `dpkg -s` guard       | TBD   |
| `cp` service files without `diff` check         | TBD   |

---

## 6. Task Details

### 6.1: Config File Append Pattern Fix

**Before (non-idempotent):**

```bash
cat >> /etc/sysctl.conf <<'EOF'
vm.swappiness = 10
vm.min_free_kbytes = 65536
vm.dirty_ratio = 10
EOF
```

**After (idempotent):**

```bash
# Idempotent sysctl configuration using drop-in directory
# /etc/sysctl.d/ is the correct location; /etc/sysctl.conf should not be appended to
SYSCTL_CONF="/etc/sysctl.d/90-argos.conf"

# Write complete file (not append) -- inherently idempotent
cat > "${SYSCTL_CONF}" <<'EOF'
# Argos platform kernel tuning
# Managed by: scripts/setup-host-complete.sh
# Do not edit manually; re-run the script to update.
vm.swappiness = 60
vm.min_free_kbytes = 65536
vm.dirty_ratio = 10
EOF

sysctl --system >/dev/null 2>&1
log_info "Applied sysctl configuration from ${SYSCTL_CONF}"
```

**Key change:** Use `>` (overwrite) into a drop-in file under `/etc/sysctl.d/`, never `>>` (append) into `/etc/sysctl.conf`.

### 6.2: limits.conf Idempotency

**Before (non-idempotent):**

```bash
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
EOF
```

**After (idempotent):**

```bash
LIMITS_CONF="/etc/security/limits.d/90-argos.conf"
cat > "${LIMITS_CONF}" <<'EOF'
# Argos platform file descriptor limits
# Managed by: scripts/setup-host-complete.sh
* soft nofile 65535
* hard nofile 65535
EOF
log_info "Applied limits configuration to ${LIMITS_CONF}"
```

### 6.3: vm.swappiness Conflict Resolution

All three scripts MUST be updated to use `vm.swappiness=60` to match the production zram configuration. The value `10` is appropriate for systems with spinning disk swap; the Argos platform uses zram (compressed memory swap) where higher swappiness is correct.

**Files requiring update:**

- `scripts/setup-host-complete.sh:324` -- change `vm.swappiness = 10` to `vm.swappiness = 60`
- `scripts/install-system-dependencies.sh:307` -- change `vm.swappiness = 10` to `vm.swappiness = 60`
- `scripts/setup-swap.sh:116` -- change `vm.swappiness=10` to `vm.swappiness=60`

**Exact remediation commands:**

```bash
# Fix all three scripts in a single pass
sed -i 's/vm\.swappiness.*=.*10/vm.swappiness = 60/' \
    scripts/setup-host-complete.sh \
    scripts/install-system-dependencies.sh

# setup-swap.sh uses no-space format
sed -i 's/vm\.swappiness=10/vm.swappiness=60/' \
    scripts/setup-swap.sh

# Verification: all three files now reference 60
grep -n "vm.swappiness" \
    scripts/setup-host-complete.sh \
    scripts/install-system-dependencies.sh \
    scripts/setup-swap.sh
# Expected: all lines show =60 or = 60
```

**Rationale:** `vm.swappiness=60` is correct for zram (compressed memory swap). The value `10` is only appropriate for spinning disk swap partitions where the cost of page-out is high. With zram, swap I/O is CPU-bound compression into RAM, so a higher swappiness allows the kernel to reclaim anonymous pages more aggressively, which is desirable on the 8GB RPi 5 running multiple containers.

### 6.4: Package Installation Idempotency

**Before:**

```bash
apt-get install -y package1 package2 package3
```

**After:**

```bash
install_if_missing() {
    local pkg
    for pkg in "$@"; do
        if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
            log_info "Installing ${pkg}..."
            run_cmd apt-get install -y "${pkg}"
        else
            log_info "Package ${pkg} already installed, skipping."
        fi
    done
}

install_if_missing package1 package2 package3
```

### 6.5: Service File Installation Idempotency

**Before:**

```bash
cp argos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable argos
```

**After:**

```bash
if ! diff -q argos.service /etc/systemd/system/argos.service >/dev/null 2>&1; then
    run_cmd cp argos.service /etc/systemd/system/
    run_cmd systemctl daemon-reload
    log_info "Service file updated and daemon reloaded."
else
    log_info "Service file unchanged, skipping."
fi
run_cmd systemctl enable argos 2>/dev/null || true  # enable is already idempotent
```

### Detection

```bash
# Find all append-to-system-config patterns
grep -rn "cat >>" scripts/ --include="*.sh" | grep -i "sysctl\|limits\|fstab\|crontab\|conf"

# Find all vm.swappiness settings
grep -rn "vm.swappiness" scripts/ --include="*.sh"

# Find non-idempotent apt-get patterns (no dpkg -s guard)
grep -rn "apt-get install\|apt install" scripts/ --include="*.sh" | head -20
```

---

## 7. Verification Commands

```bash
# No cat >> to system config files
grep -rn "cat >>" scripts/ --include="*.sh" | \
  grep -i "sysctl\|limits\|fstab\|crontab" | wc -l
# Expected: 0

# All vm.swappiness values are 60
grep -rn "vm.swappiness" scripts/ --include="*.sh" | grep -v "=.*60\|= *60" | wc -l
# Expected: 0

# Verify sysctl uses drop-in directory
grep -rn "sysctl\.conf" scripts/ --include="*.sh" | grep ">>" | wc -l
# Expected: 0

# Verify limits uses drop-in directory
grep -rn "limits\.conf" scripts/ --include="*.sh" | grep ">>" | wc -l
# Expected: 0

# Idempotency smoke test: run setup script twice, diff system state
# (Manual verification step -- document results in completion report)

# Syntax check
find scripts/ -name "*.sh" -type f -exec bash -n {} \;
# Expected: exit 0
```

---

## 8. Acceptance Criteria

- [ ] Zero instances of `cat >>` or `echo >>` targeting system configuration files
- [ ] All sysctl settings use `/etc/sysctl.d/90-argos.conf` (drop-in, overwrite mode)
- [ ] All limits settings use `/etc/security/limits.d/90-argos.conf` (drop-in, overwrite mode)
- [ ] All vm.swappiness references use value 60 (zram-appropriate)
- [ ] Package installation scripts check `dpkg -s` before calling `apt-get install`
- [ ] Service file installation checks `diff` before copying and reloading
- [ ] Running any setup script twice produces identical system state to running it once

---

## 9. Traceability

| Task  | Deficiency                              | Standard                        | Files Affected          | Verification Command                                 |
| ----- | --------------------------------------- | ------------------------------- | ----------------------- | ---------------------------------------------------- |
| 6.4.8 | 4 non-idempotent config append patterns | Ansible/Terraform best practice | 3 setup/install scripts | `grep -rn "cat >>" scripts/ \| grep sysctl \| wc -l` |

---

## 10. Execution Order Notes

**Position in critical path:** 9th (parallel with 6.4.7, after 6.4.5)

```
... --> 6.4.5 (quoting/validation) --> 6.4.13 (security) --> 6.4.7 (help/dry-run) \
                                                              6.4.8 (idempotency)  / --> 6.4.9 (logging) --> ...
```

According to the parent document Appendix A, Tasks 6.4.7 and 6.4.8 can execute in parallel because they have independent scopes. Task 6.4.7 adds argument parsing; Task 6.4.8 fixes idempotency patterns. Neither modifies the other's work.

This task modifies the internal logic of setup/installation scripts, which carries MEDIUM risk. The vm.swappiness fix is particularly important because the current scripts set a value (10) that conflicts with the production zram configuration (60). Running any of the three scripts currently would degrade system performance by reducing zram swap utilization.

---

```
END OF TASK DOCUMENT
Task:     6.4.8 - Idempotency Fixes
Status:   FINAL
Version:  1.0
Date:     2026-02-08
```
