import { EventEmitter } from 'events';
import { logInfo, logError, logWarn, logDebug } from '$lib/utils/logger';
import type { CorrelationResult, NetworkPacket, RFSignal, WiFiDevice } from './types';

/**
 * Cross-domain correlation engine for unified security intelligence
 * Correlates data from Network (Wireshark), RF (GNU Radio), and WiFi (Kismet) domains
 */
export class FusionCorrelationEngine extends EventEmitter {
    private networkData: NetworkPacket[] = [];
    private rfData: RFSignal[] = [];
    private wifiData: WiFiDevice[] = [];
    private correlationResults: CorrelationResult[] = [];
    private correlationCache: Map<string, CorrelationResult> = new Map();
    private correlationRules: CorrelationRule[] = [];
    private activeCorrelations: Set<string> = new Set();
    private correlationInterval: NodeJS.Timer | null = null;
    private dataRetentionTime = 300000; // 5 minutes
    private maxCorrelationAge = 60000; // 1 minute
    private correlationThreshold = 0.7;

    constructor() {
        super();
        this.initializeCorrelationRules();
        this.startPeriodicCorrelation();
    }

    /**
     * Add network packet data for correlation
     */
    addNetworkData(packet: NetworkPacket): void {
        this.networkData.push(packet);
        this.cleanupOldData();
        this.triggerCorrelation();
    }

    /**
     * Add RF signal data for correlation
     */
    addRFData(signal: RFSignal): void {
        this.rfData.push(signal);
        this.cleanupOldData();
        this.triggerCorrelation();
    }

    /**
     * Add WiFi device data for correlation
     */
    addWiFiData(device: WiFiDevice): void {
        const existingIndex = this.wifiData.findIndex(d => d.mac === device.mac);
        if (existingIndex >= 0) {
            this.wifiData[existingIndex] = device;
        } else {
            this.wifiData.push(device);
        }
        this.cleanupOldData();
        this.triggerCorrelation();
    }

    /**
     * Analyze correlations across all domains
     */
    async analyzeCorrelations(): Promise<CorrelationResult[]> {
        try {
            const correlations: CorrelationResult[] = [];
            
            // Temporal correlations - events happening at similar times
            correlations.push(...await this.findTemporalCorrelations());
            
            // Geographic correlations - events from similar locations
            correlations.push(...await this.findGeographicCorrelations());
            
            // Frequency correlations - RF and WiFi on same frequencies
            correlations.push(...await this.findFrequencyCorrelations());
            
            // Device correlations - link network IPs with WiFi MACs
            correlations.push(...await this.findDeviceCorrelations());
            
            // Behavioral correlations - similar patterns across domains
            correlations.push(...await this.findBehavioralCorrelations());
            
            // Security correlations - threats across domains
            correlations.push(...await this.findSecurityCorrelations());
            
            // Filter high-confidence correlations
            const highConfidenceCorrelations = correlations.filter(
                c => c.confidence >= this.correlationThreshold
            );
            
            // Store results
            this.correlationResults = this.prioritizeCorrelations(highConfidenceCorrelations);
            
            // Emit correlation events
            this.correlationResults.forEach(correlation => {
                this.emit('correlation_found', correlation);
            });
            
            return this.correlationResults;
            
        } catch (error) {
            logError('Error analyzing correlations', { error: error.message });
            return [];
        }
    }

    /**
     * Get active correlations
     */
    getActiveCorrelations(): CorrelationResult[] {
        const now = Date.now();
        return this.correlationResults.filter(
            c => now - c.timestamp.getTime() < this.maxCorrelationAge
        );
    }

    /**
     * Get correlation statistics
     */
    getCorrelationStats(): any {
        const stats = {
            totalCorrelations: this.correlationResults.length,
            activeCorrelations: this.getActiveCorrelations().length,
            correlationsByType: new Map<string, number>(),
            averageConfidence: 0,
            domainCoverage: {
                network: this.networkData.length,
                rf: this.rfData.length,
                wifi: this.wifiData.length
            },
            lastAnalysis: new Date()
        };
        
        // Calculate correlation type distribution
        this.correlationResults.forEach(c => {
            const count = stats.correlationsByType.get(c.type) || 0;
            stats.correlationsByType.set(c.type, count + 1);
        });
        
        // Calculate average confidence
        if (this.correlationResults.length > 0) {
            stats.averageConfidence = this.correlationResults.reduce(
                (sum, c) => sum + c.confidence, 0
            ) / this.correlationResults.length;
        }
        
        return stats;
    }

    /**
     * Find temporal correlations
     */
    private async findTemporalCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        const timeWindow = 30000; // 30 seconds
        
        // Network-WiFi temporal correlations
        for (const packet of this.networkData) {
            for (const device of this.wifiData) {
                const timeDiff = Math.abs(
                    packet.timestamp.getTime() - device.lastSeen.getTime()
                );
                
                if (timeDiff <= timeWindow) {
                    const correlation = await this.createCorrelation(
                        'temporal_network_wifi',
                        [packet],
                        [],
                        [device],
                        this.calculateTemporalConfidence(timeDiff, timeWindow),
                        ['time_proximity'],
                        'Network activity correlates with WiFi device activity'
                    );
                    
                    if (correlation) {
                        correlations.push(correlation);
                    }
                }
            }
        }
        
        // RF-WiFi temporal correlations
        for (const signal of this.rfData) {
            for (const device of this.wifiData) {
                const timeDiff = Math.abs(
                    signal.timestamp.getTime() - device.lastSeen.getTime()
                );
                
                if (timeDiff <= timeWindow) {
                    const correlation = await this.createCorrelation(
                        'temporal_rf_wifi',
                        [],
                        [signal],
                        [device],
                        this.calculateTemporalConfidence(timeDiff, timeWindow),
                        ['time_proximity'],
                        'RF signal correlates with WiFi device activity'
                    );
                    
                    if (correlation) {
                        correlations.push(correlation);
                    }
                }
            }
        }
        
        return correlations;
    }

    /**
     * Find geographic correlations
     */
    private async findGeographicCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        const locationThreshold = 100; // meters
        
        // WiFi-WiFi geographic correlations
        for (let i = 0; i < this.wifiData.length; i++) {
            for (let j = i + 1; j < this.wifiData.length; j++) {
                const device1 = this.wifiData[i];
                const device2 = this.wifiData[j];
                
                if (device1.location && device2.location) {
                    const distance = this.calculateDistance(
                        device1.location,
                        device2.location
                    );
                    
                    if (distance <= locationThreshold) {
                        const correlation = await this.createCorrelation(
                            'geographic_wifi_wifi',
                            [],
                            [],
                            [device1, device2],
                            this.calculateGeographicConfidence(distance, locationThreshold),
                            ['geographic_proximity'],
                            `WiFi devices are geographically close (${distance.toFixed(1)}m apart)`
                        );
                        
                        if (correlation) {
                            correlations.push(correlation);
                        }
                    }
                }
            }
        }
        
        return correlations;
    }

    /**
     * Find frequency correlations
     */
    private async findFrequencyCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        const frequencyTolerance = 50000; // 50 kHz
        
        // RF-WiFi frequency correlations
        for (const signal of this.rfData) {
            for (const device of this.wifiData) {
                if (device.frequency) {
                    const freqDiff = Math.abs(signal.frequency - device.frequency);
                    
                    if (freqDiff <= frequencyTolerance) {
                        const correlation = await this.createCorrelation(
                            'frequency_rf_wifi',
                            [],
                            [signal],
                            [device],
                            this.calculateFrequencyConfidence(freqDiff, frequencyTolerance),
                            ['frequency_match'],
                            `RF signal and WiFi device on similar frequency (${freqDiff} Hz apart)`
                        );
                        
                        if (correlation) {
                            correlations.push(correlation);
                        }
                    }
                }
            }
        }
        
        return correlations;
    }

    /**
     * Find device correlations
     */
    private async findDeviceCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        
        // Network-WiFi device correlations
        for (const packet of this.networkData) {
            for (const device of this.wifiData) {
                let confidence = 0;
                const evidence: string[] = [];
                
                // Check for IP-MAC correlation (simplified)
                if (packet.sourceIP && device.mac) {
                    // In real implementation, this would check ARP tables
                    confidence += 0.3;
                    evidence.push('potential_ip_mac_correlation');
                }
                
                // Check for hostname correlation
                if (packet.hostname && device.manufacturer) {
                    const hostnameMatch = this.checkHostnameManufacturerMatch(
                        packet.hostname,
                        device.manufacturer
                    );
                    
                    if (hostnameMatch) {
                        confidence += 0.4;
                        evidence.push('hostname_manufacturer_match');
                    }
                }
                
                // Check for traffic pattern correlation
                if (this.checkTrafficPatternMatch(packet, device)) {
                    confidence += 0.3;
                    evidence.push('traffic_pattern_match');
                }
                
                if (confidence >= this.correlationThreshold) {
                    const correlation = await this.createCorrelation(
                        'device_network_wifi',
                        [packet],
                        [],
                        [device],
                        confidence,
                        evidence,
                        'Network traffic correlates with WiFi device'
                    );
                    
                    if (correlation) {
                        correlations.push(correlation);
                    }
                }
            }
        }
        
        return correlations;
    }

    /**
     * Find behavioral correlations
     */
    private async findBehavioralCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        
        // Analyze behavioral patterns across domains
        const networkPatterns = this.extractNetworkPatterns();
        const rfPatterns = this.extractRFPatterns();
        const wifiPatterns = this.extractWiFiPatterns();
        
        // Correlate similar behavioral patterns
        for (const netPattern of networkPatterns) {
            for (const wifiPattern of wifiPatterns) {
                const similarity = this.calculateBehavioralSimilarity(
                    netPattern,
                    wifiPattern
                );
                
                if (similarity >= this.correlationThreshold) {
                    const correlation = await this.createCorrelation(
                        'behavioral_network_wifi',
                        netPattern.packets,
                        [],
                        wifiPattern.devices,
                        similarity,
                        ['behavioral_similarity'],
                        'Similar behavioral patterns in network and WiFi domains'
                    );
                    
                    if (correlation) {
                        correlations.push(correlation);
                    }
                }
            }
        }
        
        return correlations;
    }

    /**
     * Find security correlations
     */
    private async findSecurityCorrelations(): Promise<CorrelationResult[]> {
        const correlations: CorrelationResult[] = [];
        
        // Network-WiFi security correlations
        const suspiciousPackets = this.networkData.filter(p => p.suspicious);
        const threatenedDevices = this.wifiData.filter(d => 
            d.threatLevel === 'high' || d.threatLevel === 'critical'
        );
        
        for (const packet of suspiciousPackets) {
            for (const device of threatenedDevices) {
                const correlation = await this.createCorrelation(
                    'security_network_wifi',
                    [packet],
                    [],
                    [device],
                    0.8, // High confidence for security correlations
                    ['security_threat_correlation'],
                    'Suspicious network activity correlates with WiFi threat'
                );
                
                if (correlation) {
                    correlations.push(correlation);
                }
            }
        }
        
        return correlations;
    }

    /**
     * Create correlation result
     */
    private async createCorrelation(
        type: string,
        networkEntities: NetworkPacket[],
        rfEntities: RFSignal[],
        wifiEntities: WiFiDevice[],
        confidence: number,
        evidence: string[],
        description: string
    ): Promise<CorrelationResult | null> {
        try {
            // Generate unique correlation ID
            const id = this.generateCorrelationId(type, networkEntities, rfEntities, wifiEntities);
            
            // Check if correlation already exists
            if (this.correlationCache.has(id)) {
                return null;
            }
            
            const correlation: CorrelationResult = {
                id,
                type,
                confidence,
                entities: {
                    network: networkEntities,
                    rf: rfEntities,
                    wifi: wifiEntities
                },
                evidence,
                description,
                timestamp: new Date(),
                threatLevel: this.assessCorrelationThreatLevel(confidence, evidence),
                metadata: {
                    domains: this.getInvolvedDomains(networkEntities, rfEntities, wifiEntities),
                    entityCount: networkEntities.length + rfEntities.length + wifiEntities.length
                }
            };
            
            // Cache correlation
            this.correlationCache.set(id, correlation);
            
            return correlation;
            
        } catch (error) {
            logError('Error creating correlation', { error: error.message });
            return null;
        }
    }

    /**
     * Calculate temporal confidence
     */
    private calculateTemporalConfidence(timeDiff: number, timeWindow: number): number {
        return Math.max(0, 1 - (timeDiff / timeWindow));
    }

    /**
     * Calculate geographic confidence
     */
    private calculateGeographicConfidence(distance: number, threshold: number): number {
        return Math.max(0, 1 - (distance / threshold));
    }

    /**
     * Calculate frequency confidence
     */
    private calculateFrequencyConfidence(freqDiff: number, tolerance: number): number {
        return Math.max(0, 1 - (freqDiff / tolerance));
    }

    /**
     * Calculate distance between two locations
     */
    private calculateDistance(loc1: any, loc2: any): number {
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = (loc1.latitude * Math.PI) / 180;
        const lat2Rad = (loc2.latitude * Math.PI) / 180;
        const deltaLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
        const deltaLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
        
        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                 Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                 Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c;
    }

    /**
     * Check hostname-manufacturer match
     */
    private checkHostnameManufacturerMatch(hostname: string, manufacturer: string): boolean {
        const hostnameLC = hostname.toLowerCase();
        const manufacturerLC = manufacturer.toLowerCase();
        
        // Check for direct matches
        if (hostnameLC.includes(manufacturerLC) || manufacturerLC.includes(hostnameLC)) {
            return true;
        }
        
        // Check for common patterns
        const patterns = [
            { hostname: /iphone|ipad|mac/i, manufacturer: /apple/i },
            { hostname: /android|galaxy|samsung/i, manufacturer: /samsung/i },
            { hostname: /pixel|google/i, manufacturer: /google/i },
            { hostname: /windows|microsoft/i, manufacturer: /microsoft/i }
        ];
        
        return patterns.some(pattern => 
            pattern.hostname.test(hostnameLC) && pattern.manufacturer.test(manufacturerLC)
        );
    }

    /**
     * Check traffic pattern match
     */
    private checkTrafficPatternMatch(packet: NetworkPacket, device: WiFiDevice): boolean {
        // Simplified traffic pattern matching
        // In real implementation, this would analyze packet timing, sizes, protocols
        
        // Check for mobile device patterns
        if (device.deviceType === 'client' && device.classification?.characteristics?.isMobile) {
            return packet.protocol === 'HTTPS' || packet.protocol === 'HTTP';
        }
        
        // Check for IoT device patterns
        if (device.classification?.characteristics?.isIoT) {
            return packet.protocol === 'MQTT' || packet.protocol === 'CoAP';
        }
        
        return false;
    }

    /**
     * Extract network patterns
     */
    private extractNetworkPatterns(): any[] {
        const patterns: any[] = [];
        
        // Group packets by source IP
        const ipGroups = new Map<string, NetworkPacket[]>();
        this.networkData.forEach(packet => {
            const packets = ipGroups.get(packet.sourceIP) || [];
            packets.push(packet);
            ipGroups.set(packet.sourceIP, packets);
        });
        
        // Analyze patterns for each IP
        for (const [ip, packets] of ipGroups) {
            patterns.push({
                ip,
                packets,
                pattern: this.analyzeNetworkPattern(packets)
            });
        }
        
        return patterns;
    }

    /**
     * Extract RF patterns
     */
    private extractRFPatterns(): any[] {
        const patterns: any[] = [];
        
        // Group signals by frequency
        const freqGroups = new Map<number, RFSignal[]>();
        this.rfData.forEach(signal => {
            const signals = freqGroups.get(signal.frequency) || [];
            signals.push(signal);
            freqGroups.set(signal.frequency, signals);
        });
        
        // Analyze patterns for each frequency
        for (const [freq, signals] of freqGroups) {
            patterns.push({
                frequency: freq,
                signals,
                pattern: this.analyzeRFPattern(signals)
            });
        }
        
        return patterns;
    }

    /**
     * Extract WiFi patterns
     */
    private extractWiFiPatterns(): any[] {
        const patterns: any[] = [];
        
        // Group devices by type
        const typeGroups = new Map<string, WiFiDevice[]>();
        this.wifiData.forEach(device => {
            const devices = typeGroups.get(device.deviceType) || [];
            devices.push(device);
            typeGroups.set(device.deviceType, devices);
        });
        
        // Analyze patterns for each device type
        for (const [type, devices] of typeGroups) {
            patterns.push({
                type,
                devices,
                pattern: this.analyzeWiFiPattern(devices)
            });
        }
        
        return patterns;
    }

    /**
     * Analyze network pattern
     */
    private analyzeNetworkPattern(packets: NetworkPacket[]): any {
        return {
            packetCount: packets.length,
            protocols: Array.from(new Set(packets.map(p => p.protocol))),
            avgPacketSize: packets.reduce((sum, p) => sum + p.length, 0) / packets.length,
            timeSpan: packets.length > 1 ? 
                packets[packets.length - 1].timestamp.getTime() - packets[0].timestamp.getTime() : 0
        };
    }

    /**
     * Analyze RF pattern
     */
    private analyzeRFPattern(signals: RFSignal[]): any {
        return {
            signalCount: signals.length,
            avgPower: signals.reduce((sum, s) => sum + s.power, 0) / signals.length,
            powerRange: {
                min: Math.min(...signals.map(s => s.power)),
                max: Math.max(...signals.map(s => s.power))
            },
            timeSpan: signals.length > 1 ?
                signals[signals.length - 1].timestamp.getTime() - signals[0].timestamp.getTime() : 0
        };
    }

    /**
     * Analyze WiFi pattern
     */
    private analyzeWiFiPattern(devices: WiFiDevice[]): any {
        return {
            deviceCount: devices.length,
            avgSignalStrength: devices.reduce((sum, d) => sum + d.signalStrength, 0) / devices.length,
            manufacturers: Array.from(new Set(devices.map(d => d.manufacturer))),
            encryptionTypes: Array.from(new Set(devices.flatMap(d => d.encryption)))
        };
    }

    /**
     * Calculate behavioral similarity
     */
    private calculateBehavioralSimilarity(pattern1: any, pattern2: any): number {
        let similarity = 0;
        let factors = 0;
        
        // Compare time patterns
        if (pattern1.pattern.timeSpan && pattern2.pattern.timeSpan) {
            const timeRatio = Math.min(pattern1.pattern.timeSpan, pattern2.pattern.timeSpan) /
                             Math.max(pattern1.pattern.timeSpan, pattern2.pattern.timeSpan);
            similarity += timeRatio * 0.3;
            factors += 0.3;
        }
        
        // Compare activity levels
        if (pattern1.pattern.packetCount && pattern2.pattern.deviceCount) {
            const activityRatio = Math.min(pattern1.pattern.packetCount, pattern2.pattern.deviceCount) /
                                 Math.max(pattern1.pattern.packetCount, pattern2.pattern.deviceCount);
            similarity += activityRatio * 0.4;
            factors += 0.4;
        }
        
        // Compare protocol/encryption diversity
        if (pattern1.pattern.protocols && pattern2.pattern.encryptionTypes) {
            const diversity1 = pattern1.pattern.protocols.length;
            const diversity2 = pattern2.pattern.encryptionTypes.length;
            const diversityRatio = Math.min(diversity1, diversity2) / Math.max(diversity1, diversity2);
            similarity += diversityRatio * 0.3;
            factors += 0.3;
        }
        
        return factors > 0 ? similarity / factors : 0;
    }

    /**
     * Prioritize correlations
     */
    private prioritizeCorrelations(correlations: CorrelationResult[]): CorrelationResult[] {
        return correlations.sort((a, b) => {
            // Sort by confidence first
            if (a.confidence !== b.confidence) {
                return b.confidence - a.confidence;
            }
            
            // Then by threat level
            const threatOrder = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
            const aThreat = threatOrder[a.threatLevel] || 0;
            const bThreat = threatOrder[b.threatLevel] || 0;
            
            if (aThreat !== bThreat) {
                return bThreat - aThreat;
            }
            
            // Finally by timestamp (newest first)
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
    }

    /**
     * Generate correlation ID
     */
    private generateCorrelationId(
        type: string,
        networkEntities: NetworkPacket[],
        rfEntities: RFSignal[],
        wifiEntities: WiFiDevice[]
    ): string {
        const networkIds = networkEntities.map(e => e.id || 'unknown').join(',');
        const rfIds = rfEntities.map(e => e.id || 'unknown').join(',');
        const wifiIds = wifiEntities.map(e => e.mac).join(',');
        
        return `${type}_${networkIds}_${rfIds}_${wifiIds}`;
    }

    /**
     * Assess correlation threat level
     */
    private assessCorrelationThreatLevel(confidence: number, evidence: string[]): 'low' | 'medium' | 'high' | 'critical' | 'unknown' {
        // Security-related correlations are higher threat
        if (evidence.some(e => e.includes('security') || e.includes('threat'))) {
            return confidence > 0.9 ? 'critical' : 'high';
        }
        
        // High confidence correlations are more concerning
        if (confidence > 0.9) return 'high';
        if (confidence > 0.8) return 'medium';
        return 'low';
    }

    /**
     * Get involved domains
     */
    private getInvolvedDomains(
        networkEntities: NetworkPacket[],
        rfEntities: RFSignal[],
        wifiEntities: WiFiDevice[]
    ): string[] {
        const domains: string[] = [];
        
        if (networkEntities.length > 0) domains.push('network');
        if (rfEntities.length > 0) domains.push('rf');
        if (wifiEntities.length > 0) domains.push('wifi');
        
        return domains;
    }

    /**
     * Clean up old data
     */
    private cleanupOldData(): void {
        const now = Date.now();
        
        // Clean up old network data
        this.networkData = this.networkData.filter(
            packet => now - packet.timestamp.getTime() < this.dataRetentionTime
        );
        
        // Clean up old RF data
        this.rfData = this.rfData.filter(
            signal => now - signal.timestamp.getTime() < this.dataRetentionTime
        );
        
        // Clean up old WiFi data
        this.wifiData = this.wifiData.filter(
            device => now - device.lastSeen.getTime() < this.dataRetentionTime
        );
        
        // Clean up old correlations
        this.correlationResults = this.correlationResults.filter(
            correlation => now - correlation.timestamp.getTime() < this.maxCorrelationAge
        );
        
        // Clean up correlation cache
        for (const [id, correlation] of this.correlationCache) {
            if (now - correlation.timestamp.getTime() > this.maxCorrelationAge) {
                this.correlationCache.delete(id);
            }
        }
    }

    /**
     * Trigger correlation analysis
     */
    private triggerCorrelation(): void {
        // Debounce correlation analysis
        if (this.correlationInterval) {
            clearTimeout(this.correlationInterval);
        }
        
        this.correlationInterval = setTimeout(() => {
            this.analyzeCorrelations();
        }, 1000); // 1 second debounce
    }

    /**
     * Start periodic correlation analysis
     */
    private startPeriodicCorrelation(): void {
        setInterval(() => {
            this.analyzeCorrelations();
        }, 30000); // Every 30 seconds
    }

    /**
     * Initialize correlation rules
     */
    private initializeCorrelationRules(): void {
        this.correlationRules = [
            {
                name: 'Temporal Network-WiFi',
                domains: ['network', 'wifi'],
                threshold: 0.7,
                timeWindow: 30000
            },
            {
                name: 'Frequency RF-WiFi',
                domains: ['rf', 'wifi'],
                threshold: 0.8,
                frequencyTolerance: 50000
            },
            {
                name: 'Geographic WiFi-WiFi',
                domains: ['wifi'],
                threshold: 0.6,
                locationThreshold: 100
            },
            {
                name: 'Security Cross-Domain',
                domains: ['network', 'rf', 'wifi'],
                threshold: 0.8,
                securityFocus: true
            }
        ];
    }
}

// Type definitions for correlation engine
interface CorrelationRule {
    name: string;
    domains: string[];
    threshold: number;
    timeWindow?: number;
    frequencyTolerance?: number;
    locationThreshold?: number;
    securityFocus?: boolean;
}