export type { AttackMode } from '$lib/types/wifite';
import type { AttackMode } from '$lib/types/wifite';

export interface WifiteTarget {
	bssid: string;
	essid: string;
	channel: number;
	encryption: string;
	power: number;
	clients: number;
}

export interface WifiteConfig {
	targets: string[]; // BSSIDs
	channels: number[]; // Channels of the selected targets
	timeout: number;
	attackMode: AttackMode;
}

export interface WifiteResult {
	target: string;
	attackType: string;
	success: boolean;
	handshakePath: string | null;
	pmkid: string | null;
	timestamp: string;
}

export interface WifiteLastRun {
	exitCode: number | null;
	startedAt: string;
	finishedAt: string;
	attackMode: AttackMode;
	targets: string[];
	results: WifiteResult[];
	output: string[];
}

export interface WifiteStatus {
	running: boolean;
	currentTarget: string | null;
	progress: string;
	results: WifiteResult[];
	lastRun: WifiteLastRun | null;
}
