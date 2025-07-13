import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';

export const GET: RequestHandler = ({ url }) => {
  try {
    const db = getRFDatabase();
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '3600000'); // Default 1 hour
    
    // Get current map bounds if provided
    const minLat = parseFloat(url.searchParams.get('minLat') || '-90');
    const maxLat = parseFloat(url.searchParams.get('maxLat') || '90');
    const minLon = parseFloat(url.searchParams.get('minLon') || '-180');
    const maxLon = parseFloat(url.searchParams.get('maxLon') || '180');
    
    const stats = db.getAreaStatistics(
      { minLat, maxLat, minLon, maxLon },
      timeWindow
    );
    
    return json({
      totalSignals: (stats as { total_signals?: number }).total_signals || 0,
      uniqueDevices: (stats as { unique_devices?: number }).unique_devices || 0,
      avgPower: (stats as { avg_power?: number }).avg_power || 0,
      minPower: (stats as { min_power?: number }).min_power || 0,
      maxPower: (stats as { max_power?: number }).max_power || 0,
      freqBands: (stats as { freq_bands?: number }).freq_bands || 0,
      timeRange: {
        start: Date.now() - timeWindow,
        end: Date.now()
      }
    });
  } catch (err: unknown) {
    console.error('Error getting statistics:', err);
    return error(500, 'Failed to get statistics');
  }
};