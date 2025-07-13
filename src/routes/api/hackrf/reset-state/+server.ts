import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { getSweepManager } from '$lib/server/hackrf/sweepManager';

export const POST: RequestHandler = async () => {
  try {
    const sweepManager = getSweepManager();
    
    // Force cleanup and reset state
    await sweepManager.forceCleanup();
    
    // Emit status update to ensure UI is synchronized
    const status = sweepManager.getStatus();
    
    return json({
      success: true,
      message: 'HackRF state reset successfully',
      status
    });
  } catch (error: unknown) {
    console.error('Reset state error:', error);
    return json({
      success: false,
      error: (error as { message?: string }).message || 'Failed to reset state'
    }, { status: 500 });
  }
};