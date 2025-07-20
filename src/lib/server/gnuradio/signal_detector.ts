/**
 * Signal Detection and Processing for GNU Radio Integration
 * Phase 2: Advanced signal analysis and classification
 */

import { SignalDetection, SpectrumData, SignalProcessor } from './types';

export class AdvancedSignalDetector implements SignalProcessor {
    private threshold: number;
    private minPeakSeparation: number;
    private minSignalBandwidth: number;
    private maxSignalBandwidth: number;
    private signalHistory: Map<number, SignalDetection[]> = new Map();
    private modulationClassifier: ModulationClassifier;
    
    constructor(
        threshold: number = 10,
        minPeakSeparation: number = 10,
        minSignalBandwidth: number = 1000,
        maxSignalBandwidth: number = 100000
    ) {
        this.threshold = threshold;
        this.minPeakSeparation = minPeakSeparation;
        this.minSignalBandwidth = minSignalBandwidth;
        this.maxSignalBandwidth = maxSignalBandwidth;
        this.modulationClassifier = new ModulationClassifier();
    }
    
    detectSignals(spectrum: SpectrumData): SignalDetection[] {
        const { frequencies, powers } = spectrum;
        const noiseFloor = this.estimateNoiseFloor(powers);
        const detectedSignals: SignalDetection[] = [];
        
        // Find peaks above threshold
        const peaks = this.findPeaks(powers, noiseFloor + this.threshold);
        
        // Process each peak
        for (const peakIndex of peaks) {
            const signal = this.analyzeSignal(spectrum, peakIndex, noiseFloor);
            if (signal) {
                detectedSignals.push(signal);
            }
        }
        
        // Update signal history
        this.updateSignalHistory(spectrum.timestamp, detectedSignals);
        
        // Classify persistent signals
        this.classifyPersistentSignals(detectedSignals);
        
        return detectedSignals;
    }
    
    private analyzeSignal(spectrum: SpectrumData, peakIndex: number, noiseFloor: number): SignalDetection | null {
        const { frequencies, powers } = spectrum;
        
        const frequency = frequencies[peakIndex];
        const power = powers[peakIndex];
        const snr = this.calculateSNR(power, noiseFloor);
        
        // Estimate bandwidth using -3dB method
        const bandwidth = this.estimateBandwidth(powers, peakIndex, power - 3);
        
        // Skip if bandwidth is invalid
        if (bandwidth < this.minSignalBandwidth || bandwidth > this.maxSignalBandwidth) {
            return null;
        }
        
        // Calculate confidence based on SNR and bandwidth
        const confidence = this.calculateConfidence(snr, bandwidth, power);
        
        // Attempt modulation classification
        const modulation = this.modulationClassifier.classify(powers, peakIndex, bandwidth);
        
        return {
            frequency,
            power,
            bandwidth,
            snr,
            modulation,
            confidence,
            timestamp: spectrum.timestamp
        };
    }
    
    estimateNoiseFloor(powers: number[]): number {
        // Use multiple methods and take the most conservative estimate
        const sorted = [...powers].sort((a, b) => a - b);
        
        // Method 1: 10th percentile
        const percentile10 = sorted[Math.floor(sorted.length * 0.1)];
        
        // Method 2: Median of lower half
        const lowerHalf = sorted.slice(0, Math.floor(sorted.length / 2));
        const medianLower = lowerHalf[Math.floor(lowerHalf.length / 2)];
        
        // Method 3: Mode estimation using histogram
        const mode = this.estimateMode(powers);
        
        // Use the highest estimate (most conservative)
        return Math.max(percentile10, medianLower, mode);
    }
    
    private estimateMode(powers: number[]): number {
        // Create histogram
        const min = Math.min(...powers);
        const max = Math.max(...powers);
        const bins = 50;
        const binSize = (max - min) / bins;
        const histogram = new Array(bins).fill(0);
        
        for (const power of powers) {
            const binIndex = Math.floor((power - min) / binSize);
            if (binIndex >= 0 && binIndex < bins) {
                histogram[binIndex]++;
            }
        }
        
        // Find mode (most frequent bin)
        let maxCount = 0;
        let modeIndex = 0;
        
        for (let i = 0; i < bins; i++) {
            if (histogram[i] > maxCount) {
                maxCount = histogram[i];
                modeIndex = i;
            }
        }
        
        return min + (modeIndex * binSize) + (binSize / 2);
    }
    
    findPeaks(powers: number[], threshold: number): number[] {
        const peaks: number[] = [];
        const windowSize = 3; // Minimum window around peak
        
        for (let i = windowSize; i < powers.length - windowSize; i++) {
            if (powers[i] > threshold) {
                // Check if it's a local maximum
                let isPeak = true;
                
                for (let j = i - windowSize; j <= i + windowSize; j++) {
                    if (j !== i && powers[j] >= powers[i]) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    // Check minimum separation from previous peaks
                    const lastPeak = peaks[peaks.length - 1];
                    if (!lastPeak || Math.abs(i - lastPeak) >= this.minPeakSeparation) {
                        peaks.push(i);
                    }
                }
            }
        }
        
        return peaks;
    }
    
    private estimateBandwidth(powers: number[], peakIndex: number, threshold: number): number {
        let leftIndex = peakIndex;
        let rightIndex = peakIndex;
        
        // Find left edge
        while (leftIndex > 0 && powers[leftIndex] > threshold) {
            leftIndex--;
        }
        
        // Find right edge
        while (rightIndex < powers.length - 1 && powers[rightIndex] > threshold) {
            rightIndex++;
        }
        
        // Convert bins to frequency (assuming uniform spacing)
        const binWidth = 1; // This should be calculated based on sample rate and FFT size
        return (rightIndex - leftIndex) * binWidth;
    }
    
    calculateSNR(signalPower: number, noisePower: number): number {
        return signalPower - noisePower;
    }
    
    private calculateConfidence(snr: number, bandwidth: number, power: number): number {
        // Multi-factor confidence calculation
        
        // SNR factor (0-1)
        const snrFactor = Math.min(1, Math.max(0, snr / 30));
        
        // Bandwidth factor (prefer moderate bandwidths)
        const optimalBandwidth = 10000; // 10 kHz
        const bandwidthFactor = Math.exp(-Math.pow(Math.log10(bandwidth / optimalBandwidth), 2));
        
        // Power factor (stronger signals are more confident)
        const powerFactor = Math.min(1, Math.max(0, (power + 100) / 60)); // Normalize from -100 to -40 dBm
        
        // Combine factors
        const confidence = (snrFactor * 0.5) + (bandwidthFactor * 0.3) + (powerFactor * 0.2);
        
        return Math.min(1, Math.max(0, confidence));
    }
    
    private updateSignalHistory(timestamp: number, signals: SignalDetection[]): void {
        // Clean old entries (older than 5 minutes)
        const cutoffTime = timestamp - 300000;
        
        for (const [time, _] of this.signalHistory) {
            if (time < cutoffTime) {
                this.signalHistory.delete(time);
            }
        }
        
        // Add new signals
        this.signalHistory.set(timestamp, signals);
    }
    
    private classifyPersistentSignals(signals: SignalDetection[]): void {
        // Analyze signal persistence and stability
        for (const signal of signals) {
            const similarSignals = this.findSimilarSignals(signal);
            
            if (similarSignals.length >= 3) {
                // Signal has been detected multiple times
                signal.confidence = Math.min(1, signal.confidence + 0.2);
                
                // Classify as beacon if very stable
                if (this.isStableSignal(similarSignals)) {
                    signal.modulation = signal.modulation || 'beacon';
                }
            }
        }
    }
    
    private findSimilarSignals(targetSignal: SignalDetection): SignalDetection[] {
        const similarSignals: SignalDetection[] = [];
        const frequencyTolerance = 1000; // 1 kHz
        const powerTolerance = 5; // 5 dB
        
        for (const [_, signals] of this.signalHistory) {
            for (const signal of signals) {
                if (Math.abs(signal.frequency - targetSignal.frequency) < frequencyTolerance &&
                    Math.abs(signal.power - targetSignal.power) < powerTolerance) {
                    similarSignals.push(signal);
                }
            }
        }
        
        return similarSignals;
    }
    
    private isStableSignal(signals: SignalDetection[]): boolean {
        if (signals.length < 3) return false;
        
        // Check frequency stability
        const frequencies = signals.map(s => s.frequency);
        const freqStdDev = this.calculateStandardDeviation(frequencies);
        
        // Check power stability
        const powers = signals.map(s => s.power);
        const powerStdDev = this.calculateStandardDeviation(powers);
        
        return freqStdDev < 500 && powerStdDev < 3; // 500 Hz, 3 dB
    }
    
    private calculateStandardDeviation(values: number[]): number {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    // Public interface methods
    getSignalHistory(): Map<number, SignalDetection[]> {
        return this.signalHistory;
    }
    
    clearHistory(): void {
        this.signalHistory.clear();
    }
    
    updateThreshold(threshold: number): void {
        this.threshold = threshold;
    }
    
    getStatistics(): {
        totalSignals: number;
        uniqueFrequencies: number;
        averageConfidence: number;
        signalTypes: Record<string, number>;
    } {
        let totalSignals = 0;
        const frequencies = new Set<number>();
        let confidenceSum = 0;
        const signalTypes: Record<string, number> = {};
        
        for (const [_, signals] of this.signalHistory) {
            for (const signal of signals) {
                totalSignals++;
                frequencies.add(Math.round(signal.frequency / 1000) * 1000); // Round to nearest kHz
                confidenceSum += signal.confidence;
                
                const type = signal.modulation || 'unknown';
                signalTypes[type] = (signalTypes[type] || 0) + 1;
            }
        }
        
        return {
            totalSignals,
            uniqueFrequencies: frequencies.size,
            averageConfidence: totalSignals > 0 ? confidenceSum / totalSignals : 0,
            signalTypes
        };
    }
}

class ModulationClassifier {
    classify(powers: number[], peakIndex: number, bandwidth: number): string | undefined {
        // Simple modulation classification based on spectral characteristics
        
        // Check for narrow bandwidth signals (likely CW or digital)
        if (bandwidth < 1000) {
            return 'CW';
        }
        
        // Check for FM signals (wider bandwidth)
        if (bandwidth > 10000 && bandwidth < 200000) {
            return 'FM';
        }
        
        // Check for AM signals (side peaks)
        if (this.hasAmCharacteristics(powers, peakIndex)) {
            return 'AM';
        }
        
        // Check for digital modulation patterns
        if (this.hasDigitalCharacteristics(powers, peakIndex, bandwidth)) {
            return 'Digital';
        }
        
        // Check for WiFi/802.11 signals
        if (this.isWifiSignal(powers, peakIndex, bandwidth)) {
            return 'WiFi';
        }
        
        // Check for Bluetooth signals
        if (this.isBluetoothSignal(powers, peakIndex, bandwidth)) {
            return 'Bluetooth';
        }
        
        return undefined;
    }
    
    private hasAmCharacteristics(powers: number[], peakIndex: number): boolean {
        // Look for side peaks around main carrier
        const sideband = 5; // Look 5 bins away
        
        if (peakIndex - sideband < 0 || peakIndex + sideband >= powers.length) {
            return false;
        }
        
        const carrierPower = powers[peakIndex];
        const leftSideband = powers[peakIndex - sideband];
        const rightSideband = powers[peakIndex + sideband];
        
        // Side peaks should be present but lower than carrier
        return (leftSideband > carrierPower - 10 && leftSideband < carrierPower - 3) ||
               (rightSideband > carrierPower - 10 && rightSideband < carrierPower - 3);
    }
    
    private hasDigitalCharacteristics(powers: number[], peakIndex: number, bandwidth: number): boolean {
        // Digital signals often have flat-top spectral characteristics
        const flatWidth = Math.floor(bandwidth / 2);
        const startIndex = Math.max(0, peakIndex - flatWidth);
        const endIndex = Math.min(powers.length - 1, peakIndex + flatWidth);
        
        let flatSamples = 0;
        const peakPower = powers[peakIndex];
        
        for (let i = startIndex; i <= endIndex; i++) {
            if (Math.abs(powers[i] - peakPower) < 3) { // Within 3 dB of peak
                flatSamples++;
            }
        }
        
        return flatSamples / (endIndex - startIndex + 1) > 0.6; // 60% flat
    }
    
    private isWifiSignal(powers: number[], peakIndex: number, bandwidth: number): boolean {
        // WiFi signals are typically 20 MHz wide at 2.4 GHz or 5 GHz
        return bandwidth > 15000 && bandwidth < 25000;
    }
    
    private isBluetoothSignal(powers: number[], peakIndex: number, bandwidth: number): boolean {
        // Bluetooth signals are typically 1 MHz wide and frequency hop
        return bandwidth > 500 && bandwidth < 1500;
    }
}

// Factory function
export function createSignalDetector(config?: {
    threshold?: number;
    minPeakSeparation?: number;
    minSignalBandwidth?: number;
    maxSignalBandwidth?: number;
}): AdvancedSignalDetector {
    return new AdvancedSignalDetector(
        config?.threshold,
        config?.minPeakSeparation,
        config?.minSignalBandwidth,
        config?.maxSignalBandwidth
    );
}