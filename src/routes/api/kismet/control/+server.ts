import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action } = await request.json() as { action: unknown };
    
    if (action === 'start') {
      try {
        await execAsync('sudo systemctl start kismet');
        return json({ success: true, message: 'Kismet started successfully' });
      } catch (error: unknown) {
        return json({ 
          success: false, 
          message: 'Failed to start Kismet', 
          error: (error as { message?: string }).message 
        }, { status: 500 });
      }
    } else if (action === 'stop') {
      try {
        await execAsync('sudo systemctl stop kismet');
        return json({ success: true, message: 'Kismet stopped successfully' });
      } catch (error: unknown) {
        return json({ 
          success: false, 
          message: 'Failed to stop Kismet', 
          error: (error as { message?: string }).message 
        }, { status: 500 });
      }
    } else if (action === 'status') {
      try {
        const { stdout } = await execAsync('systemctl is-active kismet');
        const isActive = stdout.trim() === 'active';
        return json({ 
          success: true, 
          running: isActive,
          status: stdout.trim()
        });
      } catch {
        // systemctl returns exit code 3 when service is not active
        return json({ 
          success: true, 
          running: false,
          status: 'inactive'
        });
      }
    } else {
      return json({ 
        success: false, 
        message: 'Invalid action' 
      }, { status: 400 });
    }
  } catch (error: unknown) {
    return json({ 
      success: false, 
      message: 'Server error', 
      error: (error as { message?: string }).message 
    }, { status: 500 });
  }
};