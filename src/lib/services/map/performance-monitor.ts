/**
 * Performance monitoring for heatmap rendering
 * Tracks FPS, memory usage, and rendering metrics
 */

export interface PerformanceMetrics {
  [key: string]: number | undefined; // Allow string indexing
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderTime: number;
  interpolationTime: number;
  gridProcessingTime?: number;
  pointCount: number;
  layerCount: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  minFps: number;
  maxFrameTime: number;
  maxMemoryUsage: number;
  maxRenderTime: number;
}

type PerformanceCallback = (metrics: PerformanceMetrics) => void;

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    renderTime: 0,
    interpolationTime: 0,
    gridProcessingTime: 0,
    pointCount: 0,
    layerCount: 0,
    timestamp: Date.now()
  };

  private thresholds: PerformanceThresholds = {
    minFps: 30,
    maxFrameTime: 33, // ~30 FPS
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxRenderTime: 16 // Target 60 FPS
  };

  private frameCount = 0;
  private lastFrameTime = 0;
  private frameStartTime = 0;
  private fpsUpdateInterval = 1000; // Update FPS every second
  private lastFpsUpdate = 0;
  
  private callbacks: Map<string, PerformanceCallback> = new Map();
  private rafId: number | null = null;
  private monitoring = false;

  // Ring buffers for averaging
  private frameTimes: number[] = [];
  private renderTimes: number[] = [];
  private bufferSize = 60; // Average over 60 frames

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = performance.now();
    this.animate();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.monitoring = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Animation loop for FPS calculation
   */
  private animate = (): void => {
    if (!this.monitoring) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Update frame time buffer
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.bufferSize) {
      this.frameTimes.shift();
    }

    // Calculate average frame time
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.metrics.frameTime = avgFrameTime;

    // Update FPS
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.metrics.fps = this.frameCount * (1000 / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      
      // Check thresholds and notify
      this.checkThresholds();
    }

    this.frameCount++;
    this.rafId = requestAnimationFrame(this.animate);
  };

  /**
   * Mark the start of a frame
   */
  startFrame(): void {
    this.frameStartTime = performance.now();
  }

  /**
   * Mark the end of a frame
   */
  endFrame(): void {
    if (this.frameStartTime > 0) {
      const frameTime = performance.now() - this.frameStartTime;
      this.renderTimes.push(frameTime);
      if (this.renderTimes.length > this.bufferSize) {
        this.renderTimes.shift();
      }
      
      // Update average render time
      const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
      this.metrics.renderTime = avgRenderTime;
    }
  }

  /**
   * Record a specific metric
   */
  recordMetric(name: keyof PerformanceMetrics, value: number): void {
    (this.metrics as Record<string, number>)[name] = value;
  }

  /**
   * Update point count
   */
  updatePointCount(count: number): void {
    this.metrics.pointCount = count;
  }

  /**
   * Update layer count
   */
  updateLayerCount(count: number): void {
    this.metrics.layerCount = count;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    // Update memory usage if available
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize?: number } }).memory;
      if (memory?.usedJSHeapSize !== undefined) {
        this.metrics.memoryUsage = memory.usedJSHeapSize;
      }
    }

    this.metrics.timestamp = Date.now();
    return { ...this.metrics };
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(): void {
    const warnings: string[] = [];

    if (this.metrics.fps < this.thresholds.minFps && this.metrics.fps > 0) {
      warnings.push(`Low FPS: ${this.metrics.fps.toFixed(1)}`);
    }

    if (this.metrics.frameTime > this.thresholds.maxFrameTime) {
      warnings.push(`High frame time: ${this.metrics.frameTime.toFixed(1)}ms`);
    }

    if (this.metrics.renderTime > this.thresholds.maxRenderTime) {
      warnings.push(`High render time: ${this.metrics.renderTime.toFixed(1)}ms`);
    }

    if (this.metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      const memoryMB = (this.metrics.memoryUsage / 1024 / 1024).toFixed(1);
      warnings.push(`High memory usage: ${memoryMB}MB`);
    }

    if (warnings.length > 0) {
      this.notifyCallbacks('performanceWarning', this.metrics);
    }
  }

  /**
   * Register a callback for events
   */
  on(event: string, callback: PerformanceCallback): void {
    this.callbacks.set(event, callback);
  }

  /**
   * Remove a callback
   */
  off(event: string): void {
    this.callbacks.delete(event);
  }

  /**
   * Notify all callbacks for an event
   */
  private notifyCallbacks(event: string, metrics: PerformanceMetrics): void {
    const callback = this.callbacks.get(event);
    if (callback) {
      callback(metrics);
    }
  }

  /**
   * Set performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get performance report
   */
  getReport(): string {
    const metrics = this.getMetrics();
    const memoryMB = (metrics.memoryUsage / 1024 / 1024).toFixed(1);
    
    return `Performance Report:
- FPS: ${metrics.fps.toFixed(1)}
- Frame Time: ${metrics.frameTime.toFixed(1)}ms
- Render Time: ${metrics.renderTime.toFixed(1)}ms
- Interpolation Time: ${metrics.interpolationTime.toFixed(1)}ms
- Memory Usage: ${memoryMB}MB
- Point Count: ${metrics.pointCount}
- Layer Count: ${metrics.layerCount}`;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.frameTimes = [];
    this.renderTimes = [];
    this.frameCount = 0;
    this.metrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      renderTime: 0,
      interpolationTime: 0,
      pointCount: 0,
      layerCount: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Destroy monitor and clean up
   */
  destroy(): void {
    this.stopMonitoring();
    this.callbacks.clear();
    this.reset();
  }
}