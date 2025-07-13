// Simple country detection based on GPS coordinates
// This is a basic implementation - for production, use a proper geocoding service

interface CountryBounds {
  name: string;
  flag: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

// Basic country boundaries for common countries
const countries: CountryBounds[] = [
  // North America
  { name: 'USA', flag: '🇺🇸', bounds: { north: 49.38, south: 24.52, east: -66.93, west: -124.77 } },
  { name: 'Canada', flag: '🇨🇦', bounds: { north: 83.11, south: 41.68, east: -52.62, west: -141.00 } },
  { name: 'Mexico', flag: '🇲🇽', bounds: { north: 32.72, south: 14.53, east: -86.71, west: -118.36 } },
  
  // Europe
  { name: 'UK', flag: '🇬🇧', bounds: { north: 60.86, south: 49.90, east: 1.77, west: -8.62 } },
  { name: 'Germany', flag: '🇩🇪', bounds: { north: 55.06, south: 47.27, east: 15.04, west: 5.87 } },
  { name: 'France', flag: '🇫🇷', bounds: { north: 51.09, south: 41.33, east: 9.56, west: -5.14 } },
  { name: 'Italy', flag: '🇮🇹', bounds: { north: 47.09, south: 35.49, east: 18.52, west: 6.62 } },
  { name: 'Spain', flag: '🇪🇸', bounds: { north: 43.79, south: 35.95, east: 4.32, west: -9.30 } },
  { name: 'Poland', flag: '🇵🇱', bounds: { north: 54.84, south: 49.00, east: 24.15, west: 14.12 } },
  { name: 'Netherlands', flag: '🇳🇱', bounds: { north: 53.51, south: 50.75, east: 7.23, west: 3.36 } },
  { name: 'Belgium', flag: '🇧🇪', bounds: { north: 51.51, south: 49.50, east: 6.40, west: 2.55 } },
  { name: 'Switzerland', flag: '🇨🇭', bounds: { north: 47.81, south: 45.82, east: 10.49, west: 5.96 } },
  { name: 'Austria', flag: '🇦🇹', bounds: { north: 49.02, south: 46.37, east: 17.16, west: 9.53 } },
  { name: 'Czech Republic', flag: '🇨🇿', bounds: { north: 51.06, south: 48.55, east: 18.87, west: 12.09 } },
  
  // Asia
  { name: 'Japan', flag: '🇯🇵', bounds: { north: 45.52, south: 24.25, east: 145.82, west: 122.93 } },
  { name: 'China', flag: '🇨🇳', bounds: { north: 53.56, south: 18.16, east: 134.77, west: 73.50 } },
  { name: 'India', flag: '🇮🇳', bounds: { north: 35.50, south: 8.08, east: 97.40, west: 68.11 } },
  { name: 'South Korea', flag: '🇰🇷', bounds: { north: 38.61, south: 33.11, east: 131.87, west: 124.61 } },
  { name: 'Singapore', flag: '🇸🇬', bounds: { north: 1.47, south: 1.17, east: 104.03, west: 103.60 } },
  { name: 'Thailand', flag: '🇹🇭', bounds: { north: 20.46, south: 5.61, east: 105.64, west: 97.34 } },
  { name: 'Vietnam', flag: '🇻🇳', bounds: { north: 23.39, south: 8.55, east: 109.46, west: 102.14 } },
  { name: 'Philippines', flag: '🇵🇭', bounds: { north: 21.12, south: 4.64, east: 126.60, west: 116.93 } },
  { name: 'Indonesia', flag: '🇮🇩', bounds: { north: 6.08, south: -11.01, east: 141.02, west: 95.01 } },
  { name: 'Malaysia', flag: '🇲🇾', bounds: { north: 7.36, south: 0.85, east: 119.27, west: 99.64 } },
  
  // Oceania
  { name: 'Australia', flag: '🇦🇺', bounds: { north: -10.68, south: -43.64, east: 153.64, west: 113.16 } },
  { name: 'New Zealand', flag: '🇳🇿', bounds: { north: -34.39, south: -47.29, east: 178.55, west: 166.43 } },
  
  // South America
  { name: 'Brazil', flag: '🇧🇷', bounds: { north: 5.27, south: -33.75, east: -34.79, west: -73.99 } },
  { name: 'Argentina', flag: '🇦🇷', bounds: { north: -21.78, south: -55.06, east: -53.64, west: -73.58 } },
  { name: 'Chile', flag: '🇨🇱', bounds: { north: -17.50, south: -55.92, east: -66.42, west: -75.71 } },
  { name: 'Peru', flag: '🇵🇪', bounds: { north: -0.04, south: -18.35, east: -68.67, west: -81.33 } },
  { name: 'Colombia', flag: '🇨🇴', bounds: { north: 13.39, south: -4.23, east: -66.87, west: -79.02 } },
  
  // Africa
  { name: 'South Africa', flag: '🇿🇦', bounds: { north: -22.13, south: -34.84, east: 32.89, west: 16.46 } },
  { name: 'Egypt', flag: '🇪🇬', bounds: { north: 31.67, south: 22.00, east: 36.90, west: 24.70 } },
  { name: 'Nigeria', flag: '🇳🇬', bounds: { north: 13.89, south: 4.27, east: 14.68, west: 2.67 } },
  { name: 'Kenya', flag: '🇰🇪', bounds: { north: 5.02, south: -4.68, east: 41.91, west: 33.91 } },
  { name: 'Morocco', flag: '🇲🇦', bounds: { north: 35.93, south: 27.66, east: -0.99, west: -13.17 } },
  
  // Middle East
  { name: 'UAE', flag: '🇦🇪', bounds: { north: 26.08, south: 22.63, east: 56.38, west: 51.58 } },
  { name: 'Saudi Arabia', flag: '🇸🇦', bounds: { north: 32.16, south: 16.38, east: 55.67, west: 34.49 } },
  { name: 'Israel', flag: '🇮🇱', bounds: { north: 33.33, south: 29.50, east: 35.88, west: 34.27 } },
  { name: 'Turkey', flag: '🇹🇷', bounds: { north: 42.11, south: 35.82, east: 44.79, west: 25.67 } },
  { name: 'Iran', flag: '🇮🇷', bounds: { north: 39.78, south: 25.06, east: 63.33, west: 44.03 } }
];

export function detectCountry(lat: number, lon: number): { name: string; flag: string } {
  // Check each country's bounds
  for (const country of countries) {
    const { bounds } = country;
    if (lat >= bounds.south && lat <= bounds.north &&
        lon >= bounds.west && lon <= bounds.east) {
      return { name: country.name, flag: country.flag };
    }
  }
  
  // Default if no country found
  return { name: 'Unknown', flag: '🌍' };
}

// Format coordinates to decimal degrees with direction
export function formatCoordinates(lat: number, lon: number): { lat: string; lon: string } {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  
  return {
    lat: `${Math.abs(lat).toFixed(6)}°${latDir}`,
    lon: `${Math.abs(lon).toFixed(6)}°${lonDir}`
  };
}