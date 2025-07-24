import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action } = await request.json() as { action: string };
    
    if (action === 'stop') {
      try {
        console.log('Stopping OpenWebRX Docker container and releasing USRP...');
        
        // Stop the Docker container (this prevents auto-restart)
        await execAsync('docker stop openwebrx-usrp-final').catch(() => {});
        
        // Also kill any remaining processes
        await execAsync('sudo pkill -f openwebrx').catch(() => {});
        await execAsync('sudo pkill -f soapy_connector').catch(() => {});
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify Docker container is stopped
        const containerCheck = await execAsync('docker ps --filter "name=openwebrx-usrp-final" --format "{{.Names}}"').catch(() => ({ stdout: '' }));
        const processCheck = await execAsync('pgrep -f openwebrx').catch(() => ({ stdout: '' }));
        
        if (containerCheck.stdout.trim() || processCheck.stdout.trim()) {
          console.log('Force stopping...');
          await execAsync('docker kill openwebrx-usrp-final').catch(() => {});
          await execAsync('sudo pkill -9 -f openwebrx').catch(() => {});
          await execAsync('sudo pkill -9 -f soapy_connector').catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return json({ 
          success: true, 
          message: 'OpenWebRX stopped successfully. USRP is now available for GSM Evil.'
        });
      } catch (error: unknown) {
        console.error('Stop error:', error);
        return json({ 
          success: false, 
          message: 'Failed to stop OpenWebRX', 
          error: (error as Error).message 
        }, { status: 500 });
      }
    }
    
    else if (action === 'status') {
      try {
        // Check if OpenWebRX Docker container is running
        const containerCheck = await execAsync('docker ps --filter "name=openwebrx-usrp-final" --format "{{.Names}}"').catch(() => ({ stdout: '' }));
        const processCheck = await execAsync('pgrep -f openwebrx').catch(() => ({ stdout: '' }));
        
        const isRunning = !!(containerCheck.stdout.trim() || processCheck.stdout.trim());
        
        return json({
          success: true,
          running: isRunning,
          message: isRunning ? 'OpenWebRX is running' : 'OpenWebRX is stopped'
        });
      } catch (error: unknown) {
        console.error('Status error:', error);
        return json({ 
          success: false, 
          message: 'Failed to check OpenWebRX status', 
          error: (error as Error).message 
        }, { status: 500 });
      }
    }
    
    else {
      return json({ 
        success: false, 
        message: 'Invalid action. Use "stop" or "status".' 
      }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('OpenWebRX control API error:', error);
    return json({ 
      success: false, 
      message: 'API error', 
      error: (error as Error).message 
    }, { status: 500 });
  }
};