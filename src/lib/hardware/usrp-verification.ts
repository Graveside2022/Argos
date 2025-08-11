import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function execWithUHDEnvironment(
	command: string
): Promise<{ stdout: string; stderr: string }> {
	// Set up UHD environment variables
	const env = {
		...process.env,
		UHD_IMAGES_DIR: '/usr/share/uhd/images',
		LD_LIBRARY_PATH: '/usr/lib:/usr/local/lib'
	};

	return execAsync(command, { env });
}

export async function detectUSRPHardware(): Promise<boolean> {
	try {
		const { stdout } = await execWithUHDEnvironment('uhd_find_devices');
		return stdout.includes('type:') && !stdout.includes('No UHD Devices Found');
	} catch (error) {
		console.error('USRP detection failed:', error);
		return false;
	}
}

export function createUHDEnvironment(): Record<string, string> {
	return {
		UHD_IMAGES_DIR: '/usr/share/uhd/images',
		LD_LIBRARY_PATH: '/usr/lib:/usr/local/lib',
		PYTHONPATH: '/usr/local/lib/python3/dist-packages'
	};
}
