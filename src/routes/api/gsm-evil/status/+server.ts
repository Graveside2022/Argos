import { createHandler } from '$lib/server/api/create-handler';
import { env } from '$lib/server/env';
import { execFileAsync } from '$lib/server/exec';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import { logger } from '$lib/utils/logger';

/** Extract first non-timeout PID line from pgrep output. */
function extractFirstPidLine(stdout: string, excludePattern?: string): string | undefined {
	return stdout
		.split('\n')
		.filter((line) => line.trim() && (!excludePattern || !line.includes(excludePattern)))
		.at(0);
}

/** Parse PID from pgrep output line. Returns NaN if invalid. */
function parsePidFromLine(line: string): number {
	const parts = line.trim().split(/\s+/);
	return parseInt(parts[0]);
}

/** Check if a process has been running for more than minSeconds. */
async function isLongRunningProcess(pid: number, minSeconds: number): Promise<boolean> {
	const validPid = validateNumericParam(pid, 'pid', 1, 4194304);
	const { stdout: pidTime } = await execFileAsync('/usr/bin/ps', [
		'-o',
		'etimes=',
		'-p',
		String(validPid)
	]);
	const runtime = parseInt(pidTime.trim()) || 0;
	return runtime > minSeconds;
}

/** Verify a PID is a long-running grgsm process. Returns validated PID or null. */
async function verifyGrgsmPid(pid: number): Promise<number | null> {
	try {
		if (await isLongRunningProcess(pid, 10)) {
			return validateNumericParam(pid, 'pid', 1, 4194304);
		}
		return null;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		logger.warn(
			'[GSM-Evil] Runtime check failed for PID',
			{ error: msg, pid },
			'gsm-runtime-check'
		);
		return null;
	}
}

/** Check gr-gsm_livemon process status. */
async function checkGrgsmStatus(): Promise<{
	isRunning: boolean;
	pid: number | null;
	frequency: string;
}> {
	const result = { isRunning: false, pid: null as number | null, frequency: '948.6 MHz' };
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-af', 'grgsm_livemon_headless']);
		const line = extractFirstPidLine(stdout, 'timeout');
		if (!line) return result;

		const pid = parsePidFromLine(line);
		if (isNaN(pid)) return result;

		const validPid = await verifyGrgsmPid(pid);
		if (validPid) {
			result.isRunning = true;
			result.pid = validPid;
		}
	} catch {
		// grgsm process check - expected to fail when not running
	}
	return result;
}

/** Check if GSMEvil2 web interface is accessible. */
async function checkWebInterface(): Promise<boolean> {
	try {
		const resp = await fetch(env.GSM_EVIL_URL, { signal: AbortSignal.timeout(1000) });
		return resp.status === 200;
	} catch {
		return false;
	}
}

/** Check GSMEvil2 Python process status. */
async function checkGsmevilStatus(): Promise<{
	isRunning: boolean;
	pid: number | null;
	webInterface: boolean;
}> {
	const result = { isRunning: false, pid: null as number | null, webInterface: false };
	try {
		const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-af', 'GsmEvil.*\\.py']);
		const line = extractFirstPidLine(stdout);
		if (!line) return result;

		const pid = parsePidFromLine(line);
		if (isNaN(pid)) return result;

		result.isRunning = true;
		result.pid = pid;
		result.webInterface = await checkWebInterface();
	} catch {
		// gsmevil process check - expected to fail when not running
	}
	return result;
}

/** Derive data collection status from component states. */
function deriveDataCollection(
	grgsmRunning: boolean,
	gsmevilRunning: boolean
): { active: boolean; lastActivity: string | null; packetsReceived: number } {
	const active = grgsmRunning && gsmevilRunning;
	return { active, lastActivity: active ? 'Active' : null, packetsReceived: 0 };
}

export const GET = createHandler(async () => {
	const grgsm = await checkGrgsmStatus();
	const gsmevil = await checkGsmevilStatus();
	const dataCollection = deriveDataCollection(grgsm.isRunning, gsmevil.isRunning);
	const overallStatus = grgsm.isRunning && gsmevil.isRunning ? 'running' : 'stopped';

	return {
		status: overallStatus,
		details: { grgsm, gsmevil, dataCollection },
		message:
			overallStatus === 'running'
				? 'GSM Evil is running and monitoring'
				: 'GSM Evil is stopped'
	};
});
