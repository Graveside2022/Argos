import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HackRFService } from '$lib/services/hackrf/hackrfService';

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

  afterEach(() => {
    hackrfService.disconnect();
  });

  describe('Device Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const connected = await hackrfService.connect();
      expect(connected).toBe(true);
      expect(hackrfService.isConnected()).toBe(true);
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

      const connected = await hackrfService.connect();
      expect(connected).toBe(false);
      expect(hackrfService.isConnected()).toBe(false);
    });

    it('should disconnect cleanly from device', async () => {
      await hackrfService.connect();
      expect(hackrfService.isConnected()).toBe(true);
      
      hackrfService.disconnect();
      expect(hackrfService.isConnected()).toBe(false);
    });

    it('should handle multiple connection attempts properly', async () => {
      const firstConnection = await hackrfService.connect();
      const secondConnection = await hackrfService.connect();
      
      expect(firstConnection).toBe(true);
      expect(secondConnection).toBe(true); // Should reuse existing connection
      expect(hackrfService.isConnected()).toBe(true);
    });
  });

  describe('Frequency Sweep Configuration', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should configure frequency sweep parameters correctly', () => {
      const config = {
        startFreq: 88.0,   // MHz
        endFreq: 108.0,    // MHz
        stepSize: 0.1,     // MHz
        dwellTime: 100     // ms
      };

      const result = hackrfService.configureSweep(config);
      expect(result).toBe(true);
      
      const currentConfig = hackrfService.getSweepConfig();
      expect(currentConfig).toEqual(config);
    });

    it('should validate frequency range parameters', () => {
      const invalidConfig = {
        startFreq: 108.0,  // Invalid: start > end
        endFreq: 88.0,
        stepSize: 0.1,
        dwellTime: 100
      };

      const result = hackrfService.configureSweep(invalidConfig);
      expect(result).toBe(false);
    });

    it('should enforce frequency limits (0.1 MHz - 7250 MHz)', () => {
      const outOfRangeConfig = {
        startFreq: 0.05,   // Below minimum
        endFreq: 8000.0,   // Above maximum
        stepSize: 0.1,
        dwellTime: 100
      };

      const result = hackrfService.configureSweep(outOfRangeConfig);
      expect(result).toBe(false);
    });

    it('should validate step size precision (minimum 0.1 MHz)', () => {
      const invalidStepConfig = {
        startFreq: 88.0,
        endFreq: 108.0,
        stepSize: 0.05,    // Below minimum step size
        dwellTime: 100
      };

      const result = hackrfService.configureSweep(invalidStepConfig);
      expect(result).toBe(false);
    });
  });

  describe('Signal Processing and Classification', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should process spectrum data with correct format', () => {
      const mockSpectrumData = {
        frequency: 100.5,  // MHz
        power: -45.2,      // dBm
        timestamp: Date.now(),
        bandwidth: 20.0    // MHz
      };

      const processed = hackrfService.processSpectrumData(mockSpectrumData);
      
      expect(processed).toMatchObject({
        frequency: expect.any(Number),
        power: expect.any(Number),
        timestamp: expect.any(Number),
        snr: expect.any(Number),
        classification: expect.any(String)
      });
    });

    it('should calculate Signal-to-Noise Ratio accurately', () => {
      const signalData = {
        frequency: 100.0,
        power: -30.0,      // Strong signal
        timestamp: Date.now(),
        bandwidth: 20.0
      };

      const processed = hackrfService.processSpectrumData(signalData);
      expect(processed.snr).toBeGreaterThan(0); // Should have positive SNR
    });

    it('should classify signals based on power levels', () => {
      const strongSignal = { frequency: 100.0, power: -20.0, timestamp: Date.now(), bandwidth: 20.0 };
      const weakSignal = { frequency: 100.0, power: -80.0, timestamp: Date.now(), bandwidth: 20.0 };

      const strongProcessed = hackrfService.processSpectrumData(strongSignal);
      const weakProcessed = hackrfService.processSpectrumData(weakSignal);

      expect(strongProcessed.classification).toMatch(/strong|high/i);
      expect(weakProcessed.classification).toMatch(/weak|low/i);
    });

    it('should handle edge case signal values', () => {
      const edgeCases = [
        { frequency: 0.1, power: -120.0, timestamp: Date.now(), bandwidth: 20.0 },  // Minimum values
        { frequency: 7250.0, power: 0.0, timestamp: Date.now(), bandwidth: 20.0 },  // Maximum values
        { frequency: 100.0, power: NaN, timestamp: Date.now(), bandwidth: 20.0 },   // Invalid power
      ];

      edgeCases.forEach(testCase => {
        expect(() => hackrfService.processSpectrumData(testCase)).not.toThrow();
      });
    });
  });

  describe('Real-time Data Streaming', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle high-frequency data updates (>100 Hz)', async () => {
      const dataPoints: any[] = [];
      hackrfService.onSpectrumUpdate((data: any) => {
        dataPoints.push(data);
      });

      // Simulate 200 Hz data stream for 500ms
      const updateInterval = setInterval(() => {
        const mockData = {
          frequency: 100.0 + Math.random() * 10,
          power: -50.0 + Math.random() * 20,
          timestamp: Date.now(),
          bandwidth: 20.0
        };
        hackrfService.processSpectrumData(mockData);
      }, 5); // 200 Hz

      await new Promise(resolve => setTimeout(resolve, 500));
      clearInterval(updateInterval);

      expect(dataPoints.length).toBeGreaterThan(90); // Should process most updates
    });

    it('should maintain data integrity under high load', async () => {
      const receivedData: any[] = [];
      hackrfService.onSpectrumUpdate((data: any) => {
        receivedData.push(data);
      });

      // Send 1000 rapid updates
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const mockData = {
          frequency: 100.0 + i * 0.001,
          power: -50.0,
          timestamp: Date.now() + i,
          bandwidth: 20.0
        };
        promises.push(hackrfService.processSpectrumData(mockData));
      }

      await Promise.all(promises);
      
      // Verify no data corruption
      expect(receivedData.length).toBeGreaterThan(0);
      receivedData.forEach(data => {
        expect(data.frequency).toBeTypeOf('number');
        expect(data.power).toBeTypeOf('number');
        expect(data.timestamp).toBeTypeOf('number');
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
      hackrfService.startSweep();
      expect(hackrfService.isSweeping()).toBe(true);
      
      // Execute emergency stop
      hackrfService.emergencyStop();
      
      const stopTime = Date.now();
      const responseTime = stopTime - startTime;
      
      expect(hackrfService.isSweeping()).toBe(false);
      expect(responseTime).toBeLessThan(1000); // Must be under 1 second
    });

    it('should clean up all resources on emergency stop', () => {
      hackrfService.startSweep();
      hackrfService.emergencyStop();
      
      expect(hackrfService.isSweeping()).toBe(false);
      expect(hackrfService.getCurrentSweepId()).toBeNull();
      expect(hackrfService.getPendingOperations()).toBe(0);
    });

    it('should remain responsive after emergency stop', async () => {
      hackrfService.emergencyStop();
      
      // Should be able to start new operations
      const newSweepStarted = hackrfService.startSweep();
      expect(newSweepStarted).toBe(true);
    });
  });

  describe('WebSocket Message Integrity', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should handle WebSocket message sequencing correctly', async () => {
      const messages: string[] = [];
      
      // Override send to capture messages
      const originalSend = hackrfService['ws']?.send;
      if (hackrfService['ws']) {
        hackrfService['ws'].send = vi.fn((data: string) => {
          messages.push(data);
          originalSend?.call(hackrfService['ws'], data);
        });
      }

      // Send multiple commands rapidly
      hackrfService.startSweep();
      hackrfService.setGain(20);
      hackrfService.setAmplifierEnabled(true);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messages.length).toBeGreaterThan(0);
      // Verify JSON format integrity
      messages.forEach(msg => {
        expect(() => JSON.parse(msg)).not.toThrow();
      });
    });

    it('should handle WebSocket disconnection gracefully', async () => {
      expect(hackrfService.isConnected()).toBe(true);
      
      // Simulate connection loss
      if (hackrfService['ws']) {
        hackrfService['ws'].close();
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(hackrfService.isConnected()).toBe(false);
      
      // Should be able to reconnect
      const reconnected = await hackrfService.connect();
      expect(reconnected).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should process spectrum data within 10ms latency', () => {
      const mockData = {
        frequency: 100.0,
        power: -45.0,
        timestamp: Date.now(),
        bandwidth: 20.0
      };

      const startTime = performance.now();
      hackrfService.processSpectrumData(mockData);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10); // Must be under 10ms
    });

    it('should maintain memory usage under continuous operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate 30 seconds of continuous operation
      for (let i = 0; i < 3000; i++) {
        const mockData = {
          frequency: 100.0 + Math.random() * 10,
          power: -50.0 + Math.random() * 20,
          timestamp: Date.now(),
          bandwidth: 20.0
        };
        hackrfService.processSpectrumData(mockData);
        
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      expect(memoryIncrease).toBeLessThan(100); // Should not leak more than 100MB
    });
  });

  describe('Error Recovery and Resilience', () => {
    beforeEach(async () => {
      await hackrfService.connect();
    });

    it('should recover from transient errors automatically', async () => {
      // Simulate error condition
      const errorData = {
        frequency: NaN,
        power: Infinity,
        timestamp: Date.now(),
        bandwidth: -1
      };

      expect(() => hackrfService.processSpectrumData(errorData)).not.toThrow();
      
      // Should continue operating normally after error
      const validData = {
        frequency: 100.0,
        power: -45.0,
        timestamp: Date.now(),
        bandwidth: 20.0
      };

      const result = hackrfService.processSpectrumData(validData);
      expect(result).toBeDefined();
    });

    it('should maintain service availability during errors', () => {
      // Introduce multiple error conditions
      for (let i = 0; i < 10; i++) {
        try {
          hackrfService.processSpectrumData({
            frequency: NaN,
            power: undefined as any,
            timestamp: 'invalid' as any,
            bandwidth: null as any
          });
        } catch {
          // Expected to handle gracefully
        }
      }

      // Service should remain operational
      expect(hackrfService.isConnected()).toBe(true);
      expect(() => hackrfService.startSweep({
        frequencyStart: 0,
        frequencyEnd: 6000,
        binWidth: 1000,
        fftSize: 20,
        integrationTime: 100
      })).not.toThrow();
    });
  });
});