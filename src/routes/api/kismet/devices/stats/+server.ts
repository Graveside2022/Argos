// GET /api/kismet/devices/stats
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KismetProxy } from '$lib/server/kismet';

export const GET: RequestHandler = async () => {
  try {
    const stats = await KismetProxy.getDeviceStats();
    
    return json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching device stats:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};