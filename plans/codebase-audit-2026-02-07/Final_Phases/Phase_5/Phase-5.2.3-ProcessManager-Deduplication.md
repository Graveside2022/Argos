# Phase 5.2.3: ProcessManager Deduplication

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.3-2026-02-08                               |
| Phase         | 5.2 -- Service Layer Refactoring                            |
| Title         | ProcessManager Deduplication via Abstract Base Class        |
| Risk Level    | MEDIUM                                                      |
| Prerequisites | Phase-5.2.2 (BufferManager Deduplication) complete          |
| Files Touched | 3 (1 new, 2 modified)                                       |
| Standards     | CERT POS54-C, NASA/JPL Rule 25, NASA/JPL Rule 31, Barr Ch.9 |
| Audit Date    | 2026-02-08                                                  |

---

## 1. Objective

Extract shared process lifecycle management from both ProcessManager implementations
(~80% identical) into a common base class. This is the highest-similarity pair and
yields the greatest per-subclass reduction. Retain device-specific spawn commands,
availability checks, and cleanup procedures in subclasses.

---

## 2. Current State

| File                  | Absolute Path                                                     | Lines |
| --------------------- | ----------------------------------------------------------------- | ----- |
| HackRF ProcessManager | `src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts` | 413   |
| USRP ProcessManager   | `src/lib/services/usrp/sweep-manager/process/ProcessManager.ts`   | 360   |
| sdiff differing lines | --                                                                | 155   |
| Similarity            | --                                                                | ~80%  |

The ~80% similarity makes this the highest-value extraction target. The base class will
capture the vast majority of the spawn/monitor/cleanup lifecycle, leaving only
device-specific binary names and argument construction in subclasses.

---

## 3. Target File Structure After Refactoring

```
src/lib/services/sdr-common/
    BaseProcessManager.ts   (~200 lines)  -- abstract base class
src/lib/services/hackrf/sweep-manager/process/
    ProcessManager.ts       (~120 lines)  -- HackRF subclass (was 413)
src/lib/services/usrp/sweep-manager/process/
    ProcessManager.ts       (~120 lines)  -- USRP subclass (was 360)
```

---

## 4. Shared vs. Device-Specific Logic

### 4.1 Shared (extracted to BaseProcessManager)

- Child process spawn, monitoring, and cleanup lifecycle
- stdout/stderr stream handling and line splitting
- Process exit code interpretation and error classification
- Graceful shutdown with SIGTERM -> timeout -> SIGKILL escalation
- PID tracking and orphan process detection
- Respawn logic with backoff
- Resource cleanup on destroy

### 4.2 Device-Specific (remains in subclasses)

- `buildSpawnCommand(): SpawnCommand` -- HackRF spawns `hackrf_sweep` with
  frequency range, bin width, and gain arguments. USRP spawns `uhd_rx_cfile`
  or a custom Python wrapper with different argument syntax.
- `processName: string` -- `'hackrf_sweep'` vs `'uhd_rx_cfile'` for process
  identification in `ps` listings during orphan cleanup.
- `testDeviceAvailability(): Promise<boolean>` -- HackRF uses `hackrf_info`,
  USRP uses `uhd_find_devices`. Different binaries, different output parsing.
- `forceCleanupAll(): Promise<void>` -- HackRF kills `hackrf_sweep` and
  `hackrf_transfer` processes. USRP kills `uhd_rx_cfile` and related UHD
  processes. Different process names require different `pkill` patterns.

---

## 5. Abstract Base Class Definition

```typescript
// src/lib/services/sdr-common/BaseProcessManager.ts

import { spawn, type ChildProcess } from 'child_process';

/**
 * Abstract process lifecycle manager for SDR sweep child processes.
 *
 * Manages the full lifecycle of a child process: spawn, monitor,
 * restart, and cleanup. Subclasses provide device-specific spawn
 * commands, availability checks, and cleanup procedures.
 *
 * INVARIANT: At most ONE child process is active at any time.
 *            Calling spawn() while a process is running will first
 *            terminate the existing process via graceful shutdown.
 *
 * INVARIANT: destroy() MUST be called before the parent process
 *            exits. Failure to call destroy() will leak orphan
 *            SDR processes that hold exclusive hardware locks.
 *
 * Conforms to: CERT POS54-C (signal handling), NASA/JPL Rule 25
 *              (resource deallocation), Barr Ch.9 (process safety).
 */
export abstract class BaseProcessManager {
	// ---------------------------------------------------------------
	// Abstract contract
	// ---------------------------------------------------------------

	/**
	 * Build the spawn command for this device's sweep process.
	 * Returns the binary path and argument array.
	 */
	protected abstract buildSpawnCommand(config: SpawnConfig): SpawnCommand;

	/** Process name as it appears in `ps` output, for orphan detection. */
	protected abstract readonly processName: string;

	/**
	 * Test whether the SDR hardware is physically connected and
	 * available. Returns false if the device is absent or in use
	 * by another process.
	 */
	protected abstract testDeviceAvailability(): Promise<boolean>;

	/**
	 * Force-kill ALL processes associated with this device type.
	 * Used during emergency cleanup when graceful shutdown fails.
	 * Must handle the case where no processes exist (no-op).
	 */
	protected abstract forceCleanupAll(): Promise<void>;

	// ---------------------------------------------------------------
	// Shared state
	// ---------------------------------------------------------------

	private childProcess: ChildProcess | null = null;
	private isShuttingDown: boolean = false;
	private respawnCount: number = 0;
	private readonly maxRespawns: number = 5;
	private readonly gracefulTimeoutMs: number = 5000;
	private readonly killTimeoutMs: number = 2000;

	// Callbacks
	private onDataLine: ((line: string) => void) | null = null;
	private onExit: ((code: number | null, signal: string | null) => void) | null = null;
	private onError: ((err: Error) => void) | null = null;

	// ---------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------

	/**
	 * Spawn the SDR sweep process with the given configuration.
	 * If a process is already running, it is terminated first.
	 */
	public async start(config: SpawnConfig, callbacks: ProcessCallbacks): Promise<void> {
		if (this.childProcess !== null) {
			await this.stop();
		}

		this.onDataLine = callbacks.onDataLine;
		this.onExit = callbacks.onExit ?? null;
		this.onError = callbacks.onError ?? null;

		const available = await this.testDeviceAvailability();
		if (!available) {
			throw new Error(
				`${this.processName}: device not available. ` +
					`Check USB connection and ensure no other process holds the device.`
			);
		}

		const cmd = this.buildSpawnCommand(config);
		this.childProcess = spawn(cmd.binary, cmd.args, {
			stdio: ['ignore', 'pipe', 'pipe']
		});

		this.attachStreamHandlers();
		this.attachExitHandler();
	}

	/**
	 * Gracefully stop the running process.
	 * Sends SIGTERM, waits gracefulTimeoutMs, then SIGKILL.
	 */
	public async stop(): Promise<void> {
		if (this.childProcess === null || this.isShuttingDown) return;

		this.isShuttingDown = true;

		try {
			await this.gracefulShutdown();
		} finally {
			this.childProcess = null;
			this.isShuttingDown = false;
		}
	}

	/** Release all resources and kill any running process. */
	public async destroy(): Promise<void> {
		await this.stop();
		await this.forceCleanupAll();
		this.onDataLine = null;
		this.onExit = null;
		this.onError = null;
	}

	/** Returns true if a child process is currently running. */
	public get isRunning(): boolean {
		return this.childProcess !== null && !this.isShuttingDown;
	}

	/** Current PID of the child process, or null if not running. */
	public get pid(): number | null {
		return this.childProcess?.pid ?? null;
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	private attachStreamHandlers(): void {
		const proc = this.childProcess;
		if (!proc || !proc.stdout) return;

		let partial = '';
		proc.stdout.on('data', (chunk: Buffer) => {
			partial += chunk.toString();
			const lines = partial.split('\n');
			partial = lines.pop() ?? '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.length > 0 && this.onDataLine) {
					this.onDataLine(trimmed);
				}
			}
		});

		proc.stderr?.on('data', (chunk: Buffer) => {
			// stderr is logged but not treated as data.
			const msg = chunk.toString().trim();
			if (msg.length > 0 && this.onError) {
				this.onError(new Error(`${this.processName} stderr: ${msg}`));
			}
		});
	}

	private attachExitHandler(): void {
		this.childProcess?.on('exit', (code, signal) => {
			this.childProcess = null;

			if (!this.isShuttingDown && this.onExit) {
				this.onExit(code, signal);
			}
		});
	}

	private async gracefulShutdown(): Promise<void> {
		const proc = this.childProcess;
		if (!proc) return;

		return new Promise<void>((resolve) => {
			const killTimer = setTimeout(() => {
				try {
					proc.kill('SIGKILL');
				} catch {
					/* already dead */
				}
				resolve();
			}, this.gracefulTimeoutMs);

			proc.once('exit', () => {
				clearTimeout(killTimer);
				resolve();
			});

			try {
				proc.kill('SIGTERM');
			} catch {
				/* already dead */
			}
		});
	}
}

export interface SpawnCommand {
	binary: string;
	args: string[];
}

export interface SpawnConfig {
	freqStartHz: number;
	freqEndHz: number;
	binWidthHz?: number;
	gainDb?: number;
	lnaGainDb?: number;
	vgaGainDb?: number;
	sampleRate?: number;
}

export interface ProcessCallbacks {
	onDataLine: (line: string) => void;
	onExit?: (code: number | null, signal: string | null) => void;
	onError?: (err: Error) => void;
}
```

---

## 6. HackRF Subclass Skeleton

After extraction, the HackRF `ProcessManager.ts` retains only:

```typescript
// src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts

import {
	BaseProcessManager,
	type SpawnCommand,
	type SpawnConfig
} from '$lib/services/sdr-common/BaseProcessManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class HackRFProcessManager extends BaseProcessManager {
	protected readonly processName = 'hackrf_sweep';

	protected buildSpawnCommand(config: SpawnConfig): SpawnCommand {
		const args = [
			'-f',
			`${config.freqStartHz}:${config.freqEndHz}`,
			'-w',
			String(config.binWidthHz ?? 100000),
			'-l',
			String(config.lnaGainDb ?? 32),
			'-g',
			String(config.vgaGainDb ?? 20)
		];
		return { binary: 'hackrf_sweep', args };
	}

	protected async testDeviceAvailability(): Promise<boolean> {
		try {
			const { stdout } = await execAsync('hackrf_info');
			return stdout.includes('Serial number');
		} catch {
			return false;
		}
	}

	protected async forceCleanupAll(): Promise<void> {
		try {
			await execAsync('pkill -9 hackrf_sweep');
		} catch {
			/* no process to kill */
		}
		try {
			await execAsync('pkill -9 hackrf_transfer');
		} catch {
			/* no process to kill */
		}
	}
}
```

---

## 7. USRP Subclass Skeleton

```typescript
// src/lib/services/usrp/sweep-manager/process/ProcessManager.ts

import {
	BaseProcessManager,
	type SpawnCommand,
	type SpawnConfig
} from '$lib/services/sdr-common/BaseProcessManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class USRPProcessManager extends BaseProcessManager {
	protected readonly processName = 'uhd_rx_cfile';

	protected buildSpawnCommand(config: SpawnConfig): SpawnCommand {
		const args = [
			'--freq',
			String(config.freqStartHz),
			'--rate',
			String(config.sampleRate ?? 1000000),
			'--gain',
			String(config.gainDb ?? 30)
		];
		return { binary: 'uhd_rx_cfile', args };
	}

	protected async testDeviceAvailability(): Promise<boolean> {
		try {
			const { stdout } = await execAsync('uhd_find_devices');
			return stdout.includes('Device Address');
		} catch {
			return false;
		}
	}

	protected async forceCleanupAll(): Promise<void> {
		try {
			await execAsync('pkill -9 uhd_rx_cfile');
		} catch {
			/* no process to kill */
		}
	}
}
```

---

## 8. Implementation Steps

| Step | Action                                                    | Verification                                                                           |
| ---- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1    | Write `sdr-common/BaseProcessManager.ts` (Section 5)      | `npx tsc --noEmit` on the file                                                         |
| 2    | Refactor HackRF `ProcessManager.ts` to extend base        | `wc -l` target: ~120 lines                                                             |
| 3    | Refactor USRP `ProcessManager.ts` to extend base          | `wc -l` target: ~120 lines                                                             |
| 4    | Verify HackRF-specific spawn args match existing behavior | Manual review of `buildSpawnCommand`                                                   |
| 5    | Verify USRP-specific spawn args match existing behavior   | Manual review of `buildSpawnCommand`                                                   |
| 6    | Verify orphan cleanup covers all device process names     | `grep -rn "pkill\|killall" src/lib/services/*/sweep-manager/process/ --include="*.ts"` |
| 7    | Run type check and lint                                   | `npm run typecheck && npm run lint`                                                    |

---

## 9. Line Count Targets

| File                               | Before  | After    | Reduction |
| ---------------------------------- | ------- | -------- | --------- |
| HackRF `ProcessManager.ts`         | 413     | ~120     | -71%      |
| USRP `ProcessManager.ts`           | 360     | ~120     | -67%      |
| `sdr-common/BaseProcessManager.ts` | 0 (new) | ~200     | N/A       |
| **Net change**                     | **773** | **~440** | **-43%**  |

---

## 10. Verification Commands

```bash
# V1: Confirm new base class exists
ls -la src/lib/services/sdr-common/BaseProcessManager.ts
# Expected: file exists

# V2: Confirm base class line count
wc -l src/lib/services/sdr-common/BaseProcessManager.ts
# Expected: ~200 lines

# V3: Confirm HackRF subclass reduced
wc -l src/lib/services/hackrf/sweep-manager/process/ProcessManager.ts
# Expected: ~120 lines

# V4: Confirm USRP subclass reduced
wc -l src/lib/services/usrp/sweep-manager/process/ProcessManager.ts
# Expected: ~120 lines

# V5: Verify orphan cleanup process names
grep -rn "pkill\|killall" src/lib/services/*/sweep-manager/process/ --include="*.ts"
# Expected: HackRF kills hackrf_sweep + hackrf_transfer; USRP kills uhd_rx_cfile

# V6: Verify SIGTERM->SIGKILL escalation in base class
grep -n "SIGTERM\|SIGKILL" src/lib/services/sdr-common/BaseProcessManager.ts
# Expected: both signals present in gracefulShutdown method

# V7: Verify abstract member count
grep -c "abstract" src/lib/services/sdr-common/BaseProcessManager.ts
# Expected: 4 (buildSpawnCommand, processName, testDeviceAvailability, forceCleanupAll)

# V8: No circular dependencies
npx madge --circular src/lib/services/sdr-common/BaseProcessManager.ts
# Expected: no circular dependencies

# V9: Full type check
npm run typecheck
# Expected: exit 0

# V10: Full lint
npm run lint
# Expected: exit 0
```

---

## 11. Test Specifications

| Module               | Test File                                                   | Test Type | Minimum Tests |
| -------------------- | ----------------------------------------------------------- | --------- | ------------- |
| `BaseProcessManager` | `tests/unit/services/sdr-common/BaseProcessManager.test.ts` | Unit      | 6             |

**Required test cases:**

1. Spawn lifecycle: start() spawns process, stop() terminates it
2. SIGTERM->SIGKILL escalation: SIGTERM sent first, SIGKILL after timeout
3. Orphan detection: isRunning returns false after process exits
4. destroy() cleanup: all callbacks nulled, process killed
5. Error emission: stderr output routed to onError callback
6. Restart behavior: start() while running calls stop() first

**Minimum coverage threshold**: 80% line coverage for lifecycle logic.

---

## 12. Risk Assessment

| Risk                                            | Severity | Mitigation                                                             |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| Spawn argument order changes break device ops   | HIGH     | Manual review of buildSpawnCommand output vs existing spawn calls      |
| SIGKILL escalation timing changes               | MEDIUM   | gracefulTimeoutMs preserved at 5000ms (same as both originals)         |
| Orphan cleanup misses device-specific processes | MEDIUM   | Subclass forceCleanupAll explicitly lists ALL process names per device |
| ErrorTracker/FrequencyCycler import paths break | LOW      | ProcessManager file paths unchanged; only class inheritance changes    |

---

## 13. Standards Compliance

| Standard         | Requirement            | How This Task Complies                                       |
| ---------------- | ---------------------- | ------------------------------------------------------------ |
| CERT POS54-C     | Proper signal handling | SIGTERM->timeout->SIGKILL escalation pattern                 |
| NASA/JPL Rule 25 | Resource deallocation  | destroy() calls stop() + forceCleanupAll() + nulls callbacks |
| NASA/JPL Rule 31 | Single responsibility  | Base: lifecycle. Subclass: device-specific spawn/cleanup     |
| Barr Ch.9        | Process safety         | At-most-one process invariant enforced in start()            |

---

## 14. Rollback Strategy

This task produces one atomic Git commit. Rollback:

```bash
git revert <commit-hash>
```

The revert restores both `ProcessManager.ts` files to their pre-refactoring state and
removes `BaseProcessManager.ts`. The `sdr-common/types.ts` and `BaseSdrApi.ts` from
prior tasks are NOT affected. The `BaseBufferManager.ts` from Task 5.2.2 is NOT affected.

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |
