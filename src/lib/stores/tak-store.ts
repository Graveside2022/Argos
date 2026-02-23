import { writable } from 'svelte/store';

import { browser } from '$app/environment';
import type { TakStatus } from '$lib/types/tak';

const DEFAULT_STATUS: TakStatus = { status: 'disconnected' };

export const takStatus = writable<TakStatus>(DEFAULT_STATUS);
export const takCotMessages = writable<string[]>([]);

/** Process a TAK CoT message — append to buffer and dispatch DOM event. */
function handleCotMessage(data: Record<string, unknown>): void {
	const xml = (data as { xml?: string }).xml;
	if (typeof xml === 'string') {
		takCotMessages.update((msgs) => {
			const newMsgs = [...msgs, xml];
			if (newMsgs.length > 50) newMsgs.shift();
			return newMsgs;
		});
	}
	if (browser) window.dispatchEvent(new CustomEvent('tak-cot', { detail: data }));
}

/** Handles incoming WebSocket messages for TAK status and CoT data. */
export function handleTakMessage(message: { type: string; data: Record<string, unknown> }) {
	if (message.type === 'tak_status') takStatus.set(message.data as unknown as TakStatus);
	else if (message.type === 'tak_cot') handleCotMessage(message.data);
}
