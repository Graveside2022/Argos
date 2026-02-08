import { EventEmitter } from 'events';
import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import type { KismetConfig, WiFiDevice, DeviceStats } from './types';

/**
 * Device tracker for real-time WiFi device monitoring
 * Maintains device state, tracks associations, and detects patterns
 */
export class DeviceTracker extends EventEmitter {
    private config: KismetConfig;
    private devices = new Map<string, WiFiDevice>();
    private deviceHistory = new Map<string, WiFiDevice[]>();
    private associations = new Map<string, Set<string>>();
    private probeRequests = new Map<string, Set<string>>();
    private trackingActive = false;
    private updateInterval: NodeJS.Timer | null = null;
    private cleanupInterval: NodeJS.Timer | null = null;
    
    // Statistics
    private stats: DeviceStats = {
        total: 0,
        byType: {},
        byEncryption: {},
        byManufacturer: {},
        activeInLast5Min: 0,
        activeInLast15Min: 0,
        totalDevices: 0,
        accessPoints: 0,
        clients: 0,
        unknownDevices: 0,
        newDevicesLastHour: 0,
        activeDevicesLast5Min: 0,
        securityThreats: 0,
        rogueAPs: 0,
        encryptionTypes: new Map(),
        manufacturers: new Map(),
        channelUsage: new Map(),
        signalStrengthDistribution: new Map(),
        lastUpdate: new Date()
    };

    constructor(config: KismetConfig) {
        super();
        this.config = config;
    }

    /**
     * Start device tracking
     */
    async startTracking(): Promise<void> {
        if (this.trackingActive) {
            logWarn('Device tracking already active');
            return;
        }

        try {
            logInfo('Starting device tracking...');
            
            this.trackingActive = true;
            
            // Start periodic updates
            this.updateInterval = setInterval(async () => {
                await this.updateDevices();
            }, 5000); // Update every 5 seconds
            
            // Start cleanup task
            this.cleanupInterval = setInterval(() => {
                this.cleanupOldDevices();
            }, 60000); // Cleanup every minute
            
            logInfo('Device tracking started');
            this.emit('tracking_started');
            
        } catch (error) {
            logError('Failed to start device tracking', { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Stop device tracking
     */
    async stopTracking(): Promise<void> {
        if (!this.trackingActive) {
            return;
        }

        try {
            logInfo('Stopping device tracking...');
            
            this.trackingActive = false;
            
            // Stop intervals
            if (this.updateInterval) {
                clearInterval(this.updateInterval as NodeJS.Timeout);
                this.updateInterval = null;
            }
            
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval as NodeJS.Timeout);
                this.cleanupInterval = null;
            }
            
            logInfo('Device tracking stopped');
            this.emit('tracking_stopped');
            
        } catch (error) {
            logError('Error stopping device tracking', { error: (error as Error).message });
        }
    }

    /**
     * Update device information
     */
    async updateDevices(): Promise<void> {
        if (!this.trackingActive) {
            return;
        }

        try {
            // This method is called by the KismetController
            // The actual device data comes from the API client
            this.updateStatistics();
            
        } catch (error) {
            logError('Error updating devices', { error: (error as Error).message });
        }
    }

    /**
     * Process a new or updated device
     */
    processDevice(deviceData: any): void {
        try {
            const mac = deviceData.mac;
            const existingDevice = this.devices.get(mac);
            
            const device: WiFiDevice = {
                mac,
                ssid: deviceData.ssid,
                deviceType: this.classifyDeviceType(deviceData),
                manufacturer: deviceData.manufacturer || 'Unknown',
                firstSeen: existingDevice?.firstSeen || new Date(),
                lastSeen: new Date(),
                signalStrength: deviceData.signal?.last_signal || -100,
                channel: deviceData.channel || 0,
                frequency: deviceData.frequency || 0,
                encryption: deviceData.encryption || [],
                securityScore: deviceData.securityScore || 0,
                threatLevel: deviceData.threatLevel || 'unknown',
                location: deviceData.location,
                associations: this.getDeviceAssociations(mac),
                probeRequests: this.getProbeRequests(mac),
                packets: deviceData.packets || 0,
                dataSize: deviceData.dataSize || 0,
                classification: deviceData.classification,
                securityAssessment: deviceData.securityAssessment
            };

            // Store device history
            this.updateDeviceHistory(mac, device);
            
            // Check if this is a new device
            if (!existingDevice) {
                this.devices.set(mac, device);
                this.emit('device_discovered', device);
                logDebug('New device discovered', { mac, type: device.deviceType });
            } else {
                // Update existing device
                this.devices.set(mac, device);
                this.emit('device_updated', device);
                
                // Check for significant changes
                this.checkForSignificantChanges(existingDevice, device);
            }
            
            // Update associations if this is an access point
            if (device.deviceType === 'access_point') {
                this.updateAssociations(mac, deviceData.clients || []);
            }
            
            // Track probe requests for clients
            if (device.deviceType === 'client') {
                this.updateProbeRequests(mac, deviceData.probeRequests || []);
            }
            
        } catch (error) {
            logError('Error processing device', { 
                mac: deviceData.mac, 
                error: (error as Error).message 
            });
        }
    }

    /**
     * Get device count
     */
    getDeviceCount(): number {
        return this.devices.size;
    }

    /**
     * Get all tracked devices
     */
    getDevices(): WiFiDevice[] {
        return Array.from(this.devices.values());
    }

    /**
     * Get device by MAC address
     */
    getDevice(mac: string): WiFiDevice | undefined {
        return this.devices.get(mac);
    }

    /**
     * Get device statistics
     */
    getStatistics(): DeviceStats {
        return { ...this.stats };
    }

    /**
     * Get device history
     */
    getDeviceHistory(mac: string): WiFiDevice[] {
        return this.deviceHistory.get(mac) || [];
    }

    /**
     * Get devices by type
     */
    getDevicesByType(type: string): WiFiDevice[] {
        return Array.from(this.devices.values()).filter(device => device.deviceType === type);
    }

    /**
     * Get devices by manufacturer
     */
    getDevicesByManufacturer(manufacturer: string): WiFiDevice[] {
        return Array.from(this.devices.values()).filter(device => 
            device.manufacturer.toLowerCase().includes(manufacturer.toLowerCase())
        );
    }

    /**
     * Get recently active devices
     */
    getRecentlyActiveDevices(minutes: number = 5): WiFiDevice[] {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return Array.from(this.devices.values()).filter(device => 
            device.lastSeen > cutoff
        );
    }

    /**
     * Get devices with security threats
     */
    getThreatenedDevices(): WiFiDevice[] {
        return Array.from(this.devices.values()).filter(device => 
            device.threatLevel === 'high' || device.threatLevel === 'critical'
        );
    }

    /**
     * Classify device type based on Kismet data
     */
    private classifyDeviceType(deviceData: any): 'access_point' | 'client' | 'bridge' | 'unknown' {
        const type = deviceData.type?.toLowerCase() || '';
        
        if (type.includes('ap') || type.includes('access') || type.includes('beacon')) {
            return 'access_point';
        }
        
        if (type.includes('client') || type.includes('station') || type.includes('sta')) {
            return 'client';
        }
        
        if (type.includes('bridge') || type.includes('repeater')) {
            return 'bridge';
        }
        
        // Try to infer from other data
        if (deviceData.ssid && deviceData.beacon) {
            return 'access_point';
        }
        
        if (deviceData.probeRequests?.length > 0) {
            return 'client';
        }
        
        return 'unknown';
    }

    /**
     * Update device history
     */
    private updateDeviceHistory(mac: string, device: WiFiDevice): void {
        const history = this.deviceHistory.get(mac) || [];
        
        // Add current state to history
        history.push({ ...device });
        
        // Limit history to last 100 entries
        if (history.length > 100) {
            history.shift();
        }
        
        this.deviceHistory.set(mac, history);
    }

    /**
     * Update device associations
     */
    private updateAssociations(apMac: string, clients: string[]): void {
        const associations = this.associations.get(apMac) || new Set();
        
        // Add new associations
        clients.forEach(clientMac => {
            associations.add(clientMac);
        });
        
        this.associations.set(apMac, associations);
    }

    /**
     * Update probe requests
     */
    private updateProbeRequests(clientMac: string, probeRequests: string[]): void {
        const probes = this.probeRequests.get(clientMac) || new Set();
        
        // Add new probe requests
        probeRequests.forEach(ssid => {
            probes.add(ssid);
        });
        
        this.probeRequests.set(clientMac, probes);
    }

    /**
     * Get device associations
     */
    private getDeviceAssociations(mac: string): string[] {
        const associations = this.associations.get(mac);
        return associations ? Array.from(associations) : [];
    }

    /**
     * Get probe requests for a device
     */
    private getProbeRequests(mac: string): string[] {
        const probes = this.probeRequests.get(mac);
        return probes ? Array.from(probes) : [];
    }

    /**
     * Check for significant changes in device data
     */
    private checkForSignificantChanges(oldDevice: WiFiDevice, newDevice: WiFiDevice): void {
        // Check for signal strength changes
        const signalDiff = Math.abs(newDevice.signalStrength - oldDevice.signalStrength);
        if (signalDiff > 20) { // 20 dBm threshold
            this.emit('signal_change', {
                mac: newDevice.mac,
                oldSignal: oldDevice.signalStrength,
                newSignal: newDevice.signalStrength,
                change: signalDiff
            });
        }
        
        // Check for channel changes
        if (newDevice.channel !== oldDevice.channel) {
            this.emit('channel_change', {
                mac: newDevice.mac,
                oldChannel: oldDevice.channel,
                newChannel: newDevice.channel
            });
        }
        
        // Check for SSID changes
        if (newDevice.ssid !== oldDevice.ssid) {
            this.emit('ssid_change', {
                mac: newDevice.mac,
                oldSsid: oldDevice.ssid,
                newSsid: newDevice.ssid
            });
        }
        
        // Check for threat level changes
        if (newDevice.threatLevel !== oldDevice.threatLevel) {
            this.emit('threat_level_change', {
                mac: newDevice.mac,
                oldThreat: oldDevice.threatLevel,
                newThreat: newDevice.threatLevel
            });
        }
    }

    /**
     * Update statistics
     */
    private updateStatistics(): void {
        const devices = Array.from(this.devices.values());
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        // Basic counts
        this.stats.totalDevices = devices.length;
        this.stats.accessPoints = devices.filter(d => d.deviceType === 'access_point').length;
        this.stats.clients = devices.filter(d => d.deviceType === 'client').length;
        this.stats.unknownDevices = devices.filter(d => d.deviceType === 'unknown').length;
        
        // Activity metrics
        this.stats.activeDevicesLast5Min = devices.filter(d => d.lastSeen > fiveMinutesAgo).length;
        this.stats.newDevicesLastHour = devices.filter(d => d.firstSeen > oneHourAgo).length;
        
        // Security metrics
        this.stats.securityThreats = devices.filter(d => 
            d.threatLevel === 'high' || d.threatLevel === 'critical'
        ).length;
        this.stats.rogueAPs = devices.filter(d => 
            d.deviceType === 'access_point' && d.threatLevel === 'critical'
        ).length;
        
        // Encryption distribution
        this.stats.encryptionTypes.clear();
        devices.forEach(device => {
            if (device.encryption.length === 0) {
                this.stats.encryptionTypes.set('Open', 
                    (this.stats.encryptionTypes.get('Open') || 0) + 1);
            } else {
                device.encryption.forEach(enc => {
                    this.stats.encryptionTypes.set(enc, 
                        (this.stats.encryptionTypes.get(enc) || 0) + 1);
                });
            }
        });
        
        // Manufacturer distribution
        this.stats.manufacturers.clear();
        devices.forEach(device => {
            this.stats.manufacturers.set(device.manufacturer, 
                (this.stats.manufacturers.get(device.manufacturer) || 0) + 1);
        });
        
        // Channel usage
        this.stats.channelUsage.clear();
        devices.forEach(device => {
            if (device.channel > 0) {
                this.stats.channelUsage.set(device.channel, 
                    (this.stats.channelUsage.get(device.channel) || 0) + 1);
            }
        });
        
        // Signal strength distribution
        this.stats.signalStrengthDistribution.clear();
        devices.forEach(device => {
            const range = this.getSignalStrengthRange(device.signalStrength);
            this.stats.signalStrengthDistribution.set(range, 
                (this.stats.signalStrengthDistribution.get(range) || 0) + 1);
        });
        
        this.stats.lastUpdate = now;
    }

    /**
     * Get signal strength range for statistics
     */
    private getSignalStrengthRange(strength: number): string {
        if (strength >= -30) return 'Excellent (-30 to 0)';
        if (strength >= -50) return 'Good (-50 to -30)';
        if (strength >= -60) return 'Fair (-60 to -50)';
        if (strength >= -70) return 'Weak (-70 to -60)';
        return 'Very Weak (<-70)';
    }

    /**
     * Clean up old devices that haven't been seen recently
     */
    private cleanupOldDevices(): void {
        const cutoff = new Date(Date.now() - this.config.deviceTimeout * 1000);
        const removedDevices: string[] = [];
        
        for (const [mac, device] of this.devices.entries()) {
            if (device.lastSeen < cutoff) {
                this.devices.delete(mac);
                removedDevices.push(mac);
                this.emit('device_lost', device);
            }
        }
        
        if (removedDevices.length > 0) {
            logInfo(`Cleaned up ${removedDevices.length} old devices`);
        }
        
        // Also cleanup associations and probe requests
        removedDevices.forEach(mac => {
            this.associations.delete(mac);
            this.probeRequests.delete(mac);
            this.deviceHistory.delete(mac);
        });
    }
}