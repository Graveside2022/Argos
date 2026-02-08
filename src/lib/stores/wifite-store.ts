import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { AttackMode } from '$lib/types/wifite';

interface WifiteTarget {
	bssid: string;
	essid: string;
	channel: number;
	encryption: string;
	power: number;
	clients: number;
}

interface WifiteResult {
	target: string;
	attackType: string;
	success: boolean;
	handshakePath: string | null;
	pmkid: string | null;
	timestamp: string;
}

interface WifiteLastRun {
	exitCode: number | null;
	startedAt: string;
	finishedAt: string;
	attackMode: string;
	targets: string[];
	results: WifiteResult[];
	output: string[];
}

interface WifiteState {
	targets: WifiteTarget[];
	selectedTargets: string[];
	running: boolean;
	currentTarget: string | null;
	progress: string;
	results: WifiteResult[];
	output: string[];
	attackMode: AttackMode;
	lastError: string | null;
	lastRun: WifiteLastRun | null;
}

const defaultState: WifiteState = {
	targets: [],
	selectedTargets: [],
	running: false,
	currentTarget: null,
	progress: '',
	results: [],
	output: [],
	attackMode: 'auto',
	lastError: null,
	lastRun: null
};

export const wifiteState = writable<WifiteState>(defaultState);
export const wifiteRunning = derived(wifiteState, ($s) => $s.running);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchTargets(): Promise<void> {
	try {
		const res = await fetch('/api/wifite/targets');
		if (res.ok) {
			const data = await res.json();
			wifiteState.update((s) => ({ ...s, targets: data.targets }));
		}
	} catch (_error: unknown) {
		/* ignore */
	}
}

async function fetchStatus(): Promise<void> {
	try {
		const res = await fetch('/api/wifite/status');
		if (res.ok) {
			const data = await res.json();
			wifiteState.update((s) => ({
				...s,
				running: data.running,
				currentTarget: data.currentTarget,
				progress: data.progress,
				results: data.results,
				output: data.output || [],
				lastError: data.lastError || null,
				lastRun: data.lastRun || s.lastRun
			}));
		}
	} catch (_error: unknown) {
		/* ignore */
	}
}

export function startWifitePolling(): void {
	if (!browser || pollInterval) return;
	fetchTargets();
	fetchStatus();
	pollInterval = setInterval(() => {
		fetchStatus();
		fetchTargets();
	}, 5000);
}

export function stopWifitePolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export function selectTarget(bssid: string): void {
	wifiteState.update((s) => {
		const selected = s.selectedTargets.includes(bssid)
			? s.selectedTargets.filter((b) => b !== bssid)
			: [...s.selectedTargets, bssid];
		return { ...s, selectedTargets: selected };
	});
}

export function selectAllTargets(): void {
	wifiteState.update((s) => ({ ...s, selectedTargets: s.targets.map((t) => t.bssid) }));
}

export function deselectAllTargets(): void {
	wifiteState.update((s) => ({ ...s, selectedTargets: [] }));
}

export function setAttackMode(mode: AttackMode): void {
	wifiteState.update((s) => ({ ...s, attackMode: mode }));
}

export function clearError(): void {
	wifiteState.update((s) => ({ ...s, lastError: null }));
}

export function dismissLastRun(): void {
	wifiteState.update((s) => ({ ...s, lastRun: null }));
}

export async function startAttack(
	targets: string[],
	channels: number[],
	attackMode: AttackMode
): Promise<{ success: boolean; error?: string }> {
	try {
		const res = await fetch('/api/wifite/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start', targets, channels, attackMode })
		});
		return await res.json();
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function stopAttack(): Promise<{ success: boolean }> {
	try {
		const res = await fetch('/api/wifite/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stop' })
		});
		return await res.json();
	} catch (_error: unknown) {
		return { success: false };
	}
}
