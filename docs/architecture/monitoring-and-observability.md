# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Sentry for error tracking, custom performance metrics via Performance API
- **Backend Monitoring:** OpenTelemetry with Prometheus metrics and Jaeger tracing
- **Error Tracking:** Sentry unified across frontend and backend with source maps
- **Performance Monitoring:** Grafana dashboards with custom RF signal processing metrics
- **Log Aggregation:** Edge-capable local log storage with search and compression

## Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- JavaScript errors per session
- API response times (p50, p95, p99)
- User interactions (map pan/zoom, signal selection)
- WebSocket connection stability (disconnections/hour)
- Signal rendering performance (signals/second)
- Memory usage for large datasets

**Backend Metrics:**
- Request rate by endpoint
- Error rate by type (4xx, 5xx)
- Response time percentiles (p50, p95, p99)
- Database query performance (spatial queries < 50ms)
- Signal processing throughput (signals/second)
- Hardware device availability (uptime percentage)
- WebSocket connections (active, dropped)
- Queue depths (signal processing, sync)

## Implementation Examples

```typescript
// Frontend monitoring setup
// lib/monitoring/metrics.ts
import * as Sentry from '@sentry/sveltekit';

export class FrontendMetrics {
  private static performanceObserver: PerformanceObserver;
  
  static initialize() {
    // Sentry initialization
    Sentry.init({
      dsn: process.env.PUBLIC_SENTRY_DSN,
      environment: process.env.PUBLIC_ENV,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: [process.env.PUBLIC_API_URL],
          routingInstrumentation: Sentry.svelteKitRoutingInstrumentation()
        })
      ]
    });
    
    // Custom performance monitoring
    this.setupPerformanceObserver();
    this.trackSignalRendering();
  }
  
  private static setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Track long tasks
        if (entry.entryType === 'longtask') {
          this.trackMetric('frontend.longtask', entry.duration, {
            source: entry.attribution?.[0]?.containerSrc
          });
        }
        
        // Track largest contentful paint
        if (entry.entryType === 'largest-contentful-paint') {
          this.trackMetric('frontend.lcp', entry.startTime);
        }
      }
    });
    
    this.performanceObserver.observe({ 
      entryTypes: ['longtask', 'largest-contentful-paint'] 
    });
  }
  
  static trackSignalRendering() {
    let lastRenderTime = 0;
    let signalCount = 0;
    
    // Hook into signal store updates
    signalStore.subscribe((signals) => {
      const startTime = performance.now();
      
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        const signalsPerSecond = signals.length / (renderTime / 1000);
        
        this.trackMetric('frontend.signal_render_rate', signalsPerSecond, {
          count: signals.length,
          renderTime
        });
        
        // Alert if rendering is too slow
        if (renderTime > 100 && signals.length > 1000) {
          Sentry.captureMessage('Slow signal rendering detected', 'warning', {
            extra: { signalCount: signals.length, renderTime }
          });
        }
      });
    });
  }
  
  static trackMetric(name: string, value: number, tags?: Record<string, any>) {
    // Send to monitoring backend
    fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value, tags, timestamp: Date.now() })
    }).catch(console.error);
  }
}
```

```typescript
// Backend monitoring setup
// apps/api/src/monitoring/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { metrics } from '@opentelemetry/api';

export class BackendTelemetry {
  private static sdk: NodeSDK;
  private static signalCounter: any;
  private static responseHistogram: any;
  private static hardwareGauge: any;
  
  static initialize() {
    // OpenTelemetry setup
    const prometheusExporter = new PrometheusExporter({
      port: 9090,
      endpoint: '/metrics'
    });
    
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
    });
    
    this.sdk = new NodeSDK({
      resource: new Resource({
        'service.name': 'argos-api',
        'service.version': process.env.npm_package_version
      }),
      metricReader: prometheusExporter,
      traceExporter: jaegerExporter
    });
    
    this.sdk.start();
    this.setupMetrics();
  }
  
  private static setupMetrics() {
    const meter = metrics.getMeter('argos-api');
    
    // Signal processing metrics
    this.signalCounter = meter.createCounter('signals_processed_total', {
      description: 'Total number of signals processed'
    });
    
    // Response time histogram
    this.responseHistogram = meter.createHistogram('http_response_duration_seconds', {
      description: 'HTTP response time in seconds',
      boundaries: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10]
    });
    
    // Hardware status gauge
    this.hardwareGauge = meter.createObservableGauge('hardware_device_status', {
      description: 'Hardware device connection status (1=connected, 0=disconnected)'
    });
    
    // Register hardware status callback
    this.hardwareGauge.addCallback(async (observableResult) => {
      const devices = await HardwareManager.getDeviceStatuses();
      devices.forEach(device => {
        observableResult.observe(device.connected ? 1 : 0, {
          device: device.name,
          type: device.type
        });
      });
    });
  }
  
  static recordSignal(signal: Signal, processingTime: number) {
    this.signalCounter.add(1, {
      frequency_band: this.getFrequencyBand(signal.frequency),
      source: signal.droneId,
      signal_strength: this.getSignalStrengthCategory(signal.rssi)
    });
    
    // Track processing performance
    if (processingTime > 100) {
      Sentry.captureMessage('Slow signal processing', 'warning', {
        extra: { processingTime, signalId: signal.id }
      });
    }
  }
  
  static recordHttpRequest(req: Request, res: Response, duration: number) {
    this.responseHistogram.record(duration / 1000, {
      method: req.method,
      route: req.route?.path || 'unknown',
      status_code: res.statusCode.toString()
    });
  }
  
  private static getFrequencyBand(frequency: number): string {
    if (frequency >= 2.4e9 && frequency < 2.5e9) return '2.4GHz';
    if (frequency >= 5.1e9 && frequency < 5.9e9) return '5GHz';
    if (frequency >= 900e6 && frequency < 928e6) return '900MHz';
    return 'other';
  }
  
  private static getSignalStrengthCategory(rssi: number): string {
    if (rssi > -50) return 'strong';
    if (rssi > -70) return 'moderate';
    if (rssi > -85) return 'weak';
    return 'very_weak';
  }
}

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    BackendTelemetry.recordHttpRequest(req, res, duration);
  });
  
  next();
};
```

## Edge Log Aggregation

```typescript
// apps/api/src/monitoring/edgeLogger.ts
import { RingBuffer } from '../utils/ringBuffer';
import { compress } from '../utils/compression';

interface LogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: Record<string, any>;
}

// Local log aggregation for edge deployment
export class EdgeLogAggregator {
  private logBuffer: RingBuffer<LogEntry>;
  private logIndices: Map<string, Set<number>>; // For local search
  private compressedArchives: Map<string, Buffer>; // Date-based archives
  
  constructor(bufferSize: number = 100000) {
    this.logBuffer = new RingBuffer<LogEntry>(bufferSize);
    this.logIndices = new Map();
    this.compressedArchives = new Map();
    
    // Set up periodic compression
    setInterval(() => this.archiveOldLogs(), 3600000); // Every hour
  }
  
  async log(entry: LogEntry): Promise<void> {
    // Add timestamp if not present
    entry.timestamp = entry.timestamp || Date.now();
    
    // Store locally with indexing
    const index = this.logBuffer.push(entry);
    
    // Index by severity, component, etc.
    this.indexLogEntry(entry, index);
    
    // Also send to Sentry if error and online
    if (entry.level === 'error' && navigator.onLine) {
      Sentry.captureMessage(entry.message, 'error', {
        extra: entry.metadata
      });
    }
  }
  
  private indexLogEntry(entry: LogEntry, index: number): void {
    // Index by level
    const levelIndex = this.logIndices.get(`level:${entry.level}`) || new Set();
    levelIndex.add(index);
    this.logIndices.set(`level:${entry.level}`, levelIndex);
    
    // Index by component
    const componentIndex = this.logIndices.get(`component:${entry.component}`) || new Set();
    componentIndex.add(index);
    this.logIndices.set(`component:${entry.component}`, componentIndex);
    
    // Index by hour for time-based queries
    const hour = new Date(entry.timestamp).toISOString().slice(0, 13);
    const timeIndex = this.logIndices.get(`hour:${hour}`) || new Set();
    timeIndex.add(index);
    this.logIndices.set(`hour:${hour}`, timeIndex);
  }
  
  // Local log search without external service
  search(query: {
    level?: string;
    component?: string;
    startTime?: number;
    endTime?: number;
    text?: string;
  }): LogEntry[] {
    let indices: Set<number> | null = null;
    
    // Find matching indices
    if (query.level) {
      indices = this.logIndices.get(`level:${query.level}`);
    }
    
    if (query.component) {
      const componentIndices = this.logIndices.get(`component:${query.component}`);
      if (componentIndices) {
        indices = indices ? 
          new Set([...indices].filter(i => componentIndices.has(i))) : 
          componentIndices;
      }
    }
    
    // Convert indices to log entries
    const results: LogEntry[] = [];
    const allIndices = indices || new Set([...Array(this.logBuffer.size()).keys()]);
    
    for (const index of allIndices) {
      const entry = this.logBuffer.get(index);
      if (!entry) continue;
      
      // Apply time filters
      if (query.startTime && entry.timestamp < query.startTime) continue;
      if (query.endTime && entry.timestamp > query.endTime) continue;
      
      // Apply text search
      if (query.text && !entry.message.includes(query.text)) continue;
      
      results.push(entry);
    }
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }
  
  private async archiveOldLogs(): Promise<void> {
    const oneDayAgo = Date.now() - 86400000;
    const logsToArchive: LogEntry[] = [];
    
    // Find old logs
    for (let i = 0; i < this.logBuffer.size(); i++) {
      const entry = this.logBuffer.get(i);
      if (entry && entry.timestamp < oneDayAgo) {
        logsToArchive.push(entry);
      }
    }
    
    if (logsToArchive.length === 0) return;
    
    // Group by date
    const logsByDate = new Map<string, LogEntry[]>();
    logsToArchive.forEach(log => {
      const date = new Date(log.timestamp).toISOString().slice(0, 10);
      const dateLogs = logsByDate.get(date) || [];
      dateLogs.push(log);
      logsByDate.set(date, dateLogs);
    });
    
    // Compress and archive
    for (const [date, logs] of logsByDate) {
      const compressed = await compress(JSON.stringify(logs));
      this.compressedArchives.set(date, compressed);
      
      // Remove old archives (keep 7 days)
      const oldDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      this.compressedArchives.delete(oldDate);
    }
    
    // Clear archived logs from buffer
    this.logBuffer.clear((entry) => entry.timestamp >= oneDayAgo);
    
    // Rebuild indices
    this.rebuildIndices();
  }
  
  private rebuildIndices(): void {
    this.logIndices.clear();
    
    for (let i = 0; i < this.logBuffer.size(); i++) {
      const entry = this.logBuffer.get(i);
      if (entry) {
        this.indexLogEntry(entry, i);
      }
    }
  }
  
  // Export logs for analysis
  async exportLogs(startDate: string, endDate: string): Promise<Buffer> {
    const logs: LogEntry[] = [];
    
    // Get from archives
    for (const [date, compressed] of this.compressedArchives) {
      if (date >= startDate && date <= endDate) {
        const decompressed = await decompress(compressed);
        logs.push(...JSON.parse(decompressed));
      }
    }
    
    // Get from current buffer
    const currentLogs = this.search({
      startTime: new Date(startDate).getTime(),
      endTime: new Date(endDate).getTime()
    });
    logs.push(...currentLogs);
    
    return Buffer.from(JSON.stringify(logs));
  }
}

// Global logger instance
export const edgeLogger = new EdgeLogAggregator();
```

## Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Argos RF Signal Monitoring",
    "panels": [
      {
        "title": "Signal Processing Rate",
        "targets": [{
          "expr": "rate(signals_processed_total[5m])",
          "legendFormat": "{{frequency_band}} - {{signal_strength}}"
        }]
      },
      {
        "title": "API Response Times",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_response_duration_seconds)",
          "legendFormat": "p95 - {{route}}"
        }]
      },
      {
        "title": "Hardware Device Status",
        "targets": [{
          "expr": "hardware_device_status",
          "legendFormat": "{{device}} ({{type}})"
        }]
      },
      {
        "title": "WebSocket Connections",
        "targets": [{
          "expr": "websocket_active_connections",
          "legendFormat": "Active Connections"
        }]
      }
    ]
  }
}
```

## Alerting Rules

```yaml