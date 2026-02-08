# Phase 3.4.2: Logging Level Policy and PII Handling

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases (Corrective Action CA-06 from adversarial audit)
**Standards Compliance**: NIST SP 800-53 AU-2 (Audit Events), DISA STIG V-222602 (Error Message Suppression), DoD 5200.01 (Information Security Program)
**Review Panel**: US Cyber Command Engineering Review Board

---

**Phase**: 3 -- Code Quality, Constants, Linting, and Defensive Coding
**Sub-Phase**: 3.4 -- Defensive Coding Foundations
**Task ID**: 3.4.2
**Risk Level**: LOW -- Documentation only, no code changes
**Prerequisites**: Phase 3.1 (Logger must exist -- this policy governs its usage)
**Blocks**: Phase 3.1.4 (batch migration must follow this policy to avoid PII leaks)
**Estimated Files Touched**: 1 (new file: `docs/LOGGING-POLICY.md`)
**Standards**: NIST SP 800-53 AU-2, DISA STIG V-222602, DoD 5200.01

---

## Objective

Create `docs/LOGGING-POLICY.md` -- a formal logging level policy with PII handling rules for a SIGINT system that processes IMSI numbers, GPS coordinates, MAC addresses, and RF spectrum data. This document is required before the Phase 3.1.4 batch migration proceeds. Without it, the migration is a mechanical exercise that may inadvertently log PII.

## Current State Assessment

| Metric                         | Verified Value  | Target                   |
| ------------------------------ | --------------- | ------------------------ |
| Formal logging level policy    | Does not exist  | `docs/LOGGING-POLICY.md` |
| PII handling rules             | None documented | Documented per DoD reqs  |
| Structured logging format spec | None documented | Documented               |
| Log retention rules            | None documented | Documented               |

**DoD compliance context**: This system processes the following sensitive data categories during Army EW training exercises at NTC/JMRC:

- **IMSI numbers** -- personally identifiable, SIGINT data
- **GPS coordinates** -- location intelligence
- **MAC addresses** -- device fingerprints
- **RF spectrum data** -- operational parameters

Without a formal policy, developers have no guidance on what can and cannot appear in log files. This is a DISA STIG and NIST SP 800-53 violation.

## Scope

### File to Create: `docs/LOGGING-POLICY.md`

The document must contain the following four sections:

### Section 1: Log Level Definitions

| Level | Definition                                                       | Examples                                                                  |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ERROR | Conditions requiring human intervention or indicating data loss  | Database write failure, hardware communication timeout, assertion failure |
| WARN  | Degraded operation that is self-recovering or requires attention | Service reconnection, fallback to default config, deprecated API usage    |
| INFO  | Significant state transitions visible to operators               | Service start/stop, sweep start/complete, device connected/disconnected   |
| DEBUG | Detailed operational data for troubleshooting (dev only)         | Request/response payloads, intermediate calculation steps, timing data    |

### Section 2: PII Handling Rules

| Data Category                     | Classification                       | Logging Rule                                                                           |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| IMSI numbers                      | SENSITIVE -- personally identifiable | **NEVER** log raw IMSI. Log truncated form only: `IMSI:***1234` (last 4 digits)        |
| GPS coordinates (of targets)      | SENSITIVE -- location intelligence   | Log at DEBUG level only. Never at INFO or above. Truncate to 2 decimal places in logs. |
| GPS coordinates (of own platform) | INTERNAL                             | May log at INFO level for operational awareness                                        |
| MAC addresses                     | SENSITIVE -- device fingerprint      | Log truncated form: `AA:BB:CC:XX:XX:XX` (first 3 octets only for OUI identification)   |
| SSIDs                             | LOW SENSITIVITY                      | May log at INFO level                                                                  |
| Cell tower IDs (MCC/MNC/LAC/CID)  | PUBLIC                               | May log freely (public infrastructure data)                                            |
| API keys / credentials            | SECRET                               | **NEVER** log. Use `[REDACTED]` placeholder.                                           |
| RF frequency data                 | LOW SENSITIVITY                      | May log freely (operational parameter)                                                 |

**CRITICAL RULES**:

- **IMSI**: NEVER log the raw IMSI. Last 4 digits only. Violation = immediate security incident.
- **MAC**: First 3 octets only (OUI). The last 3 octets are device-unique identifiers.
- **API keys**: NEVER log. If an API key appears in a log entry, that is a credential leak.

### Section 3: Structured Logging Format

All log calls must use the structured logger's context parameter for machine-parseable fields:

```typescript
// CORRECT -- structured context, machine-parseable:
logInfo('Device detected', { mac: truncateMac(device.mac), frequency: device.freq });

// WRONG -- string interpolation, not parseable:
logInfo(`Device ${device.mac} detected at ${device.freq} MHz`);
```

Rules:

1. First argument is always a static string (no interpolation) describing the event
2. Second argument is always a structured object with named fields
3. Sensitive data in the context object must use truncation helpers (e.g., `truncateMac()`, `truncateImsi()`)
4. Never embed variable data in the message string -- use the context object

### Section 4: Log Retention

| Environment | Retention    | Debug Level                                        | Sensitive Data (DEBUG)    |
| ----------- | ------------ | -------------------------------------------------- | ------------------------- |
| Production  | 7 days       | Disabled by default (enable via `LOG_LEVEL=debug`) | 24-hour retention maximum |
| Development | 30 days      | Enabled                                            | 24-hour retention maximum |
| Testing     | Session only | Enabled                                            | Not applicable            |

## Execution Steps

### Step 1: Create the docs/ Directory (if needed)

```bash
mkdir -p docs/
```

### Step 2: Write `docs/LOGGING-POLICY.md`

Create the file with all four sections from the scope above, formatted as a proper Markdown document with title, version, and approval fields.

### Step 3: Verify File Exists

```bash
test -f docs/LOGGING-POLICY.md && echo EXISTS || echo MISSING
```

### Step 4: Verify Content

```bash
grep -c "NEVER" docs/LOGGING-POLICY.md
# Expected: 2+ (IMSI and API key rules)
```

## Commit Message

```
docs(logging): create logging level policy with PII handling rules for DoD compliance
```

## Verification

| #   | Check                       | Command                                         | Expected |
| --- | --------------------------- | ----------------------------------------------- | -------- |
| 1   | File exists                 | `test -f docs/LOGGING-POLICY.md && echo EXISTS` | EXISTS   |
| 2   | PII rules documented        | `grep -c "NEVER" docs/LOGGING-POLICY.md`        | 2+       |
| 3   | All 4 sections present      | `grep -c "^##" docs/LOGGING-POLICY.md`          | 4+       |
| 4   | IMSI rule present           | `grep "IMSI" docs/LOGGING-POLICY.md \| wc -l`   | 2+       |
| 5   | MAC truncation rule present | `grep "OUI" docs/LOGGING-POLICY.md \| wc -l`    | 1+       |
| 6   | No code changes             | `git diff --stat src/`                          | Empty    |

## Risk Assessment

| Risk                                             | Likelihood | Impact | Mitigation                                                                                               |
| ------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------- |
| PII logging policy too restrictive for debugging | LOW        | LOW    | DEBUG level is exempt from truncation requirement. Policy only restricts INFO and above.                 |
| Developers ignore the policy                     | MEDIUM     | MEDIUM | Policy is enforced by code review. Phase 3.1 logger can add truncation helpers for automatic compliance. |
| Policy conflicts with operational needs          | LOW        | LOW    | Policy reviewed by team before enforcement; exceptions documented as formal deviations.                  |

## Success Criteria

- [ ] `docs/LOGGING-POLICY.md` created with all 4 sections
- [ ] IMSI PII rule: NEVER log raw, last 4 digits only
- [ ] MAC PII rule: first 3 octets only (OUI)
- [ ] API key rule: NEVER log, use [REDACTED]
- [ ] Log level definitions match ERROR/WARN/INFO/DEBUG semantics
- [ ] Structured logging format documented with correct/wrong examples
- [ ] Log retention rules specified per environment

## Cross-References

- **Depends on**: Phase 3.1 (Logger must exist -- this policy governs its usage)
- **Depended on by**: Phase 3.1.4 (batch migration must follow this policy)
- **Related**: Phase 2.1.5 (Sensitive Data Exposure Fix) -- security hardening for data exposure
- **Related**: Phase 3.3.2 (Promise Chain Silent Swallowing) -- logging replaces silence

## Execution Tracking

| Step | Description                 | Status  | Started | Completed | Verified By |
| ---- | --------------------------- | ------- | ------- | --------- | ----------- |
| 1    | Create docs/ directory      | PENDING | --      | --        | --          |
| 2    | Write LOGGING-POLICY.md     | PENDING | --      | --        | --          |
| 3    | Verify file exists          | PENDING | --      | --        | --          |
| 4    | Verify content completeness | PENDING | --      | --        | --          |
