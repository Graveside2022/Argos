/**
 * HackRF API Client Service
 * Connects to the Express backend HackRF endpoints
 */

import {
  API_ENDPOINTS,
  defaultRequestOptions,
  handleResponse,
  buildQueryString,
  retryRequest,
  withTimeout,
  APIError
} from './config';

export interface HackRFStatus {
  connected: boolean;
  sweeping: boolean;
  currentFrequency?: number;
  config?: HackRFConfig;
  error?: string;
  lastUpdate?: string;
}

export interface HackRFConfig {
  startFreq: number;
  endFreq: number;
  binSize: number;
  sampleRate: number;
  gain: number;
  amplifierEnabled: boolean;
}

export interface SweepResult {
  frequency: number;
  power: number;
  timestamp: number;
}

export interface SignalDetection {
  frequency: number;
  power: number;
  bandwidth: number;
  timestamp: number;
  modulation?: string;
}

export interface SpectrumData {
  frequencies: number[];
  powers: number[];
  timestamp: number;
  centerFrequency: number;
  sampleRate: number;
}

class HackRFAPI {
  private baseUrl = API_ENDPOINTS.hackrf;

  /**
   * Get HackRF status
   */
  async getStatus(): Promise<HackRFStatus> {
    const response = await fetch(`${this.baseUrl}/status`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<HackRFStatus>(response);
  }

  /**
   * Connect to HackRF device
   */
  async connect(): Promise<{ success: boolean; message: string }> {
    const response = await retryRequest(async () => {
      const res = await fetch(`${this.baseUrl}/connect`, {
        ...defaultRequestOptions,
        method: 'POST'
      });
      return res;
    });
    
    return handleResponse(response);
  }

  /**
   * Disconnect from HackRF device
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/disconnect`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }

  /**
   * Start frequency sweep
   */
  async startSweep(config?: Partial<HackRFConfig>): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/sweep/start`, {
      ...defaultRequestOptions,
      method: 'POST',
      body: config ? JSON.stringify(config) : undefined
    });
    
    return handleResponse(response);
  }

  /**
   * Stop frequency sweep
   */
  async stopSweep(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/sweep/stop`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<HackRFConfig> {
    const response = await fetch(`${this.baseUrl}/config`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<HackRFConfig>(response);
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<HackRFConfig>): Promise<{ success: boolean; config: HackRFConfig }> {
    const response = await fetch(`${this.baseUrl}/config`, {
      ...defaultRequestOptions,
      method: 'PUT',
      body: JSON.stringify(config)
    });
    
    return handleResponse(response);
  }

  /**
   * Get latest sweep results
   */
  async getSweepResults(limit: number = 100): Promise<SweepResult[]> {
    const queryString = buildQueryString({ limit });
    const response = await fetch(`${this.baseUrl}/sweep/results${queryString}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<SweepResult[]>(response);
  }

  /**
   * Get detected signals
   */
  async getDetectedSignals(options?: {
    minPower?: number;
    frequencyRange?: { start: number; end: number };
    limit?: number;
  }): Promise<SignalDetection[]> {
    const queryString = buildQueryString({
      minPower: options?.minPower,
      startFreq: options?.frequencyRange?.start,
      endFreq: options?.frequencyRange?.end,
      limit: options?.limit
    });
    
    const response = await fetch(`${this.baseUrl}/signals${queryString}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<SignalDetection[]>(response);
  }

  /**
   * Get spectrum data for visualization
   */
  async getSpectrumData(): Promise<SpectrumData> {
    const response = await withTimeout(
      fetch(`${this.baseUrl}/spectrum`, {
        ...defaultRequestOptions,
        method: 'GET'
      }),
      5000 // 5 second timeout for spectrum data
    );
    
    return handleResponse<SpectrumData>(response);
  }

  /**
   * Set gain level
   */
  async setGain(gain: number): Promise<{ success: boolean; gain: number }> {
    if (gain < 0 || gain > 62) {
      throw new APIError('Gain must be between 0 and 62 dB');
    }
    
    const response = await fetch(`${this.baseUrl}/gain`, {
      ...defaultRequestOptions,
      method: 'PUT',
      body: JSON.stringify({ gain })
    });
    
    return handleResponse(response);
  }

  /**
   * Toggle amplifier
   */
  async toggleAmplifier(enabled: boolean): Promise<{ success: boolean; enabled: boolean }> {
    const response = await fetch(`${this.baseUrl}/amplifier`, {
      ...defaultRequestOptions,
      method: 'PUT',
      body: JSON.stringify({ enabled })
    });
    
    return handleResponse(response);
  }

  /**
   * Perform device reset
   */
  async reset(): Promise<{ success: boolean; message: string }> {
    const response = await retryRequest(async () => {
      const res = await fetch(`${this.baseUrl}/reset`, {
        ...defaultRequestOptions,
        method: 'POST'
      });
      return res;
    }, { maxAttempts: 2 });
    
    return handleResponse(response);
  }

  /**
   * Get device info
   */
  async getDeviceInfo(): Promise<{
    serial: string;
    boardId: string;
    firmwareVersion: string;
    partId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/device-info`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse(response);
  }

  /**
   * Export sweep data
   */
  async exportData(format: 'csv' | 'json' = 'json'): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/export?format=${format}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new APIError(`Export failed: ${response.statusText}`, response.status);
    }
    
    return response.blob();
  }
}

// Export singleton instance
export const hackrfAPI = new HackRFAPI();