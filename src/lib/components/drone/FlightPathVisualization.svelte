<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FlightPoint, SignalCapture } from '$lib/stores/drone';
  // import type { SignalMarker } from '$lib/stores/map/signals';
  import { getSignalColor } from '$lib/utils/hackrf/signalAnalysis';
  
  // Leaflet types
  interface LeafletMap {
    removeLayer: (layer: LeafletLayer) => void;
    addLayer?: (layer: LeafletLayer) => void;
  }
  
  interface LeafletLayer {
    addTo: (map: LeafletMap) => void;
    addLayer: (layer: LeafletLayer) => void;
    bindPopup: (content: string) => LeafletLayer;
  }
  
  interface LeafletConstructor {
    layerGroup: () => LeafletLayer;
    polyline: (points: [number, number][], options?: Record<string, unknown>) => LeafletLayer;
    circle: (center: [number, number], options?: Record<string, unknown>) => LeafletLayer;
    marker: (position: [number, number], options?: Record<string, unknown>) => LeafletLayer;
    divIcon: (options: Record<string, unknown>) => unknown;
    polylineDecorator: (line: LeafletLayer, options: Record<string, unknown>) => LeafletLayer;
    Symbol: {
      arrowHead: (options: Record<string, unknown>) => unknown;
    };
  }
  
  export let map: LeafletMap | null;
  export let flightPath: FlightPoint[] = [];
  export let signalCaptures: SignalCapture[] = [];
  export let showAltitude = true;
  export let showSignalStrength = true;
  export let show3D = false;
  
  let pathLayer: LeafletLayer | null = null;
  let altitudeLayer: LeafletLayer | null = null;
  let signalLayer: LeafletLayer | null = null;
  let is3DEnabled = false;
  
  $: if (map && flightPath.length > 0) {
    updateVisualization();
  }
  
  function updateVisualization() {
    if (!map) return;
    
    // Clear existing layers
    if (pathLayer) map.removeLayer(pathLayer);
    if (altitudeLayer) map.removeLayer(altitudeLayer);
    if (signalLayer) map.removeLayer(signalLayer);
    
    if (show3D && !is3DEnabled) {
      // Enable 3D view (requires mapbox-gl or similar)
      // For now, we'll use visual tricks with standard Leaflet
    }
    
    // Create flight path with altitude coloring
    const pathPoints: [number, number][] = flightPath.map(point => [point.lat, point.lon] as [number, number]);
    
    if (showAltitude) {
      // Create gradient path based on altitude
      const L = (window as unknown as { L: LeafletConstructor }).L;
      pathLayer = L.layerGroup();
      
      for (let i = 1; i < flightPath.length; i++) {
        const L = (window as unknown as { L: LeafletConstructor }).L;
        const segment = L.polyline(
          [pathPoints[i-1], pathPoints[i]],
          {
            color: getAltitudeColor(flightPath[i].altitude),
            weight: 4,
            opacity: 0.8
          }
        );
        
        segment.bindPopup(`
          <strong>Flight Segment</strong><br>
          Altitude: ${flightPath[i].altitude.toFixed(0)}m<br>
          Speed: ${flightPath[i].speed.toFixed(1)} m/s<br>
          Time: ${new Date(flightPath[i].timestamp).toLocaleTimeString()}
        `);
        
        pathLayer.addLayer(segment);
      }
      
      // Add altitude markers at key points
      const altitudeMarkers = createAltitudeMarkers();
      altitudeMarkers.forEach(marker => pathLayer?.addLayer(marker));
    } else {
      // Simple path
      const L = (window as unknown as { L: LeafletConstructor }).L;
      pathLayer = L.polyline(pathPoints, {
        color: '#00ff00',
        weight: 3,
        opacity: 0.7
      });
    }
    
    pathLayer.addTo(map);
    
    // Add signal strength overlay
    if (showSignalStrength && signalCaptures.length > 0) {
      const L = (window as unknown as { L: LeafletConstructor }).L;
      signalLayer = L.layerGroup();
      
      signalCaptures.forEach(capture => {
        // Create heatmap-like circles for signal strength
        const L = (window as unknown as { L: LeafletConstructor }).L;
        const circle = L.circle([capture.position.lat, capture.position.lon], {
          radius: 20 + (capture.averagePower + 100), // Scale by power
          fillColor: getSignalColor(capture.averagePower),
          fillOpacity: 0.3,
          color: getSignalColor(capture.averagePower),
          weight: 1,
          opacity: 0.5
        });
        
        circle.bindPopup(`
          <strong>Signal Capture</strong><br>
          Altitude: ${capture.position.altitude.toFixed(0)}m<br>
          Signals: ${capture.signalCount}<br>
          Avg Power: ${capture.averagePower.toFixed(1)} dBm<br>
          Time: ${new Date(capture.timestamp).toLocaleTimeString()}
        `);
        
        signalLayer?.addLayer(circle);
        
        // Add signal direction indicators
        if (capture.strongestSignal && signalLayer) {
          const bearing = calculateBearing(
            capture.position,
            { lat: capture.strongestSignal.lat, lon: capture.strongestSignal.lon }
          );
          
          const arrow = createDirectionArrow(capture.position, bearing, capture.strongestSignal.power);
          signalLayer.addLayer(arrow);
        }
      });
      
      signalLayer.addTo(map);
    }
    
    // Add start/end markers
    addFlightMarkers();
  }
  
  function getAltitudeColor(altitude: number): string {
    // Color gradient from blue (low) to red (high)
    const minAlt = 0;
    const maxAlt = 400;
    const normalized = Math.max(0, Math.min(1, (altitude - minAlt) / (maxAlt - minAlt)));
    
    if (normalized < 0.25) return '#0066ff';
    if (normalized < 0.5) return '#00ccff';
    if (normalized < 0.75) return '#ffcc00';
    return '#ff0000';
  }
  
  function createAltitudeMarkers(): LeafletLayer[] {
    const markers: LeafletLayer[] = [];
    const interval = Math.max(1, Math.floor(flightPath.length / 20)); // Show ~20 markers
    
    for (let i = 0; i < flightPath.length; i += interval) {
      const point = flightPath[i];
      
      const L = (window as unknown as { L: LeafletConstructor }).L;
      const marker = L.divIcon({
        className: 'altitude-marker',
        html: `
          <div style="
            background: ${getAltitudeColor(point.altitude)};
            color: white;
            padding: 2px 4px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            white-space: nowrap;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          ">
            ${point.altitude.toFixed(0)}m
          </div>
        `,
        iconSize: [40, 20],
        iconAnchor: [20, 10]
      });
      
      markers.push(
        L.marker([point.lat, point.lon], { icon: marker })
      );
    }
    
    return markers;
  }
  
  function createDirectionArrow(position: { lat: number; lon: number }, bearing: number, strength: number): LeafletLayer {
    const L = (window as unknown as { L: LeafletConstructor }).L;
    
    // Calculate arrow end point
    const distance = 50; // meters
    const endPoint = calculateDestination(position, bearing, distance);
    
    // Create arrow polyline
    const arrow = L.polyline([
      [position.lat, position.lon],
      [endPoint.lat, endPoint.lon]
    ], {
      color: getSignalColor(strength),
      weight: 3,
      opacity: 0.7
    });
    
    // Add arrowhead
    const _arrowHead = L.polylineDecorator(arrow, {
      patterns: [
        {
          offset: '100%',
          repeat: 0,
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            pathOptions: {
              stroke: true,
              color: getSignalColor(strength),
              weight: 3
            }
          })
        }
      ]
    });
    
    return L.layerGroup();
  }
  
  function addFlightMarkers() {
    if (flightPath.length === 0) return;
    
    const L = (window as unknown as { L: LeafletConstructor }).L;
    
    // Start marker
    const startIcon = L.divIcon({
      className: 'flight-marker',
      html: `
        <div style="
          background: #00ff00;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
        ">
          S
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const startMarker = L.marker(
      [flightPath[0].lat, flightPath[0].lon],
      { icon: startIcon }
    ).bindPopup(`
      <strong>Flight Start</strong><br>
      Time: ${new Date(flightPath[0].timestamp).toLocaleTimeString()}<br>
      Altitude: ${flightPath[0].altitude.toFixed(0)}m
    `);
    
    // End marker
    const endIcon = L.divIcon({
      className: 'flight-marker',
      html: `
        <div style="
          background: #ff0000;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
        ">
          E
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    const endPoint = flightPath[flightPath.length - 1];
    const endMarker = L.marker(
      [endPoint.lat, endPoint.lon],
      { icon: endIcon }
    ).bindPopup(`
      <strong>Flight End</strong><br>
      Time: ${new Date(endPoint.timestamp).toLocaleTimeString()}<br>
      Altitude: ${endPoint.altitude.toFixed(0)}m<br>
      Total Points: ${flightPath.length}
    `);
    
    if (pathLayer) {
      pathLayer.addLayer(startMarker);
      pathLayer.addLayer(endMarker);
    }
  }
  
  function calculateBearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(to.lat * Math.PI / 180);
    const x = Math.cos(from.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) -
              Math.sin(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.cos(dLon);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }
  
  function calculateDestination(origin: { lat: number; lon: number }, bearing: number, distance: number): { lat: number; lon: number } {
    const R = 6371e3; // Earth's radius in meters
    const d = distance;
    const brng = bearing * Math.PI / 180;
    const lat1 = origin.lat * Math.PI / 180;
    const lon1 = origin.lon * Math.PI / 180;
    
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d/R) +
      Math.cos(lat1) * Math.sin(d/R) * Math.cos(brng)
    );
    
    const lon2 = lon1 + Math.atan2(
      Math.sin(brng) * Math.sin(d/R) * Math.cos(lat1),
      Math.cos(d/R) - Math.sin(lat1) * Math.sin(lat2)
    );
    
    return {
      lat: lat2 * 180 / Math.PI,
      lon: lon2 * 180 / Math.PI
    };
  }
  
  onDestroy(() => {
    if (pathLayer && map) map.removeLayer(pathLayer);
    if (altitudeLayer && map) map.removeLayer(altitudeLayer);
    if (signalLayer && map) map.removeLayer(signalLayer);
  });
</script>

<style>
  :global(.altitude-marker) {
    z-index: 1000 !important;
  }
  
  :global(.flight-marker) {
    z-index: 1001 !important;
  }
</style>