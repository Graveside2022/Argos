import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, frequency } = await request.json() as { action: string; frequency?: string };
    
    if (action === 'start') {
      try {
        // Check if HackRF is connected
        try {
          await execAsync('hackrf_info 2>&1');
        } catch {
          return json({ 
            success: false, 
            message: 'HackRF not detected. Please connect HackRF device.' 
          }, { status: 400 });
        }
        
        // Use the auto-IMSI script with frequency parameter
        const freq = frequency || '947.2';
        console.log(`Starting GSM Evil on ${freq} MHz with IMSI sniffer auto-enabled...`);
        const { stdout, stderr } = await execAsync(`sudo /home/ubuntu/projects/Argos/scripts/gsm-evil-with-auto-imsi.sh ${freq} 45`, {
          timeout: 15000 // 15 second timeout
        });
        
        console.log('Start output:', stdout);
        if (stderr) console.error('Start stderr:', stderr);
        
        // Verify it started - check for GsmEvil.py or GsmEvil_auto.py (capital G)
        const checkResult = await execAsync('pgrep -f "GsmEvil(_auto)?\\.py"').catch(() => ({ stdout: '' }));
        if (!checkResult.stdout.trim()) {
          // Also check if port 80 is listening
          const portCheck = await execAsync('sudo lsof -i :80 | grep LISTEN').catch(() => ({ stdout: '' }));
          if (!portCheck.stdout.trim()) {
            throw new Error('GSM Evil failed to start - no process or port 80 listener found');
          }
        }
        
        return json({ 
          success: true, 
          message: 'GSM Evil started successfully'
        });
      } catch (error: unknown) {
        console.error('Start error:', error);
        return json({ 
          success: false, 
          message: 'Failed to start GSM Evil', 
          error: (error as Error).message 
        }, { status: 500 });
      }
    } 
    
    else if (action === 'stop') {
      try {
        console.log('Stopping GSM Evil...');
        
        // Use the stop script
        await execAsync('sudo /home/ubuntu/projects/Argos/scripts/gsm-evil-stop.sh');
        
        return json({ 
          success: true, 
          message: 'GSM Evil stopped successfully'
        });
      } catch (error: unknown) {
        console.error('Stop error:', error);
        return json({ 
          success: false, 
          message: 'Failed to stop GSM Evil', 
          error: (error as Error).message
        }, { status: 500 });
      }
    }
    
    else {
      return json({ 
        success: false, 
        message: 'Invalid action' 
      }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Control API error:', error);
    return json({ 
      success: false, 
      message: 'Invalid request',
      error: (error as Error).message
    }, { status: 400 });
  }
};