# Phase 6.3.02: SystemD Security Hardening

**Document ID**: ARGOS-AUDIT-P6.3.02
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.2
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM-HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

Of the 11 service files:

- **3 run as root with zero sandboxing** (argos-droneid.service, gsmevil-patch.service, wifi-keepalive.service)
- **8 of 11 services have ZERO security hardening directives** (no ProtectSystem, no ProtectHome, no CapabilityBoundingSet)
- **0 services have ProtectSystem, ProtectHome, or CapabilityBoundingSet** in any form
- 0 have `MemoryMax` or `CPUQuota` resource limits
- argos-droneid.service binds to privileged port 80 as root with no `CapabilityBoundingSet`
- wifi-keepalive.service sets `StartLimitIntervalSec=0` and `StartLimitBurst=0`, which disables systemd's restart throttle entirely, enabling infinite restart storms that consume CPU and fill journal logs
- argos-dev.service and argos-final.service lack NODE_OPTIONS, allowing V8 to allocate up to ~1.5GB on a 64-bit system (8GB total RAM, multiple services competing)
- Only argos-final.service, argos-cpu-protector.service, argos-process-manager.service, and argos-wifi-resilience.service have `NoNewPrivileges=true`

This task adds comprehensive security hardening directives and resource limits to all service templates created in Task 6.3.01.

---

## 2. Prerequisites

- Task 6.3.01 (Service File Templating) must be complete. The template files in `deployment/templates/` must exist before hardening directives can be added.

---

## 3. Dependencies

- **Upstream**: Task 6.3.01 (templates must exist)
- **Downstream**: Task 6.3.05 (Config Path Verification) validates the hardened output

---

## 4. Rollback Strategy

```bash
git checkout HEAD -- deployment/ config/systemd/ scripts/*.service
```

Service files are not installed until manual `systemctl daemon-reload`. All changes are to template files only.

---

## 5. Current State / Inventory

### 5.1 BEFORE State: Current Security Directives per Service (verified 2026-02-08)

| Service               | User            | NoNewPrivileges | PrivateTmp | ProtectSystem | ProtectHome | CapabilityBoundingSet | MemoryMax | CPUQuota |
| --------------------- | --------------- | --------------- | ---------- | ------------- | ----------- | --------------------- | --------- | -------- |
| argos-dev             | pi              | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| argos-final           | pi              | YES             | YES        | NO            | NO          | NO                    | NO        | NO       |
| argos-cpu-protector   | pi              | YES             | YES        | NO            | NO          | NO                    | NO        | NO       |
| argos-process-manager | pi              | YES             | YES        | NO            | NO          | NO                    | NO        | NO       |
| argos-wifi-resilience | pi              | YES             | YES        | NO            | NO          | NO                    | NO        | NO       |
| argos-droneid         | **root**        | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| gsmevil-patch         | **(none=root)** | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| coral-worker          | ubuntu          | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| dev-server-keepalive  | pi              | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| simple-keepalive      | pi              | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |
| wifi-keepalive        | **root**        | NO              | NO         | NO            | NO          | NO                    | NO        | NO       |

**Verification command used:** `grep -E '(NoNewPrivileges|PrivateTmp|ProtectSystem|ProtectHome|CapabilityBoundingSet|MemoryMax|CPUQuota)' deployment/*.service deployment/systemd/*.service scripts/*.service`

### 5.2 AFTER State: All Templates Must Have (post-6.3.2)

| Service Template      | User           | NoNewPrivileges | PrivateTmp | ProtectSystem | ProtectHome | CapabilityBoundingSet            | MemoryMax | CPUQuota |
| --------------------- | -------------- | --------------- | ---------- | ------------- | ----------- | -------------------------------- | --------- | -------- |
| argos-dev             | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 1536M     | 150%     |
| argos-final           | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 1536M     | 150%     |
| argos-cpu-protector   | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 128M      | 25%      |
| argos-process-manager | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 128M      | 25%      |
| argos-wifi-resilience | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 128M      | 25%      |
| argos-droneid         | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | CAP_NET_BIND_SERVICE CAP_NET_RAW | 512M      | 50%      |
| gsmevil-patch         | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 64M       | 10%      |
| coral-worker          | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 512M      | 50%      |
| dev-server-keepalive  | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 1536M     | 150%     |
| simple-keepalive      | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | (empty -- no caps needed)        | 1536M     | 150%     |
| wifi-keepalive        | @@ARGOS_USER@@ | YES             | YES        | strict        | read-only   | CAP_NET_RAW                      | 128M      | 25%      |

---

## 6. Actions / Changes

### 6.1 Security Baseline for All Templates

Every service template MUST include this minimum security block:

```ini
# Security hardening (mandatory)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
```

For services requiring write access to `ARGOS_DIR`:

```ini
ReadWritePaths=@@ARGOS_DIR@@
```

### 6.2 Per-Service Resource Limits

| Service Template              | MemoryMax | CPUQuota | Notes                                      |
| ----------------------------- | --------- | -------- | ------------------------------------------ |
| argos-dev.service             | 1536M     | 150%     | Primary app; 4-core system allows 400% max |
| argos-final.service           | 1536M     | 150%     | Production equivalent of dev               |
| argos-cpu-protector.service   | 128M      | 25%      | Monitoring script, minimal resources       |
| argos-process-manager.service | 128M      | 25%      | Monitoring script, minimal resources       |
| argos-wifi-resilience.service | 128M      | 25%      | Network monitoring                         |
| argos-droneid.service         | 512M      | 50%      | Python + RF processing                     |
| gsmevil-patch.service         | 64M       | 10%      | One-shot script                            |
| coral-worker.service          | 512M      | 50%      | ML inference workload                      |
| dev-server-keepalive.service  | 1536M     | 150%     | Wraps the dev server                       |
| simple-keepalive.service      | 1536M     | 150%     | Wraps the dev server                       |
| wifi-keepalive.service        | 128M      | 25%      | Network monitoring                         |

### 6.3 Root-Running Service Remediation (per-service subtasks)

#### Subtask A: argos-droneid.service (CRITICAL -- runs as root to bind port 80)

Current: `User=root`, no security directives, binds port 80, hardcoded `/home/ubuntu` paths.

Fix:

1. Change `User=root` to `User=@@ARGOS_USER@@`
2. Add `AmbientCapabilities=CAP_NET_BIND_SERVICE` so non-root can bind port 80
3. Add `CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW` (restricts to only needed caps)
4. Add full security hardening block (see 6.1)
5. Add `ReadWritePaths=@@ARGOS_DIR@@` for log/pid file writes

Current state (lines 7-11 of `deployment/argos-droneid.service`):

```ini
User=root
WorkingDirectory=/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver
ExecStartPre=/bin/sleep 10
ExecStart=/home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver/venv/bin/python3 /home/ubuntu/projects/Argos/RemoteIDReceiver/Receiver/backend/dronesniffer/main.py -p 80
```

Problems:

1. Runs as `root` solely to bind port 80. Fix: use `AmbientCapabilities=CAP_NET_BIND_SERVICE` and run as `@@ARGOS_USER@@`.
2. Port 80 conflicts with common web servers. Recommendation: change to port 8080 or use a reverse proxy.
3. Logs to file (`append:/home/ubuntu/...`) instead of journal. Fix: use `StandardOutput=journal`.

Template replacement:

```ini
User=@@ARGOS_USER@@
Group=@@ARGOS_GROUP@@
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW
```

#### Subtask B: gsmevil-patch.service (CRITICAL -- implicit root, no User= directive)

Current: No `User=` directive (defaults to root), no `WorkingDirectory=`, no security directives. This is a one-shot script that patches GSM Evil configuration.

Fix:

1. Add `User=@@ARGOS_USER@@` and `Group=@@ARGOS_GROUP@@`
2. Add `WorkingDirectory=@@ARGOS_DIR@@`
3. Add full security hardening block (see 6.1)
4. The script requires write access to GSM Evil config: add `ReadWritePaths=/usr/src/gsmevil2`

#### Subtask C: wifi-keepalive.service (CRITICAL -- explicit root, no sandboxing)

Current: `User=root`, no `WorkingDirectory=`, `StartLimitIntervalSec=0` / `StartLimitBurst=0` (infinite restart).

Fix:

1. Change `User=root` to `User=@@ARGOS_USER@@`
2. Add `AmbientCapabilities=CAP_NET_RAW` (needed for WiFi interface management via `ip link`)
3. Add `CapabilityBoundingSet=CAP_NET_RAW`
4. Add `WorkingDirectory=@@ARGOS_DIR@@`
5. Add full security hardening block (see 6.1)
6. Fix restart storm: `StartLimitIntervalSec=300`, `StartLimitBurst=5`

### 6.4 wifi-keepalive.service Restart Storm Fix

Current state (lines 16-17 of `scripts/wifi-keepalive.service`):

```ini
StartLimitIntervalSec=0
StartLimitBurst=0
```

This combination tells systemd to never throttle restarts. If the script crashes immediately on startup (e.g., missing binary, permission error), systemd will restart it infinitely with only a 10-second gap, generating thousands of journal entries per hour.

Fix: Set sane limits in the template:

```ini
StartLimitIntervalSec=300
StartLimitBurst=5
```

This allows 5 restarts within a 5-minute window before systemd marks the unit as failed and stops attempting. An operator must then run `systemctl reset-failed wifi-keepalive.service && systemctl start wifi-keepalive.service` to recover.

### 6.5 NODE_OPTIONS Addition

Add to templates for argos-dev, argos-final, dev-server-keepalive, and simple-keepalive:

```ini
Environment="NODE_OPTIONS=--max-old-space-size=1024"
```

The dev-server-keepalive and simple-keepalive templates already have this line. The argos-dev and argos-final templates currently lack it. Without this, Node.js on a 64-bit system defaults to ~1.5GB heap, which combined with other services risks triggering OOM on the 8GB RPi 5.

---

## 7. Verification Commands

```bash
# 1. Verify all templates have NoNewPrivileges
grep -L 'NoNewPrivileges=true' deployment/templates/*.service.template
# Expected: no output (all files contain it)

# 2. Verify all templates have MemoryMax
grep -L 'MemoryMax=' deployment/templates/*.service.template
# Expected: no output

# 3. Verify all templates have ProtectSystem=strict
grep -cL 'ProtectSystem=strict' deployment/templates/*.service.template
# Expected: no output

# 4. Verify all templates have ProtectHome=read-only
grep -cL 'ProtectHome=read-only' deployment/templates/*.service.template
# Expected: no output

# 5. Verify argos-droneid template does NOT run as root
grep 'User=root' deployment/templates/argos-droneid.service.template
# Expected: no output

# 6. Verify wifi-keepalive template has sane restart limits
grep 'StartLimitIntervalSec=0' deployment/templates/wifi-keepalive.service.template
# Expected: no output

# 7. Verify NODE_OPTIONS present in Node.js service templates
for f in argos-dev argos-final dev-server-keepalive simple-keepalive; do
  grep -q 'NODE_OPTIONS' "deployment/templates/${f}.service.template" || echo "MISSING: $f"
done
# Expected: no output (all contain it)
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                    | Command                                                                                 | Expected  |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| 2   | All templates have NoNewPrivileges       | `grep -cL 'NoNewPrivileges' deployment/templates/*.template`                            | No output |
| 3   | All templates have MemoryMax             | `grep -cL 'MemoryMax' deployment/templates/*.template`                                  | No output |
| 4   | No root User in non-network services     | `grep 'User=root' deployment/templates/*.template`                                      | No output |
| 10  | NODE_OPTIONS in all Node.js templates    | See Task 6.3.2 verification                                                             | 4 files   |
| 22  | wifi-keepalive has sane restart limits   | `grep 'StartLimitIntervalSec=300' deployment/templates/wifi-keepalive.service.template` | Found     |
| 27  | All templates have ProtectSystem=strict  | `grep -cL 'ProtectSystem=strict' deployment/templates/*.template`                       | No output |
| 28  | All templates have ProtectHome=read-only | `grep -cL 'ProtectHome=read-only' deployment/templates/*.template`                      | No output |

---

## 9. Traceability

| Finding                                               | Task                                                        | Status  |
| ----------------------------------------------------- | ----------------------------------------------------------- | ------- |
| No MemoryMax/CPUQuota on any service                  | 6.3.2                                                       | PLANNED |
| argos-droneid runs as root on port 80                 | 6.3.2 Subtask A                                             | PLANNED |
| argos-droneid has no security hardening               | 6.3.2                                                       | PLANNED |
| wifi-keepalive infinite restart storm                 | 6.3.2 Subtask C                                             | PLANNED |
| argos-dev/final missing NODE_OPTIONS                  | 6.3.2                                                       | PLANNED |
| 8 of 11 services have ZERO security hardening         | 6.3.2 (BEFORE/AFTER table + per-service subtasks)           | PLANNED |
| 3 services run as root with no sandboxing             | 6.3.2 (Subtasks A, B, C for droneid/gsmevil/wifi-keepalive) | PLANNED |
| 0 services have ProtectSystem/ProtectHome/CapBoundSet | 6.3.2 (mandatory security block for all templates)          | PLANNED |

### Risk Assessment

| Risk                                                 | Likelihood | Impact | Mitigation                                                                 |
| ---------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Service templates break on unforeseen path structure | Low        | Medium | Template generator validates all @@tokens resolved; dry-run before install |

---

## 10. Execution Order Notes

This task depends on Task 6.3.01 (templates must exist before hardening directives are added).

Position in critical path: 6.3.1a (argos-env.sh) -> 6.3.3a (paths.ts) -> 6.3.1b (templates) -> **6.3.2 (this task)** -> 6.3.5 (verification)

This task can run in parallel with Tasks 6.3.3b, 6.3.4, 6.3.6, and 6.3.6b (they do not share files).

---

_End of Phase 6.3.02_
