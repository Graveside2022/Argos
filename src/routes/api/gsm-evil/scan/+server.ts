import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { execWithUHDEnvironment, detectUSRPHardware, createUHDEnvironment } from '$lib/hardware/usrp-verification';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
  try {
    console.log('Starting GSM frequency scan...');
    
    // Parse request body for frequency parameter
    let requestedFreq = null;
    try {
      const body = await request.json();
      if (body.frequency) {
        requestedFreq = parseFloat(body.frequency);
        console.log(`Requested frequency: ${requestedFreq} MHz`);
      }
    } catch (e) {
      // No body or invalid JSON, use defaults
    }
    
    // Check if USRP is already in use by OpenWebRX or other services
    try {
      const { stdout: usrpStatus } = await execAsync('./scripts/check-usrp-busy.sh');
      if (usrpStatus.trim() !== 'FREE') {
        const busyService = usrpStatus.split(':')[1] || 'Unknown Service';
        return json({ 
          success: false, 
          message: `USRP is currently in use by ${busyService}. Please stop it first before scanning.`,
          conflictingService: busyService
        }, { status: 409 });
      }
    } catch (busyError) {
      // If script returns non-zero (BUSY), handle the conflict
      const errorOutput = (busyError as any).stdout || '';
      if (errorOutput.includes('BUSY:')) {
        const busyService = errorOutput.split(':')[1] || 'Unknown Service';
        return json({ 
          success: false, 
          message: `USRP is currently in use by ${busyService}. Please stop it first before scanning.`,
          conflictingService: busyService
        }, { status: 409 });
      }
    }
    
    // Scan frequency range from 945.0 to 949.0 MHz in 0.1 MHz steps
    const checkFreqs: string[] = [];
    for (let freq = 945.0; freq <= 949.0; freq += 0.1) {
      checkFreqs.push(freq.toFixed(1));
    }
    
    console.log(`Testing ${checkFreqs.length} strongest frequencies for GSM activity...`);
    
    const results: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean; channelType?: string; controlChannel?: boolean }[] = [];
    
    // Test each frequency for actual GSM frames
    for (const freq of checkFreqs) {
      console.log(`Testing ${freq} MHz...`);
      let pid = '';
      
      try {
        // Start grgsm_livemon briefly (works with both HackRF and USRP)
        // Check if USRP is available using proper hardware verification
        let deviceArgs = '';
        let sampleRateArg = '';
        let gain = 40;
        let isUSRP = false;
        
        try {
          const hardwareStatus = await detectUSRPHardware();
          if (hardwareStatus.detected && hardwareStatus.probeSuccess) {
            // USRP B205 Mini detected and working - use explicit device string
            const deviceString = hardwareStatus.serialNumber 
              ? `type=b200,serial=${hardwareStatus.serialNumber}`
              : 'type=b200';
            deviceArgs = `--args="${deviceString}" `;
            sampleRateArg = '-s 2e6 '; // 2 MSPS optimal for B205 Mini
            gain = 40; // Moderate gain to start
            isUSRP = true;
            console.log(`✓ Using USRP B205 Mini with device string: ${deviceString}`);
          } else if (hardwareStatus.detected) {
            console.log(`✗ USRP detected but not ready: ${hardwareStatus.errorMessage}`);
            // Fall back to HackRF
          }
        } catch (e) {
          console.log('USRP detection failed, falling back to HackRF');
          // No USRP found, will use HackRF
        }
        
        // Use direct grgsm_livemon_headless command with proper environment
        const baseCommand = `/home/ubuntu/projects/Argos/scripts/grgsm_livemon_wrapper ${deviceArgs}${sampleRateArg}-f ${freq}M -g ${gain} --collector localhost --collectorport 4729`;
        console.log(`Running command: ${baseCommand}`);
        
        // Test if system GRGSM can start at all
        let gsmTestOutput = '';
        try {
          const testResult = await execWithUHDEnvironment(`timeout 4 ${baseCommand}`);
          gsmTestOutput = testResult.stdout + testResult.stderr;
          console.log(`GRGSM test output: ${gsmTestOutput.substring(0, 300)}`);
        } catch (testError: any) {
          gsmTestOutput = (testError.stdout || '') + (testError.stderr || '');
        }
        
        console.log(`GRGSM test output: ${gsmTestOutput.substring(0, 500)}...`);
        
        // Check for known hardware failure patterns
        if (gsmTestOutput.includes('No supported devices found') || 
            gsmTestOutput.includes('RuntimeError: No supported devices found') ||
            (gsmTestOutput.includes('[ERROR] sdrplay_api_Open() Error: sdrplay_api_Fail') && !gsmTestOutput.includes('Detected Device:')) ||
            (gsmTestOutput.includes('SoapySDR::Device::enumerate') && !gsmTestOutput.includes('Detected Device:')) ||
            (gsmTestOutput.includes('[INFO] [UHD]') && !gsmTestOutput.includes('Detected Device:') && !gsmTestOutput.includes('Found device'))) {
          throw new Error(`Hardware not available: SDR device connection failed. GRGSM cannot connect to ${isUSRP ? 'USRP B205 Mini' : 'HackRF'}. Check device connection, drivers, and permissions.`);
        }
        
        const { stdout: gsmPid } = await execWithUHDEnvironment(
          `${baseCommand} >>/home/ubuntu/projects/Argos/grgsm.log 2>&1 & echo $!`
        );
        
        pid = gsmPid.trim();
        
        // Validate process started
        if (!pid || pid === '0') {
          throw new Error('Failed to start grgsm_livemon_headless - check hardware connection');
        }
        
        // Wait for initialization - USRP needs more time
        const initDelay = isUSRP ? 4000 : 2000;
        await new Promise(resolve => setTimeout(resolve, initDelay));
        
        // Count GSMTAP packets - USRP needs longer capture time
        const captureTime = isUSRP ? 5 : 3;
        let frameCount = 0;
        
        console.log(`Device: ${isUSRP ? 'USRP' : 'HackRF'}, Waiting ${initDelay}ms for init, capturing for ${captureTime}s`);
        
        try {
          // DIRECT LOG ANALYSIS: Check grgsm.log for actual GSM frames instead of unreliable tcpdump
          const logPath = '/home/ubuntu/projects/Argos/grgsm.log';
          
          // Get initial log size
          const { stdout: initialSize } = await execAsync(`wc -l < ${logPath} 2>/dev/null || echo 0`);
          const startLines = parseInt(initialSize.trim()) || 0;
          
          // Wait for data collection period
          await new Promise(resolve => setTimeout(resolve, captureTime * 1000));
          
          // Get final log size and count new GSM frame lines
          const { stdout: finalSize } = await execAsync(`wc -l < ${logPath} 2>/dev/null || echo 0`);
          const endLines = parseInt(finalSize.trim()) || 0;
          
          // Count actual GSM data frames (hex patterns) added during collection
          if (endLines > startLines) {
            const { stdout: frameLines } = await execAsync(
              `tail -n ${endLines - startLines} ${logPath} | grep -E "^\\s*[0-9a-f]{2}\\s" | wc -l`
            );
            frameCount = parseInt(frameLines.trim()) || 0;
          }
          
          console.log(`Direct log analysis: ${frameCount} GSM frames detected on ${freq} MHz`);
          
          // Fallback to tcpdump only if log analysis fails AND frames should be present
          if (frameCount === 0) {
            console.log('Log analysis found no frames, trying tcpdump fallback...');
            const tcpdumpCommand = `sudo timeout 2 tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729" || echo 0`;
            const { stdout: packetCount } = await execAsync(tcpdumpCommand).catch(() => ({ stdout: '0' }));
            const tcpdumpFrames = parseInt(packetCount.trim()) || 0;
            console.log(`Tcpdump fallback: ${tcpdumpFrames} packets`);
            frameCount = tcpdumpFrames;
          }
        } catch (logError) {
          console.log(`Direct log analysis failed: ${logError.message}, using tcpdump fallback`);
          // Fallback to original tcpdump method
          try {
            const tcpdumpCommand = `sudo timeout ${captureTime} tcpdump -i lo -nn port 4729 2>/dev/null | grep -c "127.0.0.1.4729"`;
            const { stdout: packetCount } = await execAsync(tcpdumpCommand);
            frameCount = parseInt(packetCount.trim()) || 0;
          } catch (tcpdumpError) {
            frameCount = 0;
            console.log(`Both log analysis and tcpdump failed for ${freq} MHz`);
          }
        }
        
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
        
        // Measure actual RF power with USRP if available
        let strength = 'No Signal';
        let power = -100;
        
        // Real USRP power measurement - NO HARDCODED VALUES
        if (isUSRP) {
          try {
            // Attempt real power measurement via USRP script
            const { stdout: powerResult } = await execWithUHDEnvironment(
              `cd /home/ubuntu/projects/Argos && timeout 10 python3 scripts/usrp_power_measure_real.py -f ${freq} -g ${gain} -d 0.1`,
              { timeout: 15000 }
            );
            const powerMatch = powerResult.match(/([-\d\.]+)\s*dBm/);
            if (powerMatch) {
              power = parseFloat(powerMatch[1]);
              console.log(`✓ Real USRP power measurement: ${power} dBm at ${freq} MHz`);
            } else {
              console.log(`✗ No power value found in USRP output`);
              power = -100; // Indicate measurement failed
            }
          } catch (powerError) {
            console.log(`✗ USRP power measurement failed: ${powerError.message}`);
            power = -100; // Indicate measurement failed
          }
        }
        // Convert real power to strength categories
        if (power > -100) {
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
          } else {
            strength = 'Weak';
          }
        }
        // NO FAKE POWER VALUES - Only use real measurements
        // If power measurement failed, don't fabricate values
        else if (frameCount > 0) {
          // Only indicate signal presence without fake power values
          if (frameCount > 200) {
            strength = 'Excellent (frames detected)';
          } else if (frameCount > 150) {
            strength = 'Very Strong (frames detected)';
          } else if (frameCount > 100) {
            strength = 'Strong (frames detected)';
          } else if (frameCount > 50) {
            strength = 'Good (frames detected)';
          } else if (frameCount > 10) {
            strength = 'Moderate (frames detected)';
          } else if (frameCount > 0) {
            strength = 'Weak (frames detected)';
          }
          // power remains -100 to indicate no real measurement available
        }
        
        // Debug logging for power value
        console.log(`Final values for ${freq} MHz: power=${power}, strength=${strength}, frames=${frameCount}`);
        
        // Ensure power is a valid number for JSON serialization
        const finalPower = isNaN(power) || power === null || power === undefined ? -100 : Number(power);
        
        // Only add frequencies with actual data (real power measurement OR actual frame detection)
        if (finalPower > -100 || frameCount > 0) {
          results.push({
            frequency: freq,
            power: finalPower,
            frameCount: frameCount,
            hasGsmActivity: frameCount > 10,
            strength: strength,
            channelType: channelType,
            controlChannel: controlChannel
          });
        }
        
      } catch (freqError) {
        console.log(`Error testing ${freq} MHz: ${(freqError as Error).message}`);
        
        // Check if it's a hardware availability issue
        if ((freqError as Error).message.includes('Hardware not available')) {
          // This is a critical hardware issue, don't continue with other frequencies
          throw freqError;
        }
        
        // Continue with next frequency for other errors
      } finally {
        // CRITICAL: Always kill grgsm_livemon process regardless of success/failure
        if (pid && pid !== '0') {
          try {
            await execAsync(`sudo kill ${pid} 2>/dev/null`);
          } catch (killError) {
            console.log(`Warning: Failed to clean up process ${pid}`);
            // Try force kill
            await execAsync(`sudo kill -9 ${pid} 2>/dev/null`).catch(() => {});
          }
        }
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