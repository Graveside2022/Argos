/**
 * Shared types for HackRF sweep process management.
 * Extracted to break the circular dependency between process-lifecycle.ts and process-manager.ts.
 */

import type { ChildProcess } from 'child_process';

export interface ProcessState {
	sweepProcess: ChildProcess | null;
	sweepProcessPgid: number | null;
	actualProcessPid: number | null;
	processStartTime: number | null;
}

export interface ProcessConfig {
	detached: boolean;
	stdio: ('pipe' | 'inherit' | 'ignore')[];
	timeout?: number;
	startupTimeoutMs?: number;
}
