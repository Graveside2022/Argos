import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, skipAdapter, interface: interfaceName } = await request.json() as { 
      action: unknown; 
      skipAdapter?: boolean;
      interface?: string;
    };
    
    if (action === 'start') {
      try {
        // Try to start Kismet service directly
        console.log('Starting Kismet service...');
        
        try {
          // First try to start the systemd service
          const { stdout: serviceOut, stderr: serviceErr } = await execAsync('sudo systemctl start kismet-auto-wlan1');
          console.log('Service start output:', serviceOut);
          if (serviceErr) console.error('Service start stderr:', serviceErr);
          
          return json({ 
            success: true, 
            message: 'Kismet service started',
            details: serviceOut || 'Service started successfully'
          });
        } catch (serviceError) {
          console.log('Systemd service failed, trying direct kismet command...');
          
          // If service fails, try to run kismet directly
          try {
            // Start kismet in background
            const { stdout, stderr } = await execAsync('sudo kismet -t waldzell -c wlan1 > /dev/null 2>&1 &');
            console.log('Direct kismet output:', stdout);
            if (stderr) console.error('Direct kismet stderr:', stderr);
            
            return json({ 
              success: true, 
              message: 'Kismet started directly',
              details: 'Kismet process started in background'
            });
          } catch (directError) {
            // If both fail, try one more time with the script if it exists locally
            const scriptPath = './scripts/start-kismet-safe.sh';
            try {
              const { stdout: scriptOut, stderr: scriptErr } = await execAsync(`sudo ${scriptPath}`);
              console.log('Script output:', scriptOut);
              if (scriptErr) console.error('Script stderr:', scriptErr);
              
              return json({ 
                success: true, 
                message: 'Kismet started via script',
                details: scriptOut
              });
            } catch (scriptError) {
              throw new Error('Failed to start Kismet via service, direct command, or script');
            }
          }
        }
      } catch (error: unknown) {
        console.error('Failed to start Kismet:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return json({ 
          success: false, 
          message: 'Failed to start Kismet', 
          error: errorMessage,
          details: error instanceof Error && 'stderr' in error ? (error as any).stderr : undefined
        }, { status: 500 });
      }
    } else if (action === 'stop') {
      try {
        await execAsync('sudo systemctl stop kismet-auto-wlan1');
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
        const { stdout } = await execAsync('systemctl is-active kismet-auto-wlan1');
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