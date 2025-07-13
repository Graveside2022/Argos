/**
 * System API Client Service
 * Connects to the Express backend system endpoints
 */

import {
  API_ENDPOINTS,
  defaultRequestOptions,
  handleResponse,
  buildQueryString
} from './config';

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  loadAverage: number[];
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  network: {
    interfaces: NetworkInterface[];
  };
  storage: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
}

export interface NetworkInterface {
  name: string;
  addresses: string[];
  mac: string;
  type: string;
  status: 'up' | 'down';
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  pid?: number;
  uptime?: number;
  cpu?: number;
  memory?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    cpu: { status: string; value: number; threshold: number };
    memory: { status: string; value: number; threshold: number };
    storage: { status: string; value: number; threshold: number };
    services: { status: string; running: number; total: number };
  };
  timestamp: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  details?: unknown;
}

class SystemAPI {
  private baseUrl = API_ENDPOINTS.system;

  /**
   * Get system information
   */
  async getInfo(): Promise<SystemInfo> {
    const response = await fetch(`${this.baseUrl}/info`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<SystemInfo>(response);
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<SystemHealth> {
    const response = await fetch(`${this.baseUrl}/health`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<SystemHealth>(response);
  }

  /**
   * Get all services status
   */
  async getServices(): Promise<ServiceStatus[]> {
    const response = await fetch(`${this.baseUrl}/services`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<ServiceStatus[]>(response);
  }

  /**
   * Get specific service status
   */
  async getService(serviceName: string): Promise<ServiceStatus> {
    const response = await fetch(`${this.baseUrl}/services/${encodeURIComponent(serviceName)}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<ServiceStatus>(response);
  }

  /**
   * Control a service
   */
  async controlService(
    serviceName: string, 
    action: 'start' | 'stop' | 'restart'
  ): Promise<{ success: boolean; message: string; status?: ServiceStatus }> {
    const response = await fetch(`${this.baseUrl}/services/${encodeURIComponent(serviceName)}/${action}`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }

  /**
   * Get system logs
   */
  async getLogs(options?: {
    service?: string;
    level?: 'error' | 'warn' | 'info' | 'debug';
    limit?: number;
    since?: Date;
    until?: Date;
  }): Promise<LogEntry[]> {
    const queryString = buildQueryString({
      ...options,
      since: options?.since?.toISOString(),
      until: options?.until?.toISOString()
    });
    
    const response = await fetch(`${this.baseUrl}/logs${queryString}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<LogEntry[]>(response);
  }

  /**
   * Get network interfaces
   */
  async getNetworkInterfaces(): Promise<NetworkInterface[]> {
    const response = await fetch(`${this.baseUrl}/network/interfaces`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse<NetworkInterface[]>(response);
  }

  /**
   * Get USB devices
   */
  async getUSBDevices(): Promise<{
    vendorId: string;
    productId: string;
    manufacturer?: string;
    product?: string;
    serialNumber?: string;
    devicePath: string;
  }[]> {
    const response = await fetch(`${this.baseUrl}/usb/devices`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse(response);
  }

  /**
   * Get process list
   */
  async getProcesses(options?: {
    sortBy?: 'cpu' | 'memory' | 'pid' | 'name';
    limit?: number;
  }): Promise<{
    pid: number;
    name: string;
    cpu: number;
    memory: number;
    uptime: number;
    user: string;
  }[]> {
    const queryString = buildQueryString(options || {});
    const response = await fetch(`${this.baseUrl}/processes${queryString}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse(response);
  }

  /**
   * Kill a process
   */
  async killProcess(pid: number, signal: string = 'SIGTERM'): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/processes/${pid}`, {
      ...defaultRequestOptions,
      method: 'DELETE',
      body: JSON.stringify({ signal })
    });
    
    return handleResponse(response);
  }

  /**
   * Reboot system
   */
  async reboot(delay: number = 60): Promise<{ success: boolean; message: string; scheduledTime: string }> {
    const response = await fetch(`${this.baseUrl}/reboot`, {
      ...defaultRequestOptions,
      method: 'POST',
      body: JSON.stringify({ delay })
    });
    
    return handleResponse(response);
  }

  /**
   * Shutdown system
   */
  async shutdown(delay: number = 60): Promise<{ success: boolean; message: string; scheduledTime: string }> {
    const response = await fetch(`${this.baseUrl}/shutdown`, {
      ...defaultRequestOptions,
      method: 'POST',
      body: JSON.stringify({ delay })
    });
    
    return handleResponse(response);
  }

  /**
   * Cancel scheduled reboot/shutdown
   */
  async cancelShutdown(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/shutdown/cancel`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }

  /**
   * Get system metrics history
   */
  async getMetricsHistory(options?: {
    metric: 'cpu' | 'memory' | 'network' | 'disk';
    duration: number; // minutes
    interval?: number; // seconds
  }): Promise<{
    metric: string;
    data: Array<{
      timestamp: string;
      value: number;
    }>;
  }> {
    const queryString = buildQueryString(options || {});
    const response = await fetch(`${this.baseUrl}/metrics/history${queryString}`, {
      ...defaultRequestOptions,
      method: 'GET'
    });
    
    return handleResponse(response);
  }

  /**
   * Clear system caches
   */
  async clearCaches(): Promise<{ success: boolean; message: string; freedSpace: number }> {
    const response = await fetch(`${this.baseUrl}/maintenance/clear-caches`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }

  /**
   * Run system diagnostics
   */
  async runDiagnostics(): Promise<{
    timestamp: string;
    results: {
      check: string;
      status: 'pass' | 'fail' | 'warning';
      message: string;
      details?: unknown;
    }[];
  }> {
    const response = await fetch(`${this.baseUrl}/diagnostics`, {
      ...defaultRequestOptions,
      method: 'POST'
    });
    
    return handleResponse(response);
  }
}

// Export singleton instance
export const systemAPI = new SystemAPI();