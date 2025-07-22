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
        sendUpdate('[SCAN] Focusing on 947.4 MHz - confirmed GSM activity!');
        sendUpdate('[SCAN] ');
        
        // Focus on 947.4 MHz where GSM activity was confirmed
        const checkFreqs: string[] = ['947.4'];
        
        sendUpdate(`[SCAN] Scanning 1 frequency with confirmed GSM traffic`);
        sendUpdate('[SCAN] This will maximize GSM frame capture rate');
        
        sendUpdate('[SCAN] Frequencies to scan:');
        sendUpdate(`[SCAN] ${checkFreqs.join(', ')} MHz`);
        
        sendUpdate('[SCAN] ');
        sendUpdate('[SCAN] Starting GSM Frame Detection');
        sendUpdate('[SCAN] Testing 947.4 MHz for maximum GSM frame collection...');
        const estimatedTime = checkFreqs.length * 8; // ~8 seconds total (2s init + 6s capture)
        sendUpdate(`[SCAN] Estimated time: ${estimatedTime} seconds`);
        sendUpdate('[SCAN] ');
        
        // Test each frequency
        const results: FrequencyTestResult[] = [];
        
        for (let i = 0; i < checkFreqs.length; i++) {
          const freq = checkFreqs[i];
          let pid = '';
          
          try {
            // Check if USRP is available
            let deviceArgs = '';
            let sampleRateArg = '';
            let gain = 40;
            let isUSRP = false;
            try {
              const { stdout: uhdCheck } = await execAsync('uhd_find_devices 2>/dev/null | grep -q "B205" && echo "usrp"');
              if (uhdCheck.trim() === 'usrp') {
                // USRP B205 Mini detected - use wrapper script with args
                deviceArgs = '--args="type=b200" ';
                sampleRateArg = '-s 2e6 '; // 2 MSPS is optimal for B205 Mini
                gain = 70; // Max gain for B205 Mini is 73
                isUSRP = true;
              }
            } catch (e) {
              // No USRP found, will use HackRF
            }
            
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Testing ${freq} MHz...`);
            sendUpdate(`[DEVICE] Using ${isUSRP ? 'USRP B205 Mini' : 'HackRF'}`);
            
            // CRITICAL: Measure RF power FIRST (before GSM scan) to avoid USRP conflicts
            let strength = 'No Signal';
            let power = -100;
            
            if (isUSRP) {
              try {
                sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Measuring RF power with USRP B205 Mini...`);
                
                // Use exact same command that works in Node.js test
                const { stdout: powerResult, stderr: powerStderr } = await execAsync(
                  `cd /home/ubuntu/projects/Argos && timeout 20 python3 scripts/usrp_power_measure_real.py -f ${freq} -g ${gain} -d 0.1`,
                  { timeout: 25000 }
                );
                
                console.log(`USRP stdout: "${powerResult}"`);
                console.log(`USRP stderr length: ${powerStderr.length}`);
                
                const powerMatch = powerResult.match(/([-\d\.]+)\s*dBm/);
                if (powerMatch) {
                  power = parseFloat(powerMatch[1]);
                  sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] ✓ REAL RF Power: ${power.toFixed(1)} dBm (USRP B205 Mini)`);
                  console.log(`✓ USRP power measurement successful: ${power} dBm`);
                } else {
                  console.log(`✗ No power match in stdout: "${powerResult}"`);
                  throw new Error(`No power value found in output`);
                }
              } catch (error) {
                console.log(`✗ USRP power measurement failed: ${error.message}`);
                sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] USRP power measurement failed: ${error.message}`);
                power = -100; // Explicitly set to -100 to indicate failure
              }
            }
            
            sendUpdate(`[CMD] $ grgsm_livemon_headless ${deviceArgs}${sampleRateArg}-f ${freq}M -g ${gain}`);
            
            // Start grgsm_livemon_headless directly (bypassing broken wrapper)
            const { stdout: gsmPid } = await execAsync(
              `sudo grgsm_livemon_headless ${deviceArgs}${sampleRateArg}-f ${freq}M -g ${gain} >/dev/null 2>&1 & echo $!`
            );
            
            pid = gsmPid.trim();
            
            // Validate process started
            if (!pid || pid === '0') {
              throw new Error('Failed to start grgsm_livemon_headless');
            }
            
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Waiting for demodulator initialization...`);
            
            // Wait for initialization - optimized for USRP speed
            const initDelay = isUSRP ? 2000 : 1500;
            await new Promise(resolve => setTimeout(resolve, initDelay));
            
            sendUpdate(`[CMD] $ tcpdump -i lo -nn port 4729 | wc -l`);
            const captureTime = isUSRP ? 6 : 3; // Longer capture for better frame detection
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Counting GSMTAP packets for ${captureTime} seconds...`);
            
            // Count GSMTAP packets and analyze channel types
            let frameCount = 0;
            try {
              const { stdout: packetCount } = await execAsync(
                `sudo timeout ${captureTime} tcpdump -i lo -nn port 4729 2>/dev/null | wc -l`
              );
              frameCount = parseInt(packetCount.trim()) || 0;
            } catch (tcpdumpError) {
              sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] tcpdump failed, trying alternative method...`);
              // Alternative: check for any GSMTAP traffic
              try {
                const { stdout: altCount } = await execAsync(
                  `sudo timeout ${captureTime} netstat -u | grep -c 4729 || echo 0`
                );
                frameCount = parseInt(altCount.trim()) || 0;
              } catch (altError) {
                sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Network connection lost - check server status`);
                frameCount = 0;
              }
            }
            
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
            
            // Determine signal strength based on actual power
            if (power > -40) {
              strength = 'Excellent';
            } else if (power > -50) {
              strength = 'Very Strong';
            } else if (power > -60) {
              strength = 'Strong';
            } else if (power > -70) {
              strength = 'Good';
            } else if (power > -80) {
              strength = 'Moderate';
            } else if (power > -90) {
              strength = 'Weak';
            }
            
            // If no power measurement available, fall back to frame count
            if (power === -100 && frameCount > 0) {
              if (frameCount > 200) {
                strength = 'Excellent';
              } else if (frameCount > 150) {
                strength = 'Very Strong';
              } else if (frameCount > 100) {
                strength = 'Strong';
              } else if (frameCount > 50) {
                strength = 'Good';
              } else if (frameCount > 10) {
                strength = 'Moderate';
              } else if (frameCount > 0) {
                strength = 'Weak';
              }
            }
            
            const hasActivity = frameCount > 10;
            
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Result: ${frameCount} GSM frames detected ${hasActivity ? '✓' : '✗'}`);
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Signal: ${frameCount} frames (${strength})`);
            if (channelType) {
              sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Channel: ${channelType}${controlChannel ? ' (Control Channel - Good for IMSI)' : ''}`);
            }
            sendUpdate('[SCAN] ');
            
            const frequencyResult = {
              frequency: freq,
              power: power, // Actual RF power measurement
              frameCount: frameCount,
              hasGsmActivity: hasActivity,
              strength: strength,
              channelType: channelType,
              controlChannel: controlChannel
            };
            
            results.push(frequencyResult);
            
            // Send intermediate result for real-time UI updates
            sendResult({
              type: 'frequency_result',
              frequency: freq,
              result: frequencyResult,
              progress: {
                current: i + 1,
                total: checkFreqs.length,
                completed: i + 1
              }
            });
            
          } catch (freqError) {
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Error testing ${freq} MHz: ${(freqError as Error).message}`);
            sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Skipping to next frequency...`);
            sendUpdate('[SCAN] ');
            
            // Add failed frequency result to maintain count
            const failedResult = {
              frequency: freq,
              power: -100,
              frameCount: 0,
              hasGsmActivity: false,
              strength: 'Error',
              channelType: '',
              controlChannel: false
            };
            
            results.push(failedResult);
            
            // Send failed result for real-time UI updates
            sendResult({
              type: 'frequency_result',
              frequency: freq,
              result: failedResult,
              progress: {
                current: i + 1,
                total: checkFreqs.length,
                completed: i + 1
              }
            });
          } finally {
            // CRITICAL: Always kill grgsm_livemon process regardless of success/failure
            if (pid && pid !== '0') {
              try {
                await execAsync(`sudo kill ${pid} 2>/dev/null`);
                sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Cleaned up process ${pid}`);
              } catch (killError) {
                sendUpdate(`[FREQ ${i + 1}/${checkFreqs.length}] Warning: Failed to clean up process ${pid}`);
                // Try force kill
                await execAsync(`sudo kill -9 ${pid} 2>/dev/null`).catch(() => {});
              }
            }
          }
          
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
          type: 'scan_complete',
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