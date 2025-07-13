// Kismet service management
import { exec } from 'child_process';
import { promisify } from 'util';
import type { KismetServiceStatus } from './types';

const execAsync = promisify(exec);

export class KismetServiceManager {
  private static readonly SERVICE_NAME = 'kismet';
  private static readonly START_SCRIPT = '/home/pi/Scripts/start_kismet.sh';
  private static readonly PID_FILE = '/home/pi/tmp/kismet.pid';
  private static readonly LOG_FILE = '/home/pi/tmp/kismet.log';

  /**
   * Get the current status of the Kismet service
   */
  static async getStatus(): Promise<KismetServiceStatus> {
    try {
      // Check if Kismet is running using pgrep
      const { stdout: pgrepOutput } = await execAsync('pgrep -f "kismet"');
      const pids = pgrepOutput.trim().split('\n').filter(Boolean);
      
      if (pids.length === 0) {
        return { running: false };
      }

      const pid = parseInt(pids[0]);
      
      // Get process info
      const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o %cpu,%mem,etimes --no-headers`);
      const [cpu, memory, uptime] = psOutput.trim().split(/\s+/).map(parseFloat);

      return {
        running: true,
        pid,
        cpu,
        memory,
        uptime: Math.floor(uptime)
      };
    } catch (error) {
      return {
        running: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start the Kismet service
   */
  static async start(): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.getStatus();
      if (status.running) {
        return { success: false, message: 'Kismet is already running' };
      }

      // Execute the start script
      await execAsync(this.START_SCRIPT);
      
      // Wait a moment for the service to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify it started
      const newStatus = await this.getStatus();
      if (newStatus.running) {
        return { success: true, message: 'Kismet started successfully' };
      } else {
        return { success: false, message: 'Failed to start Kismet' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to start Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Stop the Kismet service
   */
  static async stop(): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.getStatus();
      if (!status.running) {
        return { success: false, message: 'Kismet is not running' };
      }

      // Kill the Kismet process
      await execAsync('pkill -f "kismet"');
      
      // Wait a moment for the service to stop
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify it stopped
      const newStatus = await this.getStatus();
      if (!newStatus.running) {
        return { success: true, message: 'Kismet stopped successfully' };
      } else {
        return { success: false, message: 'Failed to stop Kismet' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Restart the Kismet service
   */
  static async restart(): Promise<{ success: boolean; message: string }> {
    try {
      const stopResult = await this.stop();
      if (stopResult.success || stopResult.message === 'Kismet is not running') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await this.start();
      } else {
        return stopResult;
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to restart Kismet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get recent log entries
   */
  static async getLogs(lines: number = 100): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`tail -n ${lines} ${this.LOG_FILE}`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      return [`Error reading logs: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }
}