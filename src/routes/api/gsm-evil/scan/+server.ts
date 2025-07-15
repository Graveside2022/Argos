import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
  try {
    console.log('Starting GSM frequency scan...');
    
    // Quick scan of GSM900 band to find strongest signal
    const { stdout } = await execAsync(
      'timeout 10 hackrf_sweep -f 935:960 -l 32 -g 20 | grep -E "^[0-9]" | sort -k6 -n | head -20',
      { timeout: 15000 }
    );
    
    if (!stdout) {
      return json({
        success: false,
        message: 'No signals detected'
      });
    }
    
    // Parse the sweep results to find strongest signals
    const lines = stdout.split('\n').filter(line => line.trim());
    const strongFrequencies = new Map<string, number>();
    
    // Full GSM900 downlink band frequencies to check
    const checkFreqs = [
      '935.2', '936.0', '937.0', '938.0', '939.0', '940.0', '941.0', '942.0',
      '943.0', '944.0', '945.0', '946.0', '947.2', '948.6', '949.0', '950.0',
      '951.0', '952.0', '953.0', '954.0', '955.0', '956.0', '957.6', '958.0', '959.0'
    ];
    
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 7) {
        const startFreq = parseInt(parts[2]) / 1e6; // Convert to MHz
        const endFreq = parseInt(parts[3]) / 1e6;
        const power = parseFloat(parts[6]); // Signal strength in dB
        
        // Check if any of our target frequencies fall in this range
        checkFreqs.forEach(freq => {
          const f = parseFloat(freq);
          if (f >= startFreq && f <= endFreq && power > -50) { // Only consider strong signals
            const existing = strongFrequencies.get(freq) || -100;
            strongFrequencies.set(freq, Math.max(existing, power));
          }
        });
      }
    });
    
    // Find strongest frequency
    let strongestFreq = '947.2';
    let strongestPower = -100;
    
    strongFrequencies.forEach((power, freq) => {
      if (power > strongestPower) {
        strongestPower = power;
        strongestFreq = freq;
      }
    });
    
    // Build sorted results
    const results: { frequency: string; power: number; strength: string }[] = [];
    
    checkFreqs.forEach(freq => {
      const power = strongFrequencies.get(freq);
      if (power !== undefined && power > -80) { // Only include detectable signals
        let strength = 'Weak';
        
        // More granular strength classification
        if (power > -25) strength = 'Excellent';
        else if (power > -30) strength = 'Very Strong';
        else if (power > -35) strength = 'Strong';
        else if (power > -45) strength = 'Good';
        else if (power > -55) strength = 'Moderate';
        else if (power > -65) strength = 'Fair';
        
        results.push({
          frequency: freq,
          power: power,
          strength: strength
        });
      }
    });
    
    // Sort by power (strongest first)
    results.sort((a, b) => b.power - a.power);
    
    // Create summary message
    const topResults = results.slice(0, 10);
    const summaryLines = topResults.map(r => 
      `${r.frequency} MHz: ${r.power.toFixed(1)} dB (${r.strength})`
    );
    
    return json({
      success: true,
      strongestFrequency: strongestFreq,
      message: `Scan complete! Found ${results.length} active frequencies.\n\nTop 10 strongest:\n${summaryLines.join('\n')}`,
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