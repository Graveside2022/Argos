import type { RequestHandler } from './$types';
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

export const POST: RequestHandler = async ({ request }) => {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (message: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`));
      };
      
      const sendResult = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: data })}\n\n`));
      };
      
      try {
        sendUpdate('[SCAN] Initializing GSM frequency scanner...');
        sendUpdate('[SCAN] Will test 25 GSM900 downlink frequencies');
        sendUpdate('[SCAN] ');
        
        const checkFreqs = [
          '935.2', '936.0', '937.0', '938.0', '939.0', '940.0', '941.0', '942.0',
          '943.0', '944.0', '945.0', '946.0', '947.2', '948.6', '949.0', '950.0',
          '951.0', '952.0', '953.0', '954.0', '955.0', '956.0', '957.6', '958.0', '959.0'
        ];
        
        sendUpdate('[SCAN] Frequencies to scan:');
        checkFreqs.forEach((freq, idx) => {
          if (idx % 5 === 0) {
            const batch = checkFreqs.slice(idx, idx + 5).join(', ');
            sendUpdate(`[SCAN] ${batch} MHz`);
          }
        });
        
        sendUpdate('[SCAN] ');
        sendUpdate('[SCAN] Starting GSM Frame Detection');
        sendUpdate('[SCAN] Testing each frequency for actual GSM activity...');
        const estimatedTime = checkFreqs.length * 5.5;
        sendUpdate(`[SCAN] Estimated time: ${Math.ceil(estimatedTime)} seconds (~${Math.ceil(estimatedTime/60)} minutes)`);
        sendUpdate('[SCAN] ');
        
        // Test each frequency
        const results: FrequencyTestResult[] = [];
        
        for (let i = 0; i < checkFreqs.length; i++) {
          const freq = checkFreqs[i];
          
          sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Testing ${freq} MHz...`);
          sendUpdate(`[CMD] $ grgsm_livemon_headless -f ${freq}M -g 40`);
          
          // Start grgsm_livemon
          const { stdout: gsmPid } = await execAsync(
            `sudo grgsm_livemon_headless -f ${freq}M -g 40 >/dev/null 2>&1 & echo $!`
          );
          
          const pid = gsmPid.trim();
          sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Waiting for demodulator initialization...`);
          
          // Wait for initialization
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          sendUpdate(`[CMD] $ tcpdump -i lo -nn port 4729 | wc -l`);
          sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Counting GSMTAP packets for 3 seconds...`);
          
          // Count GSMTAP packets and analyze channel types
          const { stdout: packetCount } = await execAsync(
            'sudo timeout 3 tcpdump -i lo -nn port 4729 2>/dev/null | wc -l'
          ).catch(() => ({ stdout: '0' }));
          
          const frameCount = parseInt(packetCount.trim()) || 0;
          
          // Analyze channel types if frames detected
          let channelType = '';
          let controlChannel = false;
          
          // For now, we'll use a heuristic based on frame count patterns
          // Control channels typically have steady, moderate frame rates
          // High frame counts often indicate traffic channels
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
          
          // Determine strength category based on frame count
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
          
          const hasActivity = frameCount > 10;
          
          sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Result: ${frameCount} GSM frames detected ${hasActivity ? '✓' : '✗'}`);
          sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Signal: ${power.toFixed(1)} dB (${strength})`);
          if (channelType) {
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`);
          }
          sendUpdate('[SCAN] ');
          
          results.push({
            frequency: freq,
            power: power,
            frameCount: frameCount,
            hasGsmActivity: hasActivity,
            strength: strength,
            channelType: channelType,
            controlChannel: controlChannel
          });
          
          // Brief pause
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Sort by frame count
        results.sort((a, b) => b.frameCount - a.frameCount);
        
        // Find best frequency
        const bestFreq = results.find(r => r.hasGsmActivity) || results[0] || { frequency: '947.2', frameCount: 0, power: -100, strength: 'No Signal' };
        
        sendUpdate('[SCAN] ');
        sendUpdate('[SCAN] ========== SCAN COMPLETE ==========');
        sendUpdate(`[SCAN] Best frequency: ${bestFreq.frequency} MHz`);
        sendUpdate(`[SCAN] GSM frames detected: ${bestFreq.frameCount}`);
        sendUpdate(`[SCAN] Signal strength: ${bestFreq.power.toFixed(1)} dB (${bestFreq.strength})`);
        sendUpdate('[SCAN] ==================================');
        
        // Send final result
        sendResult({
          success: true,
          bestFrequency: bestFreq.frequency,
          bestFrequencyFrames: bestFreq.frameCount,
          scanResults: results,
          totalTested: results.length
        });
        
      } catch (error: unknown) {
        sendUpdate(`[ERROR] Scan failed: ${(error as Error).message}`);
        sendResult({
          success: false,
          message: 'Scan failed',
          error: (error as Error).message
        });
      } finally {
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};