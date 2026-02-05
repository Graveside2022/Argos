# Empty Catch Block Fixes - Phase 2 (MEDIUM)

**Duration:** Week 3 (5 working days)
**Fixes:** 18 empty catch blocks in process management and detection
**Risk Level:** MEDIUM - Process state and hardware detection

---

## Overview

Phase 2 addresses medium-priority empty catch blocks in:

- Process managers (companion, hardware)
- Hardware detection (WiFi adapters)
- Database path resolution (GSM Evil)
- Script management (Kismet)

**Pattern:** Follow Phase 1 approach - add logging, preserve behavior, enable debugging.

---

## Git Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout fix/empty-catch-blocks
git tag phase-2-start
```

---

## Category 1: Companion Process Manager (3 fixes)

### File: `src/lib/server/companion/launcher.ts`

**Fixes Overview:**

- Line 94: Process termination verification
- Line 102: pkill fallback
- Line 146: Status check

**Common Pattern:**

```typescript
// BEFORE
} catch { // Process might not exist }

// AFTER
} catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log[Level]('[Operation] failed', {
        error: errorMsg,
        timestamp: Date.now(),
        operation: 'companion.[operation]',
        impact: '[Impact description]',
        fallback: '[Fallback used]'
    });
}
```

#### Fix 1: Process Termination (Line 94)

**Fixed Code:**

```typescript
try {
	process.kill(companionPid, 'SIGTERM');
	logInfo('Companion process termination signal sent', {
		timestamp: Date.now(),
		operation: 'companion.stop',
		pid: companionPid,
		signal: 'SIGTERM'
	});
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('Companion process termination failed (may already be stopped)', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'companion.stop',
		pid: companionPid,
		impact: 'Process may already be dead',
		fallback: 'Will try pkill as backup',
		nextStep: 'Attempting pkill -f companion'
	});
}
```

**Verification:**

```bash
# Start companion service
# ... then kill manually
kill [PID]
# Attempt stop via API
# Check logs for "may already be stopped"
```

#### Fix 2: pkill Fallback (Line 102)

**Fixed Code:**

```typescript
try {
	await execAsync('pkill -f companion');
	logInfo('Companion pkill successful', {
		timestamp: Date.now(),
		operation: 'companion.stop',
		method: 'pkill'
	});
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('Companion pkill failed (no matching processes)', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'companion.stop',
		method: 'pkill -f companion',
		impact: 'Companion process cleanup unverified',
		recovery: 'Check: ps aux | grep companion',
		note: 'This may be normal if process already stopped'
	});
}
```

#### Fix 3: Status Check (Line 146)

**Fixed Code:**

```typescript
try {
	const { stdout } = await execAsync('pgrep -f companion');
	const pid = parseInt(stdout.trim());
	return { running: true, pid };
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logInfo('Companion process not found (service stopped)', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'companion.status',
		method: 'pgrep',
		result: 'not-running'
	});
	return { running: false, pid: null };
}
```

**Commit:**

```bash
git add src/lib/server/companion/launcher.ts
git commit -m "fix: add logging for companion process management

- Log process termination attempts with fallback chain
- Track pkill fallback usage
- Log status checks for monitoring

Impact: Companion process state fully visible
Fallback Chain: SIGTERM → pkill → verification"
git tag phase-2-fix-1-3-complete
```

---

## Category 2: Hardware Managers (5 fixes)

### File: `src/lib/server/hardware/alfaManager.ts`

**Fixes:**

- Line 34: ALFA process termination
- Line 46: ALFA process verification

**Pattern:** Same as companion manager above

**Fixed Code Template:**

```typescript
try {
	await this.stopAlfaProcess();
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('ALFA process stop failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'alfa.stop',
		device: 'ALFA WiFi Adapter',
		impact: 'Process may still be running',
		recovery: 'Check: ps aux | grep alfa',
		diagnostics: {
			checkProcess: 'pgrep -f alfa',
			checkInterface: 'iwconfig',
			forceKill: 'pkill -9 -f alfa'
		}
	});
}
```

### File: `src/lib/server/hardware/hackrfManager.ts`

**Fixes:**

- Line 56: HackRF process termination
- Line 68: Process verification
- Line 103: Docker container stop

**Docker Container Fix (Line 103):**

```typescript
try {
	await execAsync('docker stop hackrf-container');
	logInfo('HackRF Docker container stopped', {
		timestamp: Date.now(),
		operation: 'hackrf.docker.stop',
		container: 'hackrf-container'
	});
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('HackRF Docker container stop failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'hackrf.docker.stop',
		container: 'hackrf-container',
		impact: 'Container may not be running',
		recovery: 'Check: docker ps -a | grep hackrf',
		diagnostics: {
			listContainers: 'docker ps -a',
			inspectContainer: 'docker inspect hackrf-container',
			forceRemove: 'docker rm -f hackrf-container'
		}
	});
}
```

**Commit:**

```bash
git add src/lib/server/hardware/alfaManager.ts src/lib/server/hardware/hackrfManager.ts
git commit -m "fix: add logging for hardware process management

- Log ALFA/HackRF process termination attempts
- Include Docker container management
- Provide diagnostic commands for failures

Impact: Hardware process issues visible
Includes: Process stop, Docker stop, verification"
git tag phase-2-fix-4-8-complete
```

---

## Category 3: WiFi Adapter Detection (4 fixes)

### File: `src/lib/server/kismet/wifi_adapter_detector.ts`

**Fixes:**

- Line 85: MAC address read
- Line 90: Operational state read
- Line 106: USB device check
- Line 174: Monitor mode support detection

**Pattern - File Read Failures:**

```typescript
// Lines 85, 90
try {
	const macAddress = await fs.readFile(`/sys/class/net/${iface}/address`, 'utf-8');
	return macAddress.trim();
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('WiFi adapter MAC address read failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'wifi.getMac',
		interface: iface,
		path: `/sys/class/net/${iface}/address`,
		impact: 'MAC address unavailable for this adapter',
		fallback: 'Will skip this interface',
		recovery: 'Check: ls -la /sys/class/net/'
	});
	return null;
}
```

**USB Device Check (Line 106):**

```typescript
try {
	const { stdout } = await execAsync(`lsusb | grep ${vendorId}`);
	return stdout.includes(vendorId);
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logInfo('USB device check failed (device may not be USB)', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'wifi.checkUsb',
		interface: iface,
		vendorId,
		result: 'not-found',
		note: 'This is normal for built-in WiFi adapters'
	});
	return false;
}
```

**Monitor Mode Check (Line 174):**

```typescript
try {
	const { stdout } = await execAsync(`iw ${iface} info`);
	return stdout.includes('monitor');
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('Monitor mode support check failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'wifi.checkMonitorMode',
		interface: iface,
		impact: 'Cannot determine if monitor mode supported',
		fallback: 'Assume monitor mode not supported',
		recovery: 'Manual check: iw ' + iface + ' info',
		note: 'Interface may not support wireless extensions'
	});
	return false;
}
```

**Commit:**

```bash
git add src/lib/server/kismet/wifi_adapter_detector.ts
git commit -m "fix: add logging for WiFi adapter detection failures

- Log MAC address read failures with sysfs paths
- Log USB device checks (normal for built-in adapters)
- Log monitor mode support detection failures
- Distinguish between errors and expected failures

Impact: WiFi detection issues visible
Note: Built-in adapters failing USB check is normal"
git tag phase-2-fix-9-12-complete
```

---

## Category 4: GSM Database Path Resolution (5 fixes)

### File: `src/lib/server/gsm-database-path.ts`

**Fixes:**

- Line 50: Process directory database check
- Line 54: Process working directory read
- Line 59: Process detection
- Line 69: Path access check
- Line 96: Find command failure

**Pattern - Path Resolution:**

```typescript
// Line 50
try {
	const dbPath = path.join(processDir, 'imsi_data.db');
	await fs.access(dbPath);
	return dbPath;
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logInfo('GSM database not in process directory', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'gsm.findDatabase',
		searchPath: processDir,
		result: 'not-found',
		nextStep: 'Will try alternative locations'
	});
}

// Line 69 - Final path check
try {
	await fs.access(dbPath, fs.constants.R_OK);
	logInfo('GSM database found', {
		timestamp: Date.now(),
		operation: 'gsm.findDatabase',
		path: dbPath,
		result: 'success'
	});
	return dbPath;
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logError('GSM database path inaccessible', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'gsm.findDatabase',
		attemptedPath: dbPath,
		impact: 'IMSI data unavailable',
		recovery: 'Check: ls -la /usr/src/gsmevil2/',
		diagnostics: {
			findDatabase: 'find /usr/src/gsmevil2 -name "imsi_data.db"',
			checkPermissions: 'ls -la ' + dbPath,
			checkProcess: 'ps aux | grep gsmevil'
		}
	});
	return null;
}
```

**Find Command Fallback (Line 96):**

```typescript
try {
	const { stdout } = await execAsync('find /usr/src/gsmevil2 -name "imsi_data.db" -type f');
	const paths = stdout.trim().split('\n').filter(Boolean);

	if (paths.length > 0) {
		logInfo('GSM database found via find command', {
			timestamp: Date.now(),
			operation: 'gsm.findDatabase',
			method: 'find-command',
			path: paths[0],
			alternativePaths: paths.slice(1)
		});
		return paths[0];
	}
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logError('GSM database find command failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'gsm.findDatabase',
		method: 'find-command',
		searchRoot: '/usr/src/gsmevil2',
		impact: 'Cannot locate IMSI database',
		consequence: 'GSM Evil IMSI display unavailable',
		recovery: 'Manually locate: find / -name "imsi_data.db" 2>/dev/null'
	});
}
```

**Commit:**

```bash
git add src/lib/server/gsm-database-path.ts
git commit -m "fix: add comprehensive logging for GSM database path resolution

- Log each path resolution attempt with next steps
- Include find command fallback logging
- Provide manual recovery commands
- Distinguish 'not found' from 'access denied'

Impact: GSM database location issues fully debuggable
Search Chain: process dir → standard paths → find command"
git tag phase-2-fix-13-17-complete
```

---

## Category 5: Kismet Script Management (1 fix)

### File: `src/lib/server/kismet/scriptManager.ts`

**Fixes:**

- Line 40: Executable permission check
- Line 152: Process kill verification

**Fixed Code:**

```typescript
// Line 40
try {
	await fs.access(scriptPath, fs.constants.X_OK);
	return true;
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('Kismet script not executable', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'kismet.checkScript',
		scriptPath,
		impact: 'Script cannot be executed',
		recovery: 'Fix: chmod +x ' + scriptPath,
		note: 'Check script exists: ls -la ' + scriptPath
	});
	return false;
}

// Line 152
try {
	process.kill(pid, 'SIGTERM');
	logInfo('Kismet process terminated', {
		timestamp: Date.now(),
		operation: 'kismet.stop',
		pid,
		signal: 'SIGTERM'
	});
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn('Kismet process termination failed', {
		error: errorMsg,
		timestamp: Date.now(),
		operation: 'kismet.stop',
		pid,
		impact: 'Process may already be stopped',
		recovery: 'Verify: ps aux | grep kismet',
		note: 'This is normal if process already exited'
	});
}
```

**Commit:**

```bash
git add src/lib/server/kismet/scriptManager.ts
git commit -m "fix: add logging for Kismet script management

- Log script executable permission checks
- Log process termination attempts
- Include recovery commands

Impact: Kismet script issues debuggable"
git tag phase-2-fix-18-complete
```

---

## Phase 2 Completion Checklist

```bash
# Verify no empty catch blocks in Phase 2 files
grep -r "} catch {" \
    src/lib/server/companion/ \
    src/lib/server/hardware/alfaManager.ts \
    src/lib/server/hardware/hackrfManager.ts \
    src/lib/server/kismet/wifi_adapter_detector.ts \
    src/lib/server/gsm-database-path.ts \
    src/lib/server/kismet/scriptManager.ts

# Should return: 0 results

# Run verification
npm run typecheck
npm run test
npm run lint

# Git checkpoint
git tag phase-2-complete

# Progress check
git log --oneline phase-2-start..phase-2-complete | wc -l
# Should be approximately 10-15 commits
```

---

## Phase 2 Summary

**Completed:**

- ✅ 18 MEDIUM priority catch blocks fixed
- ✅ Process management fully logged
- ✅ Hardware detection errors visible
- ✅ WiFi adapter detection debuggable
- ✅ GSM database path resolution tracked

**Total Progress: 60/78 fixes (77%)**

**Ready for Phase 3?** See `empty-catch-phase-3.md`
