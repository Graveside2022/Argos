/**
 * Altitude layer manager for drone signal visualization
 * Manages multiple heatmap layers at different altitude bands
 */

import type { HeatmapLayer as _HeatmapLayer } from './heatmapService';

export interface AltitudeBand {
  id: string;
  name: string;
  minAltitude: number; // meters
  maxAltitude: number; // meters
  color: string; // Primary color for this band
  icon: string; // Icon identifier
}

export interface LayerBlendMode {
  mode: 'normal' | 'additive' | 'multiply' | 'screen';
  opacity: number;
}

export class AltitudeLayerManager {
  private bands: Map<string, AltitudeBand> = new Map();
  private layerVisibility: Map<string, boolean> = new Map();
  private layerOpacity: Map<string, number> = new Map();
  private blendMode: LayerBlendMode = {
    mode: 'normal',
    opacity: 1
  };
  
  // Predefined altitude bands for drone operations
  private defaultBands: AltitudeBand[] = [
    {
      id: 'ground',
      name: 'Ground Level',
      minAltitude: 0,
      maxAltitude: 50,
      color: '#00ff00',
      icon: 'ground'
    },
    {
      id: 'low',
      name: 'Low Altitude',
      minAltitude: 50,
      maxAltitude: 150,
      color: '#ffff00',
      icon: 'low-flight'
    },
    {
      id: 'medium',
      name: 'Medium Altitude',
      minAltitude: 150,
      maxAltitude: 400,
      color: '#ff8800',
      icon: 'medium-flight'
    },
    {
      id: 'high',
      name: 'High Altitude',
      minAltitude: 400,
      maxAltitude: 1000,
      color: '#ff0000',
      icon: 'high-flight'
    },
    {
      id: 'vhigh',
      name: 'Very High Altitude',
      minAltitude: 1000,
      maxAltitude: 10000,
      color: '#ff00ff',
      icon: 'very-high-flight'
    }
  ];

  constructor() {
    this.initializeDefaultBands();
  }

  /**
   * Initialize default altitude bands
   */
  private initializeDefaultBands(): void {
    this.defaultBands.forEach(band => {
      this.bands.set(band.id, band);
      this.layerVisibility.set(band.id, true);
      this.layerOpacity.set(band.id, 0.7);
    });
  }

  /**
   * Add custom altitude band
   */
  addBand(band: AltitudeBand): void {
    this.bands.set(band.id, band);
    this.layerVisibility.set(band.id, true);
    this.layerOpacity.set(band.id, 0.7);
  }

  /**
   * Remove altitude band
   */
  removeBand(bandId: string): void {
    this.bands.delete(bandId);
    this.layerVisibility.delete(bandId);
    this.layerOpacity.delete(bandId);
  }

  /**
   * Get all bands
   */
  getBands(): AltitudeBand[] {
    return Array.from(this.bands.values());
  }

  /**
   * Get band for specific altitude
   */
  getBandForAltitude(altitude: number): AltitudeBand | null {
    for (const band of this.bands.values()) {
      if (altitude >= band.minAltitude && altitude < band.maxAltitude) {
        return band;
      }
    }
    return null;
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(bandId: string, visible: boolean): void {
    this.layerVisibility.set(bandId, visible);
  }

  /**
   * Get layer visibility
   */
  isLayerVisible(bandId: string): boolean {
    return this.layerVisibility.get(bandId) ?? false;
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(bandId: string, opacity: number): void {
    this.layerOpacity.set(bandId, Math.max(0, Math.min(1, opacity)));
  }

  /**
   * Get layer opacity
   */
  getLayerOpacity(bandId: string): number {
    return this.layerOpacity.get(bandId) ?? 0.7;
  }

  /**
   * Set blend mode for all layers
   */
  setBlendMode(mode: LayerBlendMode): void {
    this.blendMode = mode;
  }

  /**
   * Get current blend mode
   */
  getBlendMode(): LayerBlendMode {
    return this.blendMode;
  }

  /**
   * Toggle all layers visibility
   */
  toggleAllLayers(visible: boolean): void {
    this.bands.forEach((_, bandId) => {
      this.layerVisibility.set(bandId, visible);
    });
  }

  /**
   * Set opacity for all layers
   */
  setAllLayersOpacity(opacity: number): void {
    this.bands.forEach((_, bandId) => {
      this.layerOpacity.set(bandId, opacity);
    });
  }

  /**
   * Get visible altitude range
   */
  getVisibleAltitudeRange(): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;

    this.bands.forEach((band, bandId) => {
      if (this.isLayerVisible(bandId)) {
        min = Math.min(min, band.minAltitude);
        max = Math.max(max, band.maxAltitude);
      }
    });

    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 10000 : max
    };
  }

  /**
   * Create gradient for altitude band
   */
  createGradientForBand(bandId: string): Record<number, string> {
    const band = this.bands.get(bandId);
    if (!band) {
      return {
        0.0: '#0000ff',
        0.5: '#00ff00',
        1.0: '#ff0000'
      };
    }

    // Create gradient based on band color
    const baseColor = band.color;
    const rgb = this.hexToRgb(baseColor);
    
    if (!rgb) {
      return {
        0.0: '#0000ff',
        0.5: '#00ff00',
        1.0: '#ff0000'
      };
    }

    // Create gradient from dark to bright version of the color
    return {
      0.0: this.rgbToHex(rgb[0] * 0.2, rgb[1] * 0.2, rgb[2] * 0.2),
      0.3: this.rgbToHex(rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5),
      0.6: baseColor,
      0.8: this.rgbToHex(
        Math.min(255, rgb[0] * 1.3),
        Math.min(255, rgb[1] * 1.3),
        Math.min(255, rgb[2] * 1.3)
      ),
      1.0: this.rgbToHex(
        Math.min(255, rgb[0] * 1.5),
        Math.min(255, rgb[1] * 1.5),
        Math.min(255, rgb[2] * 1.5)
      )
    };
  }

  /**
   * Get altitude statistics from signals
   */
  getAltitudeStatistics(signals: Array<{ altitude?: number }>): {
    min: number;
    max: number;
    average: number;
    distribution: Map<string, number>;
  } {
    const altitudes = signals
      .map(s => s.altitude ?? 0)
      .filter(alt => alt >= 0);

    if (altitudes.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        distribution: new Map()
      };
    }

    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const average = altitudes.reduce((a, b) => a + b, 0) / altitudes.length;

    // Calculate distribution by band
    const distribution = new Map<string, number>();
    this.bands.forEach((band, bandId) => {
      const count = altitudes.filter(
        alt => alt >= band.minAltitude && alt < band.maxAltitude
      ).length;
      distribution.set(bandId, count);
    });

    return { min, max, average, distribution };
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }

  /**
   * Convert RGB to hex
   */
  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    bands: AltitudeBand[];
    visibility: Record<string, boolean>;
    opacity: Record<string, number>;
    blendMode: LayerBlendMode;
  } {
    return {
      bands: Array.from(this.bands.values()),
      visibility: Object.fromEntries(this.layerVisibility),
      opacity: Object.fromEntries(this.layerOpacity),
      blendMode: this.blendMode
    };
  }

  /**
   * Import configuration
   */
  importConfig(config: {
    bands?: AltitudeBand[];
    visibility?: Record<string, boolean>;
    opacity?: Record<string, number>;
    blendMode?: LayerBlendMode;
  }): void {
    if (config.bands) {
      this.bands.clear();
      config.bands.forEach(band => this.addBand(band));
    }

    if (config.visibility) {
      Object.entries(config.visibility).forEach(([bandId, visible]) => {
        this.layerVisibility.set(bandId, visible);
      });
    }

    if (config.opacity) {
      Object.entries(config.opacity).forEach(([bandId, opacity]) => {
        this.layerOpacity.set(bandId, opacity);
      });
    }

    if (config.blendMode) {
      this.blendMode = config.blendMode;
    }
  }
}

// Singleton instance
let altitudeLayerManagerInstance: AltitudeLayerManager | null = null;

export function getAltitudeLayerManager(): AltitudeLayerManager {
  if (!altitudeLayerManagerInstance) {
    altitudeLayerManagerInstance = new AltitudeLayerManager();
  }
  return altitudeLayerManagerInstance;
}