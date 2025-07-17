// Enhanced Kismet types for Phase 3 implementation

/**
 * WiFi device discovered by Kismet
 */
export interface WiFiDevice {
    mac: string;
    ssid?: string;
    deviceType: 'access_point' | 'client' | 'bridge' | 'unknown';
    manufacturer: string;
    firstSeen: Date;
    lastSeen: Date;
    signalStrength: number;
    channel: number;
    frequency: number;
    encryption: string[];
    securityScore: number;
    threatLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
    associations: string[]; // Connected devices
    probeRequests: string[]; // SSIDs this device probed for
    packets: number;
    dataSize: number;
    classification?: DeviceClassification;
    securityAssessment?: SecurityAssessment;
}

/**
 * Device classification result
 */
export interface DeviceClassification {
    type: string;
    subtype: string;
    confidence: number;
    characteristics: {
        isApple: boolean;
        isAndroid: boolean;
        isIoT: boolean;
        isEnterprise: boolean;
        isMobile: boolean;
        isDesktop: boolean;
        isEmbedded: boolean;
    };
    capabilities: string[];
    operatingSystem: string;
    deviceFamily: string;
    vendor: string;
    model: string;
}

/**
 * Device fingerprint for identification
 */
export interface DeviceFingerprint {
    macOUI: string;
    capabilities: string[];
    signalCharacteristics: any;
    behaviorSignature: string;
    protocolFingerprint: string;
    vendorElements: string[];
    uniqueIdentifiers: string[];
}

/**
 * Manufacturer information from OUI database
 */
export interface ManufacturerInfo {
    name: string;
    country: string;
    type: string;
}

/**
 * Security assessment result
 */
export interface SecurityAssessment {
    score: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    vulnerabilities: string[];
    recommendations: string[];
    threats: SecurityThreat[];
    lastAnalyzed: Date;
    details: {
        encryption: { score: number; issues: string[] };
        authentication: { score: number; issues: string[] };
        configuration: { score: number; issues: string[] };
        behavior: { score: number; issues: string[] };
    };
}

/**
 * Security threat detected
 */
export interface SecurityThreat {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    deviceMac: string;
    ssid?: string;
    timestamp: Date;
    active: boolean;
    confidence: number;
    evidence: string[];
    recommendations: string[];
}

/**
 * Vulnerability report
 */
export interface VulnerabilityReport {
    totalDevices: number;
    vulnerableDevices: number;
    averageSecurityScore: number;
    vulnerabilities: any[];
    threatDistribution: Record<string, number>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    recommendations: string[];
    lastAnalyzed: Date;
}

/**
 * Kismet configuration
 */
export interface KismetConfig {
    interface: string;
    monitorMode: boolean;
    channels: number[];
    hopRate: number;
    restPort: number;
    restUser: string;
    restPassword: string;
    logLevel: string;
    enableGPS: boolean;
    enableLogging: boolean;
    enableAlerts: boolean;
    deviceTimeout: number;
}

/**
 * Kismet status
 */
export interface KismetStatus {
    running: boolean;
    interface: string | null;
    channels: number[];
    startTime: Date | null;
    uptime: number;
    deviceCount: number;
    monitorInterfaces: MonitorInterface[];
    metrics: any;
    config: KismetConfig;
}

/**
 * Monitor interface configuration
 */
export interface MonitorInterface {
    name: string;
    type: string;
    channels: number[];
    enabled: boolean;
}

/**
 * Device statistics
 */
export interface DeviceStats {
    totalDevices: number;
    accessPoints: number;
    clients: number;
    unknownDevices: number;
    newDevicesLastHour: number;
    activeDevicesLast5Min: number;
    securityThreats: number;
    rogueAPs: number;
    encryptionTypes: Map<string, number>;
    manufacturers: Map<string, number>;
    channelUsage: Map<number, number>;
    signalStrengthDistribution: Map<string, number>;
    lastUpdate: Date;
}

/**
 * Fusion correlation types
 */
export interface CorrelationResult {
    id: string;
    type: string;
    confidence: number;
    entities: {
        network: NetworkPacket[];
        rf: RFSignal[];
        wifi: WiFiDevice[];
    };
    evidence: string[];
    description: string;
    timestamp: Date;
    threatLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
    metadata?: {
        domains: string[];
        entityCount: number;
    };
}

/**
 * Network packet from Wireshark
 */
export interface NetworkPacket {
    id?: string;
    timestamp: Date;
    sourceIP: string;
    destIP: string;
    protocol: string;
    length: number;
    hostname?: string;
    suspicious?: boolean;
}

/**
 * RF signal from GNU Radio
 */
export interface RFSignal {
    id?: string;
    timestamp: Date;
    frequency: number;
    power: number;
    bandwidth?: number;
    modulation?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
}

/**
 * Raw Kismet device data
 */
export interface RawKismetDevice {
    mac: string;
    ssid?: string;
    type?: string;
    manufacturer?: string;
    firstSeen?: number;
    lastSeen?: number;
    signal?: {
        last_signal: number;
        max_signal: number;
        min_signal: number;
    };
    channel?: number;
    frequency?: number;
    encryption?: string[];
    capabilities?: string[];
    location?: {
        lat: number;
        lon: number;
        accuracy?: number;
    };
    packets?: number;
    dataSize?: number;
    clients?: string[];
    probeRequests?: string[];
    behaviorFlags?: string[];
    hasWeakPassword?: boolean;
    deauthFrames?: number;
    wpsAttempts?: number;
    respondsToAllProbes?: boolean;
    ssidCount?: number;
    beacon?: boolean;
}

/**
 * Kismet API response wrapper
 */
export interface KismetAPIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: string;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
    type: 'device_discovered' | 'device_updated' | 'device_lost' | 'security_threat' | 'correlation_found' | 'status_update';
    data: any;
    timestamp: string;
}

/**
 * Kismet event types
 */
export type KismetEventType = 
    | 'started'
    | 'stopped'
    | 'device_discovered'
    | 'device_updated'
    | 'device_lost'
    | 'security_threat'
    | 'rogue_ap_detected'
    | 'correlation_found'
    | 'connection_lost'
    | 'connection_restored'
    | 'health_check'
    | 'error';

/**
 * Fusion event types
 */
export type FusionEventType = 
    | 'packet'
    | 'stats'
    | 'status'
    | 'spectrum_data'
    | 'signal_detected'
    | 'device_connected'
    | 'device_disconnected'
    | 'device_list'
    | 'device_update'
    | 'security_alert'
    | 'correlation_update'
    | 'heartbeat'
    | 'connected'
    | 'error';

/**
 * SSE event data structure
 */
export interface SSEEventData {
    type: FusionEventType;
    tool: 'wireshark' | 'gnuradio' | 'kismet';
    data: any;
    timestamp: string;
}

/**
 * Device activity pattern
 */
export interface DeviceActivityPattern {
    mac: string;
    connectionFrequency: number;
    averageSessionDuration: number;
    signalVariability: number;
    mobilityScore: number;
    probeRequestDiversity: number;
    temporalPattern: 'constant' | 'periodic' | 'random' | 'bursty';
    behaviorSignature: string;
}

/**
 * Access point security profile
 */
export interface AccessPointProfile {
    mac: string;
    ssid: string;
    securityType: string[];
    vulnerabilities: string[];
    clientCount: number;
    riskScore: number;
    isRogue: boolean;
    isHoneypot: boolean;
    lastSecurityScan: Date;
}

/**
 * Correlation confidence scoring
 */
export interface CorrelationConfidence {
    temporal: number;
    spatial: number;
    frequency: number;
    behavioral: number;
    security: number;
    overall: number;
}

/**
 * Threat intelligence context
 */
export interface ThreatIntelligence {
    mac: string;
    knownThreatActor: boolean;
    threatSources: string[];
    attackPatterns: string[];
    iocs: string[]; // Indicators of Compromise
    lastSeen: Date;
    confidence: number;
}

/**
 * Geo-location data
 */
export interface GeoLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    timestamp: Date;
}

/**
 * Signal analysis result
 */
export interface SignalAnalysis {
    frequency: number;
    power: number;
    bandwidth: number;
    modulation: string;
    snr: number;
    quality: number;
    timestamp: Date;
}

/**
 * Device behavior analysis
 */
export interface BehaviorAnalysis {
    mac: string;
    patterns: {
        connection: any;
        signal: any;
        mobility: any;
        activity: any;
        probe: any;
        temporal: any;
    };
    anomalies: string[];
    riskScore: number;
    lastAnalyzed: Date;
}

/**
 * Cross-domain entity linking
 */
export interface EntityLink {
    id: string;
    networkEntity?: string;
    rfEntity?: string;
    wifiEntity?: string;
    confidence: number;
    linkType: 'device' | 'location' | 'timing' | 'frequency' | 'behavior';
    evidence: string[];
    timestamp: Date;
}