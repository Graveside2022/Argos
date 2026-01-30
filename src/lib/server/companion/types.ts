import type { HardwareDevice } from '$lib/server/hardware/types';

export interface CompanionApp {
	name: string;
	displayName: string;
	command: string;
	args: string[];
	device: HardwareDevice;
	processPattern: string;
}

export interface CompanionStatus {
	running: boolean;
	pid: number | null;
	startedAt: number | null;
	appName: string;
}
