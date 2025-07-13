import { writable, derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// Types
export interface SpectrumData {
    frequencies: number[];
    power: number[];
    power_levels?: number[]; // Alternative format
    start_freq?: number;
    stop_freq?: number;
    center_freq?: number;
    peak_power?: number;
    peak_freq?: number;
    avg_power?: number;
    centerFreq: number;
    sampleRate: number;
    binSize: number;
    timestamp: number;
    sweepId?: string;
    processed?: boolean;
}

export interface FrequencyRange {
    id: string;
    start: number;
    stop: number;
    step: number;
}

export interface SignalHistoryEntry {
    frequency: number;
    power: number;
    timestamp: number;
}

export interface SweepStatus {
    active: boolean;
    startFreq: number;
    endFreq: number;
    currentFreq: number;
    progress: number;
    startTime?: number;
    duration?: number;
    sweepCount?: number;
    error?: string;
}

export interface CycleStatus {
    active: boolean;
    currentCycle: number;
    totalCycles: number;
    cycleTime?: number;
    timeRemaining?: number;
    startTime?: number;
    endTime?: number;
    duration?: number;
    progress: number;
}

export interface EmergencyStopStatus {
    active: boolean;
    reason?: string;
    timestamp?: number;
}

export interface ConnectionStatus {
    connected: boolean;
    connecting: boolean;
    error: string | null;
    reconnectAttempts?: number;
    lastError?: string;
    lastConnected?: number;
    deviceConnected?: boolean;
    deviceInfo?: DeviceInfo;
}

export interface DeviceInfo {
    serial: string;
    version: string;
    board_id: number;
    board_name: string;
    firmware_version?: string;
}

export interface HackRFConfig {
    gain: number;
    lnaGain: number;
    vgaGain: number;
    sampleRate: number;
    centerFreq: number;
    bandwidth: number;
}

// Stores
export const spectrumData: Writable<SpectrumData | null> = writable(null);
export const sweepStatus: Writable<SweepStatus> = writable({
    active: false,
    startFreq: 0,
    endFreq: 0,
    currentFreq: 0,
    progress: 0
});

export const cycleStatus: Writable<CycleStatus> = writable({
    active: false,
    currentCycle: 0,
    totalCycles: 0,
    progress: 0
});

export const emergencyStopStatus: Writable<EmergencyStopStatus> = writable({
    active: false
});

export const connectionStatus: Writable<ConnectionStatus> = writable({
    connected: false,
    connecting: false,
    error: null
});

export const deviceInfo: Writable<DeviceInfo | null> = writable(null);

export const config: Writable<HackRFConfig> = writable({
    gain: 30,
    lnaGain: 20,
    vgaGain: 20,
    sampleRate: 20e6,
    centerFreq: 915e6,
    bandwidth: 20e6
});

// History store for spectrum data
export const spectrumHistory: Writable<SpectrumData[]> = writable([]);
const MAX_HISTORY_SIZE = 50; // Reduced to prevent memory issues
let historyCleanupInterval: ReturnType<typeof setInterval> | null = null;

// Frequency configuration
export const frequencyRanges: Writable<FrequencyRange[]> = writable([]);

// Signal history
export const signalHistory: Writable<SignalHistoryEntry[]> = writable([]);

// Derived stores
export const isActive: Readable<boolean> = derived(
    [sweepStatus, cycleStatus],
    ([$sweepStatus, $cycleStatus]) => $sweepStatus.active || $cycleStatus.active
);

export const sweepProgress: Readable<number> = derived(
    sweepStatus,
    $sweepStatus => $sweepStatus.progress
);

export const sweepDuration: Readable<number> = derived(
    sweepStatus,
    $sweepStatus => $sweepStatus.duration || 0
);

export const isEmergencyStopped: Readable<boolean> = derived(
    emergencyStopStatus,
    $emergencyStopStatus => $emergencyStopStatus.active
);

export const peakFrequency: Readable<number | null> = derived(
    spectrumData,
    $spectrumData => {
        if (!$spectrumData) return null;
        
        const maxIndex = $spectrumData.power.indexOf(Math.max(...$spectrumData.power));
        return $spectrumData.frequencies[maxIndex];
    }
);

export const averagePower: Readable<number | null> = derived(
    spectrumData,
    $spectrumData => {
        if (!$spectrumData || $spectrumData.power.length === 0) return null;
        
        const sum = $spectrumData.power.reduce((acc, val) => acc + val, 0);
        return sum / $spectrumData.power.length;
    }
);

export const signalStrength: Readable<number> = derived(
    spectrumData,
    $spectrumData => {
        if (!$spectrumData) return -100;
        
        const max = Math.max(...$spectrumData.power);
        return Math.max(-100, Math.min(0, max));
    }
);

// Helper functions
export function updateSpectrumData(data: SpectrumData | null) {
    spectrumData.set(data);
    
    // Add to history if not null
    if (data) {
        spectrumHistory.update(history => {
            const newHistory = [...history, data];
            // Keep only the last MAX_HISTORY_SIZE entries
            if (newHistory.length > MAX_HISTORY_SIZE) {
                return newHistory.slice(-MAX_HISTORY_SIZE);
            }
            return newHistory;
        });
    }
    
    // Start periodic cleanup if not already running
    if (!historyCleanupInterval) {
        historyCleanupInterval = setInterval(() => {
            spectrumHistory.update(history => {
                // Remove old entries older than 5 minutes
                const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
                return history.filter(entry => entry.timestamp > fiveMinutesAgo);
            });
        }, 60000); // Cleanup every minute
    }
}

export function updateSweepStatus(updates: Partial<SweepStatus>) {
    sweepStatus.update(status => ({ ...status, ...updates }));
}

export function updateCycleStatus(updates: Partial<CycleStatus>) {
    cycleStatus.update(status => ({ ...status, ...updates }));
}

export function updateEmergencyStopStatus(updates: Partial<EmergencyStopStatus>) {
    emergencyStopStatus.update(status => ({ ...status, ...updates }));
}

export function updateConnectionStatus(updates: Partial<ConnectionStatus>) {
    connectionStatus.update(status => ({ ...status, ...updates }));
}

export function updateDeviceInfo(info: DeviceInfo | null) {
    deviceInfo.set(info);
}

export function updateConfig(updates: Partial<HackRFConfig>) {
    config.update(cfg => ({ ...cfg, ...updates }));
}

export function clearSpectrumHistory() {
    spectrumHistory.set([]);
    
    // Stop cleanup interval
    if (historyCleanupInterval !== null) {
        clearInterval(historyCleanupInterval);
        historyCleanupInterval = null;
    }
}

export function updateSignalHistory(entry: SignalHistoryEntry) {
    signalHistory.update(history => {
        const newHistory = [...history, entry];
        // Keep only the last 50 entries
        if (newHistory.length > 50) {
            return newHistory.slice(-50);
        }
        return newHistory;
    });
}

export function resetStores() {
    spectrumData.set(null);
    sweepStatus.set({
        active: false,
        startFreq: 0,
        endFreq: 0,
        currentFreq: 0,
        progress: 0
    });
    cycleStatus.set({
        active: false,
        currentCycle: 0,
        totalCycles: 0,
        progress: 0
    });
    emergencyStopStatus.set({
        active: false
    });
    connectionStatus.set({
        connected: false,
        connecting: false,
        error: null
    });
    deviceInfo.set(null);
    clearSpectrumHistory();
}

// Utility functions for frequency formatting
export function formatFrequency(freq: number): string {
    if (freq >= 1e9) {
        return `${(freq / 1e9).toFixed(3)} GHz`;
    } else if (freq >= 1e6) {
        return `${(freq / 1e6).toFixed(3)} MHz`;
    } else if (freq >= 1e3) {
        return `${(freq / 1e3).toFixed(3)} kHz`;
    } else {
        return `${freq.toFixed(0)} Hz`;
    }
}

export function formatPower(power: number): string {
    return `${power.toFixed(1)} dBm`;
}

export function formatSampleRate(rate: number): string {
    if (rate >= 1e6) {
        return `${(rate / 1e6).toFixed(1)} MS/s`;
    } else if (rate >= 1e3) {
        return `${(rate / 1e3).toFixed(1)} kS/s`;
    } else {
        return `${rate.toFixed(0)} S/s`;
    }
}