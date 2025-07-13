/**
 * Web Worker for heavy grid analysis calculations
 * Processes signal data into grid cells for visualization
 */

// Grid calculation utilities
function getGridKey(lat, lon, gridSize) {
  const latMetersPerDegree = 111320;
  const lonMetersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
  
  const gridLat = Math.floor(lat * latMetersPerDegree / gridSize) * gridSize / latMetersPerDegree;
  const gridLon = Math.floor(lon * lonMetersPerDegree / gridSize) * gridSize / lonMetersPerDegree;
  
  return `${gridLat.toFixed(6)},${gridLon.toFixed(6)}`;
}

function calculateGridBounds(lat, lon, gridSize) {
  const latMetersPerDegree = 111320;
  const lonMetersPerDegree = 111320 * Math.cos(lat * Math.PI / 180);
  
  const latDelta = gridSize / latMetersPerDegree;
  const lonDelta = gridSize / lonMetersPerDegree;
  
  return {
    minLat: lat,
    maxLat: lat + latDelta,
    minLon: lon,
    maxLon: lon + lonDelta
  };
}

function processSignalsToGrid(signals, gridSize, bounds) {
  const gridData = new Map();
  const startTime = performance.now();
  
  // Filter signals within bounds if provided
  const validSignals = bounds ? signals.filter(signal => {
    return signal.lat >= bounds.minLat && 
           signal.lat <= bounds.maxLat &&
           signal.lon >= bounds.minLon && 
           signal.lon <= bounds.maxLon;
  }) : signals;
  
  // Process each signal
  validSignals.forEach(signal => {
    const gridKey = getGridKey(signal.lat, signal.lon, gridSize);
    
    if (gridData.has(gridKey)) {
      const cell = gridData.get(gridKey);
      cell.signals.push(signal);
      cell.totalPower += signal.power;
      cell.maxPower = Math.max(cell.maxPower, signal.power);
      cell.minPower = Math.min(cell.minPower, signal.power);
      
      // Track frequency bands with more detail
      const freqBand = getFrequencyBand(signal.freq);
      const bandCategory = getBandCategory(freqBand);
      
      // Track both specific and category bands
      cell.freqBands[freqBand] = (cell.freqBands[freqBand] || 0) + 1;
      if (!cell.bandCategories) cell.bandCategories = {};
      cell.bandCategories[bandCategory] = (cell.bandCategories[bandCategory] || 0) + 1;
      
      // Enhanced frequency tracking with 1MHz precision for better aggregation
      const freqKey = Math.round(signal.freq); // Round to nearest MHz
      if (!cell.freqDetails[freqKey]) {
        cell.freqDetails[freqKey] = { 
          count: 0, 
          maxPower: signal.power, 
          avgPower: 0, 
          totalPower: 0,
          band: freqBand,
          category: bandCategory,
          timestamps: []
        };
      }
      cell.freqDetails[freqKey].count++;
      cell.freqDetails[freqKey].totalPower += signal.power;
      cell.freqDetails[freqKey].avgPower = cell.freqDetails[freqKey].totalPower / cell.freqDetails[freqKey].count;
      cell.freqDetails[freqKey].maxPower = Math.max(cell.freqDetails[freqKey].maxPower, signal.power);
      cell.freqDetails[freqKey].timestamps.push(signal.timestamp);
      
      // Update time range
      cell.timeRange.start = Math.min(cell.timeRange.start, signal.timestamp);
      cell.timeRange.end = Math.max(cell.timeRange.end, signal.timestamp);
    } else {
      const [lat, lon] = gridKey.split(',').map(Number);
      const bounds = calculateGridBounds(lat, lon, gridSize);
      const freqBand = getFrequencyBand(signal.freq);
      const bandCategory = getBandCategory(freqBand);
      const freqKey = Math.round(signal.freq);
      
      gridData.set(gridKey, {
        key: gridKey,
        bounds,
        signals: [signal],
        totalPower: signal.power,
        maxPower: signal.power,
        minPower: signal.power,
        freqBands: { [freqBand]: 1 },
        bandCategories: { [bandCategory]: 1 },
        freqDetails: { 
          [freqKey]: { 
            count: 1, 
            maxPower: signal.power, 
            avgPower: signal.power, 
            totalPower: signal.power,
            band: freqBand,
            category: bandCategory,
            timestamps: [signal.timestamp]
          } 
        },
        timeRange: {
          start: signal.timestamp,
          end: signal.timestamp
        }
      });
    }
  });
  
  // Calculate statistics for each cell
  const processedCells = [];
  gridData.forEach((cell, key) => {
    const avgPower = cell.totalPower / cell.signals.length;
    const dominantBand = Object.entries(cell.freqBands)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Calculate signal density (signals per square meter)
    const areaM2 = gridSize * gridSize;
    const density = cell.signals.length / areaM2;
    
    // Standard deviation of power
    const variance = cell.signals.reduce((acc, signal) => {
      return acc + Math.pow(signal.power - avgPower, 2);
    }, 0) / cell.signals.length;
    const stdDev = Math.sqrt(variance);
    
    // Enhanced signal aggregation algorithm
    // Combines peak power with signal density for better representation
    const signalDensity = cell.signals.length / (gridSize * gridSize / 10000); // signals per 100m²
    const densityFactor = Math.min(1, signalDensity / 0.5); // Max at 0.5 signals/100m²
    
    // Calculate confidence based on multiple factors
    const countConfidence = Math.min(1, cell.signals.length / 10); // Max confidence at 10+ signals
    const timeSpanMinutes = (cell.timeRange.end - cell.timeRange.start) / 60000;
    const temporalConfidence = Math.min(1, timeSpanMinutes / 5); // Max confidence at 5+ minutes
    const confidenceFactor = (countConfidence * 0.7 + temporalConfidence * 0.3);
    
    // Enhanced aggregation formula
    // Uses weighted combination of peak and high percentile values
    const sortedPowers = cell.signals.map(s => s.power).sort((a, b) => b - a);
    const p95Index = Math.floor(sortedPowers.length * 0.05); // 95th percentile
    const p95Power = sortedPowers[p95Index] || cell.maxPower;
    
    // Final aggregated power calculation
    const aggregatedPower = (cell.maxPower * 0.6 + p95Power * 0.4) * (0.8 + 0.2 * densityFactor);
    
    // Find the strongest frequencies by category
    const strongestByCategory = {};
    const topFrequencies = [];
    
    Object.entries(cell.freqDetails).forEach(([freq, data]) => {
      const category = data.category;
      if (!strongestByCategory[category] || data.maxPower > strongestByCategory[category].power) {
        strongestByCategory[category] = {
          freq: parseInt(freq),
          power: data.maxPower,
          band: data.band,
          count: data.count
        };
      }
      
      // Keep track of top 5 frequencies overall
      topFrequencies.push({
        freq: parseInt(freq),
        power: data.maxPower,
        band: data.band,
        count: data.count
      });
    });
    
    // Sort and keep top 5
    topFrequencies.sort((a, b) => b.power - a.power);
    const top5Frequencies = topFrequencies.slice(0, 5);
    
    // Get overall strongest
    const strongestFreq = topFrequencies[0] || { freq: 0, power: -120 };
    
    processedCells.push({
      key,
      bounds: cell.bounds,
      stats: {
        count: cell.signals.length,
        avgPower,
        maxPower: cell.maxPower,
        minPower: cell.minPower,
        aggregatedPower,
        stdDev,
        density,
        densityFactor,
        dominantBand,
        freqBands: cell.freqBands,
        bandCategories: cell.bandCategories,
        strongestFreq: strongestFreq.freq,
        strongestFreqPower: strongestFreq.power,
        strongestByCategory,
        topFrequencies: top5Frequencies,
        timeRange: cell.timeRange,
        confidenceFactor,
        temporalSpanMinutes: (cell.timeRange.end - cell.timeRange.start) / 60000
      }
    });
  });
  
  const processingTime = performance.now() - startTime;
  
  return {
    cells: processedCells,
    totalSignals: validSignals.length,
    totalCells: processedCells.length,
    processingTime,
    gridSize
  };
}

// Enhanced frequency band categorization with sub-bands
function getFrequencyBand(freq) {
  // More granular frequency band detection
  if (freq >= 88 && freq <= 108) return 'FM Radio';
  else if (freq >= 118 && freq <= 137) return 'Aircraft VHF';
  else if (freq >= 144 && freq <= 148) return '2m Amateur';
  else if (freq >= 400 && freq <= 470) return 'UHF';
  else if (freq >= 420 && freq <= 450) return '70cm Amateur';
  else if (freq >= 850 && freq <= 950) return 'GSM/LTE-850';
  else if (freq >= 1710 && freq <= 1785) return 'LTE-1700';
  else if (freq >= 1850 && freq <= 1990) return 'LTE-1900';
  else if (freq >= 2110 && freq <= 2170) return 'LTE-2100';
  else if (freq >= 2400 && freq <= 2484) return '2.4GHz WiFi';
  else if (freq >= 2500 && freq <= 2690) return 'LTE-2600';
  else if (freq >= 3400 && freq <= 3800) return '5G-3500';
  else if (freq >= 5150 && freq <= 5350) return '5GHz WiFi-Low';
  else if (freq >= 5470 && freq <= 5850) return '5GHz WiFi-High';
  else if (freq >= 5850 && freq <= 5925) return '5.8GHz ISM';
  else if (freq < 1000) return 'Sub-1GHz';
  else return 'Other';
}

// Get simplified band category for grouping
function getBandCategory(band) {
  if (band.includes('WiFi')) return 'WiFi';
  else if (band.includes('LTE') || band.includes('GSM') || band.includes('5G')) return 'Cellular';
  else if (band.includes('Amateur')) return 'Amateur Radio';
  else if (band === 'FM Radio' || band === 'Aircraft VHF') return 'Public Service';
  else if (band.includes('ISM') || band === 'UHF') return 'ISM/Industrial';
  else return 'Other';
}

// Hexagonal grid processing (future enhancement)
function processSignalsToHexGrid(signals, hexSize, _bounds) {
  // Placeholder for hexagonal grid implementation
  // This would use a different coordinate system (axial or cubic)
  // For now, return empty result
  return {
    cells: [],
    totalSignals: signals.length,
    totalCells: 0,
    processingTime: 0,
    hexSize
  };
}

// Message handler
self.addEventListener('message', (event) => {
  const { type, data, requestId } = event.data;
  
  switch (type) {
    case 'processGrid':
      try {
        const result = processSignalsToGrid(
          data.signals,
          data.gridSize,
          data.bounds
        );
        self.postMessage({
          type: 'gridProcessed',
          data: result,
          requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message,
          requestId
        });
      }
      break;
      
    case 'processHexGrid':
      try {
        const result = processSignalsToHexGrid(
          data.signals,
          data.hexSize,
          data.bounds
        );
        self.postMessage({
          type: 'hexGridProcessed',
          data: result,
          requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message,
          requestId
        });
      }
      break;
      
    case 'calculateStats':
      // Calculate overall statistics for a set of signals
      try {
        const signals = data.signals;
        const stats = {
          totalSignals: signals.length,
          powerRange: {
            min: Math.min(...signals.map(s => s.power)),
            max: Math.max(...signals.map(s => s.power)),
            avg: signals.reduce((acc, s) => acc + s.power, 0) / signals.length
          },
          freqRange: {
            min: Math.min(...signals.map(s => s.freq)),
            max: Math.max(...signals.map(s => s.freq))
          },
          timeRange: {
            start: Math.min(...signals.map(s => s.timestamp)),
            end: Math.max(...signals.map(s => s.timestamp))
          },
          signalDensity: signals.length / ((data.bounds.maxLat - data.bounds.minLat) * 
                                           (data.bounds.maxLon - data.bounds.minLon) * 
                                           111320 * 111320) // Convert to square meters
        };
        
        self.postMessage({
          type: 'statsCalculated',
          data: stats,
          requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error.message,
          requestId
        });
      }
      break;
      
    default:
      self.postMessage({
        type: 'error',
        error: 'Unknown message type: ' + type,
        requestId
      });
  }
});