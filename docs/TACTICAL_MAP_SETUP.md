# Tactical Map Setup Guide

## Overview

The Tactical Map provides real-time visualization of RF signals from HackRF and Kismet on an interactive map. It supports both online (OpenStreetMap) and offline tile servers.

## Quick Start (Online Mode)

1. Navigate to: http://localhost:5173/tactical-map
2. Allow browser location access when prompted
3. Start HackRF sweep from the main console
4. RF signals will appear as color-coded markers on the map

## Features

### Signal Visualization

- **Color Coding by Signal Strength**:
    - Red: Strong signals (> -50 dBm)
    - Orange: Good signals (-50 to -60 dBm)
    - Yellow: Medium signals (-60 to -70 dBm)
    - Light Green: Fair signals (-70 to -80 dBm)
    - Green: Weak signals (-80 to -90 dBm)
    - Blue: Very weak signals (< -90 dBm)

### Map Controls

- **Layer Toggle**: Show/hide HackRF and Kismet signals
- **Signal Filtering**: Adjust minimum signal strength threshold
- **Age Filter**: Hide signals older than specified time
- **Clustering**: Automatically group nearby signals at lower zoom levels
- **Heatmap View**: Visualize signal density and coverage

### Data Export

- **GeoJSON**: For use in GIS applications
- **KML**: For Google Earth and other mapping tools

## Offline Map Setup

### Prerequisites

- Docker and Docker Compose installed
- At least 1-10GB storage (depending on map area)

### Setup Steps

1. **Run the setup script**:

    ```bash
    ./scripts/setup-offline-maps.sh
    ```

2. **Choose an option**:
    - Option 1: Download test region (Luxembourg, ~50MB)
    - Option 2: Download specific region from Geofabrik
    - Option 3: Get instructions for pre-made MBTiles
    - Option 4: Setup server only (if you have tiles)

3. **For production use**, download your operational area:

    ```bash
    # Example: Download California
    wget -O map-data/tiles/california.osm.pbf \
      https://download.geofabrik.de/north-america/us/california-latest.osm.pbf
    ```

4. **Start the tile server**:

    ```bash
    docker-compose -f docker-compose.tiles.yml up -d
    ```

5. **Verify tile server**: http://localhost:8088

### Alternative: Pre-made MBTiles

For easier setup, download pre-made MBTiles:

1. **OpenMapTiles** (Commercial, free tier available):
    - Visit: https://data.maptiler.com/downloads/
    - Download your region
    - Place in: `map-data/tiles/`

2. **Natural Earth** (Free, lower detail):
    ```bash
    wget -O map-data/tiles/natural-earth.mbtiles \
      https://github.com/lukasmartinelli/naturalearthtiles/releases/download/v1.0/natural_earth.mbtiles
    ```

## Configuration

Edit `src/lib/config/mapConfig.ts` to customize:

```typescript
export const MAP_CONFIG = {
	// Change to your tile server
	tileServerUrl: 'http://localhost:8088',

	// Select tile style
	tileSources: {
		osmBright: '/styles/osm-bright/{z}/{x}/{y}.png',
		darkMatter: '/styles/dark-matter/{z}/{x}/{y}.png'
	}
};
```

## Performance Tips

1. **For many signals (>1000)**:
    - Enable clustering in map controls
    - Use heatmap view instead of individual markers
    - Increase the signal threshold filter

2. **For mobile devices**:
    - Reduce max age to show fewer signals
    - Disable heatmap layer
    - Use clustering at all zoom levels

3. **For offline use**:
    - Pre-download tiles for your operational area
    - Use `.mbtiles` format for better performance
    - Consider vector tiles for smaller file sizes

## Troubleshooting

### No signals appearing

1. Check if HackRF sweep is running
2. Verify browser location permissions
3. Check browser console for errors

### Tile server issues

1. Verify Docker is running: `docker ps`
2. Check tile server logs: `docker-compose -f docker-compose.tiles.yml logs`
3. Ensure port 8088 is not in use

### Performance issues

1. Enable clustering for many markers
2. Increase signal threshold to show fewer signals
3. Reduce max age of displayed signals

## Integration with ATAK

The tactical map can export data for use in ATAK/WinTAK:

1. Click "Export" in map controls
2. Choose KML format
3. Import the KML file into ATAK
4. Signals will appear as color-coded markers

## API Endpoints

The map automatically connects to:

- HackRF data: `/api/hackrf/data-stream` (Server-Sent Events)
- Kismet data: `/api/kismet/devices` (WebSocket)
- GPS updates: Browser Geolocation API

## Future Enhancements

- [ ] 3D signal propagation view
- [ ] Historical playback of signal data
- [ ] Integration with SDR# and GQRX
- [ ] Custom map overlays (building plans, terrain)
- [ ] Signal triangulation and location estimation
- [ ] Collaborative mapping (share signals between operators)
