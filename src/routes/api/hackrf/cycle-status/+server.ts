import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ApiResponse, SweepStatus } from '$lib/server/hackrf/types';
import { SystemStatus } from '$lib/types/enums';

export const GET: RequestHandler = () => {
  try {
    // TODO: Call sweepManager.getStatus()
    
    // For now, return mock data
    const status: SweepStatus = {
      state: SystemStatus.Idle
    };

    const response: ApiResponse<SweepStatus> = {
      success: true,
      data: status,
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