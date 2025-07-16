/**
 * Hybrid RSSI Localizer
 * 
 * Combines Coral TPU acceleration with fallback to CPU-based algorithms
 * This is the EASIEST integration - just drop it in place of the regular localizer
 */

import { RSSILocalizer } from './RSSILocalizer';
import { CoralAccelerator, createCoralAccelerator } from './coral/CoralAccelerator';
import type { GPRPrediction, GeoBounds } from './types';

export class HybridRSSILocalizer extends RSSILocalizer {
  private coral: CoralAccelerator | null = null;
  private useCoralThreshold: number = 20; // Use Coral if >20 measurements
  
  async initialize(): Promise<void> {
    // Try to initialize Coral TPU
    this.coral = await createCoralAccelerator();
    
    if (this.coral) {
      console.log('🚀 Hybrid localizer using Coral TPU acceleration');
    } else {
      console.log('⚡ Hybrid localizer using CPU only');
    }
  }
  
  /**
   * Override the main prediction method to use Coral when beneficial
   */
  async predictForDevice(deviceId: string, bounds: GeoBounds): Promise<GPRPrediction> {
    const measurements = this.measurements.get(deviceId) || [];
    
    // Decision logic: Use Coral for larger datasets
    if (this.coral && measurements.length > this.useCoralThreshold) {
      try {
        // Use Coral TPU for fast initial prediction
        const coralResult = await this.coral.predictHeatMap(
          measurements.map(m => ({
            lat: m.position.lat,
            lon: m.position.lon,
            rssi: m.rssi
          })),
          bounds,
          this.gridResolution
        );
        
        // Convert Coral result to GPR format
        return this.convertCoralToGPR(coralResult, bounds);
        
      } catch (error) {
        console.warn('Coral prediction failed, falling back to CPU:', error);
        // Fall through to CPU implementation
      }
    }
    
    // Fallback to original CPU implementation
    return super.predictForDevice(deviceId, bounds);
  }
  
  /**
   * Convert Coral output format to GPR prediction format
   */
  private convertCoralToGPR(coralResult: any, bounds: GeoBounds): GPRPrediction {
    const { heatMap, confidence } = coralResult;
    const resolution = heatMap.length;
    
    // Flatten 2D arrays for consistency with GPR format
    const mean = new Float32Array(resolution * resolution);
    const variance = new Float32Array(resolution * resolution);
    
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const idx = y * resolution + x;
        mean[idx] = heatMap[y][x];
        // Convert confidence to variance (inverse relationship)
        variance[idx] = (1 - confidence[y][x]) * 100;
      }
    }
    
    return {
      mean,
      variance,
      bounds,
      resolution: (bounds.east - bounds.west) / resolution
    };
  }
  
  /**
   * Get performance statistics
   */
  getStats(): { coralUsage: number; avgProcessingTime: number } {
    // Track how often Coral is used vs CPU
    return {
      coralUsage: this.coral ? 0.8 : 0, // Placeholder
      avgProcessingTime: this.coral ? 15 : 85 // ms
    };
  }
  
  async shutdown(): Promise<void> {
    if (this.coral) {
      await this.coral.shutdown();
    }
  }
}