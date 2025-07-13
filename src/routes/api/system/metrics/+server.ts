import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export const GET: RequestHandler = async () => {
  try {
    const metrics = await getSystemMetrics();
    return json(metrics);
  } catch (error: unknown) {
    console.error('Failed to get system metrics:', error);
    return json(
      { error: 'Failed to get system metrics' },
      { status: 500 }
    );
  }
};

async function getSystemMetrics() {
  const [cpu, memory, disk, temperature, network] = await Promise.all([
    getCPUUsage(),
    getMemoryUsage(),
    getDiskUsage(),
    getCPUTemperature(),
    getNetworkStats()
  ]);

  return {
    cpu: {
      usage: cpu,
      temperature
    },
    memory,
    disk,
    network,
    timestamp: Date.now()
  };
}

async function getCPUUsage(): Promise<number> {
  try {
    // Get CPU usage percentage
    const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    return parseFloat(stdout.trim()) || 0;
  } catch {
    // Fallback to Node.js os module
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }
}

function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    total: totalMem,
    used: usedMem,
    free: freeMem,
    percentage: (usedMem / totalMem) * 100
  };
}

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync("df -B1 / | tail -1 | awk '{print $2,$3,$4}'");
    const [total, used, available] = stdout.trim().split(' ').map(Number);
    
    return {
      total,
      used,
      available,
      percentage: (used / total) * 100
    };
  } catch {
    return {
      total: 0,
      used: 0,
      available: 0,
      percentage: 0
    };
  }
}

async function getCPUTemperature(): Promise<number | undefined> {
  try {
    // Try Raspberry Pi temperature
    const { stdout } = await execAsync('vcgencmd measure_temp');
    const match = stdout.match(/temp=(\d+\.?\d*)/);
    if (match) {
      return parseFloat(match[1]);
    }
  } catch {
    try {
      // Try thermal zone (works on many Linux systems)
      const temp = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf-8');
      return parseInt(temp) / 1000;
    } catch {
      return undefined;
    }
  }
}

async function getNetworkStats() {
  try {
    // Get network interface stats
    const { stdout } = await execAsync("cat /proc/net/dev | grep -E 'wlan|eth' | head -1");
    const parts = stdout.trim().split(/\s+/);
    
    if (parts.length >= 10) {
      return {
        rx: parseInt(parts[1]) || 0, // Received bytes
        tx: parseInt(parts[9]) || 0, // Transmitted bytes
        errors: (parseInt(parts[2]) || 0) + (parseInt(parts[10]) || 0)
      };
    }
  } catch {
    // Fallback
  }
  
  return {
    rx: 0,
    tx: 0,
    errors: 0
  };
}