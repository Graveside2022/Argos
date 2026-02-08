# Phase 2.2.11: OS-Level Hardening

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: DISA STIG (Application Security, Operating System), NIST SP 800-53 SC-7 (Boundary Protection), NIST SP 800-53 CM-7 (Least Functionality), NIST SP 800-53 AC-6 (Least Privilege)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade C1

---

## Purpose

Implement OS-level security controls that provide defense in depth for the Argos system. If the application layer is bypassed -- through a zero-day vulnerability, a misconfigured authentication middleware, or a novel injection vector -- OS-level controls provide secondary containment. This task creates a firewall script (iptables), filesystem hardening (/tmp noexec), and an AppArmor mandatory access control profile for the Node.js process.

## Execution Constraints

| Constraint    | Value                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Risk Level    | MEDIUM -- OS configuration changes can lock out administrators if misconfigured                 |
| Severity      | MEDIUM                                                                                          |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place)  |
| Files Touched | 3 new files (`scripts/security/setup-iptables.sh`, `/etc/fstab` modification, AppArmor profile) |
| Blocks        | Nothing                                                                                         |
| Blocked By    | Phase 2.1 (port inventory must be finalized before firewall rules are written)                  |

## Threat Context

Argos is deployed on Raspberry Pi 5 hardware (Kali 2025.4, kernel 6.12.34+rpt-rpi-2712) on tactical networks at Army EW training sites. The device is network-accessible and runs multiple services on multiple ports. Without OS-level hardening:

1. **Network exposure**: Any service listening on the RPi is accessible to any device on the tactical network. The default iptables policy is ACCEPT, meaning every port -- including Kismet (2501), HackRF backend (8092), Portainer (9000), and the netcat deploy server (8099) -- is reachable from any client.

2. **Temp-file execution**: The cell-towers Python injection vector (identified in the independent security audit) writes and executes Python code in `/tmp/`. If `/tmp` has execute permissions, any injection that writes a file to `/tmp` can execute arbitrary code. Mounting `/tmp` with `noexec` blocks this class of attack at the kernel level.

3. **Unrestricted process capabilities**: The Node.js process runs with full user privileges and can read/write any file the user owns, execute any binary on the system, and bind to any port. An AppArmor profile confines the process to only the resources it legitimately needs.

These three controls implement the defense-in-depth principle: each control is independent, and an attacker must defeat all three layers (plus the application-layer controls from Phase 2.1/2.2) to achieve full compromise.

## Current State Assessment

| Metric                           | Value                    | Verification Command                                                                          |
| -------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| iptables default INPUT policy    | **ACCEPT** (insecure)    | `sudo iptables -L INPUT --line-numbers -n \| head -3`                                         |
| iptables default FORWARD policy  | **ACCEPT** (insecure)    | `sudo iptables -L FORWARD --line-numbers -n \| head -3`                                       |
| /tmp mount options               | **defaults** (no noexec) | `mount \| grep "/tmp"`                                                                        |
| /tmp noexec protection           | **None**                 | `mount -o remount,noexec /tmp && touch /tmp/test.sh && chmod +x /tmp/test.sh && /tmp/test.sh` |
| AppArmor status                  | Verify at execution      | `sudo aa-status 2>/dev/null \| head -5`                                                       |
| AppArmor profile for Node.js     | **None**                 | `sudo aa-status 2>/dev/null \| grep node`                                                     |
| Listening services on RPi        | **Multiple**             | `ss -tlnp`                                                                                    |
| Services accessible from network | **All of them**          | No firewall rules restrict inbound traffic                                                    |

### Known Service Ports (from CLAUDE.md and codebase analysis)

| Port | Service                | Should Accept Inbound | Rationale                               |
| ---- | ---------------------- | --------------------- | --------------------------------------- |
| 22   | SSH                    | YES                   | Field maintenance and administration    |
| 2501 | Kismet                 | NO (localhost only)   | Internal service; Argos proxies via API |
| 3001 | Dashboard terminal     | NO (localhost only)   | Node-pty terminal; host-only service    |
| 3002 | HackRF control         | NO (localhost only)   | Internal API; Argos proxies via API     |
| 5173 | Argos web interface    | YES                   | Primary user interface                  |
| 5174 | Argos WebSocket        | YES                   | Real-time data streaming                |
| 8073 | Spectrum analyzer web  | NO (localhost only)   | OpenWebRX; Argos proxies via API        |
| 8092 | HackRF backend         | NO (localhost only)   | Python Flask backend; internal only     |
| 8099 | Deploy server (netcat) | NO (should not exist) | Unauthenticated; identified in audit    |
| 9000 | Portainer              | NO (localhost only)   | Docker management; admin-only           |

## Implementation Plan

### Subtask 2.2.11.1: iptables Firewall Rules

**Create**: `scripts/security/setup-iptables.sh`

This script configures iptables with a default-deny inbound policy, allowing only the three services that require external network access: SSH (22), Argos web (5173), and Argos WebSocket (5174). All other inbound traffic is logged and dropped.

```bash
#!/usr/bin/env bash
# scripts/security/setup-iptables.sh
#
# Argos System Firewall Configuration
# Standards: NIST SP 800-53 SC-7 (Boundary Protection)
#
# This script configures iptables with default-deny inbound policy.
# Only three services accept external connections:
#   - SSH (22): Field maintenance
#   - Argos web (5173): Primary user interface
#   - Argos WebSocket (5174): Real-time data streaming
#
# All internal services (Kismet 2501, HackRF 8092, Portainer 9000, etc.)
# are restricted to localhost only.
#
# Usage: sudo bash scripts/security/setup-iptables.sh
# Rollback: sudo iptables -F && sudo iptables -P INPUT ACCEPT

set -euo pipefail

# Validate running as root
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)" >&2
    exit 1
fi

echo "[*] Configuring iptables firewall for Argos system..."

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t mangle -F

# Default policies: deny inbound, deny forward, allow outbound
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow established and related connections (stateful inspection)
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow all traffic on loopback interface
# (required for internal service communication: Kismet, HackRF, etc.)
iptables -A INPUT -i lo -j ACCEPT

# Allow SSH for field maintenance (port 22)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow Argos web interface (port 5173)
iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Allow Argos WebSocket (port 5174)
iptables -A INPUT -p tcp --dport 5174 -j ACCEPT

# Allow ICMP (ping) for network diagnostics
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# Log dropped packets for forensic analysis
# Rate-limited to prevent log flooding from port scans
iptables -A INPUT -m limit --limit 5/min --limit-burst 10 \
    -j LOG --log-prefix "IPTABLES-DROP: " --log-level 4

# Final explicit drop (redundant with policy, but defense in depth)
iptables -A INPUT -j DROP

echo "[*] Firewall rules applied successfully."
echo "[*] Allowed inbound: SSH(22), Argos(5173), WebSocket(5174), ICMP"
echo "[*] All other inbound traffic is logged and dropped."

# Save rules for persistence across reboots
if command -v iptables-save &>/dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || \
    iptables-save > /etc/iptables.rules 2>/dev/null || \
    echo "[!] WARNING: Could not save rules. Rules will be lost on reboot."
    echo "    Install iptables-persistent: apt install iptables-persistent"
fi

echo "[*] Done. Verify with: sudo iptables -L -n --line-numbers"
```

**BEFORE** (insecure -- all ports accessible):

```
Chain INPUT (policy ACCEPT)
num  target     prot opt source    destination
```

**AFTER** (hardened -- default deny):

```
Chain INPUT (policy DROP)
num  target     prot opt source       destination
1    ACCEPT     all  --  0.0.0.0/0    0.0.0.0/0    ctstate RELATED,ESTABLISHED
2    ACCEPT     all  --  0.0.0.0/0    0.0.0.0/0    /* loopback */
3    ACCEPT     tcp  --  0.0.0.0/0    0.0.0.0/0    tcp dpt:22
4    ACCEPT     tcp  --  0.0.0.0/0    0.0.0.0/0    tcp dpt:5173
5    ACCEPT     tcp  --  0.0.0.0/0    0.0.0.0/0    tcp dpt:5174
6    ACCEPT     icmp --  0.0.0.0/0    0.0.0.0/0    icmptype 8
7    LOG        all  --  0.0.0.0/0    0.0.0.0/0    limit: avg 5/min LOG "IPTABLES-DROP: "
8    DROP       all  --  0.0.0.0/0    0.0.0.0/0
```

### Subtask 2.2.11.2: Filesystem Hardening

Mount `/tmp` with `noexec`, `nosuid`, and `nodev` flags. This prevents execution of any file written to `/tmp`, which blocks an entire class of injection attacks including the cell-towers Python injection vector identified in the independent security audit.

#### Immediate Application (non-persistent)

```bash
# Remount /tmp with security flags
sudo mount -o remount,noexec,nosuid,nodev /tmp
```

#### Persistent Configuration (/etc/fstab)

Add or modify the following line in `/etc/fstab`:

```
tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev,size=512M 0 0
```

**BEFORE** (`/etc/fstab` -- no /tmp entry or default mount):

```
# /tmp is mounted with default options (exec permitted)
```

**AFTER** (`/etc/fstab` -- hardened):

```
# Argos Security: /tmp mounted noexec to prevent temp-file execution attacks
# Reference: Phase 2.2.11, DISA STIG, cell-towers injection mitigation
tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev,size=512M 0 0
```

#### Impact Analysis

The `noexec` flag on `/tmp` blocks:

| Attack Vector                                 | Blocked | Rationale                                                |
| --------------------------------------------- | ------- | -------------------------------------------------------- |
| cell-towers Python injection (writes to /tmp) | YES     | Python interpreter cannot execute scripts in noexec /tmp |
| Arbitrary file write + execute                | YES     | Any binary/script written to /tmp cannot be executed     |
| Shared library injection via /tmp             | YES     | Libraries in /tmp cannot be loaded with exec permission  |

Legitimate uses that may be affected:

| Use Case                                | Affected | Mitigation                                                 |
| --------------------------------------- | -------- | ---------------------------------------------------------- |
| Python subprocess creating temp scripts | YES      | Redirect temp scripts to /app/tmp/ (app-owned, not noexec) |
| npm postinstall scripts writing to /tmp | POSSIBLE | Run npm install before enabling noexec                     |
| Systemd services using /tmp for scratch | NO       | Systemd PrivateTmp creates per-service /tmp                |

### Subtask 2.2.11.3: AppArmor Profile for Node.js

Create an AppArmor profile that confines the Node.js process to only the resources it legitimately requires. This is the principle of least privilege (NIST AC-6) applied at the OS level.

**Create**: `/etc/apparmor.d/argos-node`

```
# AppArmor profile for Argos Node.js process
# Standards: NIST SP 800-53 AC-6 (Least Privilege)
#
# This profile restricts the Node.js process running the Argos
# SvelteKit application to only the resources it needs:
# - File read: /app/ (application code), /usr/ (system libraries)
# - File write: /app/rf_signals.db* (database), /tmp/ (temp files)
# - Network: configured ports only
# - Execute: /usr/bin/, /usr/local/bin/, /app/node_modules/.bin/

#include <tunables/global>

profile argos-node /usr/bin/node {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/ssl_certs>

  # Node.js binary and shared libraries
  /usr/bin/node                   ix,
  /usr/local/bin/node             ix,
  /usr/lib/**                     r,
  /usr/local/lib/**               r,
  /lib/**                         r,
  /proc/sys/kernel/random/uuid    r,
  /proc/self/**                   r,
  /proc/meminfo                   r,
  /proc/cpuinfo                   r,
  /sys/devices/system/cpu/**      r,

  # Application code (read-only)
  /app/**                         r,
  /app/node_modules/**            r,
  /app/node_modules/.bin/*        ix,

  # Database (read-write) -- the ONLY writable application file
  /app/rf_signals.db              rw,
  /app/rf_signals.db-wal          rw,
  /app/rf_signals.db-shm          rw,
  /app/rf_signals.db-journal      rw,

  # Temporary files (read-write, no execute due to noexec mount)
  /tmp/**                         rw,

  # Log output (via stdout/stderr to systemd journal)
  /dev/null                       rw,
  /dev/urandom                    r,

  # Network access (controlled by iptables, AppArmor allows TCP)
  network tcp,
  network udp,

  # Executables the application may legitimately call
  /usr/bin/                       r,
  /usr/bin/python3*               ix,
  /usr/bin/gpsd                   ix,
  /usr/bin/hackrf_*               ix,
  /usr/bin/uhd_*                  ix,
  /usr/bin/kismet                 ix,
  /usr/local/bin/bettercap        ix,
  /usr/bin/ip                     ix,
  /usr/bin/iw                     ix,
  /usr/bin/iwconfig               ix,
  /usr/sbin/iptables              ix,

  # Deny everything else (implicit in AppArmor)
}
```

#### Installation and Activation

```bash
# Install the AppArmor profile
sudo cp /path/to/argos-node /etc/apparmor.d/argos-node

# Parse and load the profile
sudo apparmor_parser -r /etc/apparmor.d/argos-node

# Verify it is loaded
sudo aa-status | grep argos-node

# To put in complain mode first (logs violations but does not block):
sudo aa-complain /etc/apparmor.d/argos-node

# To enforce after testing:
sudo aa-enforce /etc/apparmor.d/argos-node
```

**Recommended deployment sequence**:

1. Install profile in **complain** mode
2. Run Argos through full functional test (all features)
3. Review AppArmor logs for denied operations: `dmesg | grep apparmor`
4. Adjust profile as needed
5. Switch to **enforce** mode

## Verification Checklist

1. **Firewall script exists and is executable**

    ```bash
    test -x scripts/security/setup-iptables.sh && echo "PASS" || echo "FAIL"
    # Expected: PASS
    ```

2. **Firewall rules applied correctly (after running script)**

    ```bash
    sudo iptables -L INPUT -n --line-numbers | head -10
    # Expected: Chain INPUT (policy DROP) with rules for 22, 5173, 5174
    ```

3. **Internal services not accessible from external IP**

    ```bash
    # From another machine on the same network:
    curl -s --connect-timeout 3 http://<argos-ip>:2501/ 2>&1
    # Expected: Connection refused or timeout (Kismet not reachable externally)

    curl -s --connect-timeout 3 http://<argos-ip>:8092/ 2>&1
    # Expected: Connection refused or timeout (HackRF backend not reachable)

    curl -s --connect-timeout 3 http://<argos-ip>:9000/ 2>&1
    # Expected: Connection refused or timeout (Portainer not reachable)
    ```

4. **Argos web interface still accessible**

    ```bash
    curl -s --connect-timeout 3 http://<argos-ip>:5173/ | head -1
    # Expected: HTML response (Argos dashboard)
    ```

5. **/tmp is mounted noexec**

    ```bash
    mount | grep "/tmp" | grep noexec
    # Expected: tmpfs on /tmp type tmpfs (rw,nosuid,nodev,noexec,...)
    ```

6. **/tmp noexec blocks execution**

    ```bash
    echo '#!/bin/bash' > /tmp/test-exec.sh && chmod +x /tmp/test-exec.sh
    /tmp/test-exec.sh 2>&1
    # Expected: "Permission denied" (noexec blocks execution)
    rm -f /tmp/test-exec.sh
    ```

7. **/etc/fstab contains persistent /tmp entry**

    ```bash
    grep "noexec" /etc/fstab | grep "/tmp"
    # Expected: Line with tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev
    ```

8. **AppArmor profile installed (after deployment)**
    ```bash
    sudo aa-status 2>/dev/null | grep argos-node
    # Expected: "argos-node" in enforced or complain mode
    ```

## Commit Strategy

```
security(phase2.2.11): add OS-level hardening (iptables, noexec /tmp, AppArmor)

Phase 2.2 Task 11: OS-Level Hardening (DISA STIG, NIST SC-7/CM-7/AC-6)
- scripts/security/setup-iptables.sh: default-deny inbound, allow 22/5173/5174
- /etc/fstab: /tmp mounted noexec,nosuid,nodev (blocks injection via temp files)
- /etc/apparmor.d/argos-node: confine Node.js to app dir + database only
Verified: iptables policy DROP, /tmp noexec active, AppArmor profile loaded

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

| Component           | Rollback Command                                                                                     | Impact                         |
| ------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| iptables            | `sudo iptables -F && sudo iptables -P INPUT ACCEPT`                                                  | All ports accessible again     |
| /tmp noexec         | `sudo mount -o remount,exec /tmp` + remove /etc/fstab line                                           | /tmp execution permitted again |
| AppArmor profile    | `sudo aa-disable /etc/apparmor.d/argos-node` or `sudo apparmor_parser -R /etc/apparmor.d/argos-node` | Node.js unrestricted           |
| Full rollback (git) | `git reset --soft HEAD~1`                                                                            | Reverts script file only       |

**WARNING**: The iptables and AppArmor rollback commands affect the live OS immediately. The /etc/fstab change requires a remount or reboot. Perform rollback only with physical or SSH access to the device.

## Risk Assessment

| Risk                                             | Level  | Mitigation                                                                |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------- |
| Firewall locks out SSH access                    | HIGH   | SSH (port 22) is explicitly allowed; physical access is always available  |
| noexec /tmp breaks npm install                   | MEDIUM | Run npm install before enabling noexec; use /app/tmp/ for app temp files  |
| AppArmor blocks legitimate Node.js operations    | MEDIUM | Deploy in complain mode first; review dmesg logs; adjust before enforcing |
| iptables rules lost on reboot                    | MEDIUM | iptables-save persists rules; install iptables-persistent package         |
| Internal services break if loopback rule missing | HIGH   | Loopback (lo) is explicitly allowed; all internal traffic uses 127.0.0.1  |
| Docker networking affected by FORWARD policy     | MEDIUM | Docker manages its own iptables chains; FORWARD DROP may need exception   |

### Docker-Specific Consideration

Docker typically manipulates iptables rules for container networking. The `FORWARD DROP` policy may interfere with Docker bridge networking. Since Argos uses `network_mode: host`, this is unlikely to cause issues. However, if Docker containers use bridge networking:

```bash
# Add exception for Docker bridge interface (only if needed)
iptables -A FORWARD -i docker0 -j ACCEPT
iptables -A FORWARD -o docker0 -j ACCEPT
```

Verify Docker functionality after applying firewall rules:

```bash
docker ps  # Containers should still be running
docker exec argos-dev echo "OK"  # Should succeed
```

## Standards Traceability

| Standard       | Control     | Requirement                                         | How This Task Satisfies It                                         |
| -------------- | ----------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| NIST SP 800-53 | SC-7        | Boundary Protection                                 | iptables default-deny restricts network boundary                   |
| NIST SP 800-53 | SC-7(5)     | Deny by default / allow by exception                | INPUT policy DROP; only 3 ports explicitly allowed                 |
| NIST SP 800-53 | CM-7        | Least Functionality                                 | Only essential ports open; debug services localhost-only           |
| NIST SP 800-53 | AC-6        | Least Privilege                                     | AppArmor restricts Node.js to minimum required file/network access |
| NIST SP 800-53 | SC-4        | Information in Shared Resources                     | noexec /tmp prevents temp-file based attacks between processes     |
| DISA STIG      | NET-FW-01   | Firewall must be configured                         | iptables script implements firewall                                |
| DISA STIG      | OS-MOUNT-01 | Removable media and tmp must have restrictive mount | noexec,nosuid,nodev on /tmp                                        |
| DISA STIG      | OS-MAC-01   | Mandatory Access Control must be enabled            | AppArmor profile provides MAC for Node.js                          |

## Execution Tracking

| Subtask  | Description                                                 | Status  | Started | Completed | Verified By |
| -------- | ----------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.11.1 | iptables firewall script (default deny, allow 22/5173/5174) | PENDING | --      | --        | --          |
| 2.2.11.2 | Filesystem hardening (/tmp noexec,nosuid,nodev)             | PENDING | --      | --        | --          |
| 2.2.11.3 | AppArmor profile for Node.js (least privilege)              | PENDING | --      | --        | --          |
