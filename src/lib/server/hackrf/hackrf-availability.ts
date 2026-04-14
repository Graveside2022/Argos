import { execFile, type ExecFileException } from 'child_process';

export interface HackrfAvailabilityResult {
	available: boolean;
	reason: string;
	deviceInfo?: string;
}

function classifyHackrfError(error: ExecFileException): HackrfAvailabilityResult {
	const reason =
		error.code === 124 ? 'Device check timeout' : `Device check failed: ${error.message}`;
	return { available: false, reason };
}

function classifyHackrfOutput(stdout: string, stderr: string): HackrfAvailabilityResult {
	if (stderr.includes('Resource busy')) return { available: false, reason: 'Device busy' };
	if (stderr.includes('No HackRF boards found'))
		return { available: false, reason: 'No HackRF found' };
	if (!stdout.includes('Serial number')) return { available: false, reason: 'Unknown error' };
	const deviceInfo = stdout
		.split('\n')
		.filter((line) => line.trim())
		.join(', ');
	return { available: true, reason: 'HackRF detected', deviceInfo };
}

/** Tests HackRF hardware availability by running hackrf_info. */
export function testHackrfAvailability(): Promise<HackrfAvailabilityResult> {
	return new Promise((resolve) => {
		execFile('/usr/bin/timeout', ['3', 'hackrf_info'], (error, stdout, stderr) => {
			resolve(error ? classifyHackrfError(error) : classifyHackrfOutput(stdout, stderr));
		});
	});
}
