import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import { KismetAPIClient } from './api-client';
import { DeviceTracker } from './device-tracker';
import { SecurityAnalyzer } from './security-analyzer';
import { DeviceIntelligence } from './device-intelligence';
import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import { validateInterfaceName } from '$lib/server/security/input-sanitizer';
import type { WiFiDevice, KismetStatus, KismetConfig, MonitorInterface } from './types';

/**
 * Core Kismet controller for WiFi discovery and monitoring
 * Manages Kismet server lifecycle, device tracking, and real-time event streaming
 */
export class KismetController extends EventEmitter {
	private apiClient: KismetAPIClient;
	private deviceTracker: DeviceTracker;
	private securityAnalyzer: SecurityAnalyzer;
	private deviceIntelligence: DeviceIntelligence;

	private kismetProcess: ChildProcess | null = null;
	private isRunning = false;
	private currentInterface: string | null = null;
	private monitorInterfaces: MonitorInterface[] = [];
	private config: KismetConfig;
	private startTime: Date | null = null;
	private deviceUpdateInterval: NodeJS.Timeout | null = null;
	private healthCheckInterval: NodeJS.Timeout | null = null;

	// Performance metrics
	private metrics = {
		devicesDetected: 0,
		packetsProcessed: 0,
		alertsGenerated: 0,
		correlationsFound: 0,
		memoryUsage: 0,
		cpuUsage: 0,
		lastUpdate: new Date()
	};

	constructor(config: Partial<KismetConfig> = {}) {
		super();

		this.config = {
			interface: process.env.KISMET_INTERFACE || 'auto', // Auto-detect or use env var
			monitorMode: true,
			channels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
			hopRate: 5,
			restPort: 2501,
			restUser: 'kismet',
			restPassword: 'kismet',
			logLevel: 'info',
			enableGPS: true,
			enableLogging: true,
			enableAlerts: true,
			deviceTimeout: 300, // 5 minutes
			...config
		};

		this.apiClient = new KismetAPIClient(this.config);
		this.deviceTracker = new DeviceTracker(this.config);
		this.securityAnalyzer = new SecurityAnalyzer();
		this.deviceIntelligence = new DeviceIntelligence();
		// this.correlationEngine = new FusionCorrelationEngine(); // Removed

		this.setupEventHandlers();
	}

	/**
	 * Start WiFi monitoring with Kismet
	 */
	async startMonitoring(): Promise<void> {
		if (this.isRunning) {
			logWarn('Kismet monitoring already running');
			return;
		}

		try {
			logInfo('Starting Kismet WiFi monitoring...');

			// Enable monitor mode on WiFi interface
			await this.enableMonitorMode();

			// Start Kismet server if not running
			await this.startKismetServer();

			// Initialize API client connection
			await this.apiClient.connect();

			// Begin device tracking
			await this.deviceTracker.startTracking();

			// Setup real-time event streaming
			this.setupEventStreaming();

			// Start periodic tasks
			this.startPeriodicTasks();

			this.isRunning = true;
			this.startTime = new Date();

			logInfo('Kismet WiFi monitoring started successfully');
			this.emit('started', {
				interface: this.currentInterface,
				channels: this.config.channels,
				timestamp: this.startTime
			});
		} catch (error) {
			logError('Failed to start Kismet monitoring', { error: (error as Error).message });
			this.emit('error', error);
			throw error;
		}
	}

	/**
	 * Stop WiFi monitoring
	 */
	async stopMonitoring(): Promise<void> {
		if (!this.isRunning) {
			logWarn('Kismet monitoring not running');
			return;
		}

		try {
			logInfo('Stopping Kismet WiFi monitoring...');

			// Stop periodic tasks
			this.stopPeriodicTasks();

			// Stop device tracking
			await this.deviceTracker.stopTracking();

			// Disconnect API client
			await this.apiClient.disconnect();

			// Stop Kismet server
			await this.stopKismetServer();

			// Disable monitor mode
			await this.disableMonitorMode();

			this.isRunning = false;
			this.startTime = null;

			logInfo('Kismet WiFi monitoring stopped successfully');
			this.emit('stopped');
		} catch (error) {
			logError('Failed to stop Kismet monitoring', { error: (error as Error).message });
			this.emit('error', error);
			throw error;
		}
	}

	/**
	 * Get current monitoring status
	 */
	getStatus(): KismetStatus {
		return {
			running: this.isRunning,
			interface: this.currentInterface,
			channels: this.config.channels,
			startTime: this.startTime,
			uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
			deviceCount: this.deviceTracker.getDeviceCount(),
			monitorInterfaces: this.monitorInterfaces,
			metrics: this.metrics,
			config: this.config
		};
	}

	/**
	 * Get discovered WiFi devices
	 */
	async getDevices(): Promise<WiFiDevice[]> {
		try {
			const rawDevices = await this.apiClient.getDevices();
			const enrichedDevices = await Promise.all(
				rawDevices.map((device) => this.enrichDeviceData(device))
			);

			// Update metrics
			this.metrics.devicesDetected = enrichedDevices.length;
			this.metrics.lastUpdate = new Date();

			return enrichedDevices;
		} catch (error) {
			logError('Failed to get devices', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Get device statistics
	 */
	getDeviceStats() {
		return this.deviceTracker.getStatistics();
	}

	/**
	 * Get security analysis results
	 */
	getSecurityAnalysis() {
		return this.securityAnalyzer.getAnalysisResults();
	}

	/**
	 * Get cross-domain correlations
	 */
	async getCorrelations() {
		return [];
	}

	/**
	 * Enable monitor mode on WiFi interface
	 */
	private async enableMonitorMode(): Promise<void> {
		if (!this.config.monitorMode) {
			return;
		}

		try {
			const iface = validateInterfaceName(this.config.interface);
			logInfo(`Enabling monitor mode on ${iface}...`);

			// Bring interface down
			await this.executeCommand(`sudo ip link set ${iface} down`);

			// Set monitor mode
			await this.executeCommand(`sudo iw dev ${iface} set type monitor`);

			// Bring interface up
			await this.executeCommand(`sudo ip link set ${iface} up`);

			this.currentInterface = iface;
			this.monitorInterfaces = [
				{
					name: iface,
					type: 'monitor',
					channels: this.config.channels,
					enabled: true
				}
			];

			logInfo(`Monitor mode enabled on ${iface}`);
		} catch (error) {
			logError('Failed to enable monitor mode', {
				interface: this.config.interface,
				error: (error as Error).message
			});
			throw error;
		}
	}

	/**
	 * Disable monitor mode on WiFi interface
	 */
	private async disableMonitorMode(): Promise<void> {
		if (!this.config.monitorMode || !this.currentInterface) {
			return;
		}

		try {
			const iface = validateInterfaceName(this.currentInterface);
			logInfo(`Disabling monitor mode on ${iface}...`);

			// Skip interface manipulation if it's a USB device to prevent SSH drops
			const isUSBDevice = iface.startsWith('wlx');

			if (isUSBDevice) {
				logInfo(
					`Skipping interface reset for USB device ${iface} to prevent network disruption`
				);
				// Just clear the tracking variables without touching the interface
				this.currentInterface = null;
				this.monitorInterfaces = [];
				logInfo('Monitor mode tracking cleared (interface left in current state)');
			} else {
				// Only manipulate non-USB interfaces
				// Bring interface down
				await this.executeCommand(`sudo ip link set ${iface} down`);

				// Set managed mode
				await this.executeCommand(`sudo iw dev ${iface} set type managed`);

				// Bring interface up
				await this.executeCommand(`sudo ip link set ${iface} up`);

				this.currentInterface = null;
				this.monitorInterfaces = [];

				logInfo('Monitor mode disabled');
			}
		} catch (error) {
			logError('Failed to disable monitor mode', { error: (error as Error).message });
			// Don't throw here - this is cleanup
		}
	}

	/**
	 * Start Kismet server process
	 */
	private async startKismetServer(): Promise<void> {
		if (this.kismetProcess) {
			logWarn('Kismet server already running');
			return;
		}

		try {
			const kismetArgs = [
				'--tcp-port',
				this.config.restPort.toString(),
				'--no-line-wrap',
				'--no-ncurses',
				'--daemonize',
				'--silent'
			];

			if (this.config.interface) {
				kismetArgs.push('-c', this.config.interface);
			}

			logInfo('Starting Kismet server process...', { args: kismetArgs });

			this.kismetProcess = spawn('kismet', kismetArgs);

			this.kismetProcess.stdout?.on('data', (data) => {
				logDebug('Kismet stdout:', data.toString());
			});

			this.kismetProcess.stderr?.on('data', (data) => {
				logWarn('Kismet stderr:', data.toString());
			});

			this.kismetProcess.on('error', (error) => {
				logError('Kismet process error', { error: error.message });
				this.emit('error', error);
			});

			this.kismetProcess.on('exit', (code) => {
				logInfo('Kismet process exited', { code });
				this.kismetProcess = null;
				if (this.isRunning) {
					this.emit('stopped');
				}
			});

			// Wait for Kismet to start
			await this.waitForKismetReady();

			logInfo('Kismet server started successfully');
		} catch (error) {
			logError('Failed to start Kismet server', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Stop Kismet server process - Enhanced with external process detection
	 */
	private async stopKismetServer(): Promise<void> {
		try {
			logInfo('Stopping Kismet server process...');

			// Handle internal process if it exists
			if (this.kismetProcess) {
				logInfo('Stopping internal Kismet process...');

				// Verify this is actually our process before killing it
				if (this.kismetProcess.pid) {
					// Double-check the process is actually kismet
					try {
						const processInfo = await this.executeCommand(
							`ps -p ${this.kismetProcess.pid} -o comm= 2>/dev/null`
						);
						if (!processInfo.trim().includes('kismet')) {
							logWarn(
								`Process ${this.kismetProcess.pid} is not kismet, skipping kill`
							);
							this.kismetProcess = null;
							return;
						}
					} catch (_error: unknown) {
						logWarn('Could not verify process identity, proceeding with caution');
					}
				}

				this.kismetProcess.kill('SIGTERM');

				// Wait for graceful shutdown
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => {
						if (this.kismetProcess && this.kismetProcess.pid) {
							logWarn('Kismet process did not exit gracefully, using SIGKILL');
							this.kismetProcess.kill('SIGKILL');
						}
						resolve();
					}, 5000);

					this.kismetProcess!.on('exit', () => {
						clearTimeout(timeout);
						logInfo('Internal Kismet process stopped');
						resolve();
					});
				});

				this.kismetProcess = null;
			}

			// Always check for external Kismet processes and handle them safely
			await this.stopExternalKismetProcesses();
		} catch (error) {
			logError('Failed to stop Kismet server', { error: (error as Error).message });
			throw error;
		}
	}

	/**
	 * Stop any external Kismet processes safely without affecting SSH
	 */
	private async stopExternalKismetProcesses(): Promise<void> {
		try {
			logInfo('Checking for external Kismet processes...');

			// Get all kismet processes excluding our current shell/SSH sessions
			const pgrepOutput = await this.executeCommand('pgrep -af kismet || true');

			if (!pgrepOutput.trim()) {
				logInfo('No external Kismet processes found');
				return;
			}

			const lines = pgrepOutput.trim().split('\n');
			let foundKismetProcess = false;

			for (const line of lines) {
				// Skip if this is our current shell or contains SSH-related processes
				if (
					line.includes('pgrep') ||
					line.includes('ssh') ||
					line.includes('/bin/sh') ||
					line.includes('/bin/bash') ||
					line.includes('/usr/bin/zsh')
				) {
					continue;
				}

				// Check if this is actually a kismet executable
				if (
					line.includes('/usr/bin/kismet') ||
					line.includes('kismet_server') ||
					(line.includes('kismet') && (line.includes('-t ') || line.includes('-c ')))
				) {
					foundKismetProcess = true;
					const pidMatch = line.match(/^(\d+)/);
					if (pidMatch) {
						const pid = pidMatch[1];
						logInfo(`Found external Kismet process: PID ${pid}`);
					}
				}
			}

			if (foundKismetProcess) {
				logInfo('External Kismet processes detected, using safe stop method...');

				// Use SIGTERM first for graceful shutdown
				await this.executeCommand(
					'sudo pkill -TERM -f "^/usr/bin/kismet" 2>/dev/null || true'
				);

				// Wait a moment for graceful shutdown
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Check if any are still running and force kill if necessary
				const stillRunning = await this.executeCommand(
					'pgrep -f "^/usr/bin/kismet" 2>/dev/null || true'
				);
				if (stillRunning.trim()) {
					logWarn('Some Kismet processes did not stop gracefully, using SIGKILL...');
					await this.executeCommand(
						'sudo pkill -KILL -f "^/usr/bin/kismet" 2>/dev/null || true'
					);
				}

				// Also stop any systemd services
				await this.executeCommand(
					'sudo systemctl stop kismet-auto-wlan1 2>/dev/null || true'
				);

				logInfo('External Kismet processes stopped');
			} else {
				logInfo('No external Kismet processes found to stop');
			}
		} catch (error) {
			logWarn('Error handling external Kismet processes', {
				error: (error as Error).message
			});
			// Don't throw - this is cleanup
		}
	}

	/**
	 * Wait for Kismet to be ready for connections
	 */
	private async waitForKismetReady(): Promise<void> {
		const maxAttempts = 30;
		const delay = 1000;

		for (let i = 0; i < maxAttempts; i++) {
			try {
				await this.apiClient.ping();
				logInfo('Kismet server ready for connections');
				return;
			} catch (_error: unknown) {
				logDebug(`Waiting for Kismet... (${i + 1}/${maxAttempts})`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw new Error('Kismet server failed to start within timeout');
	}

	/**
	 * Setup real-time event streaming from Kismet
	 */
	private setupEventStreaming(): void {
		// Device discovery events
		this.deviceTracker.on('device_discovered', (device) => {
			this.emit('device_discovered', device);
			this.metrics.devicesDetected++;
		});

		this.deviceTracker.on('device_updated', (device) => {
			this.emit('device_updated', device);
		});

		this.deviceTracker.on('device_lost', (device) => {
			this.emit('device_lost', device);
		});

		// Security analysis events
		this.securityAnalyzer.on('security_threat', (threat) => {
			this.emit('security_threat', threat);
			this.metrics.alertsGenerated++;
		});

		this.securityAnalyzer.on('rogue_ap_detected', (ap) => {
			this.emit('rogue_ap_detected', ap);
			this.metrics.alertsGenerated++;
		});

		// Correlation events
		// this.correlationEngine.on('correlation_found', (correlation) => { // Removed
		//     this.emit('correlation_found', correlation);
		//     this.metrics.correlationsFound++;
		// });

		// API client events
		this.apiClient.on('packet_received', (_packet) => {
			this.metrics.packetsProcessed++;
		});

		this.apiClient.on('connection_lost', () => {
			this.emit('connection_lost');
		});

		this.apiClient.on('connection_restored', () => {
			this.emit('connection_restored');
		});
	}

	/**
	 * Start periodic monitoring tasks
	 */
	private startPeriodicTasks(): void {
		// Device update interval
		this.deviceUpdateInterval = setTimeout(async () => {
			try {
				await this.deviceTracker.updateDevices();
				await this.securityAnalyzer.performAnalysis();
				// await this.correlationEngine.analyzeCorrelations(); // Removed
			} catch (error) {
				logError('Error in periodic device update', { error: (error as Error).message });
			}
		}, 5000); // Every 5 seconds

		// Health check interval
		this.healthCheckInterval = setTimeout(async () => {
			try {
				await this.performHealthCheck();
			} catch (error) {
				logError('Error in health check', { error: (error as Error).message });
			}
		}, 30000); // Every 30 seconds
	}

	/**
	 * Stop periodic monitoring tasks
	 */
	private stopPeriodicTasks(): void {
		if (this.deviceUpdateInterval) {
			clearTimeout(this.deviceUpdateInterval);
			this.deviceUpdateInterval = null;
		}

		if (this.healthCheckInterval) {
			clearTimeout(this.healthCheckInterval);
			this.healthCheckInterval = null;
		}
	}

	/**
	 * Perform health check on Kismet system
	 */
	private async performHealthCheck(): Promise<void> {
		try {
			// Check API connectivity
			await this.apiClient.ping();

			// Check process health
			if (this.kismetProcess && this.kismetProcess.pid) {
				const memInfo = await this.getProcessMemoryUsage(this.kismetProcess.pid);
				this.metrics.memoryUsage = memInfo.rss || 0;
			}

			// Update metrics
			this.metrics.lastUpdate = new Date();

			this.emit('health_check', {
				status: 'healthy',
				metrics: this.metrics,
				timestamp: new Date()
			});
		} catch (error) {
			logError('Health check failed', { error: (error as Error).message });
			this.emit('health_check', {
				status: 'unhealthy',
				error: (error as Error).message,
				timestamp: new Date()
			});
		}
	}

	/**
	 * Enrich device data with intelligence and security analysis
	 */
	private async enrichDeviceData(device: any): Promise<WiFiDevice> {
		try {
			// Device classification
			const classification = this.deviceIntelligence.classifyDevice(device);

			// Security analysis
			const securityAssessment = this.securityAnalyzer.analyzeDevice(device);

			// Manufacturer lookup
			const manufacturer = this.deviceIntelligence.lookupManufacturer(device.mac);

			// Threat level calculation
			const threatLevel = this.calculateThreatLevel(device, securityAssessment);

			return {
				mac: device.mac,
				ssid: device.ssid,
				deviceType: classification.type as 'access_point' | 'client' | 'bridge' | 'unknown',
				manufacturer,
				firstSeen: new Date(device.firstSeen * 1000),
				lastSeen: new Date(device.lastSeen * 1000),
				signalStrength: device.signal?.last_signal || -100,
				channel: device.channel || 0,
				frequency: device.frequency || 0,
				encryption: device.encryption || [],
				securityScore: securityAssessment.score,
				threatLevel,
				location: device.location
					? {
							latitude: device.location.lat,
							longitude: device.location.lon,
							accuracy: device.location.accuracy || 100
						}
					: undefined,
				associations: device.associations || [],
				probeRequests: device.probeRequests || [],
				packets: device.packets || 0,
				dataSize: device.dataSize || 0,
				classification,
				securityAssessment
			};
		} catch (error) {
			logError('Failed to enrich device data', {
				mac: device.mac,
				error: (error as Error).message
			});

			// Return minimal device data on error
			return {
				mac: device.mac,
				ssid: device.ssid,
				deviceType: 'unknown',
				manufacturer: 'Unknown',
				firstSeen: new Date(),
				lastSeen: new Date(),
				signalStrength: -100,
				channel: 0,
				frequency: 0,
				encryption: [],
				securityScore: 0,
				threatLevel: 'unknown',
				associations: [],
				probeRequests: [],
				packets: 0,
				dataSize: 0
			};
		}
	}

	/**
	 * Calculate threat level for a device
	 */
	private calculateThreatLevel(
		device: any,
		securityAssessment: any
	): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
		if (!securityAssessment) return 'unknown';

		const score = securityAssessment.score;

		if (score >= 90) return 'low';
		if (score >= 70) return 'medium';
		if (score >= 40) return 'high';
		return 'critical';
	}

	/**
	 * Setup event handlers for internal communication
	 */
	private setupEventHandlers(): void {
		this.on('error', (error) => {
			logError('Kismet controller error', { error: error.message });
		});

		this.on('device_discovered', (device) => {
			logDebug('Device discovered', { mac: device.mac, type: device.deviceType });
		});

		this.on('security_threat', (threat) => {
			logWarn('Security threat detected', {
				type: threat.type,
				severity: threat.severity
			});
		});
	}

	/**
	 * Execute shell command with timeout
	 */
	private async executeCommand(command: string, timeout = 10000): Promise<string> {
		return new Promise((resolve, reject) => {
			const child = spawn('sh', ['-c', command]);
			let output = '';
			let error = '';

			const timer = setTimeout(() => {
				child.kill('SIGKILL');
				reject(new Error(`Command timeout: ${command}`));
			}, timeout);

			child.stdout?.on('data', (data) => {
				output += data.toString();
			});

			child.stderr?.on('data', (data) => {
				error += data.toString();
			});

			child.on('exit', (code) => {
				clearTimeout(timer);

				if (code === 0) {
					resolve(output);
				} else {
					reject(new Error(`Command failed (${code}): ${error || output}`));
				}
			});

			child.on('error', (err) => {
				clearTimeout(timer);
				reject(err);
			});
		});
	}

	/**
	 * Get process memory usage
	 */
	private async getProcessMemoryUsage(pid: number): Promise<any> {
		try {
			const output = await this.executeCommand(`ps -p ${pid} -o pid,rss,pcpu --no-headers`);
			const parts = output.trim().split(/\s+/);

			return {
				pid: parseInt(parts[0]),
				rss: parseInt(parts[1]) * 1024, // Convert KB to bytes
				cpu: parseFloat(parts[2])
			};
		} catch (_error: unknown) {
			return { pid, rss: 0, cpu: 0 };
		}
	}
}
