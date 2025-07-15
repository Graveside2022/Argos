import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    // Check if grgsm_livemon is running
    const grgsm = await execAsync('pgrep -f grgsm_livemon_headless').catch(() => ({ stdout: '' }));
    if (!grgsm.stdout.trim()) {
      return json({
        success: false,
        hasActivity: false,
        message: 'GSM monitor not running'
      });
    }

    // Check for recent GSMTAP activity on port 4729
    // Count packets in the last second
    const { stdout: tcpdumpOutput } = await execAsync(
      'sudo timeout 1 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l',
      { timeout: 1500 }
    ).catch(() => ({ stdout: '0' }));

    const packets = parseInt(tcpdumpOutput.trim()) || 0;
    
    // Also check if GSM Evil web interface has recent data
    // Look for the IMSI database file that GSM Evil creates
    let recentIMSI = false;
    try {
      const dbPath = '/usr/src/gsmevil2/imsi.db';
      const stats = await fs.stat(dbPath);
      const now = Date.now();
      const fileAge = now - stats.mtimeMs;
      // Check if file was modified in last 5 minutes
      recentIMSI = fileAge < 5 * 60 * 1000;
    } catch {
      // Database doesn't exist or can't be accessed
      recentIMSI = false;
    }

    // Get current frequency from process
    const { stdout: psOutput } = await execAsync('ps aux | grep grgsm_livemon_headless | grep -v grep').catch(() => ({ stdout: '' }));
    let currentFreq = '947.2';
    const freqMatch = psOutput.match(/-f\s+(\d+\.?\d*)M/);
    if (freqMatch) {
      currentFreq = freqMatch[1];
    }

    // Get channel type distribution
    let channelInfo = '';
    try {
      const { stdout: channelTypes } = await execAsync(
        'sudo timeout 1 tshark -i lo -f "port 4729" -T fields -e gsmtap.chan_type 2>/dev/null | sort | uniq -c | head -3'
      ).catch(() => ({ stdout: '' }));
      
      if (channelTypes) {
        channelInfo = channelTypes.trim().replace(/\n/g, ', ');
      }
    } catch {}

    return json({
      success: true,
      hasActivity: packets > 0,
      packetCount: packets,
      recentIMSI: recentIMSI,
      currentFrequency: currentFreq,
      message: packets > 0 ? `Receiving data (${packets} packets/sec)` : 'No activity detected',
      channelInfo: channelInfo || 'No channel info',
      suggestion: packets === 0 ? 'Try different frequencies or check antenna' : 
                  !recentIMSI && packets > 0 ? 'Receiving control data only - no IMSI broadcasts detected' : null
    });

  } catch (error: unknown) {
    console.error('Activity check error:', error);
    return json({
      success: false,
      hasActivity: false,
      message: 'Failed to check activity',
      error: (error as Error).message
    });
  }
};