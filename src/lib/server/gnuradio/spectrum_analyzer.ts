/**
 * GNU Radio Spectrum Analyzer
 * Phase 2: Real-time RF spectrum analysis with GNU Radio integration
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { SpectrumConfig, SpectrumData, SignalDetection, GnuRadioStatus, GnuRadioEvent, SDRDevice } from './types';
import { RealTimeFFTProcessor, SignalDetector } from './utils/fft_processor';
import { SDRDeviceManager } from './utils/device_manager';

export class GnuRadioSpectrumAnalyzer extends EventEmitter {
    private config: SpectrumConfig;
    private isRunning: boolean = false;
    private gnuradioProcess: ChildProcess | null = null;
    private deviceManager: SDRDeviceManager;
    private fftProcessor: RealTimeFFTProcessor;
    private signalDetector: SignalDetector;
    private activeDevice: SDRDevice | null = null;
    private dataBuffer: Float32Array[] = [];
    private lastUpdate: number = 0;
    private performance: {
        samplesPerSecond: number;
        droppedSamples: number;
        cpuUsage: number;
        memoryUsage: number;
    };
    private pythonScriptPath: string;
    private outputFile: string;
    private updateInterval: NodeJS.Timeout | null = null;
    
    constructor(config: SpectrumConfig) {
        super();
        this.config = config;
        this.deviceManager = new SDRDeviceManager();
        this.fftProcessor = new RealTimeFFTProcessor(
            config.fftSize,
            config.sampleRate,
            config.centerFreq
        );
        this.signalDetector = new SignalDetector();
        this.performance = {
            samplesPerSecond: 0,
            droppedSamples: 0,
            cpuUsage: 0,
            memoryUsage: 0
        };
        this.pythonScriptPath = '/tmp/gnuradio_spectrum.py';
        this.outputFile = '/tmp/spectrum_data.json';
        
        // Initialize Python script (async will be handled in start())
        this.setupPythonScript();
    }
    
    private setupPythonScript(): void {
        // Script content will be written when needed
    }
    
    private async createPythonScript(): Promise<void> {
        const pythonScript = `#!/usr/bin/env python3
"""
GNU Radio Spectrum Analyzer Python Script
Real-time RF spectrum analysis for Argos Fusion
"""

import numpy as np
import json
import time
import threading
import sys
import os
from gnuradio import gr, blocks, analog, fft, filter
from gnuradio.fft import window
try:
    import osmosdr
    OSMOSDR_AVAILABLE = True
except ImportError:
    OSMOSDR_AVAILABLE = False
    print("Warning: osmosdr not available, using dummy source")

class SpectrumAnalyzer(gr.top_block):
    def __init__(self, config):
        gr.top_block.__init__(self, "Argos Spectrum Analyzer")
        
        # Configuration
        self.center_freq = config.get('centerFreq', 2.4e9)
        self.samp_rate = config.get('sampleRate', 2e6)
        self.gain = config.get('gain', 20)
        self.fft_size = config.get('fftSize', 1024)
        self.device_type = config.get('deviceType', 'auto')
        self.update_rate = config.get('updateRate', 10)
        
        # Create SDR source
        self.sdr_source = self.create_sdr_source()
        
        # Configure SDR
        self.sdr_source.set_center_freq(self.center_freq)
        self.sdr_source.set_sample_rate(self.samp_rate)
        if hasattr(self.sdr_source, 'set_gain'):
            self.sdr_source.set_gain(self.gain)
        
        # Stream to vector for FFT
        self.stream_to_vector = blocks.stream_to_vector(gr.sizeof_gr_complex, self.fft_size)
        
        # FFT block
        self.fft_block = fft.fft_vcc(self.fft_size, True, window.blackmanharris(self.fft_size))
        
        # Complex to magnitude squared
        self.complex_to_mag = blocks.complex_to_mag_squared(self.fft_size)
        
        # Vector to stream
        self.vector_to_stream = blocks.vector_to_stream(gr.sizeof_float, self.fft_size)
        
        # Log power (convert to dB)
        self.log_block = blocks.nlog10_ff(10, 1, 0)
        
        # Keep N samples for processing
        self.keep_n = blocks.keep_one_in_n(gr.sizeof_float, max(1, int(self.samp_rate / self.fft_size / self.update_rate)))
        
        # File sink for output
        self.file_sink = blocks.file_sink(gr.sizeof_float, "${this.outputFile}.raw")
        
        # Connect the flow graph
        self.connect(self.sdr_source, self.stream_to_vector)
        self.connect(self.stream_to_vector, self.fft_block)
        self.connect(self.fft_block, self.complex_to_mag)
        self.connect(self.complex_to_mag, self.vector_to_stream)
        self.connect(self.vector_to_stream, self.log_block)
        self.connect(self.log_block, self.keep_n)
        self.connect(self.keep_n, self.file_sink)
        
        # Data collection thread
        self.running = False
        self.output_file = "${this.outputFile}"
        
    def create_sdr_source(self):
        """Create appropriate SDR source based on device type and availability"""
        if not OSMOSDR_AVAILABLE:
            # Fallback to noise source for testing
            print("Using noise source for testing")
            noise_source = analog.noise_source_c(analog.GR_GAUSSIAN, 1)
            return noise_source
            
        if self.device_type == 'hackrf':
            try:
                source = osmosdr.source(args="hackrf=0")
                print("Created HackRF source")
                return source
            except Exception as e:
                print(f"Failed to create HackRF source: {e}")
                
        elif self.device_type == 'rtl-sdr':
            try:
                source = osmosdr.source(args="rtl=0")
                print("Created RTL-SDR source")
                return source
            except Exception as e:
                print(f"Failed to create RTL-SDR source: {e}")
                
        # Auto-detection
        try:
            # Try HackRF first
            source = osmosdr.source(args="hackrf=0")
            print("Auto-detected HackRF device")
            return source
        except:
            try:
                # Try RTL-SDR
                source = osmosdr.source(args="rtl=0")
                print("Auto-detected RTL-SDR device")
                return source
            except:
                print("No SDR devices found, using noise source")
                return analog.noise_source_c(analog.GR_GAUSSIAN, 1)
    
    def start_analysis(self):
        """Start the spectrum analysis"""
        self.running = True
        self.start()
        
        # Start data processing thread
        self.data_thread = threading.Thread(target=self.process_data_loop, daemon=True)
        self.data_thread.start()
        
        print(f"Spectrum analyzer started - Center: {self.center_freq/1e9:.3f} GHz, Rate: {self.samp_rate/1e6:.1f} MHz")
    
    def stop_analysis(self):
        """Stop the spectrum analysis"""
        self.running = False
        self.stop()
        self.wait()
        print("Spectrum analyzer stopped")
    
    def process_data_loop(self):
        """Process spectrum data and write to JSON file"""
        while self.running:
            try:
                # Read raw data from GNU Radio
                raw_data = self.read_raw_data()
                if raw_data is not None:
                    # Process spectrum data
                    spectrum_data = self.process_spectrum(raw_data)
                    
                    # Write to JSON file
                    with open(self.output_file, 'w') as f:
                        json.dump(spectrum_data, f)
                
                time.sleep(1.0 / self.update_rate)
                
            except Exception as e:
                print(f"Error processing data: {e}")
                time.sleep(0.1)
    
    def read_raw_data(self):
        """Read raw data from GNU Radio file sink"""
        try:
            if os.path.exists(self.output_file + ".raw"):
                # Read binary float data
                with open(self.output_file + ".raw", 'rb') as f:
                    data = np.frombuffer(f.read(), dtype=np.float32)
                    if len(data) >= self.fft_size:
                        return data[-self.fft_size:]  # Get latest FFT worth of data
            return None
        except Exception as e:
            print(f"Error reading raw data: {e}")
            return None
    
    def process_spectrum(self, raw_data):
        """Process raw spectrum data into structured format"""
        # Calculate frequencies
        freqs = np.fft.fftshift(np.fft.fftfreq(self.fft_size, 1/self.samp_rate))
        freqs += self.center_freq
        
        # FFT shift the power data
        powers = np.fft.fftshift(raw_data)
        
        # Calculate statistics
        peak_idx = np.argmax(powers)
        peak_freq = freqs[peak_idx]
        peak_power = powers[peak_idx]
        noise_floor = np.percentile(powers, 10)
        average_power = np.mean(powers)
        
        # Simple signal detection
        threshold = noise_floor + 10  # 10 dB above noise floor
        peaks = []
        for i in range(1, len(powers) - 1):
            if powers[i] > threshold and powers[i] > powers[i-1] and powers[i] > powers[i+1]:
                peaks.append({
                    'frequency': float(freqs[i]),
                    'power': float(powers[i]),
                    'bandwidth': 1000,  # Estimate 1 kHz bandwidth
                    'snr': float(powers[i] - noise_floor),
                    'confidence': min(1.0, (powers[i] - noise_floor) / 20),
                    'timestamp': time.time()
                })
        
        return {
            'timestamp': time.time(),
            'centerFreq': float(self.center_freq),
            'sampleRate': float(self.samp_rate),
            'fftSize': int(self.fft_size),
            'frequencies': freqs.tolist(),
            'powers': powers.tolist(),
            'peakFreq': float(peak_freq),
            'peakPower': float(peak_power),
            'noiseFloor': float(noise_floor),
            'averagePower': float(average_power),
            'detectedSignals': peaks
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 spectrum_analyzer.py <config_json>")
        sys.exit(1)
    
    # Load configuration
    config_file = sys.argv[1]
    with open(config_file, 'r') as f:
        config = json.load(f)
    
    # Create and start analyzer
    analyzer = SpectrumAnalyzer(config)
    
    try:
        analyzer.start_analysis()
        
        # Keep running until interrupted
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("Stopping spectrum analyzer...")
        analyzer.stop_analysis()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        analyzer.stop_analysis()
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
        
        const fs = await import('fs');
        fs.writeFileSync(this.pythonScriptPath, pythonScript);
        fs.chmodSync(this.pythonScriptPath, '755');
    }
    
    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Spectrum analyzer is already running');
        }
        
        try {
            // Refresh device list
            await this.deviceManager.refreshDevices();
            
            // Select device
            this.activeDevice = this.selectDevice();
            if (!this.activeDevice) {
                throw new Error('No compatible SDR device found');
            }
            
            // Update configuration for selected device
            this.updateConfigForDevice(this.activeDevice);
            
            // Create Python script
            await this.createPythonScript();
            
            // Write configuration file
            const fs = await import('fs');
            const configFile = '/tmp/gnuradio_config.json';
            fs.writeFileSync(configFile, JSON.stringify(this.config));
            
            // Start GNU Radio Python script
            this.gnuradioProcess = spawn('python3', [this.pythonScriptPath, configFile], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, PYTHONPATH: '/usr/local/lib/python3/dist-packages' }
            });
            
            // Handle process events
            this.gnuradioProcess.on('error', (error) => {
                console.error('GNU Radio process error:', error);
                this.emit('error', { type: 'error', data: { message: error.message } });
            });
            
            this.gnuradioProcess.on('exit', (code) => {
                console.log(`GNU Radio process exited with code ${code}`);
                this.isRunning = false;
                this.cleanup();
            });
            
            // Handle stdout/stderr
            this.gnuradioProcess.stdout?.on('data', (data) => {
                console.log('GNU Radio stdout:', data.toString());
            });
            
            this.gnuradioProcess.stderr?.on('data', (data) => {
                console.log('GNU Radio stderr:', data.toString());
            });
            
            // Start data monitoring
            this.startDataMonitoring();
            
            this.isRunning = true;
            this.lastUpdate = Date.now();
            
            // Emit status update
            this.emit('status_update', {
                type: 'status_update',
                data: this.getStatus()
            });
            
            console.log('GNU Radio spectrum analyzer started successfully');
            
        } catch (error) {
            console.error('Failed to start GNU Radio spectrum analyzer:', error);
            throw error;
        }
    }
    
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }
        
        try {
            this.isRunning = false;
            
            // Stop data monitoring
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            
            // Terminate GNU Radio process
            if (this.gnuradioProcess) {
                this.gnuradioProcess.kill('SIGTERM');
                
                // Force kill if not terminated within 5 seconds
                setTimeout(() => {
                    if (this.gnuradioProcess && !this.gnuradioProcess.killed) {
                        this.gnuradioProcess.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            this.cleanup();
            
            // Emit status update
            this.emit('status_update', {
                type: 'status_update',
                data: this.getStatus()
            });
            
            console.log('GNU Radio spectrum analyzer stopped');
            
        } catch (error) {
            console.error('Error stopping GNU Radio spectrum analyzer:', error);
            throw error;
        }
    }
    
    private selectDevice(): SDRDevice | null {
        const devices = this.deviceManager.getDevices();
        
        if (this.config.deviceType === 'auto') {
            return this.deviceManager.selectBestDevice();
        } else {
            const device = devices.find(d => d.type === this.config.deviceType);
            return device ? this.deviceManager.selectDevice(device.deviceId) : null;
        }
    }
    
    private updateConfigForDevice(device: SDRDevice): void {
        // Validate and adjust frequency
        if (!this.deviceManager.validateFrequency(this.config.centerFreq, device)) {
            console.warn('Invalid frequency for device, using default');
            this.config.centerFreq = (device.frequencyRange.min + device.frequencyRange.max) / 2;
        }
        
        // Validate and adjust sample rate
        if (!this.deviceManager.validateSampleRate(this.config.sampleRate, device)) {
            console.warn('Invalid sample rate for device, using closest available');
            this.config.sampleRate = this.deviceManager.getBestSampleRate(this.config.sampleRate, device);
        }
        
        // Update FFT processor
        this.fftProcessor.updateConfig(this.config.sampleRate, this.config.centerFreq);
    }
    
    private startDataMonitoring(): void {
        this.updateInterval = setInterval(async () => {
            await this.processSpectrumData();
        }, 1000 / this.config.updateRate);
    }
    
    private async processSpectrumData(): Promise<void> {
        try {
            // Read spectrum data from JSON file
            const fs = await import('fs');
            if (fs.existsSync(this.outputFile)) {
                const data = fs.readFileSync(this.outputFile, 'utf8');
                const spectrumData: SpectrumData = JSON.parse(data);
                
                // Update performance metrics
                this.updatePerformanceMetrics(spectrumData);
                
                // Emit spectrum data event
                this.emit('spectrum_data', {
                    type: 'spectrum_data',
                    data: spectrumData
                });
                
                // Emit signal detection events
                for (const signal of spectrumData.detectedSignals) {
                    this.emit('signal_detected', {
                        type: 'signal_detected',
                        data: signal
                    });
                }
                
                this.lastUpdate = Date.now();
            }
        } catch (error) {
            console.error('Error processing spectrum data:', error);
        }
    }
    
    private updatePerformanceMetrics(data: SpectrumData): void {
        // Calculate samples per second
        const timeDiff = (Date.now() - this.lastUpdate) / 1000;
        this.performance.samplesPerSecond = this.config.sampleRate;
        
        // Estimate CPU and memory usage (simplified)
        this.performance.cpuUsage = Math.min(100, (data.detectedSignals.length * 5) + 20);
        this.performance.memoryUsage = Math.min(300, (data.fftSize * 4) / 1024 + 50); // MB
        
        // Dropped samples estimation
        if (timeDiff > (1.5 / this.config.updateRate)) {
            this.performance.droppedSamples += Math.floor(timeDiff * this.config.sampleRate);
        }
    }
    
    updateConfig(newConfig: Partial<SpectrumConfig>): void {
        this.config = { ...this.config, ...newConfig };
        
        // Update FFT processor if needed
        if (newConfig.fftSize || newConfig.sampleRate || newConfig.centerFreq) {
            this.fftProcessor.updateConfig(this.config.sampleRate, this.config.centerFreq);
            this.fftProcessor.setSize(this.config.fftSize);
        }
        
        // If running, restart with new configuration
        if (this.isRunning) {
            console.log('Restarting spectrum analyzer with new configuration');
            this.stop().then(() => {
                setTimeout(() => this.start(), 1000);
            });
        }
    }
    
    getStatus(): GnuRadioStatus {
        return {
            running: this.isRunning,
            device: this.activeDevice,
            config: this.config,
            lastUpdate: this.lastUpdate,
            performance: this.performance,
            error: undefined
        };
    }
    
    getDevices(): SDRDevice[] {
        return this.deviceManager.getDevices();
    }
    
    private cleanup(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.gnuradioProcess) {
            this.gnuradioProcess = null;
        }
        
        this.deviceManager.cleanup();
        
        // Clean up temporary files
        this.cleanupTempFiles();
    }
    
    private async cleanupTempFiles(): Promise<void> {
        try {
            const fs = await import('fs');
            if (fs.existsSync(this.outputFile)) {
                fs.unlinkSync(this.outputFile);
            }
            if (fs.existsSync(this.outputFile + '.raw')) {
                fs.unlinkSync(this.outputFile + '.raw');
            }
        } catch (error) {
            console.warn('Error cleaning up temporary files:', error);
        }
    }
}

// Singleton instance
let spectrumAnalyzer: GnuRadioSpectrumAnalyzer | null = null;

export function getSpectrumAnalyzer(): GnuRadioSpectrumAnalyzer {
    if (!spectrumAnalyzer) {
        const defaultConfig: SpectrumConfig = {
            centerFreq: 2.425e9,  // 2.425 GHz (WiFi)
            sampleRate: 2e6,      // 2 MHz
            gain: 20,             // 20 dB
            fftSize: 1024,        // 1024 point FFT
            deviceType: 'auto',   // Auto-detect device
            updateRate: 10,       // 10 Hz
            averagingFactor: 1,   // No averaging
            windowType: 'blackman'
        };
        
        spectrumAnalyzer = new GnuRadioSpectrumAnalyzer(defaultConfig);
    }
    
    return spectrumAnalyzer;
}

export function destroySpectrumAnalyzer(): void {
    if (spectrumAnalyzer) {
        spectrumAnalyzer.stop().catch(console.error);
        spectrumAnalyzer = null;
    }
}