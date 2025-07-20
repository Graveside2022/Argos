/**
 * SDR Device Manager for GNU Radio Integration
 * Phase 2: Hardware abstraction layer for HackRF and RTL-SDR
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import { SDRDevice } from '../types';

export class SDRDeviceManager {
    private detectedDevices: SDRDevice[] = [];
    private activeDevice: SDRDevice | null = null;
    private deviceProcess: ChildProcess | null = null;
    
    constructor() {
        this.refreshDevices();
    }
    
    async refreshDevices(): Promise<SDRDevice[]> {
        this.detectedDevices = [];
        
        // Check for HackRF devices
        await this.detectHackRFDevices();
        
        // Check for RTL-SDR devices
        await this.detectRTLSDRDevices();
        
        // Check for USRP devices (if available)
        await this.detectUSRPDevices();
        
        return this.detectedDevices;
    }
    
    private async detectHackRFDevices(): Promise<void> {
        try {
            // Check if hackrf_info command exists
            const result = execSync('which hackrf_info', { encoding: 'utf8' });
            if (!result.trim()) {
                console.log('HackRF tools not found, skipping HackRF detection');
                return;
            }
            
            // Run hackrf_info to detect devices
            const output = execSync('hackrf_info', { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            if (output.includes('Found HackRF')) {
                // Parse device info
                const serialMatch = output.match(/Serial number: (0x[a-fA-F0-9]+)/);
                const versionMatch = output.match(/Firmware version: ([^\n]+)/);
                
                const device: SDRDevice = {
                    type: 'hackrf',
                    name: 'HackRF One',
                    deviceId: serialMatch ? serialMatch[1] : 'unknown',
                    frequencyRange: {
                        min: 1e6,      // 1 MHz
                        max: 6e9       // 6 GHz
                    },
                    sampleRates: [2e6, 4e6, 8e6, 10e6, 12e6, 16e6, 20e6],
                    gainRange: {
                        min: 0,
                        max: 62
                    },
                    available: true,
                    description: `HackRF One - ${versionMatch ? versionMatch[1] : 'Unknown version'}`
                };
                
                this.detectedDevices.push(device);
                console.log('HackRF device detected:', device.deviceId);
            }
        } catch (error) {
            console.log('HackRF detection failed:', error.message);
        }
    }
    
    private async detectRTLSDRDevices(): Promise<void> {
        try {
            // Check if rtl_test command exists
            const result = execSync('which rtl_test', { encoding: 'utf8' });
            if (!result.trim()) {
                console.log('RTL-SDR tools not found, skipping RTL-SDR detection');
                return;
            }
            
            // Run rtl_test to detect devices
            const output = execSync('rtl_test -t', { 
                encoding: 'utf8',
                timeout: 5000 
            });
            
            // Parse device information
            const deviceMatches = output.match(/Found \d+ device\(s\):/);
            if (deviceMatches) {
                const lines = output.split('\n');
                let deviceIndex = 0;
                
                for (const line of lines) {
                    if (line.includes('Realtek, RTL')) {
                        const device: SDRDevice = {
                            type: 'rtl-sdr',
                            name: 'RTL-SDR',
                            deviceId: `rtl-sdr-${deviceIndex}`,
                            frequencyRange: {
                                min: 24e6,     // 24 MHz
                                max: 1766e6    // 1.766 GHz
                            },
                            sampleRates: [250e3, 1e6, 2e6, 2.4e6],
                            gainRange: {
                                min: 0,
                                max: 50
                            },
                            available: true,
                            description: `RTL-SDR Device ${deviceIndex}`
                        };
                        
                        this.detectedDevices.push(device);
                        console.log('RTL-SDR device detected:', device.deviceId);
                        deviceIndex++;
                    }
                }
            }
        } catch (error) {
            console.log('RTL-SDR detection failed:', error.message);
        }
    }
    
    private async detectUSRPDevices(): Promise<void> {
        try {
            // Check if uhd_find_devices command exists
            const result = execSync('which uhd_find_devices', { encoding: 'utf8' });
            if (!result.trim()) {
                console.log('UHD tools not found, skipping USRP detection');
                return;
            }
            
            // Run uhd_find_devices to detect USRP devices
            const output = execSync('uhd_find_devices', { 
                encoding: 'utf8',
                timeout: 10000 
            });
            
            // Parse USRP device information
            if (output.includes('Device Address')) {
                const device: SDRDevice = {
                    type: 'usrp',
                    name: 'USRP Device',
                    deviceId: 'usrp-0',
                    frequencyRange: {
                        min: 10e6,      // 10 MHz
                        max: 6e9        // 6 GHz (depends on daughterboard)
                    },
                    sampleRates: [1e6, 2e6, 4e6, 8e6, 10e6, 20e6, 25e6],
                    gainRange: {
                        min: 0,
                        max: 31
                    },
                    available: true,
                    description: 'USRP Software Defined Radio'
                };
                
                this.detectedDevices.push(device);
                console.log('USRP device detected');
            }
        } catch (error) {
            console.log('USRP detection failed:', error.message);
        }
    }
    
    getDevices(): SDRDevice[] {
        return this.detectedDevices;
    }
    
    getDevice(deviceId: string): SDRDevice | null {
        return this.detectedDevices.find(device => device.deviceId === deviceId) || null;
    }
    
    selectDevice(deviceId: string): SDRDevice | null {
        const device = this.getDevice(deviceId);
        if (device && device.available) {
            this.activeDevice = device;
            return device;
        }
        return null;
    }
    
    selectBestDevice(): SDRDevice | null {
        // Priority: HackRF > RTL-SDR > USRP
        const priorities = ['hackrf', 'rtl-sdr', 'usrp'];
        
        for (const type of priorities) {
            const device = this.detectedDevices.find(d => d.type === type && d.available);
            if (device) {
                this.activeDevice = device;
                return device;
            }
        }
        
        return null;
    }
    
    getActiveDevice(): SDRDevice | null {
        return this.activeDevice;
    }
    
    validateFrequency(frequency: number, device?: SDRDevice): boolean {
        const targetDevice = device || this.activeDevice;
        if (!targetDevice) return false;
        
        return frequency >= targetDevice.frequencyRange.min && 
               frequency <= targetDevice.frequencyRange.max;
    }
    
    validateSampleRate(sampleRate: number, device?: SDRDevice): boolean {
        const targetDevice = device || this.activeDevice;
        if (!targetDevice) return false;
        
        return targetDevice.sampleRates.includes(sampleRate);
    }
    
    getBestSampleRate(requestedRate: number, device?: SDRDevice): number {
        const targetDevice = device || this.activeDevice;
        if (!targetDevice) return 2e6; // Default 2 MHz
        
        // Find closest available sample rate
        let bestRate = targetDevice.sampleRates[0];
        let minDiff = Math.abs(requestedRate - bestRate);
        
        for (const rate of targetDevice.sampleRates) {
            const diff = Math.abs(requestedRate - rate);
            if (diff < minDiff) {
                minDiff = diff;
                bestRate = rate;
            }
        }
        
        return bestRate;
    }
    
    getDeviceCapabilities(device?: SDRDevice): {
        supportsRX: boolean;
        supportsTX: boolean;
        maxBandwidth: number;
        minBandwidth: number;
        hasAGC: boolean;
    } {
        const targetDevice = device || this.activeDevice;
        if (!targetDevice) {
            return {
                supportsRX: false,
                supportsTX: false,
                maxBandwidth: 0,
                minBandwidth: 0,
                hasAGC: false
            };
        }
        
        switch (targetDevice.type) {
            case 'hackrf':
                return {
                    supportsRX: true,
                    supportsTX: true,
                    maxBandwidth: 20e6,
                    minBandwidth: 1e6,
                    hasAGC: false
                };
                
            case 'rtl-sdr':
                return {
                    supportsRX: true,
                    supportsTX: false,
                    maxBandwidth: 2.4e6,
                    minBandwidth: 250e3,
                    hasAGC: true
                };
                
            case 'usrp':
                return {
                    supportsRX: true,
                    supportsTX: true,
                    maxBandwidth: 25e6,
                    minBandwidth: 1e6,
                    hasAGC: true
                };
                
            default:
                return {
                    supportsRX: false,
                    supportsTX: false,
                    maxBandwidth: 0,
                    minBandwidth: 0,
                    hasAGC: false
                };
        }
    }
    
    async testDevice(device: SDRDevice): Promise<boolean> {
        try {
            switch (device.type) {
                case 'hackrf':
                    execSync('hackrf_info', { timeout: 5000 });
                    return true;
                    
                case 'rtl-sdr':
                    execSync('rtl_test -t', { timeout: 5000 });
                    return true;
                    
                case 'usrp':
                    execSync('uhd_find_devices', { timeout: 10000 });
                    return true;
                    
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Device test failed for ${device.name}:`, error.message);
            return false;
        }
    }
    
    cleanup(): void {
        if (this.deviceProcess) {
            this.deviceProcess.kill();
            this.deviceProcess = null;
        }
        this.activeDevice = null;
    }
}