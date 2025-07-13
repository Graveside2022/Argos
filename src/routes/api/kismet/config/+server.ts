// GET /api/kismet/config - Return proxy configuration and status
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KismetProxy } from '$lib/server/kismet';

export const GET: RequestHandler = async () => {
  try {
    const config = KismetProxy.getConfig();
    
    // Try to get Kismet status to verify connection
    let kismetStatus = null;
    let connected = false;
    
    try {
      kismetStatus = await KismetProxy.getSystemStatus() as unknown;
      connected = true;
    } catch (error: unknown) {
      console.warn('Cannot connect to Kismet:', error);
    }
    
    return json({
      success: true,
      data: {
        proxy: config,
        kismet: {
          connected,
          status: kismetStatus
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error getting config:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};