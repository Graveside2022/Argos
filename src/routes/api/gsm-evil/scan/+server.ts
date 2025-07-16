import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
  try {
    console.log('Starting GSM frequency scan...');
    
    // Full GSM900 downlink band frequencies to check
    const checkFreqs = [
      '935.2', '936.0', '937.0', '938.0', '939.0', '940.0', '941.0', '942.0',
      '943.0', '944.0', '945.0', '946.0', '947.2', '948.6', '949.0', '950.0',
      '951.0', '952.0', '953.0', '954.0', '955.0', '956.0', '957.6', '958.0', '959.0'
    ];
    
    console.log(`Testing ${checkFreqs.length} frequencies for GSM activity...`);
    
    const results: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean; channelType?: string; controlChannel?: boolean }[] = [];
    
    // Test each frequency for actual GSM frames
    for (const freq of checkFreqs) {
      console.log(`Testing ${freq} MHz...`);
      
      // Start grgsm_livemon briefly
      const { stdout: gsmPid } = await execAsync(
        `sudo grgsm_livemon_headless -f ${freq}M -g 40 >/dev/null 2>&1 & echo $!`
      );
      
      const pid = gsmPid.trim();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Count GSMTAP packets for 3 seconds
      const { stdout: packetCount } = await execAsync(
        'sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l'
      ).catch(() => ({ stdout: '0' }));
      
      const frameCount = parseInt(packetCount.trim()) || 0;
      
      // Analyze channel types based on frame patterns
      let channelType = '';
      let controlChannel = false;
      
      if (frameCount > 0) {
        if (frameCount > 10 && frameCount < 100) {
          // Moderate frame count - likely control channel
          channelType = 'BCCH/CCCH';
          controlChannel = true;
        } else if (frameCount >= 100) {
          // High frame count - likely traffic channel
          channelType = 'TCH';
          controlChannel = false;
        } else {
          // Low frame count - could be SDCCH or weak signal
          channelType = 'SDCCH';
          controlChannel = false;
        }
      }
      
      // Kill grgsm_livemon
      await execAsync(`sudo kill ${pid} 2>/dev/null`).catch(() => {});
      
      // Determine strength based on frame count (since we don't have RF power)
      let strength = 'No Signal';
      let power = -100;
      if (frameCount > 200) {
        strength = 'Excellent';
        power = -25;
      } else if (frameCount > 150) {
        strength = 'Very Strong';
        power = -30;
      } else if (frameCount > 100) {
        strength = 'Strong';
        power = -35;
      } else if (frameCount > 50) {
        strength = 'Good';
        power = -45;
      } else if (frameCount > 10) {
        strength = 'Moderate';
        power = -55;
      } else if (frameCount > 0) {
        strength = 'Weak';
        power = -65;
      }
      
      // Only add frequencies with GSM activity
      if (frameCount > 0) {
        results.push({
          frequency: freq,
          power: power,
          frameCount: frameCount,
          hasGsmActivity: frameCount > 10,
          strength: strength,
          channelType: channelType,
          controlChannel: controlChannel
        });
      }
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Sort by frame count (most active first)
    results.sort((a, b) => (b.frameCount || 0) - (a.frameCount || 0));
    
    // Find the best frequency (most GSM frames)
    const bestFreq = results.find(r => r.hasGsmActivity) || results[0];
    
    // Create summary message
    const summaryLines = results.slice(0, 10).map(r => 
      `${r.frequency} MHz: ${r.frameCount} frames (${r.strength})${r.controlChannel ? ' - Control Channel' : ''}`
    );
    
    return json({
      success: true,
      strongestFrequency: bestFreq ? bestFreq.frequency : '947.2',
      bestFrequencyFrames: bestFreq ? bestFreq.frameCount : 0,
      message: `Scan complete! Found ${results.length} active frequencies.\n\n${results.length > 0 ? `Top frequencies:\n${summaryLines.join('\n')}` : 'No GSM activity detected on any frequency.'}`,
      scanResults: results,
      totalFound: results.length
    });
    
  } catch (error: unknown) {
    console.error('Scan error:', error);
    return json({
      success: false,
      message: 'Scan failed. Make sure GSM Evil is stopped first.',
      error: (error as Error).message
    }, { status: 500 });
  }
};