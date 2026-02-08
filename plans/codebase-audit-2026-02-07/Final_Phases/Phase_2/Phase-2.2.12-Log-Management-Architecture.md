# Phase 2.2.12: Log Management Architecture

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 AU-4 (Audit Storage Capacity), NIST SP 800-53 AU-9 (Protection of Audit Information), NIST SP 800-53 AU-11 (Audit Record Retention)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade C2

---

## Purpose

Establish log rotation configuration and structured log output format for the Argos system. NIST SP 800-53 AU-4 requires adequate audit storage capacity with mechanisms to reduce the likelihood of capacity exhaustion. Currently, all Argos application logs go to stdout with no rotation, no size limits, no retention policy, and no structured format. On a field-deployed RPi 5 with a 500GB NVMe SSD, unmanaged logs will eventually consume available disk space; in the interim, unstructured logs make forensic analysis and incident response impractical.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | LOW -- Log rotation and format changes do not affect application logic                         |
| Severity      | MEDIUM                                                                                         |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 3 (logrotate config script, LogEntry interface definition, integration notes)                  |
| Blocks        | Phase 3 Task 3.1 (Logger service can build on structured format defined here)                  |
| Blocked By    | Phase 2.2.8 (Auth audit logging establishes the first structured log entries)                  |

## Threat Context

On a field-deployed Argos system, logs serve three critical functions:

1. **Incident detection** -- Authentication failures, unauthorized access attempts, and anomalous RF transmission commands appear in logs first. Without structured, parseable logs, automated detection is impossible and manual review is impractical.

2. **Forensic analysis** -- After an incident, logs are the primary evidence for determining what happened, when, and from where. Unstructured console.log output mixed with application debug messages makes timeline reconstruction extremely difficult.

3. **Compliance evidence** -- NIST AU-4, AU-9, and AU-11 require that audit records are preserved with adequate capacity, protected from unauthorized modification, and retained for a defined period. The current system satisfies none of these requirements.

Additionally, the RPi 5 has finite storage (500GB NVMe). While this is generous, long-running field deployments with continuous RF data streaming, GPS logging, and WebSocket activity can generate significant log volume. Without rotation, logs accumulate indefinitely until disk exhaustion causes system failure.

## Current State Assessment

| Metric                               | Value                    | Verification Command                                                     |
| ------------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| Log rotation configuration for Argos | **None**                 | `ls /etc/logrotate.d/argos 2>/dev/null && echo EXISTS \|\| echo MISSING` |
| Log output format                    | **Unstructured**         | `journalctl -u argos-dev -n 5 --output=cat` (free-form text)             |
| Console statements in codebase       | **753** across 172 files | `grep -rn "console\." src/ --include="*.ts" \| wc -l`                    |
| Logger service (structured)          | **Minimal**              | `grep -rn "import.*logger" src/ --include="*.ts" \| wc -l` (44 files)    |
| Structured JSON log entries          | **0** (pre-Phase 2.2.8)  | Auth audit logging (Phase 2.2.8) introduces the first ones               |
| Log retention policy                 | **None**                 | No rotation, no expiration, no size limits                               |
| /var/log/argos/ directory            | **Does not exist**       | `ls -d /var/log/argos/ 2>/dev/null`                                      |
| systemd journal for argos-dev        | **Active**               | `journalctl -u argos-dev --disk-usage`                                   |

## Implementation Plan

### Subtask 2.2.12.1: Log Rotation Configuration

**Create**: `scripts/security/setup-logrotate.sh`

This script installs a logrotate configuration for Argos application logs. It creates the log directory, sets appropriate permissions, and configures daily rotation with 30-day retention.

```bash
#!/usr/bin/env bash
# scripts/security/setup-logrotate.sh
#
# Argos Log Rotation Configuration
# Standards: NIST SP 800-53 AU-4 (Audit Storage Capacity)
#            NIST SP 800-53 AU-9 (Protection of Audit Information)
#            NIST SP 800-53 AU-11 (Audit Record Retention)
#
# Usage: sudo bash scripts/security/setup-logrotate.sh

set -euo pipefail

# Validate running as root
if [[ $EUID -ne 0 ]]; then
    echo "ERROR: This script must be run as root (sudo)" >&2
    exit 1
fi

echo "[*] Configuring log management for Argos system..."

# 1. Create log directory with restrictive permissions
mkdir -p /var/log/argos
chown root:root /var/log/argos
chmod 0750 /var/log/argos

echo "[*] Created /var/log/argos (owner: root:root, mode: 0750)"

# 2. Install logrotate configuration
cat > /etc/logrotate.d/argos << 'LOGROTATE_CONF'
# Argos Application Log Rotation
# Standards: NIST SP 800-53 AU-4, AU-9, AU-11
# Created by: Phase 2.2.12 setup script
#
# Retention: 30 days (compliant with AU-11 minimum)
# Permissions: 0640 root:root (compliant with AU-9 protection)
# Rotation: Daily with compression (compliant with AU-4 capacity)

/var/log/argos/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    dateext
    dateformat -%Y%m%d
    sharedscripts
    postrotate
        # Restart Argos to reopen log file handles
        # Uses systemctl if available; falls back to Docker restart
        if systemctl is-active argos-dev >/dev/null 2>&1; then
            systemctl restart argos-dev
        elif docker ps --format '{{.Names}}' | grep -q argos-dev; then
            docker restart argos-dev
        fi
    endscript
}
LOGROTATE_CONF

echo "[*] Installed /etc/logrotate.d/argos"

# 3. Configure systemd journal retention (backup log channel)
if [[ -f /etc/systemd/journald.conf ]]; then
    # Set maximum journal size to 500MB
    if ! grep -q "^SystemMaxUse=" /etc/systemd/journald.conf; then
        echo "SystemMaxUse=500M" >> /etc/systemd/journald.conf
    fi
    # Set maximum retention to 30 days
    if ! grep -q "^MaxRetentionSec=" /etc/systemd/journald.conf; then
        echo "MaxRetentionSec=30day" >> /etc/systemd/journald.conf
    fi
    systemctl restart systemd-journald
    echo "[*] Configured systemd journal: max 500MB, 30-day retention"
fi

# 4. Verify logrotate configuration syntax
logrotate -d /etc/logrotate.d/argos 2>&1 | head -5
echo "[*] Logrotate dry run complete (check output above for errors)"

echo "[*] Log management configuration complete."
echo "[*] Log directory: /var/log/argos/"
echo "[*] Retention: 30 days, daily rotation, compressed"
echo "[*] Permissions: 0640 root:root (protected per NIST AU-9)"
```

#### Log Rotation Parameters

| Parameter      | Value           | NIST Requirement | Rationale                                              |
| -------------- | --------------- | ---------------- | ------------------------------------------------------ |
| Rotation       | `daily`         | AU-4 capacity    | Limits individual file size                            |
| Retention      | `rotate 30`     | AU-11 retention  | 30-day minimum for incident investigation window       |
| Compression    | `compress`      | AU-4 capacity    | Reduces disk usage ~90% for text logs                  |
| Delay compress | `delaycompress` | N/A              | Keeps most recent rotated log uncompressed for tailing |
| Permissions    | `0640`          | AU-9 protection  | Only root can read; group read for authorized services |
| Date extension | `dateext`       | AU-3 timestamps  | Log filenames include date for easy identification     |

### Subtask 2.2.12.2: Structured Log Output Format

Define a standard `LogEntry` interface that all Argos application logs must conform to. This format enables machine parsing by log aggregation tools (Splunk, Elasticsearch, SIEM systems) and human-readable forensic analysis.

**Create or add to**: `src/lib/server/security/log-format.ts`

```typescript
// src/lib/server/security/log-format.ts
//
// Structured Log Output Format
// Standards: NIST SP 800-53 AU-3 (Content of Audit Records)
//
// All application logs MUST use this format. Unstructured console.log
// calls will be migrated to this format in Phase 3 (Logger service).

/**
 * Log severity levels.
 * Ordered by severity: DEBUG < INFO < WARN < ERROR < FATAL
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

/**
 * Structured log entry per NIST SP 800-53 AU-3.
 *
 * AU-3 requires: type of event, when occurred, where occurred,
 * source of event, outcome of event, identity of subject.
 */
export interface LogEntry {
	/** ISO 8601 timestamp with timezone (AU-3: when) */
	timestamp: string;

	/** Severity level (AU-3: type + outcome) */
	level: LogLevel;

	/** Component that generated the log (AU-3: where + source) */
	component: string;

	/** Human-readable message (AU-3: type description) */
	message: string;

	/** Optional structured metadata (AU-3: additional information) */
	metadata?: Record<string, unknown>;
}

/**
 * Emit a structured log entry as single-line JSON to stdout/stderr.
 *
 * DEBUG and INFO go to stdout (console.log).
 * WARN, ERROR, and FATAL go to stderr (console.error).
 *
 * This function is the bridge between the current console.log approach
 * and the Phase 3 Logger service. Code migrated to use this function
 * will automatically benefit from the Phase 3 Logger when it is
 * implemented (the Logger will replace this function's internals
 * without changing the call signature).
 */
export function emitLog(
	level: LogLevel,
	component: string,
	message: string,
	metadata?: Record<string, unknown>
): void {
	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		component,
		message,
		metadata: metadata || undefined
	};

	const line = JSON.stringify(entry);

	if (level === 'DEBUG' || level === 'INFO') {
		console.log(line);
	} else {
		console.error(line);
	}
}
```

#### Example Usage

**BEFORE** (unstructured -- current state):

```typescript
console.log('Kismet service started successfully');
console.error('Failed to connect to HackRF:', error.message);
console.log(`GPS fix acquired: lat=${lat}, lon=${lon}`);
```

**AFTER** (structured -- target state):

```typescript
import { emitLog } from '$lib/server/security/log-format';

emitLog('INFO', 'kismet', 'Service started successfully');
emitLog('ERROR', 'hackrf', 'Failed to connect to HackRF', { error: error.message });
emitLog('INFO', 'gps', 'GPS fix acquired', { lat, lon });
```

#### Structured Output Examples

Each log entry is a single line of JSON:

```json
{"timestamp":"2026-02-08T14:30:00.000Z","level":"INFO","component":"kismet","message":"Service started successfully"}
{"timestamp":"2026-02-08T14:30:01.123Z","level":"ERROR","component":"hackrf","message":"Failed to connect to HackRF","metadata":{"error":"USB device not found"}}
{"timestamp":"2026-02-08T14:30:02.456Z","level":"INFO","component":"gps","message":"GPS fix acquired","metadata":{"lat":35.2828,"lon":-116.6723}}
{"timestamp":"2026-02-08T14:30:03.789Z","level":"WARN","component":"auth","message":"Authentication failure","metadata":{"ip":"192.168.1.100","path":"/api/hackrf/status"}}
```

#### Component Name Registry

To ensure consistency across the codebase, the following component names are standardized:

| Component   | Scope                                               | Files Using Component               |
| ----------- | --------------------------------------------------- | ----------------------------------- |
| `auth`      | Authentication events                               | hooks.server.ts, auth middleware    |
| `hackrf`    | HackRF hardware integration                         | api/hackrf/_, services/hackrf/_     |
| `usrp`      | USRP hardware integration                           | api/usrp/_, services/usrp/_         |
| `kismet`    | Kismet WiFi scanning                                | api/kismet/_, server/kismet/_       |
| `gsm-evil`  | GSM monitoring                                      | api/gsm-evil/_, services/gsm-evil/_ |
| `gps`       | GPS positioning                                     | api/gps/_, server/gps/_             |
| `rf`        | Generic RF operations                               | api/rf/\*                           |
| `rtl-433`   | RTL-433 signal decoding                             | api/rtl-433/\*                      |
| `droneid`   | Drone detection                                     | api/droneid/\*                      |
| `bettercap` | Bettercap network analysis                          | server/bettercap/\*                 |
| `database`  | SQLite database operations                          | server/db/\*                        |
| `websocket` | WebSocket server                                    | server/websocket-server.ts          |
| `openwebrx` | OpenWebRX integration                               | api/openwebrx/\*                    |
| `system`    | System-level operations (startup, shutdown, health) | api/system/\*, hooks.server.ts      |
| `agent`     | Ollama AI agent                                     | api/agent/_, server/agent/_         |

#### Migration Strategy

The 753 existing `console.log/error/warn` statements will be migrated to `emitLog()` in Phase 3 (Logger service). This subtask establishes the format and provides the `emitLog()` function so that:

1. New code written during Phase 2 uses `emitLog()` from the start
2. Phase 2.2.8 authentication audit logging already uses JSON format (compatible)
3. Phase 3 replaces `emitLog()` internals with a full Logger service (file output, rotation integration, level filtering) without changing the call signature

## Verification Checklist

1. **Logrotate configuration file exists**

    ```bash
    test -f /etc/logrotate.d/argos && echo "PASS" || echo "FAIL"
    # Expected: PASS (after running setup script)
    ```

2. **Logrotate configuration is syntactically valid**

    ```bash
    sudo logrotate -d /etc/logrotate.d/argos 2>&1 | grep -c "error"
    # Expected: 0
    ```

3. **Log directory exists with correct permissions**

    ```bash
    stat -c "%U:%G %a" /var/log/argos/
    # Expected: root:root 750
    ```

4. **Log rotation setup script exists and is executable**

    ```bash
    test -x scripts/security/setup-logrotate.sh && echo "PASS" || echo "FAIL"
    # Expected: PASS
    ```

5. **LogEntry interface is defined and exported**

    ```bash
    grep -c "export interface LogEntry" src/lib/server/security/log-format.ts
    # Expected: 1
    ```

6. **emitLog function is defined and exported**

    ```bash
    grep -c "export function emitLog" src/lib/server/security/log-format.ts
    # Expected: 1
    ```

7. **LogEntry contains all NIST AU-3 required fields**

    ```bash
    grep -c "timestamp\|level\|component\|message\|metadata" src/lib/server/security/log-format.ts
    # Expected: >= 5
    ```

8. **Build verification**
    ```bash
    npm run typecheck
    # Expected: exit 0 (no type errors from new interface)
    ```

## Commit Strategy

```
security(phase2.2.12): add log management architecture (rotation + structured format)

Phase 2.2 Task 12: Log Management Architecture (NIST AU-4/AU-9/AU-11)
- scripts/security/setup-logrotate.sh: daily rotation, 30-day retention,
  0640 permissions, compressed, systemd journal limits
- src/lib/server/security/log-format.ts: LogEntry interface, emitLog()
  function for structured JSON output (AU-3 compliant)
- Component name registry for consistent log identification
Verified: logrotate config valid, LogEntry interface exported, typecheck passes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

```bash
# Revert the git commit (script and TypeScript files)
git reset --soft HEAD~1

# Remove logrotate configuration (if installed)
sudo rm -f /etc/logrotate.d/argos

# Remove log directory (if created and empty)
sudo rmdir /var/log/argos/ 2>/dev/null || true

# Revert journald changes (if applied)
# Manual: remove SystemMaxUse and MaxRetentionSec from /etc/systemd/journald.conf
# Then: sudo systemctl restart systemd-journald
```

## Risk Assessment

| Risk                                                 | Level  | Mitigation                                                             |
| ---------------------------------------------------- | ------ | ---------------------------------------------------------------------- |
| Postrotate restart causes brief service interruption | LOW    | Restart takes ~2 seconds; WebSocket clients auto-reconnect             |
| Log directory permissions too restrictive            | LOW    | 0750 allows root and group; adjust group if needed for SIEM agent      |
| emitLog overhead on hot paths                        | LOW    | JSON.stringify + console.log is <0.1ms per call                        |
| Existing console.log output mixed with structured    | LOW    | Gradual migration in Phase 3; both formats readable by journalctl      |
| Journal size limit causes log loss                   | MEDIUM | 500MB limit adequate for 30 days; monitor with journalctl --disk-usage |

## Standards Traceability

| Standard       | Control  | Requirement                              | How This Task Satisfies It                                         |
| -------------- | -------- | ---------------------------------------- | ------------------------------------------------------------------ |
| NIST SP 800-53 | AU-3     | Content of Audit Records                 | LogEntry interface: timestamp, level, component, message, metadata |
| NIST SP 800-53 | AU-4     | Audit Storage Capacity                   | Daily rotation, compression, 500MB journal limit                   |
| NIST SP 800-53 | AU-4(1)  | Transfer to alternate storage            | Compressed rotated logs can be shipped to central SIEM             |
| NIST SP 800-53 | AU-9     | Protection of Audit Information          | Log files 0640 root:root; log directory 0750                       |
| NIST SP 800-53 | AU-11    | Audit Record Retention                   | 30-day retention (rotate 30)                                       |
| NIST SP 800-53 | AU-12    | Audit Generation                         | emitLog() provides programmatic audit record generation            |
| OWASP Top 10   | A09:2021 | Security Logging and Monitoring Failures | Structured, rotated, protected logs with defined format            |

## Execution Tracking

| Subtask  | Description                                                  | Status  | Started | Completed | Verified By |
| -------- | ------------------------------------------------------------ | ------- | ------- | --------- | ----------- |
| 2.2.12.1 | Log rotation configuration (logrotate + journald)            | PENDING | --      | --        | --          |
| 2.2.12.2 | Structured log output format (LogEntry interface, emitLog()) | PENDING | --      | --        | --          |
