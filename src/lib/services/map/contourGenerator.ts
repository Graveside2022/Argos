/**
 * Contour line generation for RF signal visualization
 * Uses marching squares algorithm to create smooth contour lines
 */

import type { SignalMarker } from '$lib/stores/map/signals';

export interface ContourPoint {
  lat: number;
  lon: number;
  value: number;
}

export interface ContourLine {
  points: [number, number][];
  level: number;
  color: string;
}

export interface ContourConfig {
  levels: number[]; // Signal strength levels to create contours for
  smoothing: number; // Smoothing factor (0-1)
  resolution: number; // Grid resolution in meters
  colors: string[]; // Colors for each level
}

export const DEFAULT_CONTOUR_CONFIG: ContourConfig = {
  levels: [-90, -80, -70, -60, -50], // dBm levels
  smoothing: 0.5,
  resolution: 25, // 25m grid
  colors: ['#0066ff', '#66ff00', '#ffcc00', '#ff6600', '#ff0000'] // Blue to Red
};

/**
 * Interpolate signal strength at a given point using IDW (Inverse Distance Weighting)
 */
function interpolateValue(lat: number, lon: number, signals: SignalMarker[]): number {
  if (signals.length === 0) return -100; // No signal
  
  let weightedSum = 0;
  let weightSum = 0;
  
  for (const signal of signals) {
    const distance = calculateDistance(lat, lon, signal.lat, signal.lon);
    
    // If very close to a measurement point, return its value
    if (distance < 1) return signal.power;
    
    // IDW with power parameter of 2
    const weight = 1 / (distance * distance);
    weightedSum += signal.power * weight;
    weightSum += weight;
  }
  
  return weightSum > 0 ? weightedSum / weightSum : -100;
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
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

/**
 * Create a regular grid of interpolated values
 */
function createGrid(
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  resolution: number,
  signals: SignalMarker[]
): { grid: number[][]; latStep: number; lonStep: number } {
  const latMetersPerDegree = 111320;
  const lonMetersPerDegree = 111320 * Math.cos(((bounds.minLat + bounds.maxLat) / 2) * Math.PI / 180);
  
  const latStep = resolution / latMetersPerDegree;
  const lonStep = resolution / lonMetersPerDegree;
  
  const rows = Math.ceil((bounds.maxLat - bounds.minLat) / latStep);
  const cols = Math.ceil((bounds.maxLon - bounds.minLon) / lonStep);
  
  const grid: number[][] = [];
  
  for (let i = 0; i < rows; i++) {
    grid[i] = [];
    for (let j = 0; j < cols; j++) {
      const lat = bounds.minLat + i * latStep;
      const lon = bounds.minLon + j * lonStep;
      grid[i][j] = interpolateValue(lat, lon, signals);
    }
  }
  
  return { grid, latStep, lonStep };
}

/**
 * Marching squares algorithm to generate contour lines
 */
function marchingSquares(
  grid: number[][],
  level: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  latStep: number,
  lonStep: number
): [number, number][][] {
  const lines: [number, number][][] = [];
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  
  // Marching squares lookup table
  const edgeTable = [
    [], [0, 3], [0, 1], [1, 3], [1, 2], [0, 1, 2, 3], [0, 2], [2, 3],
    [2, 3], [0, 2], [0, 3, 1, 2], [1, 2], [1, 3], [0, 1], [0, 3], []
  ];
  
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      // Get corner values
      const a = grid[i][j] >= level ? 1 : 0;
      const b = grid[i][j + 1] >= level ? 1 : 0;
      const c = grid[i + 1][j + 1] >= level ? 1 : 0;
      const d = grid[i + 1][j] >= level ? 1 : 0;
      
      // Calculate index for lookup table
      const index = a * 8 + b * 4 + c * 2 + d;
      const edges = edgeTable[index];
      
      // Generate line segments
      for (let k = 0; k < edges.length; k += 2) {
        const edge1 = edges[k];
        const edge2 = edges[k + 1];
        
        const point1 = interpolatePoint(i, j, edge1, grid, level, bounds, latStep, lonStep);
        const point2 = interpolatePoint(i, j, edge2, grid, level, bounds, latStep, lonStep);
        
        if (point1 && point2) {
          lines.push([point1, point2]);
        }
      }
    }
  }
  
  return lines;
}

/**
 * Interpolate point on cell edge
 */
function interpolatePoint(
  i: number,
  j: number,
  edge: number,
  grid: number[][],
  level: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  latStep: number,
  lonStep: number
): [number, number] | null {
  const baseLat = bounds.minLat + i * latStep;
  const baseLon = bounds.minLon + j * lonStep;
  
  let lat: number, lon: number;
  
  switch (edge) {
    case 0: { // Top edge
      const t0 = (level - grid[i][j]) / (grid[i][j + 1] - grid[i][j]);
      lat = baseLat;
      lon = baseLon + t0 * lonStep;
      break;
    }
    case 1: { // Right edge
      const t1 = (level - grid[i][j + 1]) / (grid[i + 1][j + 1] - grid[i][j + 1]);
      lat = baseLat + t1 * latStep;
      lon = baseLon + lonStep;
      break;
    }
    case 2: { // Bottom edge
      const t2 = (level - grid[i + 1][j]) / (grid[i + 1][j + 1] - grid[i + 1][j]);
      lat = baseLat + latStep;
      lon = baseLon + t2 * lonStep;
      break;
    }
    case 3: { // Left edge
      const t3 = (level - grid[i][j]) / (grid[i + 1][j] - grid[i][j]);
      lat = baseLat + t3 * latStep;
      lon = baseLon;
      break;
    }
    default:
      return null;
  }
  
  return [lat, lon];
}

/**
 * Connect line segments into continuous contours
 */
function connectSegments(segments: [number, number][][]): [number, number][][] {
  const contours: [number, number][][] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    
    const contour: [number, number][] = [];
    let currentSegment = segments[i];
    contour.push(currentSegment[0], currentSegment[1]);
    used.add(i);
    
    // Try to connect segments
    let found = true;
    while (found) {
      found = false;
      const lastPoint = contour[contour.length - 1];
      
      for (let j = 0; j < segments.length; j++) {
        if (used.has(j)) continue;
        
        const segment = segments[j];
        const dist1 = Math.hypot(lastPoint[0] - segment[0][0], lastPoint[1] - segment[0][1]);
        const dist2 = Math.hypot(lastPoint[0] - segment[1][0], lastPoint[1] - segment[1][1]);
        
        if (dist1 < 0.00001) { // Threshold for connection
          contour.push(segment[1]);
          used.add(j);
          found = true;
          break;
        } else if (dist2 < 0.00001) {
          contour.push(segment[0]);
          used.add(j);
          found = true;
          break;
        }
      }
    }
    
    if (contour.length > 2) {
      contours.push(contour);
    }
  }
  
  return contours;
}

/**
 * Generate contour lines from signal data
 */
export function generateContours(
  signals: SignalMarker[],
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  config: ContourConfig = DEFAULT_CONTOUR_CONFIG
): ContourLine[] {
  if (signals.length === 0) return [];
  
  // Create interpolated grid
  const { grid, latStep, lonStep } = createGrid(bounds, config.resolution, signals);
  
  // Generate contour lines for each level
  const contourLines: ContourLine[] = [];
  
  config.levels.forEach((level, index) => {
    const segments = marchingSquares(grid, level, bounds, latStep, lonStep);
    const contours = connectSegments(segments);
    
    contours.forEach(points => {
      contourLines.push({
        points,
        level,
        color: config.colors[index] || '#888888'
      });
    });
  });
  
  return contourLines;
}

/**
 * Smooth contour lines using Chaikin's algorithm
 */
export function smoothContours(contours: ContourLine[], iterations: number = 2): ContourLine[] {
  return contours.map(contour => ({
    ...contour,
    points: smoothPolyline(contour.points, iterations)
  }));
}

function smoothPolyline(points: [number, number][], iterations: number): [number, number][] {
  let smoothed = points;
  
  for (let i = 0; i < iterations; i++) {
    const newPoints: [number, number][] = [];
    
    for (let j = 0; j < smoothed.length - 1; j++) {
      const p1 = smoothed[j];
      const p2 = smoothed[j + 1];
      
      // Chaikin's algorithm: cut corners at 1/4 and 3/4
      newPoints.push([
        0.75 * p1[0] + 0.25 * p2[0],
        0.75 * p1[1] + 0.25 * p2[1]
      ]);
      newPoints.push([
        0.25 * p1[0] + 0.75 * p2[0],
        0.25 * p1[1] + 0.75 * p2[1]
      ]);
    }
    
    smoothed = newPoints;
  }
  
  return smoothed;
}