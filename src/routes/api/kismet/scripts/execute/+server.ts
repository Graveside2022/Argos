// POST /api/kismet/scripts/execute
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ScriptManager } from '$lib/server/kismet';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const { scriptPath } = body;
    
    if (!scriptPath) {
      return json({
        success: false,
        error: 'Script path is required',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Security check - ensure script path is within allowed directories
    const allowedDirs = ['/home/pi/Scripts', '/home/pi/stinky'];
    const isAllowed = allowedDirs.some(dir => (scriptPath as string).startsWith(dir));
    
    if (!isAllowed) {
      return json({
        success: false,
        error: 'Script path is not in allowed directories',
        timestamp: new Date().toISOString()
      }, { status: 403 });
    }
    
    const result = await ScriptManager.executeScript(scriptPath as string);
    
    return json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString()
    }, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    console.error('Error executing script:', error);
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};