import { writable } from 'svelte/store';

import { browser } from '$app/environment';
import type { GlobalProtectStatus } from '$lib/types/globalprotect';

const POLL_INTERVAL_MS = 5_000;
const DEFAULT_STATUS: GlobalProtectStatus = { status: 'disconnected' };

export const gpStatus = writable<GlobalProtectStatus>(DEFAULT_STATUS);

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchStatus(): Promise<void> {
	try {
		const res = await fetch('/api/globalprotect/connection');
		if (!res.ok) return;
		const data = await res.json();
		if (data.status) {
			gpStatus.set({
				status: data.status,
				portal: data.portal,
				gateway: data.gateway,
				assignedIp: data.assignedIp,
				uptime: data.uptime,
				lastError: data.lastError
			});
		}
	} catch {
		// Network error — keep last known status
	}
}

export function startGpPolling(): void {
	if (!browser || pollTimer) return;
	fetchStatus();
	pollTimer = setInterval(fetchStatus, POLL_INTERVAL_MS);
}

export function stopGpPolling(): void {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}
