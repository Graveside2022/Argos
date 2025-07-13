/**
 * Dedicated heatmap service for high-performance signal visualization
 * Optimized for real-time drone signal detection
 */

import type { SignalMarker } from '$lib/stores/map/signals';
import { SignalInterpolator, type InterpolationMethod } from './signalInterpolation';
import { WebGLHeatmapRenderer } from './webglHeatmapRenderer';
import { PerformanceMonitor } from './performanceMonitor';
import type { GridCell } from './gridProcessor';

export interface HeatmapConfig {
  resolution: number; // Grid resolution in meters
  interpolationMethod: InterpolationMethod;
  minOpacity: number;
  maxOpacity: number;
  blur: number;
  radius: number;
  gradient: Record<number, string>; // Power levels to colors
  updateInterval: number; // Milliseconds between updates
  performanceMode: 'quality' | 'balanced' | 'performance';
}

export interface HeatmapPoint {
  lat: number;
  lon: number;
  intensity: number; // Normalized 0-1
  altitude?: number;
  timestamp: number;
}

export interface HeatmapLayer {
  id: string;
  name: string;
  altitudeRange: [number, number]; // [min, max] in meters
  points: HeatmapPoint[];
  visible: boolean;
  opacity: number;
  config: HeatmapConfig;
}

export class HeatmapService {
  private interpolator: SignalInterpolator;
  private renderer: WebGLHeatmapRenderer | null = null;
  private performanceMonitor: PerformanceMonitor;
  private layers: Map<string, HeatmapLayer> = new Map();
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastUpdateTime = 0;
  private pendingUpdate = false;
  
  private defaultConfig: HeatmapConfig = {
    resolution: 25, // 25m grid
    interpolationMethod: 'idw',
    minOpacity: 0.1,
    maxOpacity: 0.8,
    blur: 20,
    radius: 30,
    gradient: {
      0.0: '#0000ff', // -100 dBm (very weak)
      0.2: '#00ffff', // -80 dBm (weak)
      0.4: '#00ff00', // -70 dBm (fair)
      0.6: '#ffff00', // -60 dBm (good)
      0.8: '#ff8800', // -50 dBm (strong)
      1.0: '#ff0000'  // -40 dBm (very strong)
    },
    updateInterval: 100, // 10 FPS minimum
    performanceMode: 'balanced'
  };

  constructor() {
    this.interpolator = new SignalInterpolator();
    this.performanceMonitor = new PerformanceMonitor();
    
    // Initialize default layers
    this.initializeDefaultLayers();
  }

  /**
   * Initialize with a canvas element for WebGL rendering
   */
  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    
    try {
      this.renderer = new WebGLHeatmapRenderer(canvas);
      this.renderer.initialize();
      
      // Set up performance monitoring
      this.performanceMonitor.on('performanceWarning', (metrics) => {
        this.adjustQualitySettings(metrics);
      });
      
      // Heatmap service initialized with WebGL renderer
    } catch (error) {
      console.error('Failed to initialize WebGL, falling back to Canvas2D:', error);
      // Fallback implementation would go here
    }
  }

  /**
   * Initialize default altitude layers
   */
  private initializeDefaultLayers(): void {
    // Ground level (0-100m)
    this.addLayer({
      id: 'ground',
      name: 'Ground Level',
      altitudeRange: [0, 100],
      config: { ...this.defaultConfig }
    });

    // Low altitude (100-400m)
    this.addLayer({
      id: 'low',
      name: 'Low Altitude',
      altitudeRange: [100, 400],
      config: { 
        ...this.defaultConfig,
        gradient: {
          0.0: '#000080',
          0.2: '#0080ff',
          0.4: '#00ff80',
          0.6: '#ffff00',
          0.8: '#ff8000',
          1.0: '#ff0000'
        }
      }
    });

    // High altitude (400m+)
    this.addLayer({
      id: 'high',
      name: 'High Altitude',
      altitudeRange: [400, 10000],
      config: { 
        ...this.defaultConfig,
        gradient: {
          0.0: '#4b0082',
          0.2: '#8b00ff',
          0.4: '#ff00ff',
          0.6: '#ff0080',
          0.8: '#ff4040',
          1.0: '#ff0000'
        }
      }
    });
  }

  /**
   * Add a new heatmap layer
   */
  addLayer(options: {
    id: string;
    name: string;
    altitudeRange: [number, number];
    config?: Partial<HeatmapConfig>;
  }): void {
    const layer: HeatmapLayer = {
      id: options.id,
      name: options.name,
      altitudeRange: options.altitudeRange,
      points: [],
      visible: true,
      opacity: 1,
      config: { ...this.defaultConfig, ...options.config }
    };
    
    this.layers.set(options.id, layer);
  }

  /**
   * Process aggregated grid cells for optimized heatmap rendering
   */
  processGridCells(
    gridCells: GridCell[],
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  ): void {
    const startTime = performance.now();

    // Convert grid cells to heatmap points with enhanced weighting
    const aggregatedPoints: HeatmapPoint[] = [];
    
    gridCells.forEach(cell => {
      // Only process cells within bounds
      if (cell.bounds.minLat >= bounds.minLat &&
          cell.bounds.maxLat <= bounds.maxLat &&
          cell.bounds.minLon >= bounds.minLon &&
          cell.bounds.maxLon <= bounds.maxLon) {
        
        const centerLat = (cell.bounds.minLat + cell.bounds.maxLat) / 2;
        const centerLon = (cell.bounds.minLon + cell.bounds.maxLon) / 2;
        
        // Use aggregated power normalized to intensity
        const intensity = this.normalizeSignalPower(cell.stats.aggregatedPower);
        
        // Create weighted points based on signal density
        // Higher density cells get multiple points for better visual representation
        const pointWeight = Math.min(5, Math.ceil(cell.stats.densityFactor * 5));
        
        for (let i = 0; i < pointWeight; i++) {
          // Add slight jitter for multiple points to avoid exact overlap
          const jitterLat = (Math.random() - 0.5) * 0.0001;
          const jitterLon = (Math.random() - 0.5) * 0.0001;
          
          aggregatedPoints.push({
            lat: centerLat + jitterLat,
            lon: centerLon + jitterLon,
            intensity: intensity * cell.stats.confidenceFactor, // Weight by confidence
            timestamp: cell.stats.timeRange.end
          });
        }
      }
    });

    // Update all layers with aggregated data
    for (const [_layerId, layer] of this.layers) {
      if (!layer.visible) continue;
      
      // For grid aggregation, we don't filter by altitude
      // The grid already contains mixed altitude signals
      layer.points = aggregatedPoints;
    }

    const processingTime = performance.now() - startTime;
    this.performanceMonitor.recordMetric('gridProcessingTime', processingTime);
    this.performanceMonitor.updatePointCount(aggregatedPoints.length);

    // Schedule render update
    this.scheduleUpdate();
  }

  /**
   * Process signals into heatmap points with interpolation
   */
  async processSignals(
    signals: SignalMarker[],
    bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }
  ): Promise<void> {
    const startTime = performance.now();
    
    // Clear existing points
    this.layers.forEach(layer => {
      layer.points = [];
    });

    // Group signals by altitude
    const signalsByAltitude = this.groupSignalsByAltitude(signals);

    // Process each layer
    for (const [layerId, layerSignals] of signalsByAltitude) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible) continue;

      // Convert signals to heatmap points
      const points = layerSignals.map(signal => ({
        lat: signal.lat,
        lon: signal.lon,
        intensity: this.normalizeSignalPower(signal.power),
        altitude: signal.altitude,
        timestamp: signal.timestamp
      }));

      // Interpolate points based on configuration
      if (layer.config.interpolationMethod !== 'none') {
        const interpolatedPoints = await this.interpolator.interpolate(
          points,
          bounds,
          layer.config.resolution,
          layer.config.interpolationMethod
        );
        layer.points = interpolatedPoints;
      } else {
        layer.points = points;
      }
    }

    const processingTime = performance.now() - startTime;
    this.performanceMonitor.recordMetric('interpolationTime', processingTime);

    // Schedule render update
    this.scheduleUpdate();
  }

  /**
   * Group signals by altitude layers
   */
  private groupSignalsByAltitude(signals: SignalMarker[]): Map<string, SignalMarker[]> {
    const grouped = new Map<string, SignalMarker[]>();

    signals.forEach(signal => {
      const altitude = signal.altitude || 0;
      
      // Find appropriate layer
      for (const [layerId, layer] of this.layers) {
        const [minAlt, maxAlt] = layer.altitudeRange;
        if (altitude >= minAlt && altitude < maxAlt) {
          if (!grouped.has(layerId)) {
            grouped.set(layerId, []);
          }
          grouped.get(layerId)?.push(signal);
          break;
        }
      }
    });

    return grouped;
  }

  /**
   * Normalize signal power to 0-1 intensity
   */
  private normalizeSignalPower(power: number): number {
    // Map -100 to -30 dBm to 0-1
    const normalized = (power + 100) / 70;
    return Math.max(0, Math.min(1, normalized));
  }

  /**
   * Schedule a render update with throttling
   */
  private scheduleUpdate(): void {
    if (this.pendingUpdate) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    const minInterval = this.getMinUpdateInterval();

    if (timeSinceLastUpdate >= minInterval) {
      this.update();
    } else {
      this.pendingUpdate = true;
      if (this.updateTimer !== null) clearTimeout(this.updateTimer);
      
      this.updateTimer = setTimeout(() => {
        this.pendingUpdate = false;
        this.update();
      }, minInterval - timeSinceLastUpdate);
    }
  }

  /**
   * Get minimum update interval based on performance mode
   */
  private getMinUpdateInterval(): number {
    const baseInterval = this.defaultConfig.updateInterval;
    
    switch (this.getCurrentPerformanceMode()) {
      case 'quality':
        return baseInterval * 0.5; // 20 FPS max
      case 'balanced':
        return baseInterval; // 10 FPS max
      case 'performance':
        return baseInterval * 2; // 5 FPS max
      default:
        return baseInterval;
    }
  }

  /**
   * Get current performance mode based on metrics
   */
  private getCurrentPerformanceMode(): 'quality' | 'balanced' | 'performance' {
    const metrics = this.performanceMonitor.getMetrics();
    
    // Auto-adjust based on frame rate
    if (metrics.fps < 30) {
      return 'performance';
    } else if (metrics.fps < 50) {
      return 'balanced';
    } else {
      return 'quality';
    }
  }

  /**
   * Render the heatmap
   */
  private update(): void {
    if (!this.renderer) return;

    const startTime = performance.now();
    this.performanceMonitor.startFrame();

    try {
      // Clear canvas
      this.renderer.clear();

      // Render each visible layer
      const visibleLayers = Array.from(this.layers.values())
        .filter(layer => layer.visible && layer.points.length > 0)
        .sort((a, b) => a.altitudeRange[0] - b.altitudeRange[0]); // Bottom to top

      visibleLayers.forEach(layer => {
        this.renderer?.renderLayer(layer);
      });

      this.lastUpdateTime = Date.now();
    } catch (error) {
      console.error('Heatmap render error:', error);
    }

    const renderTime = performance.now() - startTime;
    this.performanceMonitor.endFrame();
    this.performanceMonitor.recordMetric('renderTime', renderTime);
  }

  /**
   * Adjust quality settings based on performance
   */
  private adjustQualitySettings(metrics: { fps: number }): void {
    if (metrics.fps < 30) {
      // Reduce quality for better performance
      this.layers.forEach(layer => {
        layer.config.resolution = Math.min(layer.config.resolution * 1.5, 100);
        layer.config.blur = Math.max(layer.config.blur * 0.8, 10);
      });
    } else if (metrics.fps > 50) {
      // Increase quality if performance allows
      this.layers.forEach(layer => {
        layer.config.resolution = Math.max(layer.config.resolution * 0.9, 10);
        layer.config.blur = Math.min(layer.config.blur * 1.2, 40);
      });
    }
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.visible = visible;
      this.scheduleUpdate();
    }
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity));
      this.scheduleUpdate();
    }
  }

  /**
   * Update layer configuration
   */
  updateLayerConfig(layerId: string, config: Partial<HeatmapConfig>): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.config = { ...layer.config, ...config };
      this.scheduleUpdate();
    }
  }

  /**
   * Get all layers
   */
  getLayers(): HeatmapLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): { fps: number; renderTime: number; interpolationTime: number; pointCount: number } {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Destroy the service and clean up resources
   */
  destroy(): void {
    if (this.updateTimer !== null) {
      clearTimeout(this.updateTimer);
    }
    
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    this.performanceMonitor.destroy();
    this.interpolator.destroy();
    this.layers.clear();
  }
}

// Singleton instance
let heatmapServiceInstance: HeatmapService | null = null;

export function getHeatmapService(): HeatmapService {
  if (!heatmapServiceInstance) {
    heatmapServiceInstance = new HeatmapService();
  }
  return heatmapServiceInstance;
}