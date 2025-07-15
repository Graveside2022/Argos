import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FrequencyTestResult {
  frequency: string;
  power: number;
  frameCount: number;
  hasGsmActivity: boolean;
  strength: string;
  channelType?: string;
  controlChannel?: boolean;
}

export const POST: RequestHandler = async () => {
  try {
    console.log('Starting intelligent GSM frequency scan...');
    
    // Phase 1: Quick RF power scan
    const { stdout: sweepData } = await execAsync(
      'timeout 10 hackrf_sweep -f 935:960 -l 32 -g 20 | grep -E "^[0-9]" | sort -k6 -n | head -20',
      { timeout: 15000 }
    ).catch(() => ({ stdout: '' }));
    
    if (!sweepData) {
      return json({
        success: false,
        message: 'No signals detected during RF sweep'
      });
    }
    
    // Parse sweep results to find strong signals
    const lines = sweepData.split('\n').filter(line => line.trim());
    const strongFrequencies = new Map<string, number>();
    
    const checkFreqs = [
      '935.2', '936.0', '937.0', '938.0', '939.0', '940.0', '941.0', '942.0',
      '943.0', '944.0', '945.0', '946.0', '947.2', '948.6', '949.0', '950.0',
      '951.0', '952.0', '953.0', '954.0', '955.0', '956.0', '957.6', '958.0', '959.0'
    ];
    
    // Extract power levels for each frequency
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 7) {
        const startFreq = parseInt(parts[2]) / 1e6;
        const endFreq = parseInt(parts[3]) / 1e6;
        const power = parseFloat(parts[6]);
        
        checkFreqs.forEach(freq => {
          const f = parseFloat(freq);
          if (f >= startFreq && f <= endFreq && power > -60) { // Lower threshold for testing
            const existing = strongFrequencies.get(freq) || -100;
            strongFrequencies.set(freq, Math.max(existing, power));
          }
        });
      }
    });
    
    // Sort frequencies by power level and test all of them
    const candidateFreqs = Array.from(strongFrequencies.entries())
      .sort((a, b) => b[1] - a[1]);
    
    if (candidateFreqs.length === 0) {
      return json({
        success: false,
        message: 'No frequencies with sufficient signal strength found'
      });
    }
    
    console.log(`Testing ${candidateFreqs.length} frequencies for GSM activity...`);
    
    // Phase 2: Test each candidate frequency for actual GSM frames
    const results: FrequencyTestResult[] = [];
    
    for (const [freq, power] of candidateFreqs) {
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
      
      // Determine strength category
      let strength = 'Weak';
      if (power > -25) strength = 'Excellent';
      else if (power > -30) strength = 'Very Strong';
      else if (power > -35) strength = 'Strong';
      else if (power > -45) strength = 'Good';
      else if (power > -55) strength = 'Moderate';
      
      results.push({
        frequency: freq,
        power: power,
        frameCount: frameCount,
        hasGsmActivity: frameCount > 10, // At least 10 frames in 3 seconds
        strength: strength,
        channelType: channelType,
        controlChannel: controlChannel
      });
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Sort by frame count (most active first)
    results.sort((a, b) => b.frameCount - a.frameCount);
    
    // Find the best frequency (most GSM frames)
    const bestFreq = results.find(r => r.hasGsmActivity) || results[0];
    
    // Format results message - show all results
    const summaryLines = results.map(r => 
      `${r.frequency} MHz: ${r.power.toFixed(1)} dB (${r.strength}) - ${r.frameCount} frames${r.hasGsmActivity ? ' ✓' : ''}`
    );
    
    return json({
      success: true,
      bestFrequency: bestFreq.frequency,
      bestFrequencyFrames: bestFreq.frameCount,
      message: `Intelligent scan complete!\n\nBest frequency: ${bestFreq.frequency} MHz with ${bestFreq.frameCount} GSM frames\n\nAll results:\n${summaryLines.join('\n')}`,
      scanResults: results,
      totalTested: results.length
    });
    
  } catch (error: unknown) {
    console.error('Intelligent scan error:', error);
    return json({
      success: false,
      message: 'Scan failed. Make sure GSM Evil is stopped first.',
      error: (error as Error).message
    }, { status: 500 });
  }
};