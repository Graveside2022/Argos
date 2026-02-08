# Phase 7.4.04: Safety Manager and Audit Logging (`safety-manager.ts`)

**Decomposed from**: Phase-7.4-SERVICE-LAYER.md (Task 7.4.4)
**Risk Level**: HIGH -- Safety enforcement, audit trail integrity, military compliance
**Prerequisites**: Phase 7.4.06 (shared types), Phase 7.4.03 (ConfigManager for safety settings)
**Estimated Duration**: 2-3 hours
**Estimated Lines**: ~120
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the Python `SafetyManager` to TypeScript and add mandatory audit logging for military deployment. This service validates transmission parameters against hardware limits and maintains an append-only audit trail of every transmission event.

**Target file**: `src/lib/server/hackrf/transmit/safety-manager.ts`

**Replaces**: `hackrf_emitter/backend/utils/safety_manager.py` (95 lines)

---

## CRITICAL FINDING: Current Python Implementation is Deliberately All-Permissive

The actual `safety_manager.py` has **every safety check returning True unconditionally**. All restrictions are explicitly disabled with inline comments: "DISABLED FOR UNRESTRICTED OPERATION".

The `get_limits()` method returns:

| Parameter                | Python Value | HackRF One Actual Limit  | Status                                    |
| ------------------------ | ------------ | ------------------------ | ----------------------------------------- |
| `max_power_dbm`          | 100          | N/A (SDR, not power amp) | Well above any consumer SDR capability    |
| `max_gain`               | 100          | 47 dB                    | Over 2x the hardware maximum              |
| `max_duration`           | 999999       | N/A (software limit)     | Essentially unlimited (~277 hours)        |
| `frequency_range`        | 0 to 999 GHz | 1 MHz to 6 GHz           | Far beyond HackRF One physical capability |
| `restricted_frequencies` | `[]` (empty) | N/A (policy decision)    | No frequencies restricted                 |

This is a **deliberate operational choice**, not a bug. For Army EW training at NTC/JMRC, operators need unrestricted access to the full hardware capability. The safety manager exists as architectural scaffolding for future environments that may require restrictions.

---

## Design Decision

The original Phase 7 plan introduced safety profiles ("unrestricted", "training", "locked_down") in `config/safety-profiles.json`. **This is feature creep.** The current Python implementation has no profiles -- it is a single, all-permissive configuration.

**Decision**: Faithfully replicate the current behavior (all-permissive) but implement it with proper architecture so that safety checks CAN be enabled in the future without code changes. The `validateTransmitParams()` method performs real validation against `HARDWARE_LIMITS` -- it just happens that those limits match the physical hardware bounds (which the all-permissive Python config exceeded).

This is the correct middle ground:

- Does NOT add unauthorized safety profiles (no feature creep)
- DOES enforce actual hardware bounds (prevents nonsensical requests like 999 GHz)
- DOES provide the architectural hook for future restriction if requested

---

## HARDWARE_LIMITS Interface and Constants

```typescript
interface SafetyLimits {
	maxFrequencyHz: number;
	minFrequencyHz: number;
	maxGainDb: number;
	maxSampleRateMsps: number;
	maxDurationS: number;
	restrictedFrequencies: number[];
}

const HARDWARE_LIMITS: SafetyLimits = {
	minFrequencyHz: 1_000_000, // 1 MHz (HackRF One hardware minimum)
	maxFrequencyHz: 6_000_000_000, // 6 GHz (HackRF One hardware maximum)
	maxGainDb: 47, // HackRF One TX VGA maximum
	maxSampleRateMsps: 20, // HackRF One maximum sample rate
	maxDurationS: Infinity, // No software limit (matching Python behavior)
	restrictedFrequencies: [] // No restrictions (matching current Python behavior)
};
```

These constants are derived from the HackRF One hardware datasheet, not from policy. They represent physical impossibilities, not operational restrictions:

- Requesting 7 GHz would fail at the hardware level regardless of software checks
- Requesting gain 50 dB would either clip to 47 or produce undefined behavior
- The safety manager catches these before they reach `hackrf_transfer`

---

## Methods to Implement

| #   | Method                                           | Description                                         |
| --- | ------------------------------------------------ | --------------------------------------------------- |
| 1   | `validateTransmitParams(params: WorkflowParams)` | Check against hardware limits, return error or null |
| 2   | `logTransmitEvent(entry: AuditEntry)`            | Append to JSONL audit log                           |
| 3   | `getHardwareLimits()`                            | Return current limits (HARDWARE_LIMITS constant)    |
| 4   | `isFrequencyAllowed(freq: number)`               | Check restricted list (currently always true)       |

### Method Details

**1. `validateTransmitParams(params: WorkflowParams): ValidationError | null`**
Validate each parameter against `HARDWARE_LIMITS`:

- `params.frequency` must be within `[minFrequencyHz, maxFrequencyHz]`
- `params.gain` must be within `[0, maxGainDb]`
- `params.sampleRate` must be within `[1_000_000, maxSampleRateMsps * 1_000_000]`
- `params.duration` must be within `[0.001, maxDurationS]` (minimum 1ms)
- `params.frequency` must not be in `restrictedFrequencies`

Returns `null` if all checks pass. Returns a `ValidationError` with a descriptive message if any check fails. Example:

```typescript
interface ValidationError {
	code: string;
	message: string;
	param: string;
	value: number;
	limit: number;
}
```

**2. `logTransmitEvent(entry: AuditEntry): void`**
Append a single JSON line to the audit log file. This method MUST NOT throw -- if file I/O fails, log the failure to stderr and continue. Transmission must never be blocked by an audit logging failure.

**3. `getHardwareLimits(): SafetyLimits`**
Return the `HARDWARE_LIMITS` constant. This is a simple getter. In the future, this could return ConfigManager-derived limits instead of the hardcoded constant.

**4. `isFrequencyAllowed(freq: number): boolean`**
Check whether `freq` appears in `restrictedFrequencies`. Currently always returns `true` because the restricted list is empty. The implementation MUST still perform the actual check (not hardcode `return true`) so that adding restricted frequencies in the future works without code changes.

---

## MANDATORY Audit Logging for Military Deployment

Every transmission event MUST be logged. This is NOT optional. In a military deployment at NTC/JMRC, the audit trail provides:

1. **Legal compliance**: Record of all RF transmissions with time, frequency, and duration
2. **Incident investigation**: If interference is reported, the log identifies what was transmitted and when
3. **Attribution**: Which operator (by IP or session) initiated each transmission
4. **Operational review**: After-action review of training exercises

### AuditEntry Interface

```typescript
interface AuditEntry {
	ts: string; // ISO 8601 timestamp (e.g., "2026-02-08T14:30:00.000Z")
	action: 'start' | 'stop' | 'rejected' | 'error';
	workflow: string; // Workflow name (e.g., "fm_modulation", "gps_spoof")
	frequency_mhz: number; // Frequency in MHz (human-readable)
	gain_db: number; // TX VGA gain in dB
	sample_rate_msps: number; // Sample rate in Msps
	duration_s: number; // Requested duration in seconds
	user: string; // Effective user identity (see AUDIT NOTE below)
	reason?: string; // For rejected/error/stop actions
}
```

### Log File Format

**Path**: `data/audit/transmit-log-YYYY-MM-DD.jsonl`

One JSON object per line, append-only. Daily rotation by date in filename.

Example log entries:

```jsonl
{"ts":"2026-02-08T14:30:00.000Z","action":"start","workflow":"fm_modulation","frequency_mhz":433.92,"gain_db":20,"sample_rate_msps":2,"duration_s":10,"user":"10.0.0.15"}
{"ts":"2026-02-08T14:30:10.500Z","action":"stop","workflow":"fm_modulation","frequency_mhz":433.92,"gain_db":20,"sample_rate_msps":2,"duration_s":10,"user":"10.0.0.15","reason":"user_requested"}
{"ts":"2026-02-08T14:31:00.000Z","action":"rejected","workflow":"gps_spoof","frequency_mhz":1575.42,"gain_db":60,"sample_rate_msps":2,"duration_s":5,"user":"10.0.0.22","reason":"gain_db 60 exceeds maximum 47"}
```

### Log Directory Creation

The `data/audit/` directory MUST be created if it does not exist. Use `fs.mkdirSync(dir, { recursive: true })` in the constructor. File permissions: directory 0o700, files 0o600.

---

## AUDIT NOTE: process.env.USER in Docker

**Independent Audit Correction (2026-02-08)**: `process.env.USER` inside a Docker container is always `root` (or whatever user the container runs as), making this field useless for attribution. Every transmission would log `user: "root"` regardless of who initiated it.

### Recommended User Identity Sources (in priority order)

1. **Session identifier from authentication middleware** (preferred) -- requires Phase 2 authentication. After Phase 2.1.1 (API key auth), the `ARGOS_API_KEY` is shared across all users, so this still does not provide individual attribution. Future enhancement: per-user API keys or session tokens.

2. **Remote IP address from SvelteKit request** (`event.getClientAddress()`) -- provides network-level attribution. Identifies WHICH device initiated the transmission, even if not which user. For a field deployment with known operator stations, IP-to-operator mapping is typically maintained externally.

3. **Timestamp + request ID as correlation identifier** -- fallback if neither of the above is available.

**Decision**: Until per-user authentication is implemented, use `event.getClientAddress()` as the `user` field. The `logTransmitEvent()` method accepts the user string as a parameter (does not attempt to determine it internally). The API route handler is responsible for passing `event.getClientAddress()` to the safety manager.

---

## Verification Commands

```bash
# File exists and compiles
test -f src/lib/server/hackrf/transmit/safety-manager.ts && echo "EXISTS" || echo "MISSING"
npx tsc --noEmit src/lib/server/hackrf/transmit/safety-manager.ts

# Line count within budget
wc -l src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: <= 180 lines

# All 4 methods present
grep -cE '(validateTransmitParams|logTransmitEvent|getHardwareLimits|isFrequencyAllowed)' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 4

# HARDWARE_LIMITS constant present with correct values
grep -c 'HARDWARE_LIMITS' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 2 (definition + usage)

# HackRF One hardware bounds present
grep -c '1_000_000\|6_000_000_000\|47\|20' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 4

# AuditEntry interface defined
grep -c 'AuditEntry' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 2

# JSONL file path pattern
grep -c 'transmit-log\|\.jsonl' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 1

# Audit directory creation
grep -c 'mkdirSync\|recursive.*true' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 1

# No hardcoded 'return true' in isFrequencyAllowed (must check the list)
grep -c 'restrictedFrequencies' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: >= 2

# No console.log in production code
grep -c 'console\.log' src/lib/server/hackrf/transmit/safety-manager.ts
# Expected: 0

# Full typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] `safety-manager.ts` exists at `src/lib/server/hackrf/transmit/safety-manager.ts`
- [ ] All 4 methods implemented: `validateTransmitParams`, `logTransmitEvent`, `getHardwareLimits`, `isFrequencyAllowed`
- [ ] `HARDWARE_LIMITS` constant uses correct HackRF One values: 1 MHz - 6 GHz, 0-47 dB, 20 Msps
- [ ] `SafetyLimits` interface defined with all 6 fields
- [ ] `AuditEntry` interface defined with all 9 fields (ts, action, workflow, frequency_mhz, gain_db, sample_rate_msps, duration_s, user, reason)
- [ ] `validateTransmitParams()` checks frequency, gain, sample rate, duration, and restricted list
- [ ] `validateTransmitParams()` returns `null` for valid params, `ValidationError` for invalid
- [ ] `isFrequencyAllowed()` performs real list check (not hardcoded `return true`)
- [ ] All-permissive behavior matches current Python implementation (no unauthorized safety profiles)
- [ ] No feature creep: no safety profile system unless explicitly requested
- [ ] `logTransmitEvent()` writes to `data/audit/transmit-log-YYYY-MM-DD.jsonl`
- [ ] Log format is JSONL (one JSON object per line, append-only)
- [ ] `logTransmitEvent()` never throws (catch I/O errors internally, log to stderr)
- [ ] `data/audit/` directory created with 0o700 permissions if missing
- [ ] Log files created with 0o600 permissions
- [ ] `user` field sourced from `event.getClientAddress()`, NOT `process.env.USER`
- [ ] No `console.log` statements in production code
- [ ] File does not exceed 300 lines
- [ ] No function exceeds 60 lines
- [ ] `npm run typecheck` passes

---

## Definition of Done

This task is complete when:

1. `validateTransmitParams()` rejects frequency 7 GHz (above HackRF max)
2. `validateTransmitParams()` rejects gain 50 dB (above HackRF max 47)
3. `validateTransmitParams()` accepts frequency 433.92 MHz with gain 20 dB (valid params)
4. `isFrequencyAllowed()` returns `true` for any frequency (matching Python behavior)
5. `logTransmitEvent()` creates `data/audit/transmit-log-YYYY-MM-DD.jsonl` and appends entries
6. Audit log entries are valid JSONL (parseable by `JSON.parse()` per line)
7. `logTransmitEvent()` does not throw even when disk is full (tested with mock)
8. All unit tests pass
9. `npm run typecheck` passes with zero errors

---

## Cross-References

- **Phase 7.4.01** (Transmit Manager): Calls `validateTransmitParams()` before every transmission and `logTransmitEvent()` after
- **Phase 7.4.03** (Config Manager): `getSafetySettings()` could override `HARDWARE_LIMITS` in future
- **Phase 7.4.06** (Shared Types): `WorkflowParams` interface used by `validateTransmitParams()`
- **Phase 7.5** (API Routes): API handlers pass `event.getClientAddress()` as user identity
- **Phase 2.1.1** (Authentication): Future per-user auth would improve audit attribution
