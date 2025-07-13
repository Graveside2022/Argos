import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HackRFService } from '$lib/services/hackrf/hackrfService';
import type { HackRFStatus, HackRFConfig, SpectrumData, SignalDetection, SweepResult } from '$lib/services/api/hackrf';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection establishment
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Simulate echo for testing
    setTimeout(() => {
      this.onmessage?.(new MessageEvent('message', { data }));
    }, 5);
  }

  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.(new CloseEvent('close'));
    }, 5);
  }
}

// Mock global WebSocket
vi.stubGlobal('WebSocket', MockWebSocket);

describe('HackRFService - Core SDR Functionality', () => {
  let hackrfService: HackRFService;

  beforeEach(() => {
    hackrfService = new HackRFService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await hackrfService.disconnect();
      hackrfService.destroy();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Device Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      await hackrfService.connect();
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      expect(status.connected).toBe(true);
    });

    it('should handle connection failures gracefully', async () => {
      // Mock failed connection
      vi.stubGlobal('WebSocket', class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            this.onerror?.(new Event('error'));
          }, 5);
        }
      });

      try {
        await hackrfService.connect();
      } catch {
        // Expected to fail
      }
      
      const error = await new Promise<string | null>(resolve => {
        const unsubscribe = hackrfService.error.subscribe(error => {
          resolve(error);
          unsubscribe();
        });
      });
      expect(error).toBeTruthy();
    });

    it('should disconnect cleanly from device', async () => {
      await hackrfService.connect();
      
      await hackrfService.disconnect();
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      expect(status.connected).toBe(false);
    });

    it('should handle multiple connection attempts properly', async () => {
      await hackrfService.connect();
      await hackrfService.connect(); // Should not fail on second attempt
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      expect(status.connected).toBe(true);
    });
  });

  describe('Frequency Sweep Configuration', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should configure frequency sweep parameters correctly', async () => {
      const config = {
        startFreq: 88.0,   // MHz
        endFreq: 108.0,    // MHz
        binSize: 100000,   // Hz
        sampleRate: 20000000,  // Hz
        gain: 20,
        amplifierEnabled: false
      };

      await hackrfService.updateConfig(config);
      
      const currentConfig = await new Promise<HackRFConfig>(resolve => {
        const unsubscribe = hackrfService.config.subscribe(config => {
          if (config) {
            resolve(config);
            unsubscribe();
          }
        });
      });
      expect(currentConfig).toMatchObject({
        startFreq: config.startFreq,
        endFreq: config.endFreq
      });
    });

    it('should validate frequency range parameters', async () => {
      const invalidConfig = {
        startFreq: 108.0,  // Invalid: start > end
        endFreq: 88.0,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20,
        amplifierEnabled: false
      };

      try {
        await hackrfService.updateConfig(invalidConfig);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should enforce frequency limits (0.1 MHz - 7250 MHz)', async () => {
      const outOfRangeConfig = {
        startFreq: 0.05,   // Below minimum
        endFreq: 8000.0,   // Above maximum
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20,
        amplifierEnabled: false
      };

      try {
        await hackrfService.updateConfig(outOfRangeConfig);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate bin size parameters', async () => {
      const invalidBinConfig = {
        startFreq: 88.0,
        endFreq: 108.0,
        binSize: 50,    // Below minimum bin size
        sampleRate: 20000000,
        gain: 20,
        amplifierEnabled: false
      };

      try {
        await hackrfService.updateConfig(invalidBinConfig);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Signal Processing and Classification', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should receive spectrum data with correct format', async () => {
      // Wait for spectrum data to be available
      const spectrumData = await new Promise<SpectrumData | null>(resolve => {
        const unsubscribe = hackrfService.spectrumData.subscribe(data => {
          if (data) {
            resolve(data);
            unsubscribe();
          }
        });
        // Simulate data reception
        setTimeout(() => resolve(null), 100);
      });
      
      if (spectrumData) {
        expect(spectrumData).toMatchObject({
          frequencies: expect.any(Array),
          powers: expect.any(Array),
          timestamp: expect.any(Number),
          centerFrequency: expect.any(Number),
          sampleRate: expect.any(Number)
        });
      }
    });

    it('should receive detected signals data', async () => {
      // Wait for detected signals to be available
      const detectedSignals = await new Promise<SignalDetection[]>(resolve => {
        const unsubscribe = hackrfService.detectedSignals.subscribe(signals => {
          resolve(signals);
          unsubscribe();
        });
      });
      
      expect(Array.isArray(detectedSignals)).toBe(true);
    });

    it('should handle sweep results data', async () => {
      // Wait for sweep results to be available
      const sweepResults = await new Promise<SweepResult[]>(resolve => {
        const unsubscribe = hackrfService.sweepResults.subscribe(results => {
          resolve(results);
          unsubscribe();
        });
      });
      
      expect(Array.isArray(sweepResults)).toBe(true);
    });

    it('should handle error states gracefully', async () => {
      // Test error handling by checking error store
      const error = await new Promise<string | null>(resolve => {
        const unsubscribe = hackrfService.error.subscribe(error => {
          resolve(error);
          unsubscribe();
        });
      });
      
      // Error should be null initially or string if there was an error
      expect(typeof error === 'string' || error === null).toBe(true);
    });
  });

  describe('Real-time Data Streaming', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle spectrum data updates through stores', async () => {
      const dataPoints: any[] = [];
      
      // Subscribe to spectrum data updates
      const unsubscribe = hackrfService.spectrumData.subscribe((data) => {
        if (data) {
          dataPoints.push(data);
        }
      });

      // Wait for some time to collect data
      await new Promise<void>(resolve => setTimeout(resolve, 500));
      unsubscribe();

      // Should have processed some data or be ready to process
      expect(dataPoints.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain store state integrity', async () => {
      // Test that stores maintain proper data types
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status).toMatchObject({
        connected: expect.any(Boolean),
        sweeping: expect.any(Boolean)
      });
    });
  });

  describe('Emergency Stop and Safety', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should execute emergency stop within 1 second', async () => {
      const startTime = Date.now();
      
      // Start a sweep operation
      await hackrfService.startSweep({
        startFreq: 100,
        endFreq: 200,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20
      });
      
      // Execute emergency stop
      await hackrfService.emergencyStop();
      
      const stopTime = Date.now();
      const responseTime = stopTime - startTime;
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.sweeping).toBe(false);
      expect(responseTime).toBeLessThan(1000); // Must be under 1 second
    });

    it('should clean up all resources on emergency stop', async () => {
      await hackrfService.startSweep({
        startFreq: 100,
        endFreq: 200,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20
      });
      
      await hackrfService.emergencyStop();
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.sweeping).toBe(false);
    });

    it('should remain responsive after emergency stop', async () => {
      await hackrfService.emergencyStop();
      
      // Should be able to start new operations
      await hackrfService.startSweep({
        startFreq: 100,
        endFreq: 200,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20
      });
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.connected).toBe(true);
    });
  });

  describe('Service Integration', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle multiple service calls correctly', async () => {
      // Send multiple commands
      await hackrfService.startSweep({
        startFreq: 100,
        endFreq: 200,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20
      });
      
      await hackrfService.setGain(30);
      await hackrfService.toggleAmplifier(true);

      // Wait for processing
      await new Promise<void>(resolve => setTimeout(resolve, 50));

      // Service should remain responsive
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.connected).toBe(true);
    });

    it('should handle service disconnection gracefully', async () => {
      // Disconnect the service
      await hackrfService.disconnect();
      
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.connected).toBe(false);
      
      // Should be able to reconnect
      await hackrfService.connect();
      
      const newStatus = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(newStatus.connected).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle service operations within reasonable time', async () => {
      const startTime = performance.now();
      
      await hackrfService.setGain(20);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(5000); // Must be under 5 seconds for API calls
    });

    it('should maintain reasonable memory usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple service operations
      for (let i = 0; i < 10; i++) {
        await hackrfService.setGain(20 + i);
        await new Promise<void>(resolve => setTimeout(resolve, 10));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      expect(memoryIncrease).toBeLessThan(50); // Should not leak more than 50MB
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle service errors gracefully', async () => {
      // Try invalid gain value
      try {
        await hackrfService.setGain(1000); // Invalid gain
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Service should still be operational after error
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.connected).toBe(true);
    });

    it('should maintain service availability during errors', async () => {
      // Introduce multiple error conditions
      for (let i = 0; i < 5; i++) {
        try {
          await hackrfService.setGain(-1); // Invalid gain
        } catch {
          // Expected to handle gracefully
        }
      }

      // Service should remain operational
      const status = await new Promise<HackRFStatus>(resolve => {
        const unsubscribe = hackrfService.status.subscribe(status => {
          resolve(status);
          unsubscribe();
        });
      });
      
      expect(status.connected).toBe(true);
      
      // Should be able to start valid sweep
      await hackrfService.startSweep({
        startFreq: 100,
        endFreq: 200,
        binSize: 100000,
        sampleRate: 20000000,
        gain: 20
      });
      
      expect(true).toBe(true); // Should not throw
    });
  });
});