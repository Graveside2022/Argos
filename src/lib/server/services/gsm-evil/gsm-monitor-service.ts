import type { ChildProcessWithoutNullStreams } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

import { logger } from '$lib/utils/logger';

interface GsmFrame {
	timestamp: number;
	raw: string;
	channelType?: string;
	message?: string;
	hex?: string;
}

class GsmMonitorService extends EventEmitter {
	private static instance: GsmMonitorService;
	private tsharkProcess: ChildProcessWithoutNullStreams | null = null;
	private frameBuffer: GsmFrame[] = [];
	private readonly MAX_BUFFER_SIZE = 100;
	private isRunning = false;
	private lastActivity = 0;
	private channelStats: Map<string, number> = new Map();

	private constructor() {
		super();
		// Auto-stop if no frames requested for 30 seconds
		setInterval(() => this.checkIdle(), 10000);
	}

	public static getInstance(): GsmMonitorService {
		if (!GsmMonitorService.instance) {
			GsmMonitorService.instance = new GsmMonitorService();
		}
		return GsmMonitorService.instance;
	}

	public startMonitor(): void {
		if (this.isRunning || this.tsharkProcess) return;

		logger.info('[GsmMonitorService] Starting tshark monitor');
		this.isRunning = true;
		this.lastActivity = Date.now();

		// Capture both GSMTAP text decode and hex data
		// We use -l for line buffering to get real-time results
		this.tsharkProcess = spawn('sudo', [
			'tshark',
			'-l',
			'-i',
			'lo',
			'-f',
			'udp port 4729',
			'-T',
			'fields',
			'-e',
			'gsmtap', // Full decode
			'-e',
			'data.data', // Hex data
			'-e',
			'gsmtap.chan_type', // Channel type for stats
			'-E',
			'separator=|'
		]);

		this.tsharkProcess.stdout.on('data', (data: Buffer) => {
			const lines = data.toString().split('\n');
			lines.forEach((line) => {
				if (line.trim()) {
					this.processFrame(line.trim());
				}
			});
		});

		this.tsharkProcess.stderr.on('data', (data: Buffer) => {
			// Ignore standard capture info, log errors
			const msg = data.toString();
			if (msg.includes('Error') || msg.includes('Permission denied')) {
				logger.error('[GsmMonitorService] tshark error', { message: msg });
			}
		});

		this.tsharkProcess.on('error', (err) => {
			logger.error('[GsmMonitorService] Failed to start tshark process', {
				error: err.message
			});
			this.isRunning = false;
			this.tsharkProcess = null;
		});

		this.tsharkProcess.on('close', (code) => {
			logger.info('[GsmMonitorService] tshark exited', { code });
			this.isRunning = false;
			this.tsharkProcess = null;
		});
	}

	public stopMonitor(): void {
		if (this.tsharkProcess) {
			logger.info('[GsmMonitorService] Stopping monitor');
			this.tsharkProcess.kill();
			try {
				// Ensure sudo child is also killed
				spawn('sudo', ['pkill', '-P', String(this.tsharkProcess.pid)]);
			} catch (_e) {
				// Ignore
			}
			this.tsharkProcess = null;
			this.isRunning = false;
		}
	}

	private processFrame(line: string): void {
		const parts = line.split('|');
		if (parts.length < 1) return;

		const fullDecode = parts[0] || '';
		const hexData = parts[1] || '';
		const channelType = parts[2] || 'UNKNOWN';

		// Update stats
		this.channelStats.set(channelType, (this.channelStats.get(channelType) || 0) + 1);

		// Extract useful message from decode
		// Format usually: "GSMTAP 81 (CCCH) (RR) System Information Type 13"
		const msgMatch = fullDecode.match(/GSMTAP\s+\d+\s+\(([^)]+)\)\s+(.+)/);
		const message = msgMatch ? msgMatch[2] : fullDecode;

		const frame: GsmFrame = {
			timestamp: Date.now(),
			raw: line,
			channelType,
			message,
			hex: hexData
		};

		this.frameBuffer.push(frame);

		// Keep buffer size constant
		if (this.frameBuffer.length > this.MAX_BUFFER_SIZE) {
			this.frameBuffer.shift();
		}

		this.lastActivity = Date.now();
		this.emit('frame', frame);
	}

	public getRecentFrames(limit = 20): GsmFrame[] {
		this.lastActivity = Date.now();
		if (!this.isRunning) {
			this.startMonitor();
		}
		return this.frameBuffer.slice(-limit).reverse();
	}

	public getActivityStats() {
		this.lastActivity = Date.now();
		if (!this.isRunning) {
			this.startMonitor();
		}

		// Convert map to sorted string for activity endpoint
		const stats = Array.from(this.channelStats.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([type, count]) => `${count} ${type}`)
			.join(', ');

		return stats;
	}

	private checkIdle() {
		if (this.isRunning && Date.now() - this.lastActivity > 30000) {
			logger.info('[GsmMonitorService] Idle timeout, stopping monitor');
			this.stopMonitor();
		}
	}
}

export const gsmMonitor = GsmMonitorService.getInstance();
