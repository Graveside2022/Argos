import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';

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
            const { stdout, stderr } = await execAsync('sudo kismet -t waldzell -c wlan1 --no-ncurses-wrapper > /dev/null 2>&1 &');
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
        // First, gracefully stop Kismet process to avoid USB reset
        console.log('Gracefully stopping Kismet...');
        
        // Send SIGTERM to Kismet process directly - be specific to avoid killing other processes
        // Only kill the actual kismet binary, not scripts or other processes with kismet in the name
        try {
          // First check if kismet is actually running
          const { stdout: pgrepOut } = await execAsync('pgrep -f "^/usr/bin/kismet"');
          if (pgrepOut.trim()) {
            console.log('Found kismet process(es):', pgrepOut.trim());
            await execAsync('sudo pkill -TERM -f "^/usr/bin/kismet"');
          } else {
            console.log('No kismet process found to kill');
          }
        } catch (pgrepError) {
          // pgrep returns exit code 1 if no processes found, that's ok
          console.log('No kismet process found (pgrep returned no results)');
        }
        
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Then stop the systemd service (which should already be stopped)
        try {
          await execAsync('sudo systemctl stop kismet-auto-wlan1');
        } catch {
          // Service might already be stopped, that's ok
        }
        
        // Clean up any stuck monitor interfaces without resetting USB
        console.log('Cleaning up monitor interfaces...');
        try {
          const { stdout: cleanupOut } = await execAsync(`
            for iface in wlx*mon kismon*; do
              if ip link show "$iface" >/dev/null 2>&1; then
                echo "Removing interface: $iface"
                sudo ip link delete "$iface" 2>/dev/null || true
              fi
            done
          `);
          if (cleanupOut) console.log('Cleanup output:', cleanupOut);
        } catch (cleanupError) {
          console.log('Monitor interface cleanup had issues (non-critical):', cleanupError);
        }
        
        return json({ success: true, message: 'Kismet stopped gracefully without network disruption' });
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