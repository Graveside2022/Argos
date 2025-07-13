import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const db = getRFDatabase();
    const { bounds } = await request.json() as Record<string, unknown>;
    
    if (!bounds || !(bounds as Record<string, unknown>).minLat || !(bounds as Record<string, unknown>).maxLat || !(bounds as Record<string, unknown>).minLon || !(bounds as Record<string, unknown>).maxLon) {
      return error(400, 'Invalid bounds');
    }
    
    // Get devices in area with their locations
    const devices = db.findDevicesNearby({
      lat: (((bounds as Record<string, unknown>).minLat as number) + ((bounds as Record<string, unknown>).maxLat as number)) / 2,
      lon: (((bounds as Record<string, unknown>).minLon as number) + ((bounds as Record<string, unknown>).maxLon as number)) / 2,
      radiusMeters: Math.max(
        Math.abs(((bounds as Record<string, unknown>).maxLat as number) - ((bounds as Record<string, unknown>).minLat as number)) * 111320,
        Math.abs(((bounds as Record<string, unknown>).maxLon as number) - ((bounds as Record<string, unknown>).minLon as number)) * 111320
      ) / 2
    });
    
    // Transform to DeviceInfo format
    const deviceInfos = devices.map(d => ({
      id: d.device_id,
      type: d.type,
      manufacturer: d.manufacturer,
      firstSeen: d.first_seen,
      lastSeen: d.last_seen,
      avgPower: d.avg_power || 0,
      signalCount: d.signal_count,
      lastPosition: { lat: d.avg_lat, lon: d.avg_lon },
      frequencyRange: { 
        min: d.freq_min || 0, 
        max: d.freq_max || 0 
      }
    }));
    
    return json(deviceInfos);
  } catch (err: unknown) {
    console.error('Error getting devices:', err);
    return error(500, 'Failed to get devices');
  }
};