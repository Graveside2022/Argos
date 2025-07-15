/**
 * Common types for RSSI localization
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

export interface CoralPrediction {
  heatMap: number[][];
  confidence: number[][];
  processingTime: number;
}