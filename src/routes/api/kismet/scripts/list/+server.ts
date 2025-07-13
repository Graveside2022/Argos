// GET /api/kismet/scripts/list
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ScriptManager } from '$lib/server/kismet';

export const GET: RequestHandler = async () => {
  try {
    const scripts = await ScriptManager.listScripts();
    
    return json({
      success: true,
      data: scripts,
      count: scripts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Error listing scripts:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};