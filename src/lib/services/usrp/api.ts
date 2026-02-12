import { writable } from 'svelte/store';

class USRPAPI {
	private eventSource: EventSource | null = null;
	private connectionState = writable<'disconnected' | 'connecting' | 'connected' | 'error'>(
		'disconnected'
	);
	private lastError = writable<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private dataCallback: ((data: any) => void) | null = null;

	connectToDataStream() {
		if (this.eventSource) {
			console.warn('Already connected to USRP data stream');
			return;
		}

		this.connectionState.set('connecting');
		console.warn('Connecting to USRP data stream...');

		try {
			// Since we're using auto_sweep.sh which outputs through hackrf pipeline
			this.eventSource = new EventSource('/api/hackrf/data-stream');

			this.eventSource.onopen = () => {
				console.warn('USRP data stream connected');
				this.connectionState.set('connected');
				this.lastError.set(null);
			};

			this.eventSource.onerror = (error) => {
				console.error('USRP data stream error:', error);
				this.connectionState.set('error');
				this.lastError.set('Connection error');
			};

			this.eventSource.addEventListener('connected', (event) => {
				console.warn('USRP stream connected:', event.data);
			});

			this.eventSource.addEventListener('sweep_data', (event) => {
				try {
					console.warn('Raw sweep_data event:', event.data);
					const data = JSON.parse(event.data);
					console.warn('USRP spectrum data received:', data);
					// Call the callback with the raw sweep_data for the usrp store
					if (this.dataCallback) {
						this.dataCallback(data);
					}
				} catch (error) {
					console.error('Error parsing USRP spectrum data:', error);
					console.error('Raw event data was:', event.data);
				}
			});

			this.eventSource.addEventListener('error', (event) => {
				try {
					const data = JSON.parse((event as MessageEvent).data);
					console.error('USRP error:', data);
					this.lastError.set(data.message || 'Unknown error');
				} catch (error) {
					console.error('Error parsing USRP error message:', error);
				}
			});

			this.eventSource.addEventListener('status', (event) => {
				try {
					const data = JSON.parse(event.data);
					console.warn('USRP status update:', data);
				} catch (error) {
					console.error('Error parsing USRP status:', error);
				}
			});

			this.eventSource.addEventListener('heartbeat', (event) => {
				console.warn('USRP heartbeat:', event.data);
			});
		} catch (error) {
			console.error('Failed to connect to USRP data stream:', error);
			this.connectionState.set('error');
			this.lastError.set('Failed to connect');
		}
	}

	disconnect() {
		if (this.eventSource) {
			console.warn('Disconnecting from USRP data stream');
			this.eventSource.close();
			this.eventSource = null;
			this.connectionState.set('disconnected');
		}
	}

	reconnect() {
		this.disconnect();
		setTimeout(() => {
			this.connectToDataStream();
		}, 100);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onData(callback: (data: any) => void) {
		this.dataCallback = callback;
	}

	getConnectionState() {
		return this.connectionState;
	}

	getLastError() {
		return this.lastError;
	}
}

export const usrpAPI = new USRPAPI();
