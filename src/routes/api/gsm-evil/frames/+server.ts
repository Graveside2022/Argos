import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    // Check if grgsm_livemon is running
    const grgsm = await execAsync('pgrep -f grgsm_livemon_headless').catch(() => ({ stdout: '' }));
    if (!grgsm.stdout.trim()) {
      return json({
        success: false,
        frames: [],
        message: 'GSM monitor not running'
      });
    }

    // Use tshark to get GSM burst data directly
    const { stdout: burstData } = await execAsync(
      'sudo timeout 1 tshark -i lo -f "port 4729" -T fields -e data.data 2>/dev/null | head -4',
      { timeout: 2000 }
    ).catch(() => ({ stdout: '' }));

    let frames: string[] = [];
    
    if (burstData) {
      // Each line contains hex data from a packet
      const lines = burstData.split('\n').filter(line => line.trim().length > 0);
      
      frames = lines.slice(0, 4).map(line => {
        // Each line is the data portion of GSMTAP
        // Format as space-separated hex pairs
        if (line.length >= 16) { // At least 8 bytes
          const formatted = line.substring(0, 24).match(/.{2}/g)?.join(' ');
          return formatted || '';
        }
        return '';
      }).filter(f => f.length > 0);
    }
    
    // If no frames captured, return empty array with message
    if (frames.length === 0) {
      return json({
        success: false,
        frames: [],
        message: 'No GSM frames captured - check if data is flowing'
      });
    }

    return json({
      success: true,
      frames: frames,
      message: frames.length > 0 ? 'Live frames captured' : 'No frames detected'
    });

  } catch (error: unknown) {
    console.error('Frame capture error:', error);
    return json({
      success: false,
      frames: [],
      message: 'Failed to capture frames',
      error: (error as Error).message
    });
  }
};