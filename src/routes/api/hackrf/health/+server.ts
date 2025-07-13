import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sweepManager, type ApiResponse, type HackRFHealth } from '$lib/server/hackrf';

export const GET: RequestHandler = async () => {
  try {
    const health = await sweepManager.checkHealth();

    const response: ApiResponse<HackRFHealth> = {
      success: true,
      data: health,
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