import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json() as {
            frequency: number;
            gain?: number;
            duration?: number;
        };
        
        const frequency = body.frequency;
        const gain = body.gain || 70; // Default to max gain for B205 Mini
        const duration = body.duration || 0.5; // Default 500ms measurement
        
        if (!frequency || frequency <= 0) {
            return json({ 
                error: 'Invalid frequency parameter' 
            }, { status: 400 });
        }
        
        // Use the same USRP power measurement script as GSM Evil
        const command = `timeout 10 python3 /home/ubuntu/projects/Argos/scripts/usrp_power_measure_real.py -f ${frequency} -g ${gain} -d ${duration}`;
        
        console.log(`[USRP Power] Measuring power at ${frequency} MHz with gain ${gain}`);
        
        const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
        
        console.log(`[USRP Power] stdout: "${stdout.trim()}"`);
        if (stderr) {
            console.log(`[USRP Power] stderr: "${stderr.trim()}"`);
        }
        
        // Parse the power measurement from output: "947.4 MHz: -78.1 dBm"
        const powerMatch = stdout.match(/([-\d\.]+)\s*dBm/);
        if (powerMatch) {
            const power = parseFloat(powerMatch[1]);
            console.log(`[USRP Power] Successfully measured: ${power} dBm`);
            return json({ 
                power: power,
                frequency: frequency,
                unit: 'dBm'
            });
        } else {
            console.error(`[USRP Power] No power value found in output: "${stdout}"`);
            return json({ 
                error: 'Failed to parse power measurement',
                output: stdout
            }, { status: 500 });
        }
        
    } catch (error) {
        console.error('[USRP Power] Measurement failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return json({ 
            error: 'USRP power measurement failed',
            details: errorMessage
        }, { status: 500 });
    }
};