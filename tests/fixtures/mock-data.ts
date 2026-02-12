export const mockSpectrumData = {
	frequencies: new Float32Array([
		88000000, 88100000, 88200000, 88300000, 88400000, 88500000, 88600000, 88700000, 88800000,
		88900000
	]),
	amplitudes: new Float32Array([-80, -75, -70, -65, -60, -55, -60, -65, -70, -75]),
	centerFrequency: 88500000,
	sampleRate: 2400000,
	timestamp: Date.now()
};

export const mockDevices = [
	{
		id: 'device-001',
		name: 'iPhone 13',
		mac: 'AA:BB:CC:DD:EE:FF',
		signal: -65,
		lastSeen: new Date().toISOString(),
		vendor: 'Apple Inc.',
		location: { lat: 40.7128, lng: -74.006 },
		history: [
			{ timestamp: Date.now() - 60000, signal: -68 },
			{ timestamp: Date.now() - 30000, signal: -66 },
			{ timestamp: Date.now(), signal: -65 }
		]
	},
	{
		id: 'device-002',
		name: 'Galaxy S23',
		mac: '11:22:33:44:55:66',
		signal: -72,
		lastSeen: new Date(Date.now() - 120000).toISOString(),
		vendor: 'Samsung Electronics',
		location: { lat: 40.758, lng: -73.9855 },
		history: [
			{ timestamp: Date.now() - 180000, signal: -75 },
			{ timestamp: Date.now() - 120000, signal: -72 }
		]
	},
	{
		id: 'device-003',
		name: 'Unknown Device',
		mac: '77:88:99:AA:BB:CC',
		signal: -85,
		lastSeen: new Date(Date.now() - 300000).toISOString(),
		vendor: null,
		location: { lat: 40.7489, lng: -73.968 },
		history: [{ timestamp: Date.now() - 300000, signal: -85 }]
	}
];

export const mockSystemStatus = {
	hackrf: {
		connected: true,
		serialNumber: 'HRF123456',
		firmwareVersion: '2023.01.1',
		temperature: 42.5
	},
	gps: {
		connected: true,
		satellites: 8,
		fix: '3D',
		location: { lat: 40.7128, lng: -74.006, alt: 10.5 },
		accuracy: 2.5
	},
	websocket: {
		connected: true,
		clients: 3,
		uptime: 3600000,
		messagesPerSecond: 45
	},
	uptime: 86400000,
	cpu: 35.2,
	memory: {
		used: 1024 * 1024 * 512, // 512MB
		total: 1024 * 1024 * 2048, // 2GB
		percentage: 25
	},
	disk: {
		used: 1024 * 1024 * 1024 * 10, // 10GB
		total: 1024 * 1024 * 1024 * 32, // 32GB
		percentage: 31.25
	}
};

export const mockWebSocketMessages = {
	spectrumUpdate: {
		type: 'spectrum:update',
		data: mockSpectrumData
	},
	deviceUpdate: {
		type: 'device:update',
		data: {
			devices: mockDevices,
			added: [],
			removed: [],
			updated: ['device-001']
		}
	},
	sweepProgress: {
		type: 'sweep:progress',
		data: {
			sweepId: 'sweep-002',
			progress: 45,
			currentFrequency: 95500000,
			detectedSignals: 2
		}
	},
	systemStatus: {
		type: 'system:status',
		data: mockSystemStatus
	},
	error: {
		type: 'error',
		message: 'Invalid frequency range',
		code: 'INVALID_FREQ_RANGE'
	}
};
