import type { RequestHandler } from './$types';
import { wiresharkController } from '$lib/server/wireshark';
import { spectrumAnalyzer } from '$lib/server/gnuradio';

export const GET: RequestHandler = async ({ url }) => {
	const channel = url.searchParams.get('channel') || 'all';
	
	// Create a readable stream for SSE
	const stream = new ReadableStream({
		async start(controller) {
			// Send initial connection message
			const encoder = new TextEncoder();
			
			const sendEvent = (type: string, data: any) => {
				const eventData = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(eventData));
			};
			
			sendEvent('connected', { channel, timestamp: new Date().toISOString() });
			
			// Set up Wireshark listeners if requested
			if (channel === 'all' || channel === 'wireshark') {
				const wsController = wiresharkController;
				
				const onPacket = (packet: any) => {
					sendEvent('packet', { type: 'packet', packet });
				};
				
				const onStats = (stats: any) => {
					sendEvent('stats', { type: 'stats', ...stats });
				};
				
				const onStarted = (data: any) => {
					sendEvent('status', { type: 'status', status: 'started', tool: 'wireshark', ...data });
				};
				
				const onStopped = () => {
					sendEvent('status', { type: 'status', status: 'stopped', tool: 'wireshark' });
				};
				
				wsController.on('packet', onPacket);
				wsController.on('stats', onStats);
				wsController.on('started', onStarted);
				wsController.on('stopped', onStopped);
				
				// Send current status
				const status = wsController.getStatus();
				sendEvent('status', { 
					type: 'status', 
					status: status.running ? 'running' : 'stopped',
					tool: 'wireshark',
					...status
				});
				
				// Clean up listeners when stream closes
				const cleanup = () => {
					wsController.off('packet', onPacket);
					wsController.off('stats', onStats);
					wsController.off('started', onStarted);
					wsController.off('stopped', onStopped);
				};
				
				// Store cleanup function for later use
				(controller as any).cleanup = cleanup;
			}
			
			// Set up GNU Radio listeners if requested
			if (channel === 'all' || channel === 'gnuradio') {
				const analyzer = spectrumAnalyzer;
				
				const onSpectrumData = (event: any) => {
					sendEvent('spectrum_data', { 
						type: 'spectrum_data', 
						tool: 'gnuradio',
						data: event.data 
					});
				};
				
				const onStatusUpdate = (event: any) => {
					sendEvent('status', { 
						type: 'status', 
						status: event.data.running ? 'running' : 'stopped',
						tool: 'gnuradio',
						device: event.data.device,
						config: event.data.config,
						performance: event.data.performance
					});
				};
				
				const onSignalDetected = (event: any) => {
					sendEvent('signal_detected', { 
						type: 'signal_detected', 
						tool: 'gnuradio',
						signal: event.data 
					});
				};
				
				const onDeviceConnected = (event: any) => {
					sendEvent('device_connected', { 
						type: 'device_connected', 
						tool: 'gnuradio',
						device: event.data 
					});
				};
				
				const onDeviceDisconnected = (event: any) => {
					sendEvent('device_disconnected', { 
						type: 'device_disconnected', 
						tool: 'gnuradio',
						deviceId: event.data 
					});
				};
				
				const onGnuRadioError = (event: any) => {
					sendEvent('error', { 
						type: 'error', 
						tool: 'gnuradio',
						error: event.data 
					});
				};
				
				// Set up event listeners
				analyzer.on('spectrum_data', onSpectrumData);
				analyzer.on('status_update', onStatusUpdate);
				analyzer.on('signal_detected', onSignalDetected);
				analyzer.on('device_connected', onDeviceConnected);
				analyzer.on('device_disconnected', onDeviceDisconnected);
				analyzer.on('error', onGnuRadioError);
				
				// Send current GNU Radio status
				const gnuStatus = analyzer.getStatus();
				sendEvent('status', { 
					type: 'status', 
					status: gnuStatus.running ? 'running' : 'stopped',
					tool: 'gnuradio',
					device: gnuStatus.device,
					config: gnuStatus.config,
					performance: gnuStatus.performance,
					lastUpdate: gnuStatus.lastUpdate
				});
				
				// Update cleanup function to include GNU Radio listeners
				const originalCleanup = (controller as any).cleanup || (() => {});
				const gnuRadioCleanup = () => {
					analyzer.off('spectrum_data', onSpectrumData);
					analyzer.off('status_update', onStatusUpdate);
					analyzer.off('signal_detected', onSignalDetected);
					analyzer.off('device_connected', onDeviceConnected);
					analyzer.off('device_disconnected', onDeviceDisconnected);
					analyzer.off('error', onGnuRadioError);
				};
				
				(controller as any).cleanup = () => {
					originalCleanup();
					gnuRadioCleanup();
				};
			}
			
			// Set up Kismet listeners if requested
			if (channel === 'all' || channel === 'kismet') {
				const { fusionKismetController } = await import('$lib/server/kismet/fusion_controller');
				
				if (fusionKismetController.isReady()) {
					const kismetController = fusionKismetController.getController();
					
					const onDeviceDiscovered = (device: any) => {
						sendEvent('device_update', {
							type: 'device_discovered',
							tool: 'kismet',
							device
						});
					};
					
					const onDeviceUpdated = (device: any) => {
						sendEvent('device_update', {
							type: 'device_updated',
							tool: 'kismet',
							device
						});
					};
					
					const onDeviceLost = (device: any) => {
						sendEvent('device_update', {
							type: 'device_lost',
							tool: 'kismet',
							device
						});
					};
					
					const onSecurityThreat = (threat: any) => {
						sendEvent('security_alert', {
							type: 'security_threat',
							tool: 'kismet',
							threat
						});
					};
					
					const onRogueAP = (ap: any) => {
						sendEvent('security_alert', {
							type: 'rogue_ap_detected',
							tool: 'kismet',
							ap
						});
					};
					
					const onCorrelationFound = (correlation: any) => {
						sendEvent('correlation_update', {
							type: 'correlation_found',
							tool: 'kismet',
							correlation
						});
					};
					
					const onKismetStatus = (status: any) => {
						sendEvent('status', {
							type: 'status',
							status: status.running ? 'running' : 'stopped',
							tool: 'kismet',
							interface: status.interface,
							deviceCount: status.deviceCount,
							uptime: status.uptime
						});
					};
					
					// Set up event listeners
					kismetController.on('device_discovered', onDeviceDiscovered);
					kismetController.on('device_updated', onDeviceUpdated);
					kismetController.on('device_lost', onDeviceLost);
					kismetController.on('security_threat', onSecurityThreat);
					kismetController.on('rogue_ap_detected', onRogueAP);
					kismetController.on('correlation_found', onCorrelationFound);
					kismetController.on('started', onKismetStatus);
					kismetController.on('stopped', onKismetStatus);
					
					// Send current Kismet status
					const currentStatus = kismetController.getStatus();
					sendEvent('status', {
						type: 'status',
						status: currentStatus.running ? 'running' : 'stopped',
						tool: 'kismet',
						interface: currentStatus.interface,
						deviceCount: currentStatus.deviceCount,
						uptime: currentStatus.uptime
					});
					
					// Send current device list
					try {
						const devices = await kismetController.getDevices();
						sendEvent('device_list', {
							type: 'device_list',
							tool: 'kismet',
							devices
						});
					} catch (error) {
						console.error('Error getting initial device list:', error);
					}
					
					// Update cleanup function to include Kismet listeners
					const originalCleanup = (controller as any).cleanup || (() => {});
					const kismetCleanup = () => {
						kismetController.off('device_discovered', onDeviceDiscovered);
						kismetController.off('device_updated', onDeviceUpdated);
						kismetController.off('device_lost', onDeviceLost);
						kismetController.off('security_threat', onSecurityThreat);
						kismetController.off('rogue_ap_detected', onRogueAP);
						kismetController.off('correlation_found', onCorrelationFound);
						kismetController.off('started', onKismetStatus);
						kismetController.off('stopped', onKismetStatus);
					};
					
					(controller as any).cleanup = () => {
						originalCleanup();
						kismetCleanup();
					};
				}
			}
			
			// Keep connection alive with periodic heartbeat
			const heartbeat = setInterval(() => {
				try {
					sendEvent('heartbeat', { timestamp: new Date().toISOString() });
				} catch (error) {
					clearInterval(heartbeat);
				}
			}, 30000); // Every 30 seconds
			
			// Store heartbeat for cleanup
			(controller as any).heartbeat = heartbeat;
		},
		
		cancel() {
			// Clean up when client disconnects
			if ((this as any).cleanup) {
				(this as any).cleanup();
			}
			if ((this as any).heartbeat) {
				clearInterval((this as any).heartbeat);
			}
		}
	});
	
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no',
			'Access-Control-Allow-Origin': '*'
		}
	});
};