export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

export interface PerformanceReport {
  startTime: number;
  endTime: number;
  duration: number;
  metrics: Record<string, PerformanceMetric[]>;
  summary: {
    avgResponseTime: number;
    peakMemoryUsage: number;
    errorRate: number;
    throughput: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  memoryLeakDetected: boolean;
  performanceDegradation: number;
  stabilityScore: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private errorCount: number = 0;
  private totalRequests: number = 0;
  private _memoryBaseline: number = 0;
  private memoryReadings: number[] = [];

  startMetrics(): void {
    this.startTime = Date.now();
    this.metrics = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    this._memoryBaseline = process.memoryUsage().heapUsed;
    this.memoryReadings = [];
    
    // Start periodic memory monitoring
    this.startMemoryMonitoring();
  }

  recordMetric(name: string, value: number): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now()
    });
    
    if (name.includes('error')) {
      this.errorCount++;
    }
    
    if (name.includes('request') || name.includes('action')) {
      this.totalRequests++;
    }
  }

  recordError(name: string, _error: Error): void {
    this.recordMetric(`error_${name}`, 1);
    this.errorCount++;
  }

  generateReport(): PerformanceReport {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;
    
    // Group metrics by name
    const groupedMetrics: Record<string, PerformanceMetric[]> = {};
    for (const metric of this.metrics) {
      if (!groupedMetrics[metric.name]) {
        groupedMetrics[metric.name] = [];
      }
      groupedMetrics[metric.name].push(metric);
    }
    
    // Calculate response times
    const responseTimes = this.metrics
      .filter(m => m.name.includes('response_time') || m.name.includes('action'))
      .map(m => m.value)
      .sort((a, b) => a - b);
    
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, val) => sum + val, 0) / responseTimes.length
      : 0;
    
    const p95ResponseTime = this.calculatePercentile(responseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(responseTimes, 99);
    
    // Calculate memory statistics
    const peakMemoryUsage = Math.max(...this.memoryReadings, 0);
    const memoryLeakDetected = this.detectMemoryLeak();
    
    // Calculate performance degradation
    const performanceDegradation = this.calculatePerformanceDegradation();
    
    // Calculate throughput
    const throughput = this.totalRequests / (duration / 1000); // requests per second
    
    // Calculate error rate
    const errorRate = this.totalRequests > 0 
      ? this.errorCount / this.totalRequests 
      : 0;
    
    // Calculate stability score (0-100)
    const stabilityScore = this.calculateStabilityScore(
      errorRate,
      performanceDegradation,
      memoryLeakDetected
    );
    
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration,
      metrics: groupedMetrics,
      summary: {
        avgResponseTime,
        peakMemoryUsage,
        errorRate,
        throughput,
        p95ResponseTime,
        p99ResponseTime
      },
      memoryLeakDetected,
      performanceDegradation,
      stabilityScore
    };
  }

  avgMetric(metricName: string): number {
    const metrics = this.metrics.filter(m => m.name === metricName);
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((total, m) => total + m.value, 0);
    return sum / metrics.length;
  }

  maxMetric(metricName: string): number {
    const metrics = this.metrics.filter(m => m.name === metricName);
    if (metrics.length === 0) return 0;
    
    return Math.max(...metrics.map(m => m.value));
  }

  getMemoryBaseline(): number {
    return this._memoryBaseline;
  }

  minMetric(metricName: string): number {
    const metrics = this.metrics.filter(m => m.name === metricName);
    if (metrics.length === 0) return 0;
    
    return Math.min(...metrics.map(m => m.value));
  }

  private startMemoryMonitoring(): void {
    const interval = setInterval(() => {
      const memUsage = process.memoryUsage().heapUsed;
      this.memoryReadings.push(memUsage);
      this.recordMetric('memory_usage', memUsage);
      
      // Stop monitoring when metrics collection ends
      if (this.endTime > 0) {
        clearInterval(interval);
      }
    }, 1000); // Check every second
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private detectMemoryLeak(): boolean {
    if (this.memoryReadings.length < 10) return false;
    
    // Simple linear regression to detect upward trend
    const n = this.memoryReadings.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = this.memoryReadings;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // If memory is growing by more than 1MB per reading on average, flag as leak
    return slope > 1024 * 1024;
  }

  private calculatePerformanceDegradation(): number {
    // Compare performance at start vs end
    const timeBasedMetrics = this.metrics
      .filter(m => m.name.includes('batch_time') || m.name.includes('response_time'))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (timeBasedMetrics.length < 10) return 0;
    
    // Compare first 10% with last 10%
    const tenPercent = Math.floor(timeBasedMetrics.length * 0.1);
    const firstBatch = timeBasedMetrics.slice(0, tenPercent);
    const lastBatch = timeBasedMetrics.slice(-tenPercent);
    
    const avgFirst = firstBatch.reduce((sum, m) => sum + m.value, 0) / firstBatch.length;
    const avgLast = lastBatch.reduce((sum, m) => sum + m.value, 0) / lastBatch.length;
    
    // Return percentage degradation
    return avgFirst > 0 ? (avgLast - avgFirst) / avgFirst : 0;
  }

  private calculateStabilityScore(
    errorRate: number,
    performanceDegradation: number,
    memoryLeakDetected: boolean
  ): number {
    let score = 100;
    
    // Deduct for errors (up to 30 points)
    score -= Math.min(30, errorRate * 300);
    
    // Deduct for performance degradation (up to 30 points)
    score -= Math.min(30, Math.abs(performanceDegradation) * 100);
    
    // Deduct for memory leak (20 points)
    if (memoryLeakDetected) {
      score -= 20;
    }
    
    // Deduct for high memory usage (up to 20 points)
    const maxMemory = Math.max(...this.memoryReadings);
    const memoryGB = maxMemory / (1024 * 1024 * 1024);
    if (memoryGB > 1) {
      score -= Math.min(20, (memoryGB - 1) * 10);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  // Utility method for benchmark formatting
  formatReport(report: PerformanceReport): string {
    return `
Performance Report
==================
Duration: ${(report.duration / 1000).toFixed(2)}s
Throughput: ${report.summary.throughput.toFixed(2)} req/s
Avg Response: ${report.summary.avgResponseTime.toFixed(2)}ms
P95 Response: ${report.summary.p95ResponseTime.toFixed(2)}ms
P99 Response: ${report.summary.p99ResponseTime.toFixed(2)}ms
Error Rate: ${(report.summary.errorRate * 100).toFixed(2)}%
Peak Memory: ${(report.summary.peakMemoryUsage / 1024 / 1024).toFixed(2)}MB
Memory Leak: ${report.memoryLeakDetected ? 'YES' : 'No'}
Performance Degradation: ${(report.performanceDegradation * 100).toFixed(2)}%
Stability Score: ${report.stabilityScore.toFixed(0)}/100
`;
  }
}