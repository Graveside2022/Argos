import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import * as bettercapClient from '$lib/server/bettercap/apiClient';
import { resourceManager } from '$lib/server/hardware/resourceManager';
import { HardwareDevice } from '$lib/server/hardware/types';
import * as alfaMgr from '$lib/server/hardware/alfaManager';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { action, mode, command } = (await request.json()) as {
			action: string;
			mode?: string;
			command?: string;
		};

		if (action === 'start') {
			// Determine the interface BEFORE starting the container.
			// Bettercap with --network host auto-selects eth0 (the default route).
			// wifi.recon then tries to put eth0 into monitor mode:
			//   1. ip link set eth0 down  ← kills all connectivity
			//   2. iw dev eth0 set type monitor  ← fails (not wireless)
			//   3. eth0 stays down, SSH/Tailscale/everything dead
			let targetIface: string | undefined;

			if (mode === 'wifi-recon') {
				const result = await resourceManager.acquire('bettercap', HardwareDevice.ALFA);
				if (!result.success) {
					return json(
						{
							success: false,
							error: `ALFA in use by ${result.owner}`,
							owner: result.owner
						},
						{ status: 409 }
					);
				}

				const alfaIface = await alfaMgr.detectAdapter();
				if (!alfaIface) {
					await resourceManager.release('bettercap', HardwareDevice.ALFA);
					return json(
						{
							success: false,
							error: 'ALFA adapter not found. Connect an external WiFi adapter.'
						},
						{ status: 404 }
					);
				}
				targetIface = alfaIface;
			} else if (mode === 'net-recon') {
				// net.recon needs eth0 for ARP scanning — safe, no monitor mode
				targetIface = 'eth0';
			}
			// ble-recon: no -iface needed, uses hci0 bluetooth device

			await bettercapClient.startContainer(targetIface);

			// Wait for bettercap API to be ready (poll instead of fixed delay)
			const apiReady = await bettercapClient.waitForApi(15000);
			if (!apiReady) {
				await bettercapClient.stopContainer();
				if (mode === 'wifi-recon') {
					await resourceManager.release('bettercap', HardwareDevice.ALFA);
				}
				return json(
					{
						success: false,
						error: 'Bettercap API failed to start. Container may need rebuilding.'
					},
					{ status: 503 }
				);
			}

			// Enable modules based on mode
			if (mode === 'wifi-recon') {
				// Double-set the interface via API as belt-and-suspenders.
				// The -iface flag at startup should have set it, but verify.
				const setResult = await bettercapClient.runCommand(
					`set wifi.interface ${targetIface}`
				);
				if (setResult === null) {
					await bettercapClient.stopContainer();
					await resourceManager.release('bettercap', HardwareDevice.ALFA);
					return json(
						{
							success: false,
							error: 'Failed to set wifi interface to ALFA adapter. Aborting to protect network.'
						},
						{ status: 500 }
					);
				}

				// Verify it took effect
				const verifyResult = await bettercapClient.runCommand('get wifi.interface');
				const verifyStr = JSON.stringify(verifyResult ?? '').toLowerCase();
				if (!verifyStr.includes(targetIface!)) {
					await bettercapClient.stopContainer();
					await resourceManager.release('bettercap', HardwareDevice.ALFA);
					return json(
						{
							success: false,
							error: `Interface verification failed. Expected ${targetIface}. Aborting to protect network.`
						},
						{ status: 500 }
					);
				}

				await bettercapClient.runCommand('wifi.recon on');
			} else if (mode === 'ble-recon') {
				await bettercapClient.runCommand('ble.recon on');
			} else if (mode === 'net-recon') {
				await bettercapClient.runCommand('net.recon on');
			}

			return json({ success: true, message: `Bettercap started in ${mode} mode` });
		} else if (action === 'stop') {
			await bettercapClient.runCommand('wifi.recon off');
			await bettercapClient.runCommand('ble.recon off');
			await bettercapClient.stopContainer();

			await resourceManager.release('bettercap', HardwareDevice.ALFA);

			return json({ success: true, message: 'Bettercap stopped' });
		} else if (action === 'command' && command) {
			const cmd = command.trim().toLowerCase();

			// Block commands that would touch the Pi's built-in WiFi (wlan0)
			if (cmd.includes('wifi.interface') && cmd.includes('wlan0')) {
				return json(
					{
						success: false,
						error: 'Cannot target wlan0 — that is the Pi built-in WiFi managed by NetworkManager.'
					},
					{ status: 403 }
				);
			}

			// If user manually types wifi.recon on, ensure ALFA interface is set first
			if (cmd.startsWith('wifi.recon on') || cmd === 'wifi.recon on') {
				const alfaIface = await alfaMgr.detectAdapter();
				if (!alfaIface) {
					return json(
						{
							success: false,
							error: 'ALFA adapter not found. Cannot start wifi.recon without external adapter.'
						},
						{ status: 404 }
					);
				}
				const setResult = await bettercapClient.runCommand(
					`set wifi.interface ${alfaIface}`
				);
				if (setResult === null) {
					return json(
						{
							success: false,
							error: 'Failed to pin wifi interface to ALFA. Refusing wifi.recon to protect NetworkManager.'
						},
						{ status: 500 }
					);
				}
			}

			const result = await bettercapClient.runCommand(command);
			return json({ success: true, result });
		} else {
			return json({ success: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		return json({ success: false, error: (error as Error).message }, { status: 500 });
	}
};
