# Phase 2.2.10: Incident Response Procedure

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 IR-4 (Incident Handling), NIST SP 800-61r2 (Computer Security Incident Handling Guide)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade B6

---

## Purpose

Create a documented incident response procedure for the Argos system. NIST SP 800-53 IR-4 mandates that organizations implement an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery. The Argos system currently has zero documented incident response procedures. As a field-deployed military system controlling RF hardware and storing SIGINT data, the absence of incident response documentation creates an unacceptable operational risk.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | ZERO -- This task creates a documentation artifact only; no code changes                       |
| Severity      | MEDIUM                                                                                         |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 1 (new file: `docs/INCIDENT-RESPONSE.md`)                                                      |
| Blocks        | Nothing                                                                                        |
| Blocked By    | Phase 2.2.8 (Auth audit logging -- incident response references auth logs for detection)       |

## Threat Context

Argos operates in contested electromagnetic environments at Army EW training sites (NTC, JMRC). The system faces the following incident categories:

1. **Unauthorized access** -- An adversary gains access to the Argos API or web interface, potentially through a compromised API key, network proximity attack, or exploitation of an unpatched vulnerability.

2. **System compromise** -- An adversary achieves code execution on the RPi 5, gains access to the operating system, modifies system files, or installs persistent backdoors.

3. **Device capture or loss** -- The RPi 5 hardware is physically captured by an adversary, lost during field operations, or stolen. The device contains classified-equivalent data including IMSI identifiers, RF SIGINT data, GPS positions of friendly forces, and WiFi device tracking information.

Each incident level requires different response actions, different escalation paths, and different preservation requirements. Without a documented procedure, operators in the field must improvise under pressure, leading to evidence destruction (e.g., rebooting a compromised system), delayed notification, or inadequate containment.

NIST SP 800-53 IR-4 requires: "The organization implements an incident handling capability for security incidents that includes preparation, detection and analysis, containment, eradication, and recovery."

## Current State Assessment

| Metric                               | Value             | Verification Command                                              |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------- |
| Incident response documents          | **0**             | `find docs/ -name "*incident*" -o -name "*INCIDENT*" 2>/dev/null` |
| Emergency scripts (partial coverage) | **3**             | `ls scripts/emergency-*.sh 2>/dev/null \| wc -l`                  |
| Authentication audit logging         | **0** (pre-2.2.8) | `grep -rn "AUTH_FAILURE" src/ --include="*.ts" \| wc -l`          |
| RF transmission audit logging        | **0**             | No RF transmission logging exists                                 |
| Zeroize capability                   | **0**             | No secure erase functionality exists                              |
| `docs/` directory exists             | **Yes**           | `ls docs/`                                                        |
| Existing docs in `docs/`             | **2**             | `AG-UI-INTEGRATION.md`, `HOST_SETUP.md`                           |

## Implementation Plan

### Subtask 2.2.10.1: Create Incident Response Document

**Create**: `docs/INCIDENT-RESPONSE.md`

This document must be self-contained, printable, and usable by a field operator who may not have network connectivity. It follows the NIST SP 800-61r2 incident response lifecycle: Preparation, Detection/Analysis, Containment/Eradication/Recovery.

#### Document Content

````markdown
# Argos System -- Incident Response Procedure

**Classification**: UNCLASSIFIED // FOUO
**System**: Argos SDR & Network Analysis Console
**Hardware**: Raspberry Pi 5 (field-deployed)
**Version**: 1.0
**Last Updated**: 2026-02-08
**Authority**: Unit SOP, NIST SP 800-53 IR-4, NIST SP 800-61r2

---

## 1. Scope

This procedure applies to all Argos system deployments on Raspberry Pi 5
hardware used for EW training at NTC, JMRC, and other CONUS/OCONUS sites.
It covers security incidents ranging from suspected unauthorized access to
device capture or loss.

## 2. Incident Classification

| Level | Description                   | Examples                                     | Response Time |
| ----- | ----------------------------- | -------------------------------------------- | ------------- |
| 1     | Suspected unauthorized access | Unexpected auth failures, unknown client IPs | 15 minutes    |
| 2     | Confirmed system compromise   | Unauthorized file changes, backdoor detected | Immediate     |
| 3     | Device capture or loss        | Physical loss, theft, adversary possession   | Immediate     |

## 3. Level 1: Suspected Unauthorized Access

### Detection Indicators

- Multiple AUTH_FAILURE events in authentication audit logs
- AUTH_FAILURE from unknown IP addresses (not operator workstations)
- Unexpected AUTH_SUCCESS events outside of training windows
- Unknown User-Agent strings in audit logs
- WebSocket connection attempts from unauthorized sources (WS_AUTH_FAILURE)

### Response Actions

1. **Review authentication audit logs**
    ```bash
    # Check recent auth failures (requires Phase 2.2.8 audit logging)
    journalctl -u argos-dev --since "1 hour ago" | grep AUTH_FAILURE
    ```
````

2. **Rotate the ARGOS_API_KEY immediately**

    ```bash
    # Generate new API key
    NEW_KEY=$(openssl rand -hex 32)

    # Update .env file
    sed -i "s/^ARGOS_API_KEY=.*/ARGOS_API_KEY=${NEW_KEY}/" /app/.env

    # Restart the Argos service
    systemctl restart argos-dev

    # Distribute new key to authorized operators via secure channel
    echo "New API key: ${NEW_KEY}"
    echo "Distribute via encrypted channel ONLY"
    ```

3. **Check WebSocket connection logs for unknown origins**

    ```bash
    journalctl -u argos-dev --since "1 hour ago" | grep "WS_AUTH"
    ```

4. **Review RF transmission logs for unauthorized transmissions**

    ```bash
    # Check HackRF control API access
    journalctl -u argos-dev --since "1 hour ago" | grep "/api/hackrf\|/api/rf"
    ```

5. **If unauthorized RF transmission occurred**:
    - STOP all RF transmissions immediately
        ```bash
        curl -X POST -H "X-API-Key: $ARGOS_API_KEY" \
            http://localhost:5173/api/rf/emergency-stop
        ```
    - Notify range safety officer
    - Record frequency, power level, duration, and time of unauthorized TX
    - Preserve transmission logs

### Documentation

Record the following in the unit incident log:

- Date/time of detection
- Detection method (audit log entry, operator observation, etc.)
- IP addresses involved
- Actions taken
- Time API key was rotated
- Personnel notified

## 4. Level 2: Confirmed System Compromise

### Detection Indicators

- Unauthorized file modifications (checksums do not match)
- Unknown processes running on the system
- Unexpected network connections (outbound C2 traffic)
- Modified system binaries or configuration files
- Database entries that do not correspond to known operations

### Response Actions -- EXECUTE IN ORDER

1. **DISCONNECT from network immediately**
    - Remove Ethernet cable physically
    - Disable WiFi adapter

    ```bash
    # If terminal access is available:
    ip link set eth0 down
    ip link set wlan0 down
    ```

    - **RATIONALE**: Prevents further exfiltration and cuts C2 channel

2. **Preserve logs with timestamped copies**

    ```bash
    INCIDENT_DIR="/tmp/incident-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${INCIDENT_DIR}"

    # Preserve system logs
    cp -a /var/log "${INCIDENT_DIR}/var-log/"

    # Preserve Argos audit logs
    journalctl -u argos-dev --no-pager > "${INCIDENT_DIR}/argos-journal.log"

    # Preserve database (SIGINT data)
    cp /app/rf_signals.db "${INCIDENT_DIR}/rf_signals.db"
    cp /app/rf_signals.db-wal "${INCIDENT_DIR}/rf_signals.db-wal" 2>/dev/null
    cp /app/rf_signals.db-shm "${INCIDENT_DIR}/rf_signals.db-shm" 2>/dev/null

    # Preserve process state
    ps auxww > "${INCIDENT_DIR}/ps-output.txt"
    ss -tlnp > "${INCIDENT_DIR}/network-listeners.txt"
    ss -tnp > "${INCIDENT_DIR}/network-connections.txt"

    # Preserve Docker state
    docker ps -a > "${INCIDENT_DIR}/docker-ps.txt"
    docker logs argos-dev > "${INCIDENT_DIR}/docker-argos.log" 2>&1

    # Compute integrity hashes
    sha256sum "${INCIDENT_DIR}"/* > "${INCIDENT_DIR}/SHA256SUMS"

    echo "Evidence preserved to: ${INCIDENT_DIR}"
    ```

3. **DO NOT REBOOT the system**
    - Memory contains volatile evidence: running processes, network connections,
      decrypted credentials, attacker tools
    - Rebooting destroys this evidence permanently
    - If the system must be powered off, perform a memory dump first (if tools available)

4. **Notify chain of command per unit SOP**
    - Report includes: device hostname, IP address, last known GPS position
    - Time of detection and estimated time of compromise
    - Summary of observed indicators
    - Evidence preservation status

### Documentation

Record the following:

- Complete timeline of events
- All indicators of compromise (IOCs) observed
- Network addresses (source and destination)
- File paths of modified files
- Hash values of preserved evidence
- Chain of custody for evidence media

## 5. Level 3: Device Capture or Loss

### Immediate Actions -- WITHIN 15 MINUTES OF DISCOVERY

1. **Execute zeroize if available and device is accessible**

    ```bash
    # Future implementation (Phase TBD)
    # scripts/security/zeroize.sh
    ```

    - **NOTE**: Zeroize capability does not exist in current version.
      If device is recoverable, perform manual secure erase:

    ```bash
    # Overwrite database with random data
    shred -vfz -n 3 /app/rf_signals.db

    # Overwrite .env (contains API keys)
    shred -vfz -n 3 /app/.env

    # Clear logs
    journalctl --vacuum-time=0
    shred -vfz -n 3 /var/log/argos/*.log
    ```

2. **Rotate ALL credentials used by the device**
    - ARGOS_API_KEY
    - Kismet API password (both `kismet` and `password` values in codebase)
    - OpenCellID API key (`config/opencellid.json`)
    - Any WiFi AP credentials stored on the device
    - Docker registry credentials (if applicable)
    - SSH keys (`~/.ssh/`)

3. **Revoke PKI certificates associated with the device**
    - TLS certificates (if any)
    - SSH host keys (remove from known_hosts on other systems)
    - Any VPN certificates

4. **Report to security officer with**:
    - Device serial number (RPi 5 serial from `/proc/cpuinfo`)
    - Device hostname (`scarmatrix-kali`)
    - MAC addresses of all network interfaces
    - Last known GPS position (from database or operator knowledge)
    - Last known network configuration (IP addresses, connected networks)
    - Inventory of sensitive data stored:
        - IMSI identifiers captured during training
        - WiFi device MAC addresses and positions
        - RF signal intelligence data
        - GPS track logs of operator movements
    - Estimated time of loss/capture
    - Circumstances of loss/capture

## 6. Contact Information

| Role                  | Contact               | When to Notify               |
| --------------------- | --------------------- | ---------------------------- |
| Unit Security Officer | Per unit TACSOP       | All Level 2 and Level 3      |
| Range Safety Officer  | Per range SOP         | Any unauthorized RF TX       |
| Chain of Command      | Per unit SOP          | Level 2 and Level 3          |
| Cyber Defense         | Per installation SOPs | Level 2 confirmed compromise |

## 7. Post-Incident Actions

After the immediate response:

1. Conduct root cause analysis using preserved evidence
2. Update this procedure based on lessons learned
3. If device was recovered after compromise:
    - Re-image the entire SD card / NVMe from known-good backup
    - Do NOT attempt to "clean" a compromised system
    - Regenerate all credentials
4. Update threat model based on observed TTPs
5. Brief operations personnel on indicators and prevention

## 8. Revision History

| Version | Date       | Author | Changes          |
| ------- | ---------- | ------ | ---------------- |
| 1.0     | 2026-02-08 | --     | Initial creation |

````

## Verification Checklist

1. **Document exists and is not empty**
   ```bash
   test -s docs/INCIDENT-RESPONSE.md && echo "PASS" || echo "FAIL"
   # Expected: PASS
````

2. **All three incident levels are documented**

    ```bash
    grep -c "^## [345]\." docs/INCIDENT-RESPONSE.md
    # Expected: 3
    ```

3. **Document contains required NIST IR-4 phases**

    ```bash
    grep -c "Detection\|Response Actions\|Preserve\|Notify" docs/INCIDENT-RESPONSE.md
    # Expected: >= 4
    ```

4. **Document contains credential rotation instructions**

    ```bash
    grep -c "ARGOS_API_KEY\|Kismet.*password\|OpenCellID\|SSH" docs/INCIDENT-RESPONSE.md
    # Expected: >= 4
    ```

5. **Document references authentication audit logs (Phase 2.2.8 dependency)**

    ```bash
    grep -c "AUTH_FAILURE\|audit log" docs/INCIDENT-RESPONSE.md
    # Expected: >= 2
    ```

6. **No classified or sensitive information in the document itself**
    ```bash
    grep -i "secret\|password.*=\|key.*=" docs/INCIDENT-RESPONSE.md | grep -v "API_KEY\|api.*key\|password.*values\|SSH keys" | wc -l
    # Expected: 0
    ```

## Commit Strategy

```
docs(phase2.2.10): create incident response procedure (NIST IR-4)

Phase 2.2 Task 10: Incident Response Procedure
- docs/INCIDENT-RESPONSE.md: 3 incident levels (suspected access,
  confirmed compromise, device capture/loss)
- Level 1: auth log review, key rotation, RF TX verification
- Level 2: network disconnect, evidence preservation, no-reboot policy
- Level 3: zeroize/shred, credential rotation, PKI revocation, reporting
Verified: document exists with all 3 levels and required NIST phases

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Revert this single commit
git reset --soft HEAD~1

# Remove the incident response document
rm -f docs/INCIDENT-RESPONSE.md
```

No code changes were made; rollback has zero runtime impact.

## Risk Assessment

| Risk                                              | Level  | Mitigation                                                         |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Document contains inaccurate procedures           | LOW    | Based on NIST SP 800-61r2 standard incident handling guide         |
| Document becomes stale as system evolves          | MEDIUM | Revision history table; periodic review during Phase 6 maintenance |
| Operators do not read or follow the procedure     | MEDIUM | Integrate into unit TACSOP; brief during pre-deployment checkout   |
| Document itself leaks system architecture details | LOW    | Classified FOUO; contains no credentials, only procedural guidance |

## Standards Traceability

| Standard         | Control   | Requirement                           | How This Task Satisfies It                                        |
| ---------------- | --------- | ------------------------------------- | ----------------------------------------------------------------- |
| NIST SP 800-53   | IR-4      | Incident Handling capability          | Three-level incident response procedure with actions and contacts |
| NIST SP 800-53   | IR-4(1)   | Automated incident handling processes | Evidence preservation script with timestamped copies              |
| NIST SP 800-53   | IR-5      | Incident Monitoring                   | References auth audit logs (Phase 2.2.8) for detection            |
| NIST SP 800-53   | IR-6      | Incident Reporting                    | Contact table and reporting requirements per incident level       |
| NIST SP 800-61r2 | Section 3 | Detection and Analysis                | Detection indicators for each level                               |
| NIST SP 800-61r2 | Section 4 | Containment, Eradication, Recovery    | Containment (network disconnect), eradication (re-image)          |
| NIST SP 800-53   | MP-6      | Media Sanitization                    | Level 3 zeroize/shred procedures                                  |

## Execution Tracking

| Subtask  | Description                                               | Status  | Started | Completed | Verified By |
| -------- | --------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.10.1 | Create `docs/INCIDENT-RESPONSE.md` with 3 incident levels | PENDING | --      | --        | --          |
