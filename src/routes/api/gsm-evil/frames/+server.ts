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
      'sudo timeout 1 tshark -i lo -f "port 4729" -T fields -e data.data 2>/dev/null | head -10',
      { timeout: 2000 }
    ).catch(() => ({ stdout: '' }));

    let frames: string[] = [];
    
    if (burstData) {
      // Each line contains hex data from a packet
      const lines = burstData.split('\n').filter(line => line.trim().length > 0);
      
      frames = lines.slice(0, 5).map(line => {
        // Parse the data - tshark might not give us gsmtap.type, so we'll analyze the data
        const hexData = line.trim();
        
        if (hexData.length >= 16) { // At least 8 bytes
          // Show up to 32 hex chars (16 bytes) for better visibility
          const formatted = hexData.substring(0, 32).match(/.{2}/g)?.join(' ') || '';
          
          // Try to identify burst type by pattern
          let burstType = '';
          if (hexData.startsWith('2b2b2b2b2b2b2b2b2b')) {
            burstType = ' [IDLE]';
          } else if (hexData.length === 16) { // 8 bytes
            burstType = ' [ACCESS]';
          } else if (formatted.includes('00 00 00 00 00 00')) {
            burstType = ' [FCH]'; // Frequency Correction
          } else if (formatted.includes('25 ') || formatted.includes('2d ')) {
            burstType = ' [SCH]'; // Synchronization
          } else if (hexData.length >= 230) { // ~115 bytes
            burstType = ' [NORMAL]';
          } else {
            burstType = ' [DATA]';
          }
          
          return formatted + burstType;
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