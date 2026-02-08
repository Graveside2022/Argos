# Phase 6.3.06: Configuration Conflict Resolution

**Document ID**: ARGOS-AUDIT-P6.3.06
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.6 + 6.3.6b
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

This task addresses three categories of configuration inconsistency:

### 1.1 vm.swappiness Conflict (Task 6.3.6)

Three scripts set `vm.swappiness=10`, which conflicts with the live system value of `vm.swappiness=60`. The value of 60 is correct for a system with zram-backed compressed swap (installed 2026-02-06). A swappiness of 10 on a zram system prevents the kernel from utilizing compressed memory efficiently, effectively disabling the benefit of zram.

### 1.2 NODE_OPTIONS Omission (Task 6.3.6)

`deployment/argos-dev.service` and `deployment/argos-final.service` lack `Environment="NODE_OPTIONS=--max-old-space-size=1024"`. The 9 other locations that set NODE_OPTIONS all use 1024. Without this, Node.js on a 64-bit system defaults to ~1.5GB heap, which combined with other services risks triggering OOM on the 8GB RPi 5.

**Note**: The NODE_OPTIONS omission is already addressed in Task 6.3.2 (template includes NODE_OPTIONS). This section documents the conflict for traceability and ensures no other NODE_OPTIONS inconsistencies exist.

### 1.3 Debug Console Statements in API Routes (Task 6.3.6b)

**50 `console.log/debug/trace()` calls exist across 14 API route files.** These are debug-time artifacts that should not exist in production API endpoints. They pollute journal logs when running under systemd, interfere with structured logging, and leak internal state information.

### Current State vs Desired State

| Metric                                | Current                    | Target                       |
| ------------------------------------- | -------------------------- | ---------------------------- |
| Scripts setting vm.swappiness=10      | 3                          | 0 (all set to 60)            |
| Service files missing NODE_OPTIONS    | 2 (argos-dev, argos-final) | 0 (via Task 6.3.2 templates) |
| console.log/debug/trace in API routes | 50 across 14 files         | 0                            |

---

## 2. Prerequisites

- None for Task 6.3.6 (vm.swappiness and NODE_OPTIONS -- independent of other tasks).
- For Task 6.3.6b (console cleanup): The structured logger must be available at `src/lib/server/logger.ts` (already exists; imported by 44 files).

---

## 3. Dependencies

- **Upstream**: None (independent task on Track B)
- **Downstream**: None (standalone cleanup task)
- **Cross-reference**: Task 6.3.2 resolves the NODE_OPTIONS omission in service templates. This task documents the conflict for traceability only.
- **Independent of**: Tasks 6.3.1, 6.3.2, 6.3.3, 6.3.4, 6.3.5, 6.3.7, 6.3.8, 6.3.9, 6.3.10

---

## 4. Rollback Strategy

### Task 6.3.6 (vm.swappiness)

```bash
# Restore original vm.swappiness=10 in 3 scripts
git checkout HEAD -- scripts/install-system-dependencies.sh scripts/setup-swap.sh scripts/setup-host-complete.sh
```

### Task 6.3.6b (Console cleanup)

```bash
# Restore original console statements in API route files
git checkout HEAD -- src/routes/api/
```

For individual file rollback, replace `src/routes/api/` with the specific file path.

---

## 5. Current State / Inventory

### 5.1 vm.swappiness Conflict (3 files)

| File                                     | Line | Current Content                                              |
| ---------------------------------------- | ---- | ------------------------------------------------------------ |
| `scripts/install-system-dependencies.sh` | 307  | `vm.swappiness = 10`                                         |
| `scripts/setup-swap.sh`                  | 116  | `echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf` |
| `scripts/setup-host-complete.sh`         | 324  | `vm.swappiness = 10`                                         |

**Live system value**: `vm.swappiness=60` (correct for zram).

**Why 60 is correct**: On systems with zram-backed compressed swap, the kernel should be encouraged to swap pages into compressed memory (zram) rather than keeping them uncompressed in RAM. A swappiness value of 60 (the kernel default) allows the kernel to balance between keeping pages in RAM and compressing them into zram. A value of 10 effectively disables this optimization, forcing the kernel to exhaust physical RAM before using zram, which defeats the purpose of installing zram in the first place.

**Reference**: https://wiki.archlinux.org/title/Zram#Optimizing

### 5.2 NODE_OPTIONS Omission (2 service files)

| Service                      | Has NODE_OPTIONS | Heap Limit          |
| ---------------------------- | ---------------- | ------------------- |
| argos-dev.service            | NO               | ~1.5GB (V8 default) |
| argos-final.service          | NO               | ~1.5GB (V8 default) |
| dev-server-keepalive.service | YES              | 1024MB              |
| simple-keepalive.service     | YES              | 1024MB              |

**Resolution**: Already addressed in Task 6.3.2 (all Node.js service templates include `Environment="NODE_OPTIONS=--max-old-space-size=1024"`). This section exists for traceability only.

### 5.3 Debug Console Statements (50 across 14 files)

**Detection command:**

```bash
grep -rn 'console\.\(log\|debug\|trace\)' src/routes/api/ --include='*.ts' | wc -l
# Result: 50
```

**Per-file breakdown (verified 2026-02-08):**

| File                                                     | console.log/debug/trace Count |
| -------------------------------------------------------- | ----------------------------- |
| `src/routes/api/gsm-evil/scan/+server.ts`                | 16                            |
| `src/routes/api/gsm-evil/tower-location/+server.ts`      | 6                             |
| `src/routes/api/kismet/stop/+server.ts`                  | 6                             |
| `src/routes/api/agent/stream/+server.ts`                 | 4                             |
| `src/routes/api/rf/usrp-power/+server.ts`                | 4                             |
| `src/routes/api/agent/tools/+server.ts`                  | 3                             |
| `src/routes/api/gsm-evil/intelligent-scan/+server.ts`    | 3                             |
| `src/routes/api/droneid/+server.ts`                      | 2                             |
| `src/routes/api/cell-towers/nearby/+server.ts`           | 1                             |
| `src/routes/api/hardware/scan/+server.ts`                | 1                             |
| `src/routes/api/hardware/status/[hardwareId]/+server.ts` | 1                             |
| `src/routes/api/kismet/start-with-adapter/+server.ts`    | 1                             |
| `src/routes/api/tools/execute/+server.ts`                | 1                             |
| `src/routes/api/tools/scan/+server.ts`                   | 1                             |
| **Total**                                                | **50**                        |

**Note**: `console.warn` and `console.error` calls (154 additional occurrences across API routes) are **excluded** from this task. These serve a legitimate purpose for warning/error reporting and should be migrated to the structured logger in a separate pass.

---

## 6. Actions / Changes

### 6.1 Action A: Fix vm.swappiness Conflict

Change all three scripts to set `vm.swappiness=60`. Add a comment explaining the rationale.

**File 1: `scripts/install-system-dependencies.sh` (line 307)**

Before:

```bash
vm.swappiness = 10
```

After:

```bash
# vm.swappiness=60 is optimal for systems with zram compressed swap.
# Lower values (e.g., 10) prevent effective use of compressed memory.
# See: https://wiki.archlinux.org/title/Zram#Optimizing
vm.swappiness = 60
```

**File 2: `scripts/setup-swap.sh` (line 116)**

Before:

```bash
echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
```

After:

```bash
# vm.swappiness=60 is optimal for systems with zram compressed swap.
# Lower values (e.g., 10) prevent effective use of compressed memory.
echo "vm.swappiness=60" > /etc/sysctl.d/99-swappiness.conf
```

**File 3: `scripts/setup-host-complete.sh` (line 324)**

Before:

```bash
vm.swappiness = 10
```

After:

```bash
# vm.swappiness=60 is optimal for systems with zram compressed swap.
# Lower values (e.g., 10) prevent effective use of compressed memory.
vm.swappiness = 60
```

### 6.2 Action B: Verify NODE_OPTIONS Consistency (Documentation Only)

No code changes required. Confirm that Task 6.3.2 templates include NODE_OPTIONS for all 4 Node.js service templates (argos-dev, argos-final, dev-server-keepalive, simple-keepalive).

Verification:

```bash
grep -l 'NODE_OPTIONS' deployment/templates/*.service.template | wc -l
# Expected: 4
```

### 6.3 Action C: Replace Debug Console Statements in API Routes

For each of the 50 `console.log/debug/trace()` calls, apply one of three treatments:

1. **Delete**: If the statement was purely for debugging and provides no operational value.
2. **Replace with `logger.debug()`**: If the information is useful for troubleshooting but should be controlled by log level.
3. **Replace with `logger.info()`**: If the statement logs an operationally significant event (e.g., "GSM scan started on frequency X").

The structured logger is already available at `src/lib/server/logger.ts` and is imported by 44 files. For files that do not yet import the logger:

```typescript
import { logger } from '$lib/server/logger';
```

**Priority order** (start with highest-count files):

| Priority | File                                                  | Count  | Treatment                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | `src/routes/api/gsm-evil/scan/+server.ts`             | 16     | Worst offender; security-sensitive endpoint. Most are debug statements from debugging sessions. Replace with `logger.debug()` for scan progress, `logger.info()` for scan start/stop events, delete pure debug artifacts. |
| 2        | `src/routes/api/gsm-evil/tower-location/+server.ts`   | 6      | Replace with `logger.debug()` for location lookup details.                                                                                                                                                                |
| 3        | `src/routes/api/kismet/stop/+server.ts`               | 6      | Replace with `logger.info()` for service lifecycle events (stop initiated, stop completed).                                                                                                                               |
| 4        | `src/routes/api/agent/stream/+server.ts`              | 4      | Replace with `logger.debug()` for stream state transitions.                                                                                                                                                               |
| 5        | `src/routes/api/rf/usrp-power/+server.ts`             | 4      | Replace with `logger.debug()` for power control operations.                                                                                                                                                               |
| 6        | `src/routes/api/agent/tools/+server.ts`               | 3      | Replace with `logger.debug()` for tool execution tracing.                                                                                                                                                                 |
| 7        | `src/routes/api/gsm-evil/intelligent-scan/+server.ts` | 3      | Replace with `logger.debug()` for scan intelligence.                                                                                                                                                                      |
| 8        | `src/routes/api/droneid/+server.ts`                   | 2      | Replace with `logger.debug()`.                                                                                                                                                                                            |
| 9-14     | Remaining 6 files                                     | 1 each | Evaluate per-statement: delete or replace with appropriate logger level.                                                                                                                                                  |

**Example transformation:**

Before:

```typescript
console.log('Starting GSM scan on frequency:', freq);
```

After:

```typescript
logger.info('Starting GSM scan', { frequency: freq });
```

Before:

```typescript
console.log('Debug: raw tower data', JSON.stringify(data));
```

After:

```typescript
logger.debug('Raw tower data received', { dataLength: data.length });
```

Note: When replacing `console.log(JSON.stringify(largeObject))` with logger calls, avoid passing entire large objects. Instead, pass summary fields (count, length, first-few-items) to prevent log bloat.

---

## 7. Verification Commands

### 7.1 vm.swappiness Verification

```bash
# 1. Verify all swappiness references are 60
grep -rn 'swappiness' scripts/ | grep -v '= 60' | grep -v '=60' | grep -v '#'
# Expected: no output (all non-comment lines use 60)

# 2. Explicit check: no swappiness=10 remains
grep -rn 'swappiness.*10' scripts/
# Expected: no output
```

### 7.2 NODE_OPTIONS Verification

```bash
# 1. Verify NODE_OPTIONS in all Node.js service templates
grep -l 'NODE_OPTIONS' deployment/templates/*.service.template | wc -l
# Expected: 4 (argos-dev, argos-final, dev-server-keepalive, simple-keepalive)

# 2. Verify consistent value across all templates
grep 'NODE_OPTIONS' deployment/templates/*.service.template | grep -v '1024'
# Expected: no output (all use 1024)
```

### 7.3 Console Statement Verification

```bash
# 1. Verify zero console.log/debug/trace in API routes
grep -rn 'console\.\(log\|debug\|trace\)' src/routes/api/ --include='*.ts' | wc -l
# Expected: 0

# 2. Verify logger is imported in files that replaced console statements
for f in \
  src/routes/api/gsm-evil/scan/+server.ts \
  src/routes/api/gsm-evil/tower-location/+server.ts \
  src/routes/api/kismet/stop/+server.ts \
  src/routes/api/agent/stream/+server.ts \
  src/routes/api/rf/usrp-power/+server.ts \
  src/routes/api/agent/tools/+server.ts \
  src/routes/api/gsm-evil/intelligent-scan/+server.ts \
  src/routes/api/droneid/+server.ts \
  src/routes/api/cell-towers/nearby/+server.ts \
  src/routes/api/hardware/scan/+server.ts \
  src/routes/api/hardware/status/[hardwareId]/+server.ts \
  src/routes/api/kismet/start-with-adapter/+server.ts \
  src/routes/api/tools/execute/+server.ts \
  src/routes/api/tools/scan/+server.ts; do
  grep -q 'import.*logger' "$f" || echo "MISSING LOGGER: $f"
done
# Expected: no output (all files import logger)

# 3. Verify ESLint no-console warnings decreased
npx eslint src/routes/api/ --config config/eslint.config.js 2>&1 | grep "no-console" | wc -l
# Expected: significantly less than current count
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                                      | Command                                                                               | Expected  |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------- | --------- |
| 9   | vm.swappiness=60 everywhere                | `grep -rn 'swappiness.*10' scripts/`                                                  | No output |
| 10  | NODE_OPTIONS in all Node.js templates      | See Task 6.3.2 verification                                                           | 4 files   |
| 29  | Zero console.log/debug/trace in API routes | `grep -rn 'console\.\(log\|debug\|trace\)' src/routes/api/ --include='*.ts' \| wc -l` | 0         |

### Additional Pass/Fail Criteria

1. All 3 scripts set `vm.swappiness=60` with explanatory comments referencing zram.
2. NODE_OPTIONS `--max-old-space-size=1024` is present in all 4 Node.js service templates (verified via Task 6.3.2).
3. Zero `console.log`, `console.debug`, or `console.trace` calls remain in `src/routes/api/**/*.ts`.
4. All 14 API route files that had console statements now import the structured logger.
5. Logger replacements use appropriate log levels (`debug` for troubleshooting, `info` for operational events).
6. No large objects are passed directly to logger calls (use summary fields instead).

---

## 9. Traceability

| Finding                                          | Task                       | Status  |
| ------------------------------------------------ | -------------------------- | ------- |
| vm.swappiness=10 conflicts with zram (3 scripts) | 6.3.6 Action A             | PLANNED |
| NODE_OPTIONS missing in 2 services               | 6.3.6 Action B (via 6.3.2) | PLANNED |
| 50 console.log/debug/trace in 14 API route files | 6.3.6b Action C            | PLANNED |

### Risk Assessment

| Risk                                                               | Likelihood | Impact   | Mitigation                                                                                       |
| ------------------------------------------------------------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------ |
| vm.swappiness=60 causes excessive swapping on systems without zram | Low        | Low      | Only applied to scripts that already have the setting; the comment explains the zram requirement |
| Console statement removal hides useful debugging info              | Low        | Low      | Statements replaced with structured logger at `debug` level; can be enabled via log level config |
| Logger import adds overhead to API routes                          | Very Low   | Very Low | Logger is a singleton; import is a no-op after first load                                        |

---

## 10. Execution Order Notes

This task runs on **Track B** (independent of the service templating/hardening chain on Track A).

**Position in execution chain:**

- After: None (independent task)
- Parallel with: Tasks 6.3.3, 6.3.4 (Track B)
- No downstream dependencies

**Recommended execution within this task:**

1. Fix vm.swappiness in 3 scripts (Action A -- 5 minutes).
2. Verify NODE_OPTIONS consistency (Action B -- documentation only, 2 minutes).
3. Replace console statements starting with the worst offender files (Action C -- priority order, ~1-2 hours).
4. Run all verification commands.

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation).

---

END OF DOCUMENT
