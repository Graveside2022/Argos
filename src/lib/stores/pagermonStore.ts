import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

interface PagerMessage {
	timestamp: string;
	capcode: string;
	content: string;
	functionType: number;
	bitrate: number;
}

interface PagermonState {
	running: boolean;
	frequency: number;
	messages: PagerMessage[];
	messageCount: number;
}

const defaultState: PagermonState = {
	running: false,
	frequency: 152000000,
	messages: [],
	messageCount: 0
};

export const pagermonState = writable<PagermonState>(defaultState);
export const pagermonRunning = derived(pagermonState, ($s) => $s.running);

let pollInterval: ReturnType<typeof setInterval> | null = null;

async function fetchStatus(): Promise<void> {
	try {
		const res = await fetch('/api/pagermon/status');
		if (res.ok) {
			const data = await res.json();
			pagermonState.update((s) => ({
				...s,
				running: data.running,
				frequency: data.frequency,
				messageCount: data.messageCount
			}));
		}
	} catch {
		/* ignore */
	}
}

async function fetchMessages(): Promise<void> {
	try {
		const res = await fetch('/api/pagermon/messages');
		if (res.ok) {
			const data = await res.json();
			pagermonState.update((s) => ({ ...s, messages: data.messages }));
		}
	} catch {
		/* ignore */
	}
}

export function startPagermonPolling(): void {
	if (!browser || pollInterval) return;
	fetchStatus();
	fetchMessages();
	pollInterval = setInterval(() => {
		fetchStatus();
		fetchMessages();
	}, 3000);
}

export function stopPagermonPolling(): void {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

export async function startPagermon(
	frequency?: number
): Promise<{ success: boolean; error?: string }> {
	try {
		const body: Record<string, unknown> = { action: 'start' };
		if (frequency) body.frequency = frequency;
		const res = await fetch('/api/pagermon/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		return await res.json();
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function stopPagermon(): Promise<{ success: boolean }> {
	try {
		const res = await fetch('/api/pagermon/control', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stop' })
		});
		return await res.json();
	} catch {
		return { success: false };
	}
}
