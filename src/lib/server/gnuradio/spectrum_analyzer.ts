import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface SpectrumData {
	frequency: number;
	power: number;
	timestamp: Date;
}

export interface GNURadioConfig {
	centerFrequency: number;
	sampleRate: number;
	gain: number;
	deviceArgs: string;
}

export class SpectrumAnalyzer extends EventEmitter {
	private process: ChildProcess | null = null;
	private isRunning = false;
	private config: GNURadioConfig;
	
	constructor(config: Partial<GNURadioConfig> = {}) {
		super();
		this.config = {
			centerFrequency: 433.92e6,
			sampleRate: 2e6,
			gain: 40,
			deviceArgs: 'hackrf=0',
			...config
		};
	}
	
	async start(): Promise<void> {
		if (this.isRunning) {
			throw new Error('Spectrum analyzer already running');
		}
		
		try {
			// For now, just emit that we're running
			// In production, this would spawn actual GNU Radio process
			this.isRunning = true;
			console.log('GNU Radio spectrum analyzer started');
			this.emit('started', this.config);
			
		} catch (error) {
			this.isRunning = false;
			throw new Error(`Failed to start spectrum analyzer: ${error.message}`);
		}
	}
	
	async stop(): Promise<void> {
		if (!this.isRunning) {
			return;
		}
		
		try {
			if (this.process) {
				this.process.kill('SIGTERM');
				this.process = null;
			}
			
			this.isRunning = false;
			console.log('GNU Radio spectrum analyzer stopped');
			this.emit('stopped');
			
		} catch (error) {
			throw new Error(`Failed to stop spectrum analyzer: ${error.message}`);
		}
	}
	
	getStatus(): {
		running: boolean;
		config: GNURadioConfig;
		device?: string;
		performance?: any;
		lastUpdate?: Date;
	} {
		return {
			running: this.isRunning,
			config: this.config,
			device: this.isRunning ? 'HackRF' : undefined,
			performance: {
				packetsProcessed: 0,
				cpuUsage: 0,
				memoryUsage: 0
			},
			lastUpdate: new Date()
		};
	}
	
	setFrequency(frequency: number): void {
		this.config.centerFrequency = frequency;
		if (this.isRunning) {
			// In production, send command to GNU Radio
			this.emit('frequency_changed', frequency);
		}
	}
	
	setGain(gain: number): void {
		this.config.gain = gain;
		if (this.isRunning) {
			// In production, send command to GNU Radio
			this.emit('gain_changed', gain);
		}
	}
}

// Global instance
export const spectrumAnalyzer = new SpectrumAnalyzer();