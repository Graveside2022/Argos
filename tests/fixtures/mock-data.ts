export const mockSpectrumData = {
  frequencies: new Float32Array([
    88000000, 88100000, 88200000, 88300000, 88400000,
    88500000, 88600000, 88700000, 88800000, 88900000,
  ]),
  amplitudes: new Float32Array([
    -80, -75, -70, -65, -60, -55, -60, -65, -70, -75,
  ]),
  centerFrequency: 88500000,
  sampleRate: 2400000,
  timestamp: Date.now(),
};

export const mockDevices = [
  {
    id: 'device-001',
    name: 'iPhone 13',
    mac: 'AA:BB:CC:DD:EE:FF',
    signal: -65,
    lastSeen: new Date().toISOString(),
    vendor: 'Apple Inc.',
    location: { lat: 40.7128, lng: -74.0060 },
    history: [
      { timestamp: Date.now() - 60000, signal: -68 },
      { timestamp: Date.now() - 30000, signal: -66 },
      { timestamp: Date.now(), signal: -65 },
    ],
  },
  {
    id: 'device-002',
    name: 'Galaxy S23',
    mac: '11:22:33:44:55:66',
    signal: -72,
    lastSeen: new Date(Date.now() - 120000).toISOString(),
    vendor: 'Samsung Electronics',
    location: { lat: 40.7580, lng: -73.9855 },
    history: [
      { timestamp: Date.now() - 180000, signal: -75 },
      { timestamp: Date.now() - 120000, signal: -72 },
    ],
  },
  {
    id: 'device-003',
    name: 'Unknown Device',
    mac: '77:88:99:AA:BB:CC',
    signal: -85,
    lastSeen: new Date(Date.now() - 300000).toISOString(),
    vendor: null,
    location: { lat: 40.7489, lng: -73.9680 },
    history: [
      { timestamp: Date.now() - 300000, signal: -85 },
    ],
  },
];

export const mockSweepResults = {
  sweepId: 'sweep-001',
  startFrequency: 88000000,
  endFrequency: 108000000,
  stepSize: 100000,
  dwellTime: 100,
  startTime: Date.now() - 30000,
  endTime: Date.now(),
  progress: 100,
  detectedSignals: [
    { frequency: 89100000, amplitude: -45, bandwidth: 200000 },
    { frequency: 93700000, amplitude: -50, bandwidth: 200000 },
    { frequency: 98100000, amplitude: -48, bandwidth: 200000 },
    { frequency: 102700000, amplitude: -52, bandwidth: 200000 },
  ],
};

export const mockSystemStatus = {
  hackrf: {
    connected: true,
    serialNumber: 'HRF123456',
    firmwareVersion: '2023.01.1',
    temperature: 42.5,
  },
  gps: {
    connected: true,
    satellites: 8,
    fix: '3D',
    location: { lat: 40.7128, lng: -74.0060, alt: 10.5 },
    accuracy: 2.5,
  },
  websocket: {
    connected: true,
    clients: 3,
    uptime: 3600000,
    messagesPerSecond: 45,
  },
  uptime: 86400000,
  cpu: 35.2,
  memory: {
    used: 1024 * 1024 * 512, // 512MB
    total: 1024 * 1024 * 2048, // 2GB
    percentage: 25,
  },
  disk: {
    used: 1024 * 1024 * 1024 * 10, // 10GB
    total: 1024 * 1024 * 1024 * 32, // 32GB
    percentage: 31.25,
  },
};

export const mockWebSocketMessages = {
  spectrumUpdate: {
    type: 'spectrum:update',
    data: mockSpectrumData,
  },
  deviceUpdate: {
    type: 'device:update',
    data: {
      devices: mockDevices,
      added: [],
      removed: [],
      updated: ['device-001'],
    },
  },
  sweepProgress: {
    type: 'sweep:progress',
    data: {
      sweepId: 'sweep-002',
      progress: 45,
      currentFrequency: 95500000,
      detectedSignals: 2,
    },
  },
  systemStatus: {
    type: 'system:status',
    data: mockSystemStatus,
  },
  error: {
    type: 'error',
    message: 'Invalid frequency range',
    code: 'INVALID_FREQ_RANGE',
  },
};

export function generateMockSpectrumData(points = 1024): Float32Array {
  const data = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    // Generate realistic spectrum data with noise and some peaks
    const noise = Math.random() * 10 - 5;
    const signal = Math.sin((i / points) * Math.PI * 4) * 20;
    data[i] = -80 + noise + (signal > 0 ? signal : 0);
  }
  return data;
}

export function generateMockDeviceHistory(hours = 24, intervalMinutes = 5) {
  const history = [];
  const now = Date.now();
  const interval = intervalMinutes * 60 * 1000;
  const points = (hours * 60) / intervalMinutes;

  for (let i = 0; i < points; i++) {
    const timestamp = now - (i * interval);
    const signal = -60 - Math.random() * 30; // Random signal between -60 and -90
    history.unshift({ timestamp, signal });
  }

  return history;
}