import type { SignalMarker } from '$lib/stores/map/signals';

// Define Leaflet types
interface LeafletIcon {
  Default: {
    prototype: { _getIconUrl?: unknown };
    mergeOptions: (options: Record<string, string>) => void;
  };
}

interface LeafletLibrary {
  Icon: LeafletIcon;
  circleMarker: (latlng: [number, number], options?: Record<string, unknown>) => LeafletMarker;
  DivIcon: new (options: Record<string, unknown>) => unknown;
  Point: new (x: number, y: number) => unknown;
}

interface LeafletMarker {
  getChildCount?: () => number;
}

interface LeafletWindow {
  L?: LeafletLibrary;
}

// Fix Leaflet icon paths
export function fixLeafletIcons() {
  // L will be passed in from the component
  const L = (window as any as LeafletWindow).L;
  if (!L) return;
  
  delete (L.Icon.Default.prototype)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
  });
}

// Create custom marker for signal
export function createSignalMarker(L: LeafletLibrary, signal: SignalMarker): LeafletMarker {
  const color = getSignalColor(signal.power);
  
  return L.circleMarker([signal.lat, signal.lon], {
    radius: 8,
    fillColor: color,
    color: '#000',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8,
    className: `signal-marker signal-${signal.source}`
  });
}

// Create popup content for signal
export function createSignalPopup(signal: SignalMarker): string {
  const time = new Date(signal.timestamp).toLocaleTimeString();
  let content = `
    <div class="signal-popup">
      <h3 class="font-bold text-lg mb-2">${signal.source.toUpperCase()} Signal</h3>
      <table class="w-full">
        <tr><td class="font-semibold">Frequency:</td><td>${signal.frequency} MHz</td></tr>
        <tr><td class="font-semibold">Power:</td><td>${signal.power} dBm</td></tr>
        <tr><td class="font-semibold">Time:</td><td>${time}</td></tr>
  `;
  
  // Add metadata if available
  if (signal.metadata.ssid) {
    content += `<tr><td class="font-semibold">SSID:</td><td>${signal.metadata.ssid}</td></tr>`;
  }
  if (signal.metadata.mac) {
    content += `<tr><td class="font-semibold">MAC:</td><td>${signal.metadata.mac}</td></tr>`;
  }
  if (signal.metadata.channel) {
    content += `<tr><td class="font-semibold">Channel:</td><td>${signal.metadata.channel}</td></tr>`;
  }
  if (signal.metadata.encryption) {
    content += `<tr><td class="font-semibold">Encryption:</td><td>${signal.metadata.encryption}</td></tr>`;
  }
  if (signal.metadata.vendor) {
    content += `<tr><td class="font-semibold">Vendor:</td><td>${signal.metadata.vendor}</td></tr>`;
  }
  if (signal.metadata.modulation) {
    content += `<tr><td class="font-semibold">Modulation:</td><td>${signal.metadata.modulation}</td></tr>`;
  }
  if (signal.metadata.bandwidth) {
    content += `<tr><td class="font-semibold">Bandwidth:</td><td>${signal.metadata.bandwidth} MHz</td></tr>`;
  }
  
  content += `
      </table>
    </div>
  `;
  
  return content;
}

// Get color based on signal strength
export function getSignalColor(power: number): string {
  if (power >= -50) return '#ff0000'; // Strong - Red
  if (power >= -60) return '#ff6600'; // Good - Orange
  if (power >= -70) return '#ffcc00'; // Medium - Yellow
  if (power >= -80) return '#66ff00'; // Fair - Light Green
  if (power >= -90) return '#00ff00'; // Weak - Green
  return '#0066ff'; // Very Weak - Blue
}

// Convert signal strength to opacity
export function getSignalOpacity(power: number): number {
  // Map -100 to -30 dBm to 0.3 to 1.0 opacity
  const normalized = (power + 100) / 70;
  return Math.max(0.3, Math.min(1.0, normalized));
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(2)}km`;
  }
}

// Create heatmap data from signals
export function createHeatmapData(signals: SignalMarker[]): [number, number, number][] {
  return signals.map(signal => {
    // Use signal strength to determine intensity
    // Normalize -100 to -30 dBm to 0 to 1
    const intensity = Math.max(0, Math.min(1, (signal.power + 100) / 70));
    return [signal.lat, signal.lon, intensity];
  });
}

// Cluster configuration
export function getClusterOptions(L: LeafletLibrary) {
  return {
    maxClusterRadius: 80,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: (cluster: LeafletMarker) => {
      const childCount = cluster.getChildCount?.() ?? 0;
      let c = ' marker-cluster-';
      if (childCount < 10) {
        c += 'small';
      } else if (childCount < 100) {
        c += 'medium';
      } else {
        c += 'large';
      }
      
      return new (L.DivIcon as new (options: Record<string, unknown>) => unknown)({
        html: `<div><span>${childCount}</span></div>`,
        className: 'marker-cluster' + c,
        iconSize: new (L.Point as new (x: number, y: number) => unknown)(40, 40)
      });
    }
  };
}

// Export data as GeoJSON
export function exportAsGeoJSON(signals: SignalMarker[]): string {
  const features = signals.map(signal => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [signal.lon, signal.lat]
    },
    properties: {
      id: signal.id,
      frequency: signal.frequency,
      power: signal.power,
      timestamp: signal.timestamp,
      source: signal.source,
      ...signal.metadata
    }
  }));
  
  const geoJSON = {
    type: 'FeatureCollection',
    features
  };
  
  return JSON.stringify(geoJSON, null, 2);
}

// Export data as KML
export function exportAsKML(signals: SignalMarker[]): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>RF Signal Export</name>
    <description>Exported from Argos Tactical Map</description>
`;

  // Add style definitions
  const colors = ['ff0000ff', 'ff0066ff', 'ff00ccff', 'ff00ff66', 'ff00ff00', 'ff66ff00'];
  colors.forEach((color, i) => {
    const power = -50 - (i * 10);
    kml += `    <Style id="signal_${power}">
      <IconStyle>
        <color>${color}</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
`;
  });

  // Add placemarks
  signals.forEach(signal => {
    const styleId = `signal_${Math.floor(signal.power / 10) * 10}`;
    const time = new Date(signal.timestamp).toISOString();
    
    kml += `    <Placemark>
      <name>${signal.source}: ${signal.frequency} MHz</name>
      <description>
        Power: ${signal.power} dBm
        Time: ${time}
        ${signal.metadata.ssid ? `SSID: ${signal.metadata.ssid}` : ''}
      </description>
      <styleUrl>#${styleId}</styleUrl>
      <Point>
        <coordinates>${signal.lon},${signal.lat},0</coordinates>
      </Point>
    </Placemark>
`;
  });

  kml += `  </Document>
</kml>`;

  return kml;
}