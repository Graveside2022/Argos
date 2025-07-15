/**
 * RSSI Localization Integration for Tactical Map
 * This module adds RSSI heatmap visualization to the tactical map
 */

import type { Map as LeafletMap } from 'leaflet';
import type { KismetDevice } from '$lib/types/kismet';
import { kismetRSSIService } from '$lib/services/map/kismetRSSIService';
import { heatMapService } from '$lib/services/map/heatMapService';

export class RSSIMapIntegration {
  private map: LeafletMap;
  private heatmapLayer: any = null;
  private selectedDevice: string | null = null;
  private updateInterval: number | null = null;
  private enabled = false;
  
  constructor(map: LeafletMap) {
    this.map = map;
  }
  
  /**
   * Initialize RSSI localization
   */
  async initialize(): Promise<void> {
    await kismetRSSIService.initialize();
    
    // Initialize heatmap service if not already done
    if (!heatMapService.isInitialized()) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      heatMapService.initialize(canvas, this.map);
    }
  }
  
  /**
   * Process Kismet devices for RSSI measurements
   */
  processDevices(devices: KismetDevice[]): void {
    if (!this.enabled) return;
    
    // Add measurements to the service
    kismetRSSIService.processKismetDevices(devices);
    
    // Update heatmap if we have a selected device
    if (this.selectedDevice) {
      this.updateHeatmap();
    }
  }
  
  /**
   * Select a device for visualization
   */
  async selectDevice(deviceId: string | null): Promise<void> {
    this.selectedDevice = deviceId;
    
    if (!deviceId || !this.enabled) {
      this.clearHeatmap();
      return;
    }
    
    // Update heatmap immediately
    await this.updateHeatmap();
    
    // Start periodic updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = window.setInterval(() => {
      this.updateHeatmap();
    }, 5000); // Update every 5 seconds
  }
  
  /**
   * Update the heatmap visualization
   */
  private async updateHeatmap(): Promise<void> {
    if (!this.selectedDevice || !this.enabled) return;
    
    try {
      // Get current map bounds
      const bounds = this.map.getBounds();
      const mapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
      
      // Generate heatmap points
      const points = await kismetRSSIService.generateHeatmapForDevice(
        this.selectedDevice,
        mapBounds
      );
      
      if (points.length === 0) {
        console.log('No heatmap points generated - need more measurements');
        return;
      }
      
      // Update heatmap layer
      heatMapService.updateLayer('rssi-localization', {
        points,
        config: {
          resolution: 5, // 5 meter grid
          interpolationMethod: 'kriging',
          minOpacity: 0.2,
          maxOpacity: 0.8,
          blur: 15,
          radius: 25,
          gradient: {
            0.0: 'rgba(0, 0, 255, 0)',
            0.2: 'rgba(0, 0, 255, 0.5)',
            0.4: 'rgba(0, 255, 0, 0.5)',
            0.6: 'rgba(255, 255, 0, 0.5)',
            0.8: 'rgba(255, 128, 0, 0.5)',
            1.0: 'rgba(255, 0, 0, 0.5)'
          },
          updateInterval: 5000,
          performanceMode: 'balanced'
        }
      });
      
      // Get estimated device location
      const location = await kismetRSSIService.getDeviceLocation(this.selectedDevice);
      if (location) {
        console.log(`Estimated location for ${this.selectedDevice}:`, location);
        // Could add a special marker for estimated position
      }
    } catch (error) {
      console.error('Failed to update RSSI heatmap:', error);
    }
  }
  
  /**
   * Clear the heatmap
   */
  private clearHeatmap(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    heatMapService.removeLayer('rssi-localization');
  }
  
  /**
   * Enable/disable RSSI localization
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    kismetRSSIService.setEnabled(enabled);
    
    if (!enabled) {
      this.clearHeatmap();
    } else if (this.selectedDevice) {
      this.updateHeatmap();
    }
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return kismetRSSIService.getStatus();
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.clearHeatmap();
    this.enabled = false;
  }
}

/**
 * Helper function to add click handler to Kismet markers
 */
export function addRSSIClickHandler(
  marker: L.Marker,
  deviceId: string,
  rssiIntegration: RSSIMapIntegration
): void {
  marker.on('click', () => {
    // Toggle selection
    const currentDevice = rssiIntegration['selectedDevice'];
    if (currentDevice === deviceId) {
      rssiIntegration.selectDevice(null);
    } else {
      rssiIntegration.selectDevice(deviceId);
    }
  });
}