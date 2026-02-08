import { spawn, type ChildProcess } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';
import { validateNumericParam } from '$lib/server/security/input-sanitizer';
import type { PagerMessage, PagermonStatus, PagermonConfig } from './types';

const execAsync = promisify(exec);

class PagermonProcessManager extends EventEmitter {
	private process: ChildProcess | null = null;
	private running = false;
	private messages: PagerMessage[] = [];
	private config: PagermonConfig = { frequency: 152000000, gain: 40, sampleRate: 22050 };

	async start(config?: Partial<PagermonConfig>): Promise<{ success: boolean; error?: string }> {
		if (this.running) return { success: false, error: 'Already running' };

		if (config) {
			this.config = { ...this.config, ...config };
		}

		// Acquire HackRF
		const result = await resourceManager.acquire('pagermon', HardwareDevice.HACKRF);
		if (!result.success) {
			return { success: false, error: `HackRF in use by ${result.owner}` };
		}

		try {
			// Pipeline: hackrf_transfer -> multimon-ng
			// Validate numeric params before shell interpolation
			const freqHz = validateNumericParam(
				this.config.frequency,
				'frequency',
				100000,
				2000000000
			);
			const validSampleRate = validateNumericParam(
				this.config.sampleRate,
				'sampleRate',
				8000,
				20000000
			);
			const validGain = validateNumericParam(this.config.gain, 'gain', 0, 62);
			this.process = spawn(
				'sh',
				[
					'-c',
					`hackrf_transfer -r - -f ${freqHz} -s ${validSampleRate * 48} -g ${validGain} -l 32 | ` +
						`multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -f alpha -`
				],
				{ stdio: ['ignore', 'pipe', 'pipe'] }
			);

			this.running = true;

			this.process.stdout?.on('data', (data: Buffer) => {
				const lines = data.toString().split('\n').filter(Boolean);
				for (const line of lines) {
					const msg = this.parseLine(line);
					if (msg) {
						this.messages.push(msg);
						if (this.messages.length > 1000) this.messages.shift();
						this.emit('message', msg);
					}
				}
			});

			this.process.on('exit', () => {
				this.running = false;
				this.process = null;
				resourceManager.release('pagermon', HardwareDevice.HACKRF);
			});

			return { success: true };
		} catch (error) {
			await resourceManager.release('pagermon', HardwareDevice.HACKRF);
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
		await resourceManager.release('pagermon', HardwareDevice.HACKRF);
		// Also kill any lingering processes
		await execAsync('pkill -f "multimon-ng" 2>/dev/null').catch(() => {});
	}

	private parseLine(line: string): PagerMessage | null {
		// Format: POCSAG1200: Address: 1234567  Function: 0  Alpha:   Message text here
		const match = line.match(
			/POCSAG(\d+):\s+Address:\s+(\d+)\s+Function:\s+(\d+)\s+(?:Alpha|Numeric):\s*(.*)/
		);
		if (!match) return null;

		return {
			timestamp: new Date().toISOString(),
			bitrate: parseInt(match[1]),
			capcode: match[2],
			functionType: parseInt(match[3]),
			content: match[4].trim()
		};
	}

	getStatus(): PagermonStatus {
		return {
			running: this.running,
			frequency: this.config.frequency,
			messageCount: this.messages.length,
			lastMessage: this.messages.length > 0 ? this.messages[this.messages.length - 1] : null
		};
	}

	getMessages(since?: number): PagerMessage[] {
		if (since) {
			const sinceDate = new Date(since).toISOString();
			return this.messages.filter((m) => m.timestamp > sinceDate);
		}
		return [...this.messages];
	}

	clearMessages(): void {
		this.messages = [];
	}
}

export const pagermonManager = new PagermonProcessManager();
