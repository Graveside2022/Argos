import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';

export const POST: RequestHandler = async () => {
  try {
    // Stop the sweep using sweepManager
    await sweepManager.stopSweep();
    
    return json({
      status: 'success',
      message: 'Sweep stopped successfully'
    });
    
  } catch (error: unknown) {
    console.error('Error in stop-sweep endpoint:', error);
    return json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to stop sweep'
    }, { status: 500 });
  }
};