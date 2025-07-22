import { writable } from 'svelte/store';
import { usrpAPI } from '$lib/services/usrp/api';

// Create a store for spectrum data
export const spectrumData = writable<any>(null);

// Create a store for connection status
export const connectionStatus = writable<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

// Create a store for errors
export const lastError = writable<string | null>(null);

// Set up data handler
usrpAPI.onData((data) => {
	console.log('[USRP Store] Received data from API:', data);
	spectrumData.set(data);
});

// Subscribe to connection state
usrpAPI.getConnectionState().subscribe((state) => {
	connectionStatus.set(state);
});

// Subscribe to errors
usrpAPI.getLastError().subscribe((error) => {
	lastError.set(error);
});