# GSM Evil tshark Orphan Cleanup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate orphaned tshark processes that accumulate when GsmEvil2 starts/stops, leaking ~1 GB RAM each on the RPi 5.

**Architecture:** Add tshark to all GSM Evil kill/cleanup paths. The existing `pkill -f GsmEvil` and `pkill -f grgsm_livemon_headless` patterns already handle their targets — we add a parallel `pkill -f 'tshark.*4729'` to catch pyshark-spawned tshark processes listening on GSMTAP port 4729. No new files; surgical edits to two existing helpers files.

**Tech Stack:** TypeScript, Node.js child_process (execFileAsync), existing gsm-evil service layer

---

## Root Cause Summary

```
spawnGsmEvil2() → setsid + detached + unref()
  → GsmEvil_auto.py → pyshark.LiveCapture()
    → tshark -l -n -T pdml -i -     ← ORPHANED when GsmEvil exits
```

pyshark spawns tshark as a subprocess. When GsmEvil2 crashes or is killed, tshark survives because `setsid` gave it a new process session. The existing cleanup functions (`killExistingGsmProcesses`, `gracefulStopGsmProcesses`, `forceKillGsmProcesses`) only target `GsmEvil` and `grgsm_livemon_headless` — they never touch tshark.

## Kill Pattern Choice

We use `pkill -f 'tshark.*4729'` (matching tshark processes filtering on GSMTAP port 4729) rather than `pkill -f 'tshark.*pdml'` because:

1. The scan module (`gsm-scan-capture.ts`) spawns its own tshark with `-T fields` on port 4729 — those should also be cleaned up on stop
2. The monitor service (`gsm-monitor-service.ts`) manages its own tshark lifecycle separately — but its processes also filter on port 4729 and should be caught on full stop
3. Port 4729 is the GSMTAP port — any tshark listening on it belongs to GSM Evil

---

### Task 1: Add tshark cleanup to `killExistingGsmProcesses` (start path)

**Files:**

- Modify: `src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts:42-55`

**Step 1: Read the current function**

Verify `killExistingGsmProcesses()` at lines 42-55 still matches expected shape.

**Step 2: Add tshark pkill after the GsmEvil pkill**

Insert a third try/catch block after the existing GsmEvil pkill (line 53):

```typescript
/** Kill any running grgsm_livemon_headless, GsmEvil, and orphaned tshark processes */
export async function killExistingGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'grgsm_livemon_headless']);
	} catch {
		/* no match is fine */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
	} catch {
		/* no match is fine */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'tshark.*4729']);
	} catch {
		/* no match is fine */
	}
	await delay(1000);
}
```

**Step 3: Verify the edit**

Run: `grep -n 'tshark.*4729' src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts`
Expected: One match in the new try/catch block.

**Step 4: Commit**

```bash
git add src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts
git commit -m "fix(gsm-evil): kill orphaned tshark processes on GSM Evil start"
```

---

### Task 2: Add tshark cleanup to `gracefulStopGsmProcesses` (stop path)

**Files:**

- Modify: `src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts:17-38`

**Step 1: Read the current function**

Verify `gracefulStopGsmProcesses()` at lines 17-38 still matches expected shape.

**Step 2: Add tshark pkill after the GsmEvil pkill**

Insert a third try/catch block after the GsmEvil pkill (after line 29), before the fuser kill:

```typescript
/** Gracefully kill GSM Evil processes, orphaned tshark, and free port 8080 */
export async function gracefulStopGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'grgsm_livemon_headless']);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: pkill grgsm_livemon_headless failed', {
			error: String(error)
		});
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'GsmEvil']);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: pkill GsmEvil failed', { error: String(error) });
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-f', 'tshark.*4729']);
	} catch {
		/* no match is fine — tshark may not be running */
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/fuser', '-k', '8080/tcp']);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: fuser kill port 8080 failed', {
			error: String(error)
		});
	}
	await delay(1000);
}
```

**Step 3: Verify the edit**

Run: `grep -n 'tshark.*4729' src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts`
Expected: One match in the new try/catch block.

**Step 4: Commit**

```bash
git add src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts
git commit -m "fix(gsm-evil): kill orphaned tshark processes on GSM Evil stop"
```

---

### Task 3: Add tshark to `forceKillGsmProcesses` (nuclear stop path)

**Files:**

- Modify: `src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts:48-70`

**Step 1: Read the current function**

Verify `forceKillGsmProcesses()` at lines 48-70.

**Step 2: Add SIGKILL tshark cleanup after the GsmEvil force-kill**

```typescript
/** Force-kill remaining GSM Evil processes and orphaned tshark with SIGKILL */
export async function forceKillGsmProcesses(): Promise<void> {
	try {
		await execFileAsync('/usr/bin/sudo', [
			'/usr/bin/pkill',
			'-9',
			'-f',
			'grgsm_livemon_headless'
		]);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: pkill -9 grgsm_livemon_headless failed', {
			error: String(error)
		});
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-9', '-f', 'GsmEvil']);
	} catch (error: unknown) {
		logger.warn('[gsm-evil] Cleanup: pkill -9 GsmEvil failed', {
			error: String(error)
		});
	}
	try {
		await execFileAsync('/usr/bin/sudo', ['/usr/bin/pkill', '-9', '-f', 'tshark.*4729']);
	} catch {
		/* no match is fine */
	}
	await delay(500);
}
```

**Step 3: Verify the edit**

Run: `grep -n 'tshark.*4729' src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts`
Expected: Two matches (graceful + force-kill).

**Step 4: Commit**

```bash
git add src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts
git commit -m "fix(gsm-evil): force-kill orphaned tshark on nuclear stop"
```

---

### Task 4: Add tshark to `findActiveGsmProcesses` and `checkRemainingGsmProcesses` (detection)

**Files:**

- Modify: `src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts:58-63`
- Modify: `src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts:41-46`

**Step 1: Update `findActiveGsmProcesses` pgrep pattern**

Change line 60 from:

```typescript
execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon|GsmEvil']);
```

To:

```typescript
execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon|GsmEvil|tshark.*4729']);
```

**Step 2: Update `checkRemainingGsmProcesses` pgrep pattern**

In `gsm-evil-stop-helpers.ts` line 43, change from:

```typescript
execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless|GsmEvil']);
```

To:

```typescript
execFileAsync('/usr/bin/pgrep', ['-f', 'grgsm_livemon_headless|GsmEvil|tshark.*4729']);
```

**Step 3: Verify both edits**

Run: `grep -rn 'tshark.*4729' src/lib/server/services/gsm-evil/`
Expected: 4 matches total (2 in control-helpers, 2 in stop-helpers).

**Step 4: Commit**

```bash
git add src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts
git commit -m "fix(gsm-evil): detect orphaned tshark in process health checks"
```

---

### Task 5: Build verification

**Step 1: Type check**

Run: `npx tsc --noEmit src/lib/server/services/gsm-evil/gsm-evil-control-helpers.ts src/lib/server/services/gsm-evil/gsm-evil-stop-helpers.ts`

**Step 2: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 3: Final commit (squash if preferred)**

All changes should already be committed from Tasks 1-4. Verify with `git log --oneline -4`.

---

## Verification Checklist

After implementation, manually verify:

1. Start GSM Evil via the dashboard → confirm tshark spawns
2. Stop GSM Evil via the dashboard → confirm tshark is killed (run `ps aux | grep tshark`)
3. Start GSM Evil, then kill GsmEvil_auto.py manually (`sudo pkill -f GsmEvil`) → restart GSM Evil → confirm old tshark is cleaned up on the new start
4. Nuclear stop → confirm no tshark processes remain

## Future Improvements (out of scope)

- Track spawned PIDs in a process registry for deterministic cleanup
- Add a periodic watchdog that detects orphaned tshark processes
- Replace pyshark in GsmEvil2 with direct tshark subprocess management (upstream change)
- Add `--only-summaries` to pyshark LiveCapture to use PSML instead of PDML (lighter)
