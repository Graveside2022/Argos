import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    const status = {
      grgsm: {
        running: false,
        pid: null as number | null,
        frequency: '948.6 MHz'
      },
      gsmevil: {
        running: false,
        pid: null as number | null,
        webInterface: false
      },
      dataCollection: {
        active: false,
        lastActivity: null as string | null,
        packetsReceived: 0
      }
    };

    // Check gr-gsm_livemon (without --collector flag)
    try {
      const { stdout: grgsmCheck } = await execAsync('ps aux | grep -E "grgsm_livemon_headless" | grep -v grep | head -1');
      if (grgsmCheck.trim()) {
        const parts = grgsmCheck.trim().split(/\s+/);
        const pid = parseInt(parts[1]);
        if (!isNaN(pid)) {
          status.grgsm.running = true;
          status.grgsm.pid = pid;
        }
      }
    } catch {
      // Not running
    }

    // Check GSMEvil2 with exact match (including auto version)
    try {
      const { stdout: gsmevilCheck } = await execAsync('ps aux | grep -E "python3? GsmEvil(_auto)?\\.py" | grep -v grep | head -1');
      if (gsmevilCheck.trim()) {
        const parts = gsmevilCheck.trim().split(/\s+/);
        const pid = parseInt(parts[1]);
        if (!isNaN(pid)) {
          status.gsmevil.running = true;
          status.gsmevil.pid = pid;
          
          // Check if web interface is accessible
          try {
            const { stdout: curlCheck } = await execAsync('timeout 1 curl -s -o /dev/null -w "%{http_code}" http://localhost:80 2>/dev/null || echo "000"');
            status.gsmevil.webInterface = curlCheck.trim() === '200';
          } catch {
            status.gsmevil.webInterface = false;
          }
        }
      }
    } catch {
      // Not running
    }

    // If both are running, assume data collection is active
    if (status.grgsm.running && status.gsmevil.running) {
      status.dataCollection.active = true;
      status.dataCollection.lastActivity = 'Active';
    }

    // Determine overall status
    const overallStatus = status.grgsm.running && status.gsmevil.running ? 'running' : 'stopped';

    return json({
      status: overallStatus,
      details: status,
      message: overallStatus === 'running' 
        ? 'GSM Evil is running and monitoring'
        : 'GSM Evil is stopped'
    });
  } catch (error: unknown) {
    console.error('Status check error:', error);
    return json({
      status: 'error',
      message: 'Failed to check GSM Evil status',
      error: (error as Error).message
    }, { status: 500 });
  }
};