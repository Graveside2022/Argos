// Map configuration for offline tiles
export const MAP_CONFIG = {
  // Tile server URL - change this based on your setup
  tileServerUrl: (import.meta.env.PUBLIC_TILE_SERVER_URL as string) || 'http://localhost:8088',
  
  // Available tile sources
  tileSources: {
    osmBright: '/styles/osm-bright/{z}/{x}/{y}.png',
    darkMatter: '/styles/dark-matter/{z}/{x}/{y}.png',
    satellite: null // Add if you have satellite tiles
  },
  
  // Default map settings
  defaultCenter: [0, 0] as [number, number], // Will be overridden by GPS
  defaultZoom: 15,
  maxZoom: 19,
  minZoom: 2,
  
  // Attribution
  attribution: '© OpenStreetMap contributors'
};