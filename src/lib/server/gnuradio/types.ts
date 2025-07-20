/**
 * GNU Radio Types and Interfaces
 * Phase 2: RF Spectrum Analysis Integration
 */

export interface SDRDevice {
    type: 'hackrf' | 'rtl-sdr' | 'usrp';
    name: string;
    deviceId: string;
    frequencyRange: {
        min: number;
        max: number;
    };
    sampleRates: number[];
    gainRange?: {
        min: number;
        max: number;
    };
    available: boolean;
    description?: string;
}

export interface SpectrumConfig {
    centerFreq: number;
    sampleRate: number;
    gain: number;
    fftSize: number;
    deviceType: 'hackrf' | 'rtl-sdr' | 'auto';
    updateRate: number; // Hz
    averagingFactor: number;
    windowType: 'blackman' | 'hamming' | 'hanning' | 'rectangular';
}

export interface SpectrumData {
    timestamp: number;
    centerFreq: number;
    sampleRate: number;
    fftSize: number;
    frequencies: number[];
    powers: number[];
    peakFreq: number;
    peakPower: number;
    noiseFloor: number;
    averagePower: number;
    detectedSignals: SignalDetection[];
}

export interface SignalDetection {
    frequency: number;
    power: number;
    bandwidth: number;
    snr: number;
    modulation?: string;
    confidence: number;
    timestamp: number;
}

export interface GnuRadioStatus {
    running: boolean;
    device: SDRDevice | null;
    config: SpectrumConfig;
    error?: string;
    lastUpdate: number;
    performance: {
        samplesPerSecond: number;
        droppedSamples: number;
        cpuUsage: number;
        memoryUsage: number;
    };
}

export interface GnuRadioConfig {
    defaultDevice: 'hackrf' | 'rtl-sdr' | 'auto';
    defaultFrequency: number;
    defaultSampleRate: number;
    defaultGain: number;
    enableAutoGain: boolean;
    enableSignalDetection: boolean;
    signalThreshold: number; // dB above noise floor
    maxConcurrentAnalysis: number;
    dataRetentionTime: number; // seconds
    enableDataLogging: boolean;
    logDirectory: string;
}

export interface FFTProcessor {
    process(data: Float32Array): Float32Array;
    getFrequencies(): number[];
    setWindowType(type: string): void;
    setSize(size: number): void;
}

export interface SignalProcessor {
    detectSignals(spectrum: SpectrumData): SignalDetection[];
    estimateNoiseFloor(powers: number[]): number;
    findPeaks(powers: number[], threshold: number): number[];
    calculateSNR(signal: number, noise: number): number;
}

export type GnuRadioEvent = 
    | { type: 'spectrum_data'; data: SpectrumData }
    | { type: 'status_update'; data: GnuRadioStatus }
    | { type: 'signal_detected'; data: SignalDetection }
    | { type: 'device_connected'; data: SDRDevice }
    | { type: 'device_disconnected'; data: string }
    | { type: 'error'; data: { message: string; code?: string } };

export type GnuRadioEventCallback = (event: GnuRadioEvent) => void;