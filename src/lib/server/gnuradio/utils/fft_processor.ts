/**
 * FFT Processor for GNU Radio Integration
 * Phase 2: Real-time spectrum analysis with window functions
 */

import { FFTProcessor } from '../types';

export class RealTimeFFTProcessor implements FFTProcessor {
    private fftSize: number;
    private windowType: string;
    private window: Float32Array;
    private sampleRate: number;
    private centerFreq: number;
    
    constructor(fftSize: number = 1024, sampleRate: number = 2e6, centerFreq: number = 2.4e9) {
        this.fftSize = fftSize;
        this.windowType = 'blackman';
        this.sampleRate = sampleRate;
        this.centerFreq = centerFreq;
        this.window = this.generateWindow();
    }
    
    process(data: Float32Array): Float32Array {
        if (data.length !== this.fftSize * 2) {
            throw new Error(`Input data must be ${this.fftSize * 2} samples (I/Q interleaved)`);
        }
        
        // Apply window function
        const windowed = this.applyWindow(data);
        
        // Perform FFT (simplified - in real implementation use FFTW or similar)
        const fftResult = this.performFFT(windowed);
        
        // Calculate power spectral density
        const powerSpectrum = this.calculatePowerSpectrum(fftResult);
        
        // Convert to dB scale
        const dbSpectrum = powerSpectrum.map(power => 10 * Math.log10(power + 1e-10));
        
        // FFT shift to center DC
        return this.fftShift(dbSpectrum);
    }
    
    getFrequencies(): number[] {
        const freqs = new Array(this.fftSize);
        const freqStep = this.sampleRate / this.fftSize;
        
        for (let i = 0; i < this.fftSize; i++) {
            const binFreq = (i - this.fftSize / 2) * freqStep;
            freqs[i] = this.centerFreq + binFreq;
        }
        
        return freqs;
    }
    
    setWindowType(type: string): void {
        this.windowType = type;
        this.window = this.generateWindow();
    }
    
    setSize(size: number): void {
        this.fftSize = size;
        this.window = this.generateWindow();
    }
    
    updateConfig(sampleRate: number, centerFreq: number): void {
        this.sampleRate = sampleRate;
        this.centerFreq = centerFreq;
    }
    
    private generateWindow(): Float32Array {
        const window = new Float32Array(this.fftSize);
        
        switch (this.windowType) {
            case 'blackman':
                for (let i = 0; i < this.fftSize; i++) {
                    const n = i / (this.fftSize - 1);
                    window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * n) + 0.08 * Math.cos(4 * Math.PI * n);
                }
                break;
                
            case 'hamming':
                for (let i = 0; i < this.fftSize; i++) {
                    const n = i / (this.fftSize - 1);
                    window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * n);
                }
                break;
                
            case 'hanning':
                for (let i = 0; i < this.fftSize; i++) {
                    const n = i / (this.fftSize - 1);
                    window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n);
                }
                break;
                
            case 'rectangular':
            default:
                window.fill(1.0);
                break;
        }
        
        return window;
    }
    
    private applyWindow(data: Float32Array): Float32Array {
        const windowed = new Float32Array(data.length);
        
        for (let i = 0; i < this.fftSize; i++) {
            const windowValue = this.window[i];
            windowed[i * 2] = data[i * 2] * windowValue;     // I component
            windowed[i * 2 + 1] = data[i * 2 + 1] * windowValue; // Q component
        }
        
        return windowed;
    }
    
    private performFFT(data: Float32Array): Float32Array {
        // Simplified FFT implementation
        // In production, use a proper FFT library like FFTW bindings
        const result = new Float32Array(data.length);
        const N = this.fftSize;
        
        for (let k = 0; k < N; k++) {
            let realSum = 0;
            let imagSum = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = -2 * Math.PI * k * n / N;
                const cosAngle = Math.cos(angle);
                const sinAngle = Math.sin(angle);
                
                const realPart = data[n * 2];
                const imagPart = data[n * 2 + 1];
                
                realSum += realPart * cosAngle - imagPart * sinAngle;
                imagSum += realPart * sinAngle + imagPart * cosAngle;
            }
            
            result[k * 2] = realSum;
            result[k * 2 + 1] = imagSum;
        }
        
        return result;
    }
    
    private calculatePowerSpectrum(fftData: Float32Array): Float32Array {
        const powerSpectrum = new Float32Array(this.fftSize);
        
        for (let i = 0; i < this.fftSize; i++) {
            const real = fftData[i * 2];
            const imag = fftData[i * 2 + 1];
            powerSpectrum[i] = real * real + imag * imag;
        }
        
        return powerSpectrum;
    }
    
    private fftShift(spectrum: Float32Array): Float32Array {
        const shifted = new Float32Array(spectrum.length);
        const half = Math.floor(spectrum.length / 2);
        
        // Move second half to beginning
        for (let i = 0; i < half; i++) {
            shifted[i] = spectrum[i + half];
        }
        
        // Move first half to end
        for (let i = half; i < spectrum.length; i++) {
            shifted[i] = spectrum[i - half];
        }
        
        return shifted;
    }
}

export class SignalDetector {
    private threshold: number;
    private minPeakSeparation: number;
    private minSignalBandwidth: number;
    
    constructor(threshold: number = 10, minPeakSeparation: number = 10, minSignalBandwidth: number = 5) {
        this.threshold = threshold;
        this.minPeakSeparation = minPeakSeparation;
        this.minSignalBandwidth = minSignalBandwidth;
    }
    
    detectSignals(spectrum: Float32Array, frequencies: number[], noiseFloor: number): Array<{
        frequency: number;
        power: number;
        bandwidth: number;
        snr: number;
        confidence: number;
    }> {
        const peaks = this.findPeaks(spectrum, noiseFloor + this.threshold);
        const signals = [];
        
        for (const peakIndex of peaks) {
            const frequency = frequencies[peakIndex];
            const power = spectrum[peakIndex];
            const bandwidth = this.estimateBandwidth(spectrum, peakIndex, noiseFloor);
            const snr = power - noiseFloor;
            const confidence = Math.min(1.0, snr / 20); // Normalize confidence
            
            signals.push({
                frequency,
                power,
                bandwidth,
                snr,
                confidence
            });
        }
        
        return signals;
    }
    
    private findPeaks(data: Float32Array, threshold: number): number[] {
        const peaks = [];
        
        for (let i = 1; i < data.length - 1; i++) {
            if (data[i] > threshold && 
                data[i] > data[i - 1] && 
                data[i] > data[i + 1]) {
                
                // Check minimum separation from previous peaks
                if (peaks.length === 0 || 
                    Math.abs(i - peaks[peaks.length - 1]) >= this.minPeakSeparation) {
                    peaks.push(i);
                }
            }
        }
        
        return peaks;
    }
    
    private estimateBandwidth(spectrum: Float32Array, peakIndex: number, noiseFloor: number): number {
        const peakPower = spectrum[peakIndex];
        const halfPower = peakPower - 3; // -3dB bandwidth
        
        let leftIndex = peakIndex;
        let rightIndex = peakIndex;
        
        // Find left edge
        while (leftIndex > 0 && spectrum[leftIndex] > halfPower) {
            leftIndex--;
        }
        
        // Find right edge
        while (rightIndex < spectrum.length - 1 && spectrum[rightIndex] > halfPower) {
            rightIndex++;
        }
        
        return Math.max(this.minSignalBandwidth, rightIndex - leftIndex);
    }
    
    estimateNoiseFloor(spectrum: Float32Array): number {
        // Use 10th percentile as noise floor estimate
        const sorted = Array.from(spectrum).sort((a, b) => a - b);
        const index = Math.floor(sorted.length * 0.1);
        return sorted[index];
    }
}