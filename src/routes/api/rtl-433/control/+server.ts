import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, appendFileSync } from 'fs';

const execAsync = promisify(exec);

// Store the RTL_433 process globally
let rtl433Process: any = null;

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { action, frequency, sampleRate, format, protocols } = await request.json();

    // IMPROVED: Handle existing RTL_433 processes properly

    if (action === 'start') {
      // Check if RTL_433 is already running (more specific check)
      try {
        const { stdout } = await execAsync('ps aux | grep "[r]tl_433" | grep -v grep || echo ""');
        if (stdout.trim()) {
          const pid = stdout.trim().split(/\s+/)[1];
          return json({ 
            success: false, 
            message: 'RTL_433 is already running. Stop it first or use different frequency.',
            pid: pid
          });
        }
      } catch (error) {
        // Continue if check fails
      }

      // Stop any existing tracked process first
      if (rtl433Process) {
        try {
          rtl433Process.kill();
          rtl433Process = null;
        } catch (error) {
          console.error('Error stopping existing RTL_433 process:', error);
        }
      }

      // Build RTL_433 command
      const args = [
        '-f', `${frequency}M`,
        '-s', sampleRate,
        '-F', format,
        '-M', 'time:iso',
        '-M', 'protocol',
        '-M', 'level',
        '-F', 'log'  // This enables console logging
      ];

      // Add protocol restrictions if specified
      if (protocols && protocols.length > 0) {
        // First disable all protocols
        args.push('-R', '0');
        // Then enable specific protocols
        protocols.forEach((protocol: string) => {
          args.push('-R', protocol);
        });
      }

      // Start RTL_433 process with output redirection
      const logFile = '/tmp/rtl433_web.log';
      
      // Initialize log file and add session separator
      try {
        const fs = require('fs');
        if (!fs.existsSync(logFile)) {
          writeFileSync(logFile, '');
        } else {
          // Add session separator to existing log
          appendFileSync(logFile, `\n=== RTL_433 Session Started: ${new Date().toISOString()} ===\n`);
        }
      } catch (e) {
        // Continue if file access fails
      }
      
      rtl433Process = spawn('rtl_433', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Set up output handlers to write to log file and capture data
      
      if (rtl433Process.stdout) {
        rtl433Process.stdout.on('data', (data) => {
          const output = data.toString();
          
          // Write to log file for streaming
          appendFileSync(logFile, output);
          
          // Store output for in-memory access (you could use a more sophisticated approach)
          global.rtl433Output = global.rtl433Output || [];
          global.rtl433Output.push({
            timestamp: new Date().toISOString(),
            data: output
          });
          
          // Keep only last 100 entries to prevent memory issues
          if (global.rtl433Output.length > 100) {
            global.rtl433Output.shift();
          }
        });
      }

      if (rtl433Process.stderr) {
        rtl433Process.stderr.on('data', (data) => {
          const output = data.toString();
          
          // Write to log file
          appendFileSync(logFile, output);
          
          global.rtl433Output = global.rtl433Output || [];
          global.rtl433Output.push({
            timestamp: new Date().toISOString(),
            data: output
          });
        });
      }

      if (rtl433Process.pid) {
        return json({ 
          success: true, 
          message: 'RTL_433 started successfully',
          pid: rtl433Process.pid 
        });
      } else {
        return json({ 
          success: false, 
          message: 'Failed to start RTL_433 process' 
        }, { status: 500 });
      }

    } else if (action === 'stop') {
      try {
        // First, try to stop the tracked process
        if (rtl433Process) {
          try {
            rtl433Process.kill('SIGTERM');
            rtl433Process = null;
          } catch (error) {
            console.error('Error stopping tracked process:', error);
          }
        }
        
        // Then kill any remaining RTL_433 processes (including sudo processes)
        await execAsync('sudo pkill -f "rtl_433" 2>/dev/null || true');
        // Also kill the sudo wrapper process
        await execAsync('sudo pkill -f "sudo.*rtl_433" 2>/dev/null || true');
        
        // Wait for processes to terminate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return json({ 
          success: true, 
          message: 'RTL_433 stopped successfully' 
        });
      } catch (error) {
        console.error('Error stopping RTL_433:', error);
        // Even if there's an error, the process might have stopped
        // Check if it's actually stopped
        try {
          const { stdout } = await execAsync('ps aux | grep "[r]tl_433" | grep -v grep || echo ""');
          if (!stdout.trim()) {
            return json({ 
              success: true, 
              message: 'RTL_433 stopped successfully' 
            });
          }
        } catch (e) {
          // Continue with error
        }
        
        return json({ 
          success: false, 
          message: 'Failed to stop RTL_433 process' 
        }, { status: 500 });
      }
    }

    return json({ 
      success: false, 
      message: 'Invalid action' 
    }, { status: 400 });

  } catch (error) {
    console.error('RTL_433 control error:', error);
    return json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
};