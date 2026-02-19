# Research: 009-gsm-evil-exec-migration

**Date**: 2026-02-19
**Purpose**: Resolve all unknowns from technical context before planning

## R1: Actual Call Site Count and Distribution

**Decision**: 91 legacyShellExec call sites across 12 files (not 76 across 11)

**Findings**:
| File Category | Files | Call Sites |
|---|---|---|
| GSM Evil Services | 4 | 55 |
| GSM Evil API Routes | 7 | 20 |
| Kismet Extended | 1 | 16 |
| **Total** | **12** | **91** |

**Rationale**: Deep audit with line-by-line reading of all 12 files. The original spec counted `hostExec` imports, not individual call sites. Several files have duplicate patterns (e.g., 6x `pgrep -x kismet || true` in kismet-control-service-extended.ts).

## R2: Shell Pattern Categories

**Decision**: Five migration patterns cover all 91 call sites

| Pattern                                         | Count | Complexity | Migration Strategy                         |
| ----------------------------------------------- | ----- | ---------- | ------------------------------------------ |
| Error suppression (`cmd 2>/dev/null \|\| true`) | ~40   | LOW        | `execFileAsync()` + try/catch              |
| Pipe chains (`cmd1 \| cmd2 \| cmd3`)            | ~20   | MEDIUM     | Single `execFileAsync()` + JS string parse |
| Background + PID capture (`cmd & echo $!`)      | 5     | HIGH       | `spawn()` with `{detached: true}` + `.pid` |
| Inline Python (`python3 -c '...'`)              | 4     | HIGH       | `better-sqlite3` or extracted `.py` script |
| Complex shell (`bash -c`, `cd &&`, `sed -i`)    | 3     | HIGH       | Structural rewrite (spawn/fs operations)   |

**Alternatives considered**:

- `shell: true` option on execFile — rejected, defeats purpose of migration
- Keeping some patterns with legacyShellExec — rejected, goal is zero shell exec

## R3: Security Gaps Found During Audit

**Decision**: 5 unvalidated dynamic values discovered that need fixing during migration

| File                               | Line | Variable        | Risk                                 | Fix                           |
| ---------------------------------- | ---- | --------------- | ------------------------------------ | ----------------------------- |
| status/+server.ts                  | 42   | `${pid}`        | HIGH — parsed from ps, no validation | Add `validateNumericParam()`  |
| intelligent-scan/+server.ts        | 73   | `${freq}`       | HIGH — from hackrf_sweep output      | Add `validateNumericParam()`  |
| activity/+server.ts                | 43   | `${imsiDbPath}` | MEDIUM — env-derived path            | Validate against allowlist    |
| kismet-control-service-extended.ts | 86   | `alfaInterface` | MEDIUM — from sysfs listing          | Add `validateInterfaceName()` |
| kismet-control-service-extended.ts | 132  | credentials     | MEDIUM — env vars in shell           | Replace curl with fetch()     |

**Rationale**: These represent real injection surfaces — values come from external command output or environment, not from validated user input.

## R4: Node.js Replacements for Shell Patterns

**Decision**: Several shell commands can be replaced entirely with Node.js APIs

| Shell Command                      | Node.js Replacement                               |
| ---------------------------------- | ------------------------------------------------- |
| `ls /sys/class/net/`               | `fs.readdirSync('/sys/class/net/')`               |
| `test -d /path`                    | `fs.statSync(path)` in try/catch                  |
| `cat /path`                        | `fs.readFileSync(path)`                           |
| `wc -l < /path`                    | `readFile(path).split('\n').length`               |
| `find /path -mmin -5`              | `fs.statSync(path).mtime` comparison              |
| `curl -s URL`                      | `fetch(url, { signal: AbortSignal.timeout(ms) })` |
| `for p in paths; do test -f; done` | `for (const p of paths) if (fs.existsSync(p))`    |
| `kill -0 ${pid}`                   | `process.kill(pid, 0)`                            |
| `python3 -c "sqlite3..."`          | `better-sqlite3` direct query                     |

**Rationale**: Node.js APIs are faster (no process spawn), safer (no shell), and more testable.

## R5: Carryover Items Resolution

**Decision**: Of 8 carryover items from 008 code review, 4 are actionable

| Item                             | Status   | Action                                                           |
| -------------------------------- | -------- | ---------------------------------------------------------------- |
| I1: Files >300 lines             | DEFERRED | Tier 2 decomposition is out of scope for 009                     |
| I2: Docker route Zod             | RESOLVED | File `src/routes/api/docker/[...path]/+server.ts` does not exist |
| I3: lsof port validation         | IN SCOPE | Fix during kismet-control-service-extended.ts migration          |
| S1: WeatherDropdown double-fetch | RESOLVED | Audit shows correct Svelte 5 rune pattern, no issue              |
| S2: HealthCheckContext JSDoc     | DEFERRED | Documentation task, out of scope for security migration          |
| S3: cat in serial-detector       | RESOLVED | Already uses execFileAsync (compliant), not legacyShellExec      |
| S4: map-setup setTimeout         | IN SCOPE | Low-effort fix (replace with MapLibre load event)                |
| S5: sudo documentation           | IN SCOPE | Add sudoers config note to deployment docs                       |

## R6: Background Process Management with spawn()

**Decision**: Use `child_process.spawn()` with `{detached: true, stdio: [...]}` + `child.unref()`

**Pattern**:

```typescript
import { spawn } from 'child_process';
import { openSync } from 'fs';

const logFd = openSync('/tmp/process.log', 'a');
const child = spawn(
	'/usr/bin/sudo',
	[
		'grgsm_livemon_headless',
		'-f',
		`${freq}M`,
		'-g',
		'40',
		'--collector',
		'localhost',
		'--collectorport',
		'4729'
	],
	{
		detached: true,
		stdio: ['ignore', logFd, logFd]
	}
);
child.unref();
const pid = child.pid;
```

**Alternatives considered**:

- systemd transient units (`systemd-run`) — more robust but adds dependency
- `nohup` via execFile — still needs shell for `&` and `echo $!`

**Rationale**: `spawn()` gives direct PID access, file descriptor-based log redirection, and proper process detachment without shell interpretation.

## R7: Inline Python → better-sqlite3 Migration

**Decision**: Replace all 4 inline Python SQL calls with `better-sqlite3`

**Current pattern** (gsm-evil-health-service.ts):

```bash
python3 -c "import sqlite3; conn = sqlite3.connect('${dbPath}'); cursor = conn.cursor(); cursor.execute('SELECT COUNT(*) FROM imsi_data WHERE datetime(date_time) > datetime(\"now\", \"-10 minutes\")'); print(cursor.fetchone()[0]); conn.close()"
```

**Replacement pattern**:

```typescript
import Database from 'better-sqlite3';
const db = new Database(dbPath, { readonly: true });
const row = db
	.prepare(
		"SELECT COUNT(*) as count FROM imsi_data WHERE datetime(date_time) > datetime('now', '-10 minutes')"
	)
	.get() as { count: number };
db.close();
return row.count;
```

**Rationale**: better-sqlite3 is already a project dependency, eliminates shell/Python subprocess overhead, uses parameterized queries (no SQL injection), and is type-safe with TypeScript.
