import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ApiResponse } from '$lib/server/hackrf/types';
import { sweepManager } from '$lib/server/hackrf/sweepManager';

export const POST: RequestHandler = async () => {
  try {
    // Force cleanup any lingering processes
    await sweepManager.forceCleanup();
    
    const response: ApiResponse<{ cleaned: boolean }> = {
      success: true,
      data: { cleaned: true },
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