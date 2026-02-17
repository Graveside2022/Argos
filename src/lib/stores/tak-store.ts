import { writable } from 'svelte/store';

import { browser } from '$app/environment';

export interface TakStatus {
	status: 'connected' | 'disconnected' | 'error';
	lastMessage?: string;
}

// Stores
export const takStatus = writable<TakStatus>({ status: 'disconnected' });
export const takCotMessages = writable<string[]>([]); // Keep last N messages?

// Logic to hook into WebSocket
// We need to access the WebSocket connection.
// Ideally, we reuse the connection from MapController or a central WS service.
// For now, we can listen if we assume a global WS or if we are initialized by the layout.

// Let's create a helper to handle TAK messages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleTakMessage(message: any) {
	if (message.type === 'tak_status') {
		takStatus.set(message.data);
	} else if (message.type === 'tak_cot') {
		// data is { xml: string }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const xml = (message.data as any).xml;
		if (typeof xml === 'string') {
			takCotMessages.update((msgs) => {
				const newMsgs = [...msgs, xml];
				if (newMsgs.length > 50) newMsgs.shift(); // Keep last 50
				return newMsgs;
			});
		}
		// Dispatch event for Map?
		if (browser) {
			window.dispatchEvent(new CustomEvent('tak-cot', { detail: message.data }));
		}
	}
}
