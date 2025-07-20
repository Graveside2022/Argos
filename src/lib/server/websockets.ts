import { wiresharkController } from './wireshark';
import type { NetworkPacket } from './wireshark';

interface WebSocketClient {
	id: string;
	ws: WebSocket;
	subscriptions: Set<string>;
}

class FusionWebSocketManager {
	private clients = new Map<string, WebSocketClient>();
	private initialized = false;
	
	initialize() {
		if (this.initialized) return;
		
		// Set up Wireshark event listeners
		wiresharkController.on('packet', (packet: NetworkPacket) => {
			this.broadcast('wireshark', {
				type: 'packet',
				packet
			});
		});
		
		wiresharkController.on('stats', (stats) => {
			this.broadcast('wireshark', {
				type: 'stats',
				...stats
			});
		});
		
		wiresharkController.on('started', (data) => {
			this.broadcast('wireshark', {
				type: 'status',
				status: 'started',
				...data
			});
		});
		
		wiresharkController.on('stopped', () => {
			this.broadcast('wireshark', {
				type: 'status',
				status: 'stopped'
			});
		});
		
		// TODO: Add GNU Radio and Kismet event listeners in their respective phases
		
		this.initialized = true;
		console.log('Fusion WebSocket manager initialized');
	}
	
	addClient(ws: WebSocket, subscriptions: string[] = []): string {
		const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		const client: WebSocketClient = {
			id: clientId,
			ws,
			subscriptions: new Set(subscriptions)
		};
		
		this.clients.set(clientId, client);
		
		ws.addEventListener('close', () => {
			this.clients.delete(clientId);
			console.log(`WebSocket client ${clientId} disconnected`);
		});
		
		ws.addEventListener('message', (event) => {
			try {
				const message = JSON.parse(event.data);
				this.handleClientMessage(clientId, message);
			} catch (error) {
				console.error('Invalid WebSocket message:', error);
			}
		});
		
		// Send welcome message
		this.sendToClient(clientId, {
			type: 'connected',
			clientId,
			subscriptions: Array.from(client.subscriptions)
		});
		
		console.log(`WebSocket client ${clientId} connected with subscriptions:`, subscriptions);
		return clientId;
	}
	
	removeClient(clientId: string) {
		this.clients.delete(clientId);
	}
	
	broadcast(channel: string, data: any) {
		const message = JSON.stringify(data);
		
		for (const [clientId, client] of this.clients) {
			if (client.subscriptions.has(channel) || client.subscriptions.size === 0) {
				try {
					if (client.ws.readyState === WebSocket.OPEN) {
						client.ws.send(message);
					} else {
						// Remove disconnected clients
						this.clients.delete(clientId);
					}
				} catch (error) {
					console.error(`Failed to send message to client ${clientId}:`, error);
					this.clients.delete(clientId);
				}
			}
		}
	}
	
	sendToClient(clientId: string, data: any) {
		const client = this.clients.get(clientId);
		if (client && client.ws.readyState === WebSocket.OPEN) {
			try {
				client.ws.send(JSON.stringify(data));
			} catch (error) {
				console.error(`Failed to send message to client ${clientId}:`, error);
				this.clients.delete(clientId);
			}
		}
	}
	
	private handleClientMessage(clientId: string, message: any) {
		const client = this.clients.get(clientId);
		if (!client) return;
		
		switch (message.type) {
			case 'subscribe':
				if (Array.isArray(message.channels)) {
					message.channels.forEach((channel: string) => {
						client.subscriptions.add(channel);
					});
				}
				break;
				
			case 'unsubscribe':
				if (Array.isArray(message.channels)) {
					message.channels.forEach((channel: string) => {
						client.subscriptions.delete(channel);
					});
				}
				break;
				
			case 'ping':
				this.sendToClient(clientId, { type: 'pong' });
				break;
				
			default:
				console.log(`Unknown message type from client ${clientId}:`, message.type);
		}
	}
	
	getStats() {
		return {
			connectedClients: this.clients.size,
			channels: ['wireshark', 'gnuradio', 'kismet'], // Available channels
			initialized: this.initialized
		};
	}
}

export const fusionWebSocketManager = new FusionWebSocketManager();