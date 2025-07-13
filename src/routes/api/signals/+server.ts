import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRFDatabase } from '$lib/server/db/database';
import type { SignalMarker } from '$lib/stores/map/signals';

export const GET: RequestHandler = ({ url }) => {
  try {
    console.warn('GET /api/signals - Starting request');
    const db = getRFDatabase();
    console.warn('Database instance created');
    
    // Parse query parameters
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const radiusMeters = parseFloat(url.searchParams.get('radiusMeters') || '1000');
    const startTime = parseInt(url.searchParams.get('startTime') || '0');
    const endTime = parseInt(url.searchParams.get('endTime') || String(Date.now()));
    const limit = parseInt(url.searchParams.get('limit') || '1000');

    console.warn('Query params:', { lat, lon, radiusMeters, startTime, endTime, limit });

    // Execute spatial query
    const signals = db.findSignalsInRadius({
      lat,
      lon,
      radiusMeters,
      startTime,
      endTime,
      limit
    });

    console.warn(`Found ${signals.length} signals`);
    return json({ signals });
  } catch (err: unknown) {
    console.error('Error querying signals:', err);
    console.error('Stack trace:', (err as { stack?: string }).stack);
    return error(500, 'Failed to query signals');
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const db = getRFDatabase();
    const signal = await request.json() as SignalMarker;
    
    // Store signal in database
    const dbSignal = db.insertSignal(signal);
    
    return json({ 
      success: true, 
      id: dbSignal.id 
    });
  } catch (err: unknown) {
    console.error('Error storing signal:', err);
    return error(500, 'Failed to store signal');
  }
};