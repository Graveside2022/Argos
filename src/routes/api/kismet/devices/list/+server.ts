// GET /api/kismet/devices/list
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KismetProxy } from '$lib/server/kismet';
import type { DeviceFilter } from '$lib/server/kismet';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters for filtering
    const filter: DeviceFilter = {};
    
    const type = url.searchParams.get('type');
    if (type && ['AP', 'Client', 'Bridge', 'Unknown'].includes(type)) {
      filter.type = type as DeviceFilter['type'];
    }
    
    const ssid = url.searchParams.get('ssid');
    if (ssid) {
      filter.ssid = ssid;
    }
    
    const manufacturer = url.searchParams.get('manufacturer');
    if (manufacturer) {
      filter.manufacturer = manufacturer;
    }
    
    const minSignal = url.searchParams.get('minSignal');
    if (minSignal) {
      filter.minSignal = parseInt(minSignal);
    }
    
    const maxSignal = url.searchParams.get('maxSignal');
    if (maxSignal) {
      filter.maxSignal = parseInt(maxSignal);
    }
    
    const seenWithin = url.searchParams.get('seenWithin');
    if (seenWithin) {
      filter.seenWithin = parseInt(seenWithin);
    }
    
    const devices = await KismetProxy.getDevices(filter);
    
    return json({
      success: true,
      data: devices,
      count: devices.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};