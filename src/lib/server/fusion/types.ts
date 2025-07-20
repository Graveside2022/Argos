// Types for Fusion cross-domain correlation engine

export * from '../kismet/types';

/**
 * Additional fusion-specific types
 */
export interface FusionSystem {
    network: NetworkSystem;
    rf: RFSystem;
    wifi: WiFiSystem;
    correlation: CorrelationSystem;
}

export interface NetworkSystem {
    active: boolean;
    interface: string;
    packetsPerSecond: number;
    totalPackets: number;
    recentPackets: any[];
}

export interface RFSystem {
    active: boolean;
    device: string;
    frequency: number;
    sampleRate: number;
    detectedSignals: number;
    spectrumData: any;
}

export interface WiFiSystem {
    active: boolean;
    interface: string;
    totalDevices: number;
    accessPoints: number;
    clients: number;
    securityThreats: number;
}

export interface CorrelationSystem {
    active: boolean;
    totalCorrelations: number;
    activeCorrelations: number;
    confidenceThreshold: number;
    lastAnalysis: Date;
}

export interface FusionEvent {
    id: string;
    type: string;
    source: 'network' | 'rf' | 'wifi' | 'correlation';
    timestamp: Date;
    data: any;
    correlations?: string[];
}

export interface FusionAlert {
    id: string;
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    description: string;
    source: 'network' | 'rf' | 'wifi' | 'correlation';
    timestamp: Date;
    data: any;
    acknowledged: boolean;
}

export interface FusionMetrics {
    system: {
        uptime: number;
        memoryUsage: number;
        cpuUsage: number;
        diskUsage: number;
    };
    network: {
        packetsPerSecond: number;
        totalPackets: number;
        protocolDistribution: Record<string, number>;
        topSources: string[];
    };
    rf: {
        signalsDetected: number;
        frequencyRange: { min: number; max: number };
        averagePower: number;
        spectrumUtilization: number;
    };
    wifi: {
        devicesDiscovered: number;
        accessPoints: number;
        clients: number;
        securityThreats: number;
        channelUtilization: Record<number, number>;
    };
    correlation: {
        totalCorrelations: number;
        averageConfidence: number;
        correlationTypes: Record<string, number>;
        crossDomainLinks: number;
    };
}

export interface FusionDashboard {
    status: 'active' | 'inactive' | 'error';
    systems: FusionSystem;
    metrics: FusionMetrics;
    alerts: FusionAlert[];
    correlations: CorrelationResult[];
    lastUpdate: Date;
}