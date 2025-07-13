// FILE: src/lib/types/enums.ts
export const enum SystemStatus {
	Running = 'running',
	Idle = 'idle',
	Error = 'error',
	Sweeping = 'sweeping',
	Stopping = 'stopping',
	Initializing = 'initializing'
}

export const enum KismetEvent {
	StateChange = 'stateChange',
	Error = 'error',
	Connect = 'connect',
	Disconnect = 'disconnect',
	DeviceNew = 'device_new',
	DeviceUpdate = 'device_update',
	DeviceRemove = 'device_remove',
	StatsUpdate = 'stats_update',
	StatusUpdate = 'status_update'
}

export const enum SignalSource {
	Kismet = 'kismet',
	HackRF = 'hackrf',
	Manual = 'manual',
	RtlSdr = 'rtl-sdr',
	Other = 'other'
}

export const enum WebSocketState {
	Connecting = 'connecting',
	Open = 'open',
	Closing = 'closing',
	Closed = 'closed'
}

export const enum WebSocketEvent {
	Open = 'open',
	Close = 'close',
	Error = 'error',
	Message = 'message',
	Reconnecting = 'reconnecting'
}

export const enum CircuitBreakerState {
	Closed = 'closed',
	Open = 'open',
	HalfOpen = 'half-open'
}