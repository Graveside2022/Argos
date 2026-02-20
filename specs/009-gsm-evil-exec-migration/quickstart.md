# Quickstart: 009-gsm-evil-exec-migration

## Integration Scenarios

### Scenario 1: Verify No Shell Execution Remains

After migration, confirm zero `legacyShellExec` usage:

```bash
# Must return zero matches
grep -r "legacyShellExec" src/ --include="*.ts"

# Must return zero matches (legacy-shell-exec.ts should be deleted)
grep -r "promisify(exec)" src/ --include="*.ts"

# Only execFile and spawn should remain
grep -r "from 'child_process'" src/ --include="*.ts" | grep -v "execFile\|spawn"
# Expected: zero matches
```

### Scenario 2: GSM Evil Scanning Flow

Test the full GSM Evil scanning lifecycle:

1. **Start scan**: POST `/api/gsm-evil/intelligent-scan` — should start `grgsm_livemon_headless` via `spawn()` (not shell)
2. **Check status**: GET `/api/gsm-evil/status` — should return process status via `pgrep`/`ps` (execFile)
3. **Get frames**: GET `/api/gsm-evil/frames` — should read log file via `fs.readFile` (not shell tail/grep)
4. **Get IMSI data**: GET `/api/gsm-evil/imsi-data` — should query via `better-sqlite3` (not Python subprocess)
5. **Stop scan**: DELETE `/api/gsm-evil/intelligent-scan` — should kill via `execFile('sudo', ['kill', pid])` (not shell)

### Scenario 3: Kismet Extended Service

Test Kismet start/stop lifecycle:

1. **Start**: Should use `spawn()` with `{detached: true}` for `kismet` daemonization
2. **Auth**: Should use `fetch()` for Kismet REST API session creation (not curl subprocess)
3. **Status check**: Should use `execFileAsync('pgrep', ...)` (not shell pgrep with `|| true`)
4. **Stop**: Should use `execFileAsync('sudo', ['systemctl', 'stop', 'kismet'])` (not shell)

### Scenario 4: Background Process PID Management

Verify spawn()-based PID capture works:

```typescript
// Expected pattern in gsm-evil-control-service.ts
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
	{ detached: true, stdio: ['ignore', logFd, logFd] }
);
child.unref();
// child.pid should be valid positive integer
```

### Scenario 5: IMSI Database Query

Verify better-sqlite3 replaces inline Python:

```typescript
// Expected pattern in gsm-evil-health-service.ts
import Database from 'better-sqlite3';
const db = new Database(dbPath, { readonly: true });
const row = db
	.prepare(
		"SELECT COUNT(*) as count FROM imsi_data WHERE datetime(date_time) > datetime('now', '-10 minutes')"
	)
	.get() as { count: number };
db.close();
```

## Verification Commands

```bash
# Full verification suite (run after each file migration)
npm run typecheck          # 0 errors
npm run build              # success
npm run test:unit          # 163+ pass
npm run test:security      # 36+ pass

# Security-specific checks
grep -rn "legacyShellExec" src/  # decreasing count after each task
grep -rn "promisify(exec)" src/  # only legacy-shell-exec.ts until final deletion
```
