import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface CompanionStatus {
	running: boolean;
	pid: number | null;
	startedAt: number | null;
	appName: string;
}

const defaultStatus: CompanionStatus = {
	running: false,
	pid: null,
	startedAt: null,
	appName: ''
};

export const companionStatuses = writable<Record<string, CompanionStatus>>({});

let pollIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

async function fetchStatus(appName: string): Promise<void> {
	try {
		const response = await fetch(`/api/companion/${appName}/control`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'status' })
		});
		if (response.ok) {
			const data = await response.json();
			companionStatuses.update((s) => ({ ...s, [appName]: data }));
		}
	} catch {
		// Network error
	}
}

export function startCompanionPolling(appName: string): void {
	if (!browser || pollIntervals.has(appName)) return;

	fetchStatus(appName);
	const interval = setInterval(() => fetchStatus(appName), 5000);
	pollIntervals.set(appName, interval);
}

export function stopCompanionPolling(appName: string): void {
	const interval = pollIntervals.get(appName);
	if (interval) {
		clearInterval(interval);
		pollIntervals.delete(appName);
	}
}

export async function launchApp(appName: string): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch(`/api/companion/${appName}/control`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'start' })
		});
		const result = await response.json();
		if (result.success) {
			companionStatuses.update((s) => ({ ...s, [appName]: result }));
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}

export async function stopApp(appName: string): Promise<{ success: boolean; error?: string }> {
	try {
		const response = await fetch(`/api/companion/${appName}/control`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'stop' })
		});
		const result = await response.json();
		if (result.success) {
			companionStatuses.update((s) => ({
				...s,
				[appName]: { ...defaultStatus, appName }
			}));
		}
		return result;
	} catch (error) {
		return { success: false, error: (error as Error).message };
	}
}
