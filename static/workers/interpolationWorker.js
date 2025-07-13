/**
 * Web Worker for signal interpolation calculations
 * Performs heavy interpolation calculations off the main thread
 */

// Interpolation utilities
function getDistance(lat1, lon1, lat2, lon2) {
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

// Build spatial index for efficient neighbor search
function buildSpatialIndex(points) {
  const index = new Map();
  const cellSize = 0.001; // ~100m at equator
  
  points.forEach(point => {
    const cellLat = Math.floor(point.lat / cellSize);
    const cellLon = Math.floor(point.lon / cellSize);
    
    // Add to multiple cells for overlap
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const key = `${cellLat + i},${cellLon + j}`;
        if (!index.has(key)) {
          index.set(key, []);
        }
        index.get(key).push(point);
      }
    }
  });
  
  return index;
}

// Find neighbors efficiently using spatial index
function findNeighbors(lat, lon, spatialIndex, config) {
  const cellSize = 0.001;
  const cellLat = Math.floor(lat / cellSize);
  const cellLon = Math.floor(lon / cellSize);
  const key = `${cellLat},${cellLon}`;
  
  const candidates = spatialIndex.get(key) || [];
  
  // Calculate distances and filter
  const neighbors = candidates
    .map(point => ({
      point,
      distance: getDistance(lat, lon, point.lat, point.lon)
    }))
    .filter(item => item.distance <= config.searchRadius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, config.maxNeighbors)
    .map(item => item.point);
  
  return neighbors;
}

// Calculate IDW value for a single point
function calculateIDW(lat, lon, neighbors, power) {
  let weightedSum = 0;
  let weightSum = 0;

  for (const neighbor of neighbors) {
    const distance = getDistance(lat, lon, neighbor.lat, neighbor.lon);
    
    // Avoid division by zero
    if (distance < 0.0001) {
      return neighbor.intensity;
    }

    const weight = Math.pow(1 / distance, power);
    weightedSum += neighbor.intensity * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? weightedSum / weightSum : 0;
}

// IDW interpolation
function interpolateIDW(points, bounds, resolution, config) {
  const grid = [];
  const latSteps = Math.ceil(getDistance(bounds.minLat, bounds.minLon, bounds.maxLat, bounds.minLon) / resolution);
  const lonSteps = Math.ceil(getDistance(bounds.minLat, bounds.minLon, bounds.minLat, bounds.maxLon) / resolution);
  
  const latStep = (bounds.maxLat - bounds.minLat) / latSteps;
  const lonStep = (bounds.maxLon - bounds.minLon) / lonSteps;

  // Build spatial index for efficient neighbor search
  const spatialIndex = buildSpatialIndex(points);

  // Process in chunks to provide progress updates
  const totalPoints = (latSteps + 1) * (lonSteps + 1);
  let processedPoints = 0;

  for (let i = 0; i <= latSteps; i++) {
    for (let j = 0; j <= lonSteps; j++) {
      const lat = bounds.minLat + i * latStep;
      const lon = bounds.minLon + j * lonStep;

      // Find nearby points
      const neighbors = findNeighbors(lat, lon, spatialIndex, config);
      
      if (neighbors.length >= config.minNeighbors) {
        const intensity = calculateIDW(lat, lon, neighbors, config.power);
        grid.push({ lat, lon, intensity });
      }

      processedPoints++;
      
      // Send progress update every 1000 points
      if (processedPoints % 1000 === 0) {
        self.postMessage({
          type: 'progress',
          progress: processedPoints / totalPoints
        });
      }
    }
  }

  return grid;
}

// Message handler
self.addEventListener('message', (event) => {
  const { type, points, bounds, resolution, config } = event.data;
  
  switch (type) {
    case 'interpolateIDW':
      try {
        const startTime = performance.now();
        const result = interpolateIDW(points, bounds, resolution, config);
        const endTime = performance.now();
        
        self.postMessage({
          type: 'idwComplete',
          result: result,
          processingTime: endTime - startTime
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message
        });
      }
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: 'Unknown message type: ' + type
      });
  }
});