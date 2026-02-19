# Feature Specification: GSM Evil & Kismet Extended — Safe Exec Migration

**Feature Branch**: `009-gsm-evil-exec-migration`
**Created**: 2026-02-19
**Status**: Draft
**Depends On**: `008-codebase-hardening` (branched from 008 HEAD — inherits all execFile patterns, input validators, file decomposition)
**Input**: Scope discovery during 008 implementation — 11 files using `hostExec` wrapper with 76 call sites, 92% requiring shell features (pipes, redirects, backgrounding, inline scripts).

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Eliminate Shell Injection in GSM Evil Subsystem (Priority: P1)

As a security-conscious operator deploying Argos in a field environment, I need the GSM Evil subsystem's system commands to execute through safe, injection-resistant methods so that no external input can compromise the host system.

**Why this priority**: The GSM Evil subsystem uses `hostExec()` (a pass-through to shell execution) for 76 call sites across 11 files. Unlike the 19 files in 008 which mostly use simple single-command calls, these files use shell scripting patterns — pipes, redirects, background processes, inline Python — that require structural refactoring, not mechanical replacement.

**Independent Test**: Can be tested by running security tests + verifying zero `hostExec` imports remain + zero unsafe shell execution patterns remain in GSM Evil files.

**Acceptance Scenarios**:

1. **Given** a GSM Evil service file uses piped shell commands (e.g., `ps aux` piped to `grep`), **When** migrated, **Then** the pipe chain is replaced with a single `execFileAsync` call plus JavaScript string parsing
2. **Given** a GSM Evil service uses `|| true` or `; true` for error suppression, **When** migrated, **Then** the pattern is replaced with try/catch around `execFileAsync`
3. **Given** a GSM Evil service backgrounds a process with `nohup cmd &`, **When** migrated, **Then** it uses `spawn()` with `{detached: true}` and `child.unref()`
4. **Given** a GSM Evil service runs inline Python via `python3 -c '...'`, **When** migrated, **Then** the Python logic is either extracted to a standalone script file or replaced with Node.js equivalents (e.g., better-sqlite3 for DB checks)
5. **Given** all migrations are complete, **When** `grep -r "hostExec\|legacyShellExec" src/` runs, **Then** zero matches are returned

---

### Edge Cases

- What happens when `pgrep` finds no matching process? The safe execution method throws with exit code 1; catch and return empty string (same as current `|| true` behavior)
- What happens when `tcpdump` output needs line counting? Run execFileAsync with timeout, count lines in JS via `stdout.split('\n').length`
- What happens when `ps aux | grep X | grep -v grep` is replaced? Use `pgrep -f` directly — eliminates the grep chain entirely
- What happens when backgrounded processes need PID capture? `spawn()` returns `child.pid` directly — no need for shell PID capture
- What happens when inline Python checks SQLite? Replace with `better-sqlite3` calls (already a project dependency) or extract to a `.py` script file called via execFileAsync

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: All 76 `hostExec()` call sites across 11 files MUST be replaced with safe argument-array-based execution
- **FR-002**: All piped command chains MUST be restructured into single-command calls with JavaScript post-processing
- **FR-003**: All error suppression patterns (`|| true`, `; true`, `2>/dev/null`) MUST be replaced with try/catch blocks
- **FR-004**: All backgrounded processes MUST use `spawn()` with `{detached: true, stdio: [...]}` and `child.unref()`
- **FR-005**: All inline Python scripts MUST be extracted to standalone files or replaced with Node.js equivalents
- **FR-006**: The `legacyShellExec` shim (created in 008) MUST be deleted after all callers are migrated
- **FR-007**: All existing tests MUST continue to pass after every change
- **FR-008**: Dynamic values (PIDs, frequencies, file paths) MUST be validated using input-sanitizer.ts before passing to execution

### Key Entities

- **Shell-dependent call site**: A `hostExec()` invocation that relies on shell features (pipes, redirects, backgrounding, command chaining) — 70 of 76 total
- **Simple call site**: A `hostExec()` invocation with a single command and no shell features — 6 of 76 total
- **GSM Evil service**: Backend service managing GSM monitoring hardware (grgsm_livemon_headless, GsmEvil.py, tcpdump, tshark)
- **Legacy shim**: `src/lib/server/legacy-shell-exec.ts` — temporary wrapper created during 008, to be deleted in this branch

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Zero files import `hostExec` or `legacyShellExec` — verified by grep
- **SC-002**: Zero unsafe shell execution patterns in GSM Evil or Kismet Extended files — verified by grep
- **SC-003**: All existing tests pass (163+ unit, 36+ security active)
- **SC-004**: Type checking completes with zero errors
- **SC-005**: `legacyShellExec` shim file deleted from codebase

## Assumptions

- Branch 008 has been merged, establishing safe execution patterns and deleting the original `host-exec.ts`
- A `legacyShellExec` shim exists for the 11 files to use during the 008 branch
- The GSM Evil subsystem has no dedicated unit tests — regression relies on TypeScript compilation + integration behavior
- `better-sqlite3` is available as a project dependency for replacing inline Python SQLite checks
- grgsm_livemon_headless, tcpdump, tshark binaries are at standard paths on the target system

## Scope Boundaries

### In Scope

- Migration of 76 `hostExec()` call sites across 11 files
- Restructuring of piped commands, background processes, inline scripts
- Input validation for all dynamic arguments (PIDs, frequencies, file paths, interface names)
- Deletion of `legacyShellExec` shim after migration

### Out of Scope

- No changes to GSM Evil UI components
- No changes to GSM Evil API route signatures or response formats
- No new features or functionality
- No refactoring of GSM Evil architecture beyond exec migration

## Files In Scope

### GSM Evil API Routes (6 files)

| File                                                  | hostExec Calls | Shell Patterns               |
| ----------------------------------------------------- | -------------- | ---------------------------- |
| `src/routes/api/gsm-evil/activity/+server.ts`         | 5              | Pipes, redirects             |
| `src/routes/api/gsm-evil/imsi-data/+server.ts`        | 2              | Shell loops, inline Python   |
| `src/routes/api/gsm-evil/imsi/+server.ts`             | 2              | Shell loops, inline Python   |
| `src/routes/api/gsm-evil/status/+server.ts`           | 5              | Multi-pipe chains            |
| `src/routes/api/gsm-evil/live-frames/+server.ts`      | 1              | Safe (no shell features)     |
| `src/routes/api/gsm-evil/frames/+server.ts`           | 2              | Pipe                         |
| `src/routes/api/gsm-evil/intelligent-scan/+server.ts` | 8              | Pipes, background, redirects |

### GSM Evil Services (4 files)

| File                                                               | hostExec Calls | Shell Patterns                             |
| ------------------------------------------------------------------ | -------------- | ------------------------------------------ |
| `src/lib/server/services/gsm-evil/gsm-evil-control-service.ts`     | 16             | Background, nohup, nested shell, redirects |
| `src/lib/server/services/gsm-evil/gsm-intelligent-scan-service.ts` | 19             | Background, pipes, redirects               |
| `src/lib/server/services/gsm-evil/gsm-scan-service.ts`             | 14             | Pipes, redirects                           |
| `src/lib/server/services/gsm-evil/gsm-evil-health-service.ts`      | 12             | Multi-pipe chains, inline Python           |

### Kismet Extended (1 file)

| File                                                                | hostExec Calls | Shell Patterns                  |
| ------------------------------------------------------------------- | -------------- | ------------------------------- |
| `src/lib/server/services/kismet/kismet-control-service-extended.ts` | 18             | Nested bash -c, redirects, curl |

## Migration Pattern Reference

### Pattern 1: Pipe chains → single call + JS parse

```
BEFORE: ps aux | grep X | grep -v grep | head -1
AFTER:  execFileAsync('/usr/bin/pgrep', ['-af', 'X']) + JS string split
```

### Pattern 2: Error suppression → try/catch

```
BEFORE: pgrep -x kismet 2>/dev/null || true
AFTER:  try { await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']) } catch { /* not running */ }
```

### Pattern 3: Background process → spawn

```
BEFORE: nohup cmd > log 2>&1 & echo $!
AFTER:  const child = spawn(cmd, args, {detached:true, stdio:[...]}); child.unref(); return child.pid
```

### Pattern 4: Inline Python → Node.js or script file

```
BEFORE: python3 -c "import sqlite3; ..."
AFTER:  import Database from 'better-sqlite3'; const db = new Database(path); ...
```

### Pattern 5: Redirects → execFile options

```
BEFORE: cmd 2>/dev/null
AFTER:  try { await execFileAsync(cmd, args) } catch { /* ignore stderr */ }
```

---

## Carryover from 008 Code Review

The following Important and Suggestion-level findings from the 008-codebase-hardening code review are included in 009 scope:

### Important (I-level)

- **I1**: Files still >300 lines after decomposition — DashboardMap (915), TopStatusBar (794), sweep-manager (634), DevicesPanel (937). Tier 2 decomposition candidates if feasible.
- **I2**: Missing Zod validation in `src/routes/api/docker/[...path]/+server.ts` — raw `params.path` used without schema validation.
- **I3**: `lsof -i :2501` port validation in kismet-control-service.ts — port number should be validated with `validateNumericParam` before interpolation.

### Suggestions (S-level)

- **S1**: WeatherDropdown calls `fetchWeatherData()` and `fetchGpsData()` twice on mount (once in setup, once via interval).
- **S2**: Missing JSDoc on `HealthCheckContext` interface in sweep-health-checker.ts.
- **S3**: `cat` usage in serial-detector.ts — should use `readFile` instead of `execFileAsync('/usr/bin/cat', ...)`.
- **S4**: `setTimeout` hack in map-setup.ts for MapLibre layer initialization.
- **S5**: `sudo` usage in service-manager.ts undocumented — needs deployment note about sudoers config.
