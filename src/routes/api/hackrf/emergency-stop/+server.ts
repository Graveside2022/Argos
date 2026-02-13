import { json } from '@sveltejs/kit';

import { sweepManager } from '$lib/server/hackrf/sweep-manager';
import type { ApiResponse } from '$lib/server/hackrf/types';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  try {
    // Call sweepManager.emergencyStop()
    await sweepManager.emergencyStop();
    
    const response: ApiResponse<{ stopped: boolean }> = {
      success: true,
      data: { stopped: true },
      timestamp: Date.now()
    };

    return json(response);
  } catch (error: unknown) {
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    };
    
    return json(response, { status: 500 });
  }
};