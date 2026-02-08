/**
 * System Health Monitoring Service
 * Monitors overall system health and service status
 */

import { writable, derived, type Readable } from 'svelte/store';
import { hackrfService } from '../hackrf';
import { kismetService } from '../kismet';

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    rx: number;
    tx: number;
    errors: number;
  };
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime?: number;
  lastCheck: number;
  error?: string;
  metrics?: Record<string, unknown>;
}

interface HealthState {
  system: SystemMetrics | null;
  services: ServiceHealth[];
  overallHealth: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  alerts: HealthAlert[];
  lastUpdate: number;
}

interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

interface MonitoringOptions {
  checkInterval: number;
  cpuThreshold: number;
  memoryThreshold: number;
  diskThreshold: number;
  alertRetention: number;
}

class SystemHealthMonitor {
  private state = writable<HealthState>({
    system: null,
    services: [],
    overallHealth: 'unknown',
    alerts: [],
    lastUpdate: Date.now()
  });
  
  private options: MonitoringOptions = {
    checkInterval: 30000, // 30 seconds
    cpuThreshold: 80,
    memoryThreshold: 85,
    diskThreshold: 90,
    alertRetention: 3600000 // 1 hour
  };
  
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private metricsHistory: SystemMetrics[] = [];
  private maxHistorySize = 120; // 1 hour at 30s intervals
  
  // Public readable stores
  public readonly systemMetrics: Readable<SystemMetrics | null>;
  public readonly serviceHealth: Readable<ServiceHealth[]>;
  public readonly overallHealth: Readable<string>;
  public readonly alerts: Readable<HealthAlert[]>;
  public readonly criticalAlerts: Readable<HealthAlert[]>;
  
  constructor() {
    this.systemMetrics = derived(this.state, $state => $state.system);
    this.serviceHealth = derived(this.state, $state => $state.services);
    this.overallHealth = derived(this.state, $state => $state.overallHealth);
    this.alerts = derived(this.state, $state => $state.alerts);
    this.criticalAlerts = derived(this.state, $state => 
      $state.alerts.filter(a => a.severity === 'critical' && !a.acknowledged)
    );
  }
  
  /**
   * Initialize monitoring
   */
  async initialize(): Promise<void> {
    // Perform initial health check
    await this.performHealthCheck();
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(() => {
      void this.performHealthCheck();
    }, this.options.checkInterval);
  }
  
  /**
   * Configure monitoring options
   */
  setOptions(options: Partial<MonitoringOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Restart monitoring if interval changed
    if (options.checkInterval !== undefined) {
      this.destroy();
      void this.initialize();
    }
  }
  
  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Get system metrics
      const systemMetrics = await this.getSystemMetrics();
      
      // Check service health
      const serviceHealth = await this.checkServices();
      
      // Update metrics history
      if (systemMetrics) {
        this.metricsHistory.push(systemMetrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
          this.metricsHistory.shift();
        }
      }
      
      // Analyze health and generate alerts
      const alerts = this.analyzeHealth(systemMetrics, serviceHealth);
      
      // Determine overall health
      const overallHealth = this.determineOverallHealth(systemMetrics, serviceHealth);
      
      // Clean old alerts
      const cleanedAlerts = this.cleanOldAlerts([...this.getStoredAlerts(), ...alerts]);
      
      // Update state
      this.state.update(state => ({
        ...state,
        system: systemMetrics,
        services: serviceHealth,
        overallHealth,
        alerts: cleanedAlerts,
        lastUpdate: Date.now()
      }));
      
    } catch (error) {
      console.error('Health check failed:', error);
      this.createAlert('critical', 'SystemHealth', 'Health check failed: ' + String(error));
    }
  }
  
  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<SystemMetrics | null> {
    try {
      // Call system API endpoint
      const response = await fetch('/api/system/metrics');
      if (!response.ok) {
        throw new Error('Failed to get system metrics');
      }
      
      const data = await response.json() as {
        cpu: { usage: number; temperature?: number };
        memory: { used: number; total: number };
        disk: { used: number; total: number };
        network?: { rx?: number; tx?: number; errors?: number };
      };
      
      return {
        cpu: {
          usage: data.cpu.usage,
          temperature: data.cpu.temperature
        },
        memory: {
          used: data.memory.used,
          total: data.memory.total,
          percentage: (data.memory.used / data.memory.total) * 100
        },
        disk: {
          used: data.disk.used,
          total: data.disk.total,
          percentage: (data.disk.used / data.disk.total) * 100
        },
        network: {
          rx: data.network?.rx || 0,
          tx: data.network?.tx || 0,
          errors: data.network?.errors || 0
        }
      };
    } catch (error) {
      console.error('Failed to get system metrics:', error);
      return null;
    }
  }
  
  /**
   * Check service health
   */
  private async checkServices(): Promise<ServiceHealth[]> {
    const services: ServiceHealth[] = [];
    
    // Check HackRF service
    try {
      let currentStatus: { connected?: boolean; sweeping?: boolean; error?: string } = {};
      hackrfService.status.subscribe(s => currentStatus = s as typeof currentStatus)();
      
      services.push({
        name: 'HackRF',
        status: currentStatus.connected ? 'healthy' : 'unhealthy',
        lastCheck: Date.now(),
        error: currentStatus.error,
        metrics: {
          connected: currentStatus.connected || false,
          sweeping: currentStatus.sweeping || false
        }
      });
    } catch (error) {
      services.push({
        name: 'HackRF',
        status: 'unknown',
        lastCheck: Date.now(),
        error: String(error)
      });
    }
    
    // Check Kismet service
    try {
      const kismetStatus = kismetService.status;
      let currentStatus: { running?: boolean; uptime?: number; devices?: number; totalDevices?: number } = {};
      kismetStatus.subscribe(s => currentStatus = s as typeof currentStatus)();
      
      services.push({
        name: 'Kismet',
        status: currentStatus.running ? 'healthy' : 'unhealthy',
        uptime: currentStatus.uptime,
        lastCheck: Date.now(),
        metrics: {
          devices: currentStatus.devices || 0,
          totalDevices: currentStatus.totalDevices || 0
        }
      });
    } catch (error) {
      services.push({
        name: 'Kismet',
        status: 'unknown',
        lastCheck: Date.now(),
        error: String(error)
      });
    }
    
    // Check WebSocket connections
    const wsStatus = await this.checkWebSocketHealth();
    services.push(wsStatus);
    
    return services;
  }
  
  /**
   * Check WebSocket health
   */
  private async checkWebSocketHealth(): Promise<ServiceHealth> {
    try {
      // Check if WebSocket server is responding
      const response = await fetch('/api/test');
      
      return {
        name: 'WebSocket Server',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: Date.now()
      };
    } catch (error) {
      return {
        name: 'WebSocket Server',
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: String(error)
      };
    }
  }
  
  /**
   * Analyze health and generate alerts
   */
  private analyzeHealth(
    metrics: SystemMetrics | null, 
    services: ServiceHealth[]
  ): HealthAlert[] {
    const alerts: HealthAlert[] = [];
    
    if (metrics) {
      // CPU alerts
      if (metrics.cpu.usage > this.options.cpuThreshold) {
        alerts.push(this.createAlert(
          metrics.cpu.usage > 90 ? 'critical' : 'warning',
          'System',
          `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`
        ));
      }
      
      // Memory alerts
      if (metrics.memory.percentage > this.options.memoryThreshold) {
        alerts.push(this.createAlert(
          metrics.memory.percentage > 95 ? 'critical' : 'warning',
          'System',
          `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`
        ));
      }
      
      // Disk alerts
      if (metrics.disk.percentage > this.options.diskThreshold) {
        alerts.push(this.createAlert(
          metrics.disk.percentage > 95 ? 'critical' : 'warning',
          'System',
          `Low disk space: ${metrics.disk.percentage.toFixed(1)}% used`
        ));
      }
      
      // Temperature alerts
      if (metrics.cpu.temperature && metrics.cpu.temperature > 70) {
        alerts.push(this.createAlert(
          metrics.cpu.temperature > 80 ? 'critical' : 'warning',
          'System',
          `High CPU temperature: ${metrics.cpu.temperature}°C`
        ));
      }
    }
    
    // Service alerts
    services.forEach(service => {
      if (service.status === 'unhealthy') {
        alerts.push(this.createAlert(
          'error',
          service.name,
          `Service is unhealthy: ${service.error || 'Unknown error'}`
        ));
      } else if (service.status === 'degraded') {
        alerts.push(this.createAlert(
          'warning',
          service.name,
          'Service is degraded'
        ));
      }
    });
    
    return alerts;
  }
  
  /**
   * Determine overall system health
   */
  private determineOverallHealth(
    metrics: SystemMetrics | null,
    services: ServiceHealth[]
  ): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    // Check for critical issues
    const hasUnhealthyService = services.some(s => s.status === 'unhealthy');
    const hasCriticalMetrics = metrics && (
      metrics.cpu.usage > 95 ||
      metrics.memory.percentage > 95 ||
      metrics.disk.percentage > 95 ||
      (metrics.cpu.temperature && metrics.cpu.temperature > 85)
    );
    
    if (hasUnhealthyService || hasCriticalMetrics) {
      return 'unhealthy';
    }
    
    // Check for degraded conditions
    const hasDegradedService = services.some(s => s.status === 'degraded');
    const hasHighMetrics = metrics && (
      metrics.cpu.usage > this.options.cpuThreshold ||
      metrics.memory.percentage > this.options.memoryThreshold ||
      metrics.disk.percentage > this.options.diskThreshold
    );
    
    if (hasDegradedService || hasHighMetrics) {
      return 'degraded';
    }
    
    // Check if we have enough data
    if (!metrics || services.length === 0) {
      return 'unknown';
    }
    
    return 'healthy';
  }
  
  /**
   * Create alert
   */
  private createAlert(
    severity: HealthAlert['severity'],
    source: string,
    message: string
  ): HealthAlert {
    return {
      id: `alert-${Date.now()}-${Math.random()}`,
      severity,
      source,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
  }
  
  /**
   * Get stored alerts
   */
  private getStoredAlerts(): HealthAlert[] {
    let alerts: HealthAlert[] = [];
    this.state.subscribe(state => {
      alerts = state.alerts;
    })();
    return alerts;
  }
  
  /**
   * Clean old alerts
   */
  private cleanOldAlerts(alerts: HealthAlert[]): HealthAlert[] {
    const cutoff = Date.now() - this.options.alertRetention;
    return alerts.filter(alert => 
      alert.timestamp > cutoff || (!alert.acknowledged && alert.severity === 'critical')
    );
  }
  
  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    this.state.update(state => ({
      ...state,
      alerts: state.alerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    }));
  }
  
  /**
   * Get metrics history
   */
  getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }
  
  /**
   * Get average metrics over time period
   */
  getAverageMetrics(minutes: number = 30): SystemMetrics | null {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentMetrics = this.metricsHistory.filter((_, index) => {
      const timestamp = Date.now() - ((this.metricsHistory.length - index) * this.options.checkInterval);
      return timestamp > cutoff;
    });
    
    if (recentMetrics.length === 0) {
      return null;
    }
    
    const sum = recentMetrics.reduce((acc, metrics) => ({
      cpu: {
        usage: acc.cpu.usage + metrics.cpu.usage,
        temperature: (acc.cpu.temperature || 0) + (metrics.cpu.temperature || 0)
      },
      memory: {
        used: acc.memory.used + metrics.memory.used,
        total: metrics.memory.total,
        percentage: acc.memory.percentage + metrics.memory.percentage
      },
      disk: {
        used: acc.disk.used + metrics.disk.used,
        total: metrics.disk.total,
        percentage: acc.disk.percentage + metrics.disk.percentage
      },
      network: {
        rx: acc.network.rx + metrics.network.rx,
        tx: acc.network.tx + metrics.network.tx,
        errors: acc.network.errors + metrics.network.errors
      }
    }), {
      cpu: { usage: 0, temperature: 0 },
      memory: { used: 0, total: 0, percentage: 0 },
      disk: { used: 0, total: 0, percentage: 0 },
      network: { rx: 0, tx: 0, errors: 0 }
    });
    
    const count = recentMetrics.length;
    
    return {
      cpu: {
        usage: sum.cpu.usage / count,
        temperature: sum.cpu.temperature ? sum.cpu.temperature / count : undefined
      },
      memory: {
        used: sum.memory.used / count,
        total: sum.memory.total,
        percentage: sum.memory.percentage / count
      },
      disk: {
        used: sum.disk.used / count,
        total: sum.disk.total,
        percentage: sum.disk.percentage / count
      },
      network: {
        rx: sum.network.rx / count,
        tx: sum.network.tx / count,
        errors: sum.network.errors / count
      }
    };
  }
  
  /**
   * Force health check
   */
  async forceCheck(): Promise<void> {
    await this.performHealthCheck();
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Export singleton instance
export const systemHealthMonitor = new SystemHealthMonitor();