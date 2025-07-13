import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { mockWebSocketMessages, mockSpectrumData, mockDevices } from '../fixtures/mock-data';

export class TestServer {
	private httpServer: import('http').Server | null = null;
	private wsServer: WebSocketServer | null = null;
	private port: number;

	constructor(port = 8093) {
		this.port = port;
	}

	async start() {
		this.httpServer = createServer((req, res) => {
			// Handle API endpoints for testing
			const url = new URL(req.url || '', `http://localhost:${this.port}`);

			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

			if (req.method === 'OPTIONS') {
				res.writeHead(200);
				res.end();
				return;
			}

			switch (url.pathname) {
				case '/api/spectrum': {
					res.writeHead(200);
					res.end(
						JSON.stringify({
							frequencies: Array.from(mockSpectrumData.frequencies),
							amplitudes: Array.from(mockSpectrumData.amplitudes)
						})
					);
					break;
				}

				case '/api/devices': {
					const minSignal = url.searchParams.get('minSignal');
					let devices = mockDevices;
					if (minSignal) {
						devices = devices.filter((d) => d.signal >= parseInt(minSignal));
					}
					res.writeHead(200);
					res.end(JSON.stringify(devices));
					break;
				}

				case '/api/system/status':
					res.writeHead(200);
					res.end(
						JSON.stringify({
							hackrf: { connected: true },
							gps: { connected: true },
							websocket: { connected: true },
							uptime: 3600000
						})
					);
					break;

				case '/api/sweep/start':
					if (req.method === 'POST') {
						res.writeHead(200);
						res.end(
							JSON.stringify({
								sweepId: 'test-sweep-001',
								status: 'started'
							})
						);
					} else {
						res.writeHead(405);
						res.end();
					}
					break;

				case '/api/sweep/status':
					res.writeHead(200);
					res.end(
						JSON.stringify({
							active: true,
							progress: 45,
							sweepId: 'test-sweep-001'
						})
					);
					break;

				case '/api/sweep/stop':
					if (req.method === 'POST') {
						res.writeHead(200);
						res.end(JSON.stringify({ status: 'stopped' }));
					} else {
						res.writeHead(405);
						res.end();
					}
					break;

				default:
					if (url.pathname.startsWith('/api/devices/')) {
						const deviceId = url.pathname.split('/').pop();
						const device = mockDevices.find((d) => d.id === deviceId);
						if (device) {
							res.writeHead(200);
							res.end(JSON.stringify(device));
						} else {
							res.writeHead(404);
							res.end(JSON.stringify({ error: 'Device not found' }));
						}
					} else {
						res.writeHead(404);
						res.end(JSON.stringify({ error: 'Not found' }));
					}
			}
		});

		this.wsServer = new WebSocketServer({ server: this.httpServer });

		this.wsServer.on('connection', (ws) => {
			// Send initial connection message
			ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));

			// Handle incoming messages
			ws.on('message', (data: import('ws').Data) => {
				try {
					const message = JSON.parse(data.toString()) as Record<string, unknown>;

					switch (message.type) {
						case 'getSpectrum':
							ws.send(
								JSON.stringify({
									type: 'spectrum',
									data: mockWebSocketMessages.spectrumUpdate.data
								})
							);
							break;

						case 'ping':
							ws.send(JSON.stringify({ type: 'pong' }));
							break;

						case 'request':
							ws.send(
								JSON.stringify({
									type: 'response',
									requestId: message.requestId,
									status: 'ok'
								})
							);
							break;

						case 'spectrum:request':
							ws.send(
								JSON.stringify({
									type: 'spectrum:response',
									timestamp: message.timestamp,
									data: mockSpectrumData
								})
							);
							break;

						case 'echo':
							ws.send(JSON.stringify(message));
							break;

						default:
							ws.send(
								JSON.stringify({
									type: 'error',
									message: 'Unknown message type'
								})
							);
					}
				} catch {
					ws.send(
						JSON.stringify({
							type: 'error',
							message: 'Invalid JSON'
						})
					);
				}
			});

			// Simulate periodic spectrum updates
			const intervalId = setInterval(() => {
				if (ws.readyState === ws.OPEN) {
					ws.send(JSON.stringify(mockWebSocketMessages.spectrumUpdate));
				}
			}, 1000);

			ws.on('close', () => {
				clearInterval(intervalId);
			});
		});

		return new Promise<void>((resolve) => {
			this.httpServer?.listen(this.port, () => {
				console.error(`Test server running on port ${this.port}`);
				resolve();
			});
		});
	}

	async stop() {
		if (this.wsServer) {
			this.wsServer.clients.forEach((client) => client.close());
			this.wsServer.close();
		}

		return new Promise<void>((resolve) => {
			this.httpServer?.close(() => {
				console.error('Test server stopped');
				resolve();
			});
		});
	}

	getUrl() {
		return `http://localhost:${this.port}`;
	}

	getWsUrl() {
		return `ws://localhost:${this.port}`;
	}
}
