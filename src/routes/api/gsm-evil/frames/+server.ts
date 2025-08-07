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

    // Read GSM frames from the log file where grgsm_livemon outputs them
    const logPath = '/home/ubuntu/projects/Argos/grgsm.log';
    const { stdout: recentFrames } = await execAsync(
      `tail -10 ${logPath} | grep -E "^\\s*[0-9a-f]{2}\\s"`,
      { timeout: 2000 }
    ).catch(() => ({ stdout: '' }));

    let frames: string[] = [];
    
    if (recentFrames) {
      // Each line contains GSM frame hex data
      const lines = recentFrames.split('\n').filter(line => line.trim().length > 0);
      
      frames = lines.slice(-5).map(line => {
        // Clean up the line and format it nicely
        const hexData = line.trim();
        
        if (hexData.length >= 10) {
          // Try to identify frame type by pattern
          let frameType = '';
          if (hexData.includes('2b 2b 2b 2b 2b 2b 2b 2b 2b')) {
            frameType = ' [FILLER]'; // These are actually filler frames, not idle
          } else if (hexData.startsWith('15 06')) {
            frameType = ' [FILLER]';
          } else if (hexData.startsWith('41 06')) {
            frameType = ' [BCCH]'; // System Information
          } else if (hexData.startsWith('01 06')) {
            frameType = ' [PAGING]';
          } else if (hexData.startsWith('25 06') || hexData.startsWith('2d 06')) {
            frameType = ' [SDCCH]';
          } else if (hexData.startsWith('59 06') || hexData.startsWith('55 06')) {
            frameType = ' [SYS_INFO]';
          } else if (hexData.startsWith('05 06')) {
            frameType = ' [IMM_ASSIGN]';
          } else {
            frameType = ' [DATA]';
          }
          
          // Limit display to first 48 characters for readability
          const displayData = hexData.length > 48 ? hexData.substring(0, 48) + '...' : hexData;
          return displayData + frameType;
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