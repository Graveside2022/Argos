/**
 * SDR Controller for GNU Radio Integration
 * Phase 2: Hardware abstraction and control layer
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { SDRDevice, SpectrumConfig, GnuRadioConfig } from './types';
import { SDRDeviceManager } from './utils/device_manager';

export class SDRController extends EventEmitter {
    private deviceManager: SDRDeviceManager;
    private activeDevice: SDRDevice | null = null;
    private deviceProcess: ChildProcess | null = null;
    private config: GnuRadioConfig;
    private isInitialized: boolean = false;
    private deviceMonitorInterval: NodeJS.Timeout | null = null;
    
    constructor(config: GnuRadioConfig) {
        super();
        this.config = config;
        this.deviceManager = new SDRDeviceManager();
        
        // Start device monitoring
        this.startDeviceMonitoring();
    }
    
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }
        
        try {
            console.log('Initializing SDR Controller...');
            
            // Refresh device list
            await this.refreshDevices();
            
            // Select default device
            await this.selectDevice();
            
            // Test selected device
            if (this.activeDevice) {
                const testResult = await this.testDevice(this.activeDevice);
                if (!testResult) {
                    throw new Error(`Device test failed for ${this.activeDevice.name}`);
                }
            }
            
            this.isInitialized = true;
            console.log('SDR Controller initialized successfully');
            
            this.emit('initialized', {
                device: this.activeDevice,
                devices: this.deviceManager.getDevices()
            });
            
        } catch (error) {
            console.error('Failed to initialize SDR Controller:', error);
            throw error;
        }
    }
    
    async refreshDevices(): Promise<SDRDevice[]> {
        try {
            const devices = await this.deviceManager.refreshDevices();
            
            this.emit('devices_updated', {
                devices: devices,
                activeDevice: this.activeDevice
            });
            
            return devices;
            
        } catch (error) {
            console.error('Error refreshing devices:', error);
            throw error;
        }
    }
    
    async selectDevice(deviceId?: string): Promise<SDRDevice | null> {
        try {
            let device: SDRDevice | null = null;
            
            if (deviceId) {
                device = this.deviceManager.selectDevice(deviceId);
            } else {
                // Auto-select best device
                device = this.deviceManager.selectBestDevice();
            }
            
            if (!device) {
                throw new Error('No compatible SDR device found');
            }
            
            // Stop any existing device process
            if (this.deviceProcess) {
                this.deviceProcess.kill();
                this.deviceProcess = null;
            }
            
            this.activeDevice = device;
            
            console.log(`Selected SDR device: ${device.name} (${device.deviceId})`);
            
            this.emit('device_selected', {
                device: device,
                previousDevice: this.activeDevice
            });
            
            return device;
            
        } catch (error) {
            console.error('Error selecting device:', error);
            throw error;
        }
    }
    
    async testDevice(device: SDRDevice): Promise<boolean> {
        try {
            console.log(`Testing device: ${device.name}...`);
            
            const result = await this.deviceManager.testDevice(device);
            
            if (result) {
                console.log(`Device test successful: ${device.name}`);
                this.emit('device_test_success', { device });
            } else {
                console.log(`Device test failed: ${device.name}`);
                this.emit('device_test_failed', { device });
            }
            
            return result;
            
        } catch (error) {
            console.error(`Device test error for ${device.name}:`, error);
            this.emit('device_test_error', { device, error: error.message });
            return false;
        }
    }
    
    async startCapture(config: SpectrumConfig): Promise<void> {
        if (!this.activeDevice) {
            throw new Error('No active SDR device selected');
        }
        
        try {
            // Validate configuration for device
            this.validateConfiguration(config, this.activeDevice);
            
            // Create device-specific command
            const command = this.createCaptureCommand(config, this.activeDevice);
            
            // Start capture process
            this.deviceProcess = spawn(command.cmd, command.args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env }
            });
            
            // Handle process events
            this.deviceProcess.on('error', (error) => {
                console.error('Device capture process error:', error);
                this.emit('capture_error', { error: error.message });
            });
            
            this.deviceProcess.on('exit', (code, signal) => {
                console.log(`Device capture process exited with code ${code}, signal ${signal}`);
                this.emit('capture_stopped', { code, signal });
                this.deviceProcess = null;
            });
            
            // Handle stdout/stderr
            this.deviceProcess.stdout?.on('data', (data) => {
                this.emit('capture_data', { data: data.toString() });
            });
            
            this.deviceProcess.stderr?.on('data', (data) => {
                console.log('Device capture stderr:', data.toString());
                this.emit('capture_log', { data: data.toString() });
            });
            
            console.log(`Started capture on ${this.activeDevice.name}`);
            this.emit('capture_started', { device: this.activeDevice, config });
            
        } catch (error) {
            console.error('Error starting capture:', error);
            throw error;
        }
    }
    
    async stopCapture(): Promise<void> {
        if (!this.deviceProcess) {
            return;
        }
        
        try {
            console.log('Stopping device capture...');
            
            this.deviceProcess.kill('SIGTERM');
            
            // Force kill if not terminated within 5 seconds
            setTimeout(() => {
                if (this.deviceProcess && !this.deviceProcess.killed) {
                    this.deviceProcess.kill('SIGKILL');
                }
            }, 5000);
            
            this.deviceProcess = null;
            
            console.log('Device capture stopped');
            this.emit('capture_stopped', { code: 0, signal: 'SIGTERM' });
            
        } catch (error) {
            console.error('Error stopping capture:', error);
            throw error;
        }
    }
    
    private validateConfiguration(config: SpectrumConfig, device: SDRDevice): void {
        // Validate frequency range
        if (!this.deviceManager.validateFrequency(config.centerFreq, device)) {
            throw new Error(`Frequency ${config.centerFreq} Hz is outside device range [${device.frequencyRange.min}, ${device.frequencyRange.max}]`);
        }
        
        // Validate sample rate
        if (!this.deviceManager.validateSampleRate(config.sampleRate, device)) {
            throw new Error(`Sample rate ${config.sampleRate} Hz is not supported by device`);
        }
        
        // Validate gain
        if (device.gainRange && (config.gain < device.gainRange.min || config.gain > device.gainRange.max)) {
            throw new Error(`Gain ${config.gain} dB is outside device range [${device.gainRange.min}, ${device.gainRange.max}]`);
        }
    }
    
    private createCaptureCommand(config: SpectrumConfig, device: SDRDevice): { cmd: string; args: string[] } {
        switch (device.type) {
            case 'hackrf':
                return {
                    cmd: 'hackrf_transfer',
                    args: [
                        '-r', '/dev/stdout',
                        '-f', config.centerFreq.toString(),
                        '-s', config.sampleRate.toString(),
                        '-g', config.gain.toString(),
                        '-l', '40',  // LNA gain
                        '-i', '32'   // IF gain
                    ]
                };
                
            case 'rtl-sdr':
                return {
                    cmd: 'rtl_sdr',
                    args: [
                        '-f', config.centerFreq.toString(),
                        '-s', config.sampleRate.toString(),
                        '-g', config.gain.toString(),
                        '-'
                    ]
                };
                
            case 'usrp':
                return {
                    cmd: 'rx_samples_to_file',
                    args: [
                        '--freq', config.centerFreq.toString(),
                        '--rate', config.sampleRate.toString(),
                        '--gain', config.gain.toString(),
                        '--file', '/dev/stdout'
                    ]
                };
                
            default:
                throw new Error(`Unsupported device type: ${device.type}`);
        }
    }
    
    private startDeviceMonitoring(): void {
        this.deviceMonitorInterval = setInterval(async () => {
            try {
                // Check if current device is still available
                if (this.activeDevice) {
                    const isAvailable = await this.deviceManager.testDevice(this.activeDevice);
                    if (!isAvailable) {
                        console.warn(`Active device ${this.activeDevice.name} is no longer available`);
                        this.emit('device_disconnected', { device: this.activeDevice });
                        this.activeDevice = null;
                        
                        // Try to select another device
                        await this.selectDevice();
                    }
                }
                
                // Refresh device list periodically
                await this.refreshDevices();
                
            } catch (error) {
                console.error('Error in device monitoring:', error);
            }
        }, 10000); // Check every 10 seconds
    }
    
    getActiveDevice(): SDRDevice | null {
        return this.activeDevice;
    }
    
    getDevices(): SDRDevice[] {
        return this.deviceManager.getDevices();
    }
    
    getDeviceCapabilities(device?: SDRDevice): {
        supportsRX: boolean;
        supportsTX: boolean;
        maxBandwidth: number;
        minBandwidth: number;
        hasAGC: boolean;
    } {
        return this.deviceManager.getDeviceCapabilities(device || this.activeDevice);
    }
    
    async setFrequency(frequency: number): Promise<void> {
        if (!this.activeDevice) {
            throw new Error('No active device');
        }
        
        if (!this.deviceManager.validateFrequency(frequency, this.activeDevice)) {
            throw new Error(`Invalid frequency ${frequency} Hz for device ${this.activeDevice.name}`);
        }
        
        // If capture is running, restart with new frequency
        if (this.deviceProcess) {
            console.log(`Changing frequency to ${frequency} Hz, restarting capture...`);
            await this.stopCapture();
            
            // Wait briefly before restart
            setTimeout(async () => {
                const config: SpectrumConfig = {
                    centerFreq: frequency,
                    sampleRate: 2e6,
                    gain: 20,
                    fftSize: 1024,
                    deviceType: this.activeDevice!.type,
                    updateRate: 10,
                    averagingFactor: 1,
                    windowType: 'blackman'
                };
                
                await this.startCapture(config);
            }, 1000);
        }
        
        this.emit('frequency_changed', { frequency, device: this.activeDevice });
    }
    
    async setGain(gain: number): Promise<void> {
        if (!this.activeDevice) {
            throw new Error('No active device');
        }
        
        if (this.activeDevice.gainRange && 
            (gain < this.activeDevice.gainRange.min || gain > this.activeDevice.gainRange.max)) {
            throw new Error(`Invalid gain ${gain} dB for device ${this.activeDevice.name}`);
        }
        
        this.emit('gain_changed', { gain, device: this.activeDevice });
    }
    
    async resetDevice(): Promise<void> {
        if (!this.activeDevice) {
            throw new Error('No active device');
        }
        
        try {
            console.log(`Resetting device: ${this.activeDevice.name}`);
            
            // Stop any running capture
            await this.stopCapture();
            
            // Device-specific reset commands
            switch (this.activeDevice.type) {
                case 'hackrf':
                    execSync('hackrf_info', { timeout: 5000 });
                    break;
                    
                case 'rtl-sdr':
                    execSync('rtl_test -t', { timeout: 5000 });
                    break;
                    
                case 'usrp':
                    execSync('uhd_find_devices', { timeout: 10000 });
                    break;
            }
            
            console.log(`Device reset successful: ${this.activeDevice.name}`);
            this.emit('device_reset', { device: this.activeDevice });
            
        } catch (error) {
            console.error(`Device reset failed for ${this.activeDevice.name}:`, error);
            throw error;
        }
    }
    
    cleanup(): void {
        if (this.deviceMonitorInterval) {
            clearInterval(this.deviceMonitorInterval);
            this.deviceMonitorInterval = null;
        }
        
        if (this.deviceProcess) {
            this.deviceProcess.kill();
            this.deviceProcess = null;
        }
        
        this.deviceManager.cleanup();
        this.activeDevice = null;
        this.isInitialized = false;
        
        console.log('SDR Controller cleanup completed');
    }
}

// Factory function for creating SDR controller
export function createSDRController(config?: Partial<GnuRadioConfig>): SDRController {
    const defaultConfig: GnuRadioConfig = {
        defaultDevice: 'auto',
        defaultFrequency: 2.425e9,
        defaultSampleRate: 2e6,
        defaultGain: 20,
        enableAutoGain: false,
        enableSignalDetection: true,
        signalThreshold: 10,
        maxConcurrentAnalysis: 1,
        dataRetentionTime: 300,
        enableDataLogging: false,
        logDirectory: '/tmp/gnuradio_logs',
        ...config
    };
    
    return new SDRController(defaultConfig);
}