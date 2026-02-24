/**
 * grgsm_livemon_headless process lifecycle — spawn, verify, and read logs.
 */
import { spawn } from 'child_process';
import { closeSync, openSync } from 'fs';
import { readFile } from 'fs/promises';

import { validateNumericParam } from '$lib/server/security/input-sanitizer';

/** Spawn grgsm_livemon_headless and return its PID */
export function spawnGrgsm(freq: string, gain: number, stderrLog: string): string {
	const gsmArgs = ['grgsm_livemon_headless', '-f', `${freq}M`, '-g', String(gain)];
	const logFd = openSync(stderrLog, 'a');
	const child = spawn('/usr/bin/sudo', gsmArgs, {
		detached: true,
		stdio: ['ignore', logFd, logFd]
	});
	child.unref();
	closeSync(logFd);
	const spawnedPid = child.pid;
	if (!spawnedPid) throw new Error('Failed to start grgsm_livemon_headless');
	const pid = String(spawnedPid);
	validateNumericParam(pid, 'pid', 1, 4194304);
	if (!pid || pid === '0') throw new Error('Failed to start grgsm_livemon_headless');
	return pid;
}

/** Read last N lines from stderr log, or empty string on failure */
export async function readStderrTail(stderrLog: string): Promise<string> {
	try {
		const logContent = await readFile(stderrLog, 'utf-8');
		return logContent.split('\n').slice(-10).join('\n').trim();
	} catch {
		return '';
	}
}

/** Verify grgsm process is still alive; throw with detail if not */
export async function verifyProcessAlive(pid: string, stderrLog: string): Promise<void> {
	try {
		const validPid = validateNumericParam(parseInt(pid), 'pid', 1, 4194304);
		process.kill(validPid, 0);
	} catch {
		const stderrContent = await readStderrTail(stderrLog);
		const errorDetail = stderrContent
			? `grgsm_livemon_headless exited during init. Error: ${stderrContent}`
			: 'grgsm_livemon_headless exited during init with no error output. Check if HackRF is accessible.';
		throw new Error(errorDetail);
	}
}

/** Try to read hex frame lines from the stderr log for analysis */
export async function readFrameHexLines(stderrLog: string): Promise<string[]> {
	const logContent = await readFile(stderrLog, 'utf-8');
	return logContent
		.split('\n')
		.filter((l) => /^\s*[0-9a-f]{2}\s/.test(l))
		.slice(-30);
}
