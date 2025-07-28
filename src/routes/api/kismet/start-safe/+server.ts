import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
    try {
        // First, stop any existing Kismet instance
        await execAsync('sudo systemctl stop kismet').catch(() => {});
        
        // Use the no-auto-source configuration
        await execAsync('sudo cp ./scripts/kismet-no-auto-source.conf /etc/kismet/kismet_site.conf');
        
        // Reset the wireless adapter
        const adapterCheck = await execAsync("ip link show | grep -E 'wlx[0-9a-f]{10}' | cut -d: -f2 | tr -d ' ' | head -1");
        const adapter = adapterCheck.stdout.trim();
        
        if (adapter) {
            await execAsync(`sudo ifconfig ${adapter} down`).catch(() => {});
            await execAsync('sleep 1');
            await execAsync(`sudo ifconfig ${adapter} up`).catch(() => {});
        }
        
        // Start Kismet
        await execAsync('sudo systemctl start kismet');
        
        // Wait for Kismet to initialize
        await execAsync('sleep 5');
        
        // Check if Kismet is running
        const status = await execAsync('sudo systemctl is-active kismet');
        const isActive = status.stdout.trim() === 'active';
        
        if (!isActive) {
            const logs = await execAsync('sudo journalctl -u kismet -n 10 --no-pager');
            return json({
                success: false,
                message: 'Kismet failed to start',
                logs: logs.stdout
            }, { status: 500 });
        }
        
        return json({
            success: true,
            message: 'Kismet started successfully',
            adapter: adapter || 'none',
            url: 'http://localhost:2501'
        });
        
    } catch (error) {
        console.error('Failed to start Kismet:', error);
        return json({
            success: false,
            message: 'Failed to start Kismet',
            error: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}