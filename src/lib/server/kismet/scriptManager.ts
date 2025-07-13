// Kismet script management
import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import { readdir, stat, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import type { KismetScript, ScriptExecutionResult } from './types';

const execAsync = promisify(exec);

export class ScriptManager {
  private static readonly SCRIPTS_DIR = '/home/pi/Scripts';
  private static readonly STINKY_DIR = '/home/pi/stinky';
  private static runningScripts = new Map<string, { pid: number; process: ChildProcess }>();

  /**
   * List available scripts
   */
  static async listScripts(): Promise<KismetScript[]> {
    const scripts: KismetScript[] = [];
    
    try {
      // Get scripts from both directories
      const scriptDirs = [this.SCRIPTS_DIR, this.STINKY_DIR];
      
      for (const dir of scriptDirs) {
        try {
          const files = await readdir(dir);
          
          for (const file of files) {
            if (file.endsWith('.sh') || file.endsWith('.py')) {
              const fullPath = join(dir, file);
              const _stats = await stat(fullPath);
              
              // Check if executable
              let executable = false;
              try {
                await access(fullPath, constants.X_OK);
                executable = true;
              } catch {
                // Ignore access errors for executable check
              }
              
              // Check if script is running
              const running = this.runningScripts.has(fullPath);
              const pid = running ? this.runningScripts.get(fullPath)?.pid : undefined;
              
              scripts.push({
                name: file,
                path: fullPath,
                description: this.getScriptDescription(file),
                executable,
                running,
                pid
              });
            }
          }
        } catch (error) {
          console.error(`Error reading directory ${dir}:`, error);
        }
      }
      
      return scripts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error listing scripts:', error);
      throw error;
    }
  }

  /**
   * Execute a script
   */
  static async executeScript(scriptPath: string): Promise<ScriptExecutionResult> {
    try {
      // Validate script exists and is executable
      await access(scriptPath, constants.F_OK | constants.X_OK);
      
      // Check if already running
      if (this.runningScripts.has(scriptPath)) {
        return {
          success: false,
          error: 'Script is already running'
        };
      }
      
      // Spawn the script
      const child = spawn(scriptPath, [], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Store the running process
      this.runningScripts.set(scriptPath, {
        pid: child.pid || 0,
        process: child
      });
      
      // Collect output
      let _output = '';
      let _error = '';
      
      child.stdout?.on('data', (data) => {
        _output += String(data);
      });
      
      child.stderr?.on('data', (data) => {
        _error += String(data);
      });
      
      // Handle process exit
      child.on('exit', (_code) => {
        this.runningScripts.delete(scriptPath);
      });
      
      // Return immediately for long-running scripts
      return {
        success: true,
        pid: child.pid || 0,
        output: 'Script started successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop a running script
   */
  static async stopScript(scriptPath: string): Promise<ScriptExecutionResult> {
    try {
      const running = this.runningScripts.get(scriptPath);
      if (!running) {
        return {
          success: false,
          error: 'Script is not running'
        };
      }
      
      // Try graceful shutdown first
      process.kill(running.pid, 'SIGTERM');
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if still running and force kill if needed
      try {
        process.kill(running.pid, 0); // Check if process exists
        process.kill(running.pid, 'SIGKILL');
      } catch {
        // Process already terminated
      }
      
      this.runningScripts.delete(scriptPath);
      
      return {
        success: true,
        output: 'Script stopped successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get script execution history from logs
   */
  static async getScriptHistory(limit: number = 50): Promise<Array<{ timestamp?: string; message: string }>> {
    try {
      // Read from various log files
      const { stdout } = await execAsync(
        `grep -h "script\\|Script" /home/pi/tmp/*.log 2>/dev/null | tail -n ${limit}`
      );
      
      return stdout.trim().split('\n').filter(Boolean).map(line => {
        // Parse log lines (simplified)
        const match = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.+)/);
        if (match) {
          return {
            timestamp: match[1],
            message: match[2]
          };
        }
        return { message: line };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get a description for known scripts
   */
  private static getScriptDescription(filename: string): string {
    const descriptions: Record<string, string> = {
      'start_kismet.sh': 'Start Kismet WiFi monitoring',
      'gps_kismet_wigle.sh': 'Start GPS, Kismet, and WigleToTAK services',
      'test-hackrf.sh': 'Test HackRF hardware',
      'test-hackrf-reception.sh': 'Test HackRF reception',
      'mavgps.py': 'MAVLink to GPSD bridge',
      'WigleToTak2.py': 'Convert Kismet data to TAK format',
      'spectrum_analyzer.py': 'HackRF spectrum analyzer'
    };
    
    return descriptions[filename] || '';
  }
}