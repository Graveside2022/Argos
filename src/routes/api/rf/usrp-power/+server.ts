import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { validateNumericParam, InputValidationError } from '$lib/server/security/input-sanitizer';

const execFileAsync = promisify(execFile);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as {
			frequency: number;
			gain?: number;
			duration?: number;
		};

		// Validate all numeric parameters — prevents shell injection
		const frequency = validateNumericParam(body.frequency, 'frequency', 70e6, 6e9);
		const gain = validateNumericParam(body.gain ?? 70, 'gain', 0, 89);
		const duration = validateNumericParam(body.duration ?? 0.5, 'duration', 0.1, 300);

		console.log(`[USRP Power] Measuring power at ${frequency} MHz with gain ${gain}`);

		// execFile does NOT invoke a shell — immune to injection
		const { stdout, stderr } = await execFileAsync(
			'timeout',
			[
				'10',
				'python3',
				'./scripts/usrp_power_measure_real.py',
				'-f',
				String(frequency),
				'-g',
				String(gain),
				'-d',
				String(duration)
			],
			{ timeout: 15000 }
		);

		console.log(`[USRP Power] stdout: "${stdout.trim()}"`);
		if (stderr) {
			console.log(`[USRP Power] stderr: "${stderr.trim()}"`);
		}

		// Parse the power measurement from output: "947.4 MHz: -78.1 dBm"
		const powerMatch = stdout.match(/([-\d.]+)\s*dBm/);
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
			return json(
				{
					error: 'Failed to parse power measurement',
					output: stdout
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		if (error instanceof InputValidationError) {
			return json({ error: error.message }, { status: 400 });
		}
		console.error('[USRP Power] Measurement failed:', error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		return json(
			{
				error: 'USRP power measurement failed',
				details: errorMessage
			},
			{ status: 500 }
		);
	}
};
