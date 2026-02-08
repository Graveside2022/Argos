import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager } from '$lib/server/hackrf/sweep-manager';

export const POST: RequestHandler = async () => {
  try {
    // Force emergency stop to clear all state
    await sweepManager.emergencyStop();
    
    // Additional force cleanup to ensure everything is reset
    await sweepManager.forceCleanup();
    
    return json({
      status: 'success',
      message: 'Sweep manager state reset successfully',
      currentStatus: sweepManager.getStatus()
    });
    
  } catch (error: unknown) {
    console.error('Error in reset-sweep endpoint:', error);
    return json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to reset sweep state'
    }, { status: 500 });
  }
};