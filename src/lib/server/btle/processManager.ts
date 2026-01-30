import { spawn, type ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import { HardwareDevice } from '$lib/server/hardware/types';
import type { BLEPacket, BTLEStatus, BTLEConfig } from './types';

const execAsync = promisify(exec);

class BTLEProcessManager extends EventEmitter {
	private process: ChildProcess | null = null;
	private running = false;
	private packets: BLEPacket[] = [];
	private uniqueDevices = new Set<string>();
	private config: BTLEConfig = { channel: 37, gain: 20 };

	async start(config?: Partial<BTLEConfig>): Promise<{ success: boolean; error?: string }> {
		if (this.running) return { success: false, error: 'Already running' };

		if (config) {
			this.config = { ...this.config, ...config };
		}

		const result = await resourceManager.acquire('btle', HardwareDevice.HACKRF);
		if (!result.success) {
			return { success: false, error: `HackRF in use by ${result.owner}` };
		}

		try {
			this.process = spawn('btle_rx', ['-c', String(this.config.channel)], {
				stdio: ['ignore', 'pipe', 'pipe']
			});

			this.running = true;

			this.process.stdout?.on('data', (data: Buffer) => {
				const lines = data.toString().split('\n').filter(Boolean);
				for (const line of lines) {
					const packet = this.parseLine(line);
					if (packet) {
						this.packets.push(packet);
						this.uniqueDevices.add(packet.mac);
						if (this.packets.length > 5000) this.packets.shift();
						this.emit('packet', packet);
					}
				}
			});

			this.process.on('exit', () => {
				this.running = false;
				this.process = null;
				resourceManager.release('btle', HardwareDevice.HACKRF);
			});

			return { success: true };
		} catch (error) {
			await resourceManager.release('btle', HardwareDevice.HACKRF);
			this.running = false;
			return { success: false, error: (error as Error).message };
		}
	}

	async stop(): Promise<void> {
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
		this.running = false;
		await resourceManager.release('btle', HardwareDevice.HACKRF);
		await execAsync('pkill -f "btle_rx" 2>/dev/null').catch(() => {});
	}

	private parseLine(line: string): BLEPacket | null {
		try {
			// btle_rx outputs: channel mac pdu_type rssi adv_data
			const parts = line.trim().split(/\s+/);
			if (parts.length < 4) return null;

			return {
				channel: parseInt(parts[0]) || this.config.channel,
				mac: parts[1] || 'unknown',
				pduType: parts[2] || 'unknown',
				rssi: parseInt(parts[3]) || -100,
				advData: parts.slice(4).join(' '),
				angle: null,
				timestamp: new Date().toISOString(),
				name: null
			};
		} catch {
			return null;
		}
	}

	getStatus(): BTLEStatus {
		return {
			running: this.running,
			packetCount: this.packets.length,
			uniqueDevices: this.uniqueDevices.size,
			channel: this.config.channel
		};
	}

	getPackets(filters?: { mac?: string; channel?: number }): BLEPacket[] {
		let result = [...this.packets];
		if (filters?.mac) result = result.filter((p) => p.mac === filters.mac);
		if (filters?.channel) result = result.filter((p) => p.channel === filters.channel);
		return result;
	}
}

export const btleManager = new BTLEProcessManager();
