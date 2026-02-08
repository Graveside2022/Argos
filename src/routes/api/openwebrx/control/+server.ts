import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import { resourceManager } from '$lib/server/hardware/resource-manager';
import { HardwareDevice } from '$lib/server/hardware/types';

const execAsync = promisify(exec);
const CONTAINER_NAME = 'openwebrx-hackrf';
// All names the resource manager might assign to OpenWebRX ownership
const OPENWEBRX_OWNERS = ['openwebrx', 'openwebrx-hackrf', 'soapy_connector'];

async function isContainerRunning(): Promise<boolean> {
	try {
		const { stdout } = await execAsync(
			`docker ps --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" 2>/dev/null`
		);
		return stdout.trim().length > 0;
	} catch (_error: unknown) {
		return false;
	}
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const { stdout } = await execAsync(
				`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/ 2>/dev/null`
			);
			if (stdout.trim() === '200' || stdout.trim() === '301' || stdout.trim() === '302') {
				return true;
			}
		} catch (_error: unknown) {
			// Not ready yet
		}
		await new Promise((resolve) => setTimeout(resolve, 2000));
	}
	return false;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action } = (await request.json()) as { action: string };

		if (action === 'start') {
			try {
				// Check if OpenWebRX is already running
				const alreadyRunning = await isContainerRunning();
				if (alreadyRunning) {
					return json({
						success: true,
						running: true,
						message: 'OpenWebRX is already running'
					});
				}

				// Acquire HackRF via Resource Manager
				const acquireResult = await resourceManager.acquire(
					'openwebrx',
					HardwareDevice.HACKRF
				);
				if (!acquireResult.success) {
					// If the HackRF is held by OpenWebRX's own processes, treat as already ours
					if (acquireResult.owner && OPENWEBRX_OWNERS.includes(acquireResult.owner)) {
						// Force-take ownership since it's our own stale lock
						await resourceManager.forceRelease(HardwareDevice.HACKRF);
						await resourceManager.acquire('openwebrx', HardwareDevice.HACKRF);
					} else {
						return json(
							{
								success: false,
								message: `HackRF is in use by ${acquireResult.owner}. Stop it first.`,
								owner: acquireResult.owner
							},
							{ status: 409 }
						);
					}
				}

				// Stop hackrf-backend container to free USB device
				await execAsync('docker stop hackrf-backend-dev 2>/dev/null').catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Start OpenWebRX container
				// First try to start existing container, then create new one
				try {
					await execAsync(`docker start ${CONTAINER_NAME} 2>&1`);
				} catch (_error: unknown) {
					// Container doesn't exist - remove stale if any, then create fresh
					await execAsync(`docker rm -f ${CONTAINER_NAME} 2>/dev/null`).catch(() => {});
					await execAsync(
						`docker run -d --name ${CONTAINER_NAME} ` +
							`--privileged ` +
							`-p 8073:8073 ` +
							`-v /dev/bus/usb:/dev/bus/usb ` +
							`-e OPENWEBRX_ADMIN_USER=admin ` +
							`-e OPENWEBRX_ADMIN_PASSWORD=admin ` +
							`--restart no ` +
							`slechev/openwebrxplus:latest 2>&1`
					);
				}

				// Wait for port 8073 to be ready
				const ready = await waitForPort(8073, 45000);

				if (!ready) {
					// Check if container actually started
					const containerRunning = await isContainerRunning();
					// Release on failure
					await resourceManager.release('openwebrx', HardwareDevice.HACKRF);
					// Restart hackrf-backend
					await execAsync('docker start hackrf-backend-dev 2>/dev/null').catch(() => {});

					const hint = containerRunning
						? 'Container is running but port 8073 not responding. Check docker logs openwebrx-hackrf'
						: 'Container failed to start. The Docker image may need to be pulled first: docker pull slechev/openwebrxplus:latest';
					return json(
						{
							success: false,
							message: `OpenWebRX failed to start within timeout. ${hint}`
						},
						{ status: 500 }
					);
				}

				return json({
					success: true,
					running: true,
					message: 'OpenWebRX started successfully'
				});
			} catch (error: unknown) {
				await resourceManager.release('openwebrx', HardwareDevice.HACKRF);
				// Restart hackrf-backend on failure
				await execAsync('docker start hackrf-backend-dev 2>/dev/null').catch(() => {});
				const errMsg = (error as { stderr?: string })?.stderr || (error as Error).message;
				return json(
					{ success: false, message: `Failed to start OpenWebRX: ${errMsg}` },
					{ status: 500 }
				);
			}
		} else if (action === 'stop') {
			try {
				// Stop the container
				await execAsync(`docker stop ${CONTAINER_NAME} 2>/dev/null`).catch(() => {});
				await execAsync('pkill -f soapy_connector 2>/dev/null').catch(() => {});
				await new Promise((resolve) => setTimeout(resolve, 3000));

				// Verify stopped
				const stillRunning = await isContainerRunning();
				if (stillRunning) {
					await execAsync(`docker kill ${CONTAINER_NAME} 2>/dev/null`).catch(() => {});
					await new Promise((resolve) => setTimeout(resolve, 2000));
				}

				// Restart hackrf-backend
				await execAsync('docker start hackrf-backend-dev 2>/dev/null').catch(() => {});

				// Release HackRF — force release since ownership name may vary
				await resourceManager.forceRelease(HardwareDevice.HACKRF);

				return json({
					success: true,
					running: false,
					message: 'OpenWebRX stopped. HackRF released.'
				});
			} catch (error: unknown) {
				await resourceManager.forceRelease(HardwareDevice.HACKRF);
				return json(
					{
						success: false,
						message: 'Failed to stop OpenWebRX',
						error: (error as Error).message
					},
					{ status: 500 }
				);
			}
		} else if (action === 'status') {
			try {
				const running = await isContainerRunning();
				const hwStatus = resourceManager.getStatus();

				return json({
					success: true,
					running,
					hackrfOwner: hwStatus.hackrf.owner,
					hackrfAvailable: hwStatus.hackrf.available,
					message: running ? 'OpenWebRX is running' : 'OpenWebRX is stopped'
				});
			} catch (error: unknown) {
				return json(
					{
						success: false,
						message: 'Failed to check status',
						error: (error as Error).message
					},
					{ status: 500 }
				);
			}
		} else {
			return json(
				{ success: false, message: 'Invalid action. Use "start", "stop", or "status".' },
				{ status: 400 }
			);
		}
	} catch (error: unknown) {
		return json(
			{ success: false, message: 'API error', error: (error as Error).message },
			{ status: 500 }
		);
	}
};
