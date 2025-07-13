// GET /api/kismet/service/status
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KismetServiceManager } from '$lib/server/kismet';

export const GET: RequestHandler = async () => {
  try {
    const status = await KismetServiceManager.getStatus();
    
    return json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error getting Kismet status:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};