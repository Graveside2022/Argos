// POST /api/kismet/service/stop
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { KismetServiceManager } from '$lib/server/kismet';

export const POST: RequestHandler = async () => {
  try {
    const result = await KismetServiceManager.stop();
    
    return json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString()
    }, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    console.error('Error stopping Kismet:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};