/**
 * Base RSSI Localizer using CPU-based algorithms
 * This is the fallback when Coral TPU is not available
 */

export interface RSSIMeasurement {
  id: string;
  timestamp: number;
  position: {
    lat: number;
    lon: number;
    altitude: number;
    accuracy: number;
  };
  deviceId: string;
  rssi: number;
  frequency: number;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GPRPrediction {
  mean: Float32Array;
  variance: Float32Array;
  bounds: GeoBounds;
  resolution: number;
}

export interface SourceEstimate {
  position: { lat: number; lon: number };
  confidence: number;
  uncertaintyRadius: number;
}

export class RSSILocalizer {
  protected measurements = new Map<string, RSSIMeasurement[]>();
  protected gridResolution = 32;
  
  addMeasurement(measurement: RSSIMeasurement): void {
    if (!this.measurements.has(measurement.deviceId)) {
      this.measurements.set(measurement.deviceId, []);
    }
    
    const deviceMeasurements = this.measurements.get(measurement.deviceId)!;
    deviceMeasurements.push(measurement);
    
    // Keep only last 500 measurements per device
    if (deviceMeasurements.length > 500) {
      deviceMeasurements.shift();
    }
  }
  
  async predictForDevice(deviceId: string, bounds: GeoBounds): Promise<GPRPrediction> {
    const measurements = this.measurements.get(deviceId) || [];
    
    if (measurements.length < 3) {
      throw new Error('Insufficient measurements for prediction');
    }
    
    // Simple mock implementation - in real implementation this would use GPR
    const gridSize = this.gridResolution;
    const mean = new Float32Array(gridSize * gridSize);
    const variance = new Float32Array(gridSize * gridSize);
    
    // Generate mock heatmap based on measurements
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const idx = y * gridSize + x;
        
        // Calculate position in bounds
        const lat = bounds.south + (y / gridSize) * (bounds.north - bounds.south);
        const lon = bounds.west + (x / gridSize) * (bounds.east - bounds.west);
        
        // Calculate weighted average RSSI based on distance to measurements
        let totalWeight = 0;
        let weightedRSSI = 0;
        
        measurements.forEach(m => {
          const dist = this.haversineDistance(lat, lon, m.position.lat, m.position.lon);
          const weight = Math.exp(-dist / 100); // 100m decay
          totalWeight += weight;
          weightedRSSI += m.rssi * weight;
        });
        
        if (totalWeight > 0) {
          mean[idx] = weightedRSSI / totalWeight;
          variance[idx] = 10 / totalWeight; // Higher weight = lower variance
        } else {
          mean[idx] = -100; // No signal
          variance[idx] = 100; // High uncertainty
        }
      }
    }
    
    return {
      mean,
      variance,
      bounds,
      resolution: (bounds.east - bounds.west) / gridSize
    };
  }
  
  async estimateSourceLocation(deviceId: string): Promise<SourceEstimate> {
    const measurements = this.measurements.get(deviceId) || [];
    
    if (measurements.length < 3) {
      throw new Error('Insufficient measurements for location estimation');
    }
    
    // Simple weighted centroid for mock implementation
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLon = 0;
    
    measurements.forEach(m => {
      // Weight by signal strength (higher RSSI = closer = higher weight)
      const weight = Math.pow(10, m.rssi / 20);
      totalWeight += weight;
      weightedLat += m.position.lat * weight;
      weightedLon += m.position.lon * weight;
    });
    
    const estimatedLat = weightedLat / totalWeight;
    const estimatedLon = weightedLon / totalWeight;
    
    // Calculate uncertainty based on measurement spread
    let maxDist = 0;
    measurements.forEach(m => {
      const dist = this.haversineDistance(
        estimatedLat, estimatedLon,
        m.position.lat, m.position.lon
      );
      maxDist = Math.max(maxDist, dist);
    });
    
    return {
      position: { lat: estimatedLat, lon: estimatedLon },
      confidence: Math.min(1, measurements.length / 20), // More measurements = higher confidence
      uncertaintyRadius: maxDist * 0.5 // Half the max distance as uncertainty
    };
  }
  
  protected haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  getStats(): { coralUsage: number; avgProcessingTime: number } {
    return {
      coralUsage: 0, // CPU only
      avgProcessingTime: 85
    };
  }
  
  async shutdown(): Promise<void> {
    this.measurements.clear();
  }
}