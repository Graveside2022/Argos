import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = 'http://100.79.154.94:5000/api';

// Extend axios config to include metadata
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: {
    startTime: Date;
  };
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add request interceptor for better error handling
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    (config as ExtendedAxiosRequestConfig).metadata = { startTime: new Date() };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    const endTime = new Date();
    const startTime = (response.config as ExtendedAxiosRequestConfig).metadata?.startTime;
    if (startTime) {
      const duration = endTime.getTime() - startTime.getTime();
      if (duration > 1000) {
        console.warn(`Slow API response: ${response.config.url} took ${duration}ms`);
      }
    }
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`API Error ${error.response.status}: ${error.response.data?.error || error.message}`);
    } else if (error.request) {
      console.error('API Error: No response received from server');
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export interface SystemStatus {
  is_transmitting: boolean;
  current_workflow: string | null;
  hackrf_connected: boolean;
  timestamp: string;
}

export interface Workflow {
  name: string;
  display_name: string;
  description: string;
  category?: string;
  complexity?: string;
  parameters: Record<string, any>;
}

export interface DeviceInfo {
  status: string;
  info?: string;
  current_frequency?: number;
  current_sample_rate?: number;
  current_gain?: number;
  error?: string;
}

export interface FrequencyBand {
  name: string;
  start_freq: number;
  end_freq: number;
  description: string;
}

export interface SafetyLimits {
  max_power_dbm: number;
  max_gain: number;
  min_gain: number;
  max_duration: number;
  min_duration: number;
  frequency_range: {
    min: number;
    max: number;
  };
  restricted_frequencies: Array<{
    start: number;
    end: number;
    description: string;
  }>;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  hackrf_connected: boolean;
  cache_ready: boolean;
  error?: string;
}

// Retry function for failed requests
const retryRequest = async (fn: () => Promise<any>, retries = 2, delay = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const apiService = {
  // System status
  getStatus: async (): Promise<SystemStatus> => {
    return retryRequest(async () => {
    const response = await api.get('/status');
    return response.data;
    });
  },

  // Health check
  getHealth: async (): Promise<HealthStatus> => {
    return retryRequest(async () => {
      const response = await api.get('/health');
      return response.data;
    });
  },

  // Workflows
  getWorkflows: async (): Promise<Workflow[]> => {
    return retryRequest(async () => {
    const response = await api.get('/workflows');
    return response.data;
    });
  },

  startWorkflow: async (workflow: string, parameters: Record<string, any>): Promise<any> => {
    return retryRequest(async () => {
    const response = await api.post('/start_workflow', {
      workflow,
      parameters,
    });
    return response.data;
    });
  },

  stopWorkflow: async (): Promise<any> => {
    return retryRequest(async () => {
    const response = await api.post('/stop_workflow');
    return response.data;
    });
  },

  // Device information
  getDeviceInfo: async (): Promise<DeviceInfo> => {
    return retryRequest(async () => {
    const response = await api.get('/device_info');
    return response.data;
    });
  },

  // Frequency bands
  getFrequencyBands: async (): Promise<FrequencyBand[]> => {
    return retryRequest(async () => {
    const response = await api.get('/frequency_bands');
    return response.data;
    });
  },

  // Safety limits
  getSafetyLimits: async (): Promise<SafetyLimits> => {
    return retryRequest(async () => {
    const response = await api.get('/safety_limits');
    return response.data;
    });
  },

  // Library
  getLibrary: async (): Promise<any[]> => {
    return retryRequest(async () => {
      const response = await api.get('/library');
      return response.data;
    });
  },
};

export default apiService; 