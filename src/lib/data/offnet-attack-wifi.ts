/**
 * OFFNET ATTACK wireless exploitation tool categories:
 * - WiFi Disruption & Exploitation (Denial + Handshake Capture)
 * - Rogue Access Point & Credential Capture
 * - Bluetooth & BLE Exploitation
 */

import type { ToolCategory } from '$lib/types/tools';

import { createTool } from './tool-factory';
import { toolIcons } from './tool-icons';

/** WiFi Disruption & Exploitation subcategory */
export const wifiDisruption: ToolCategory = {
	id: 'wifi-disruption',
	name: 'WiFi Disruption & Exploitation',
	description: 'Break into or shut down WiFi networks',
	icon: toolIcons.wifi,
	children: [
		{
			id: 'wifi-denial-deauth',
			name: 'Denial & Deauthentication',
			description: 'Kick devices off WiFi networks and disrupt wireless communications',
			icon: toolIcons.wifi,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool({
					id: 'aireplay-ng',
					name: 'Aireplay-NG',
					description:
						'Packet injection for deauthentication, WPA handshake capture, and fragmentation attacks',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'mdk4',
					name: 'mdk4',
					description:
						'Multi-mode WiFi DoS: beacon flooding, deauthentication, SSID brute force',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'block',
					name: 'Bl0ck',
					description:
						'WiFi 5/6 QoS Data frame interruption exploiting Block Ack frame vulnerabilities (802.11ac/ax)',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'scapy-80211',
					name: 'Scapy 802.11',
					description:
						'Custom 802.11 frame crafting for beacon injection, spoofing, and deauth',
					icon: toolIcons.wifi,
					deployment: 'native'
				})
			]
		},
		{
			id: 'handshake-capture',
			name: 'Handshake Capture & Cracking',
			description: 'Capture WiFi passwords and break into protected networks',
			icon: toolIcons.wifi,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool(
					{
						id: 'wifite2',
						name: 'Wifite2',
						description:
							'Automated WiFi auditing chaining handshake capture, PMKID, WPS, and cracking',
						icon: toolIcons.wifite,
						deployment: 'native'
					},
					{ isInstalled: true, viewName: 'wifite', canOpen: true }
				),
				createTool({
					id: 'hcxdumptool',
					name: 'HCXDumpTool',
					description: 'PMKID and WPA handshake capture without client deauthentication',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'airgeddon',
					name: 'Airgeddon',
					description:
						'Menu-driven WiFi multi-attack suite orchestrating handshake capture, WPS, and evil twin',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'wef',
					name: 'WEF',
					description:
						'Automated WiFi exploitation framework with guided workflows for common attacks',
					icon: toolIcons.wifi,
					deployment: 'native'
				}),
				createTool({
					id: 'fragattacks',
					name: 'FragAttacks',
					description:
						'802.11 protocol flaw exploitation for fragmentation and aggregation vulnerabilities',
					icon: toolIcons.wifi,
					deployment: 'docker'
				})
			]
		}
	]
};

/** Rogue Access Point & Credential Capture subcategory */
export const rogueAp: ToolCategory = {
	id: 'rogue-ap',
	name: 'Rogue Access Point & Credential Capture',
	description:
		'Create fake WiFi networks that targets connect to, then capture their credentials',
	icon: toolIcons.wifi,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'wifi-pumpkin3',
			name: 'WiFi Pumpkin3',
			description:
				'Rogue AP framework with MITM interception, SSL stripping, and DNS spoofing',
			icon: toolIcons.wifi,
			deployment: 'docker'
		}),
		createTool({
			id: 'wifiphisher',
			name: 'Wifiphisher',
			description: 'Automated rogue AP framework with social engineering phishing templates',
			icon: toolIcons.wifi,
			deployment: 'native'
		}),
		createTool({
			id: 'wifi-pineapple-pi',
			name: 'WiFi Pineapple Pi',
			description: 'Rogue AP, MITM, captive portal, and credential harvesting platform',
			icon: toolIcons.wifi,
			deployment: 'docker'
		}),
		createTool({
			id: 'eaphammer',
			name: 'EAPHammer',
			description:
				'WPA2-Enterprise evil twin targeting 802.1X/EAP networks for credential harvesting',
			icon: toolIcons.wifi,
			deployment: 'native'
		}),
		createTool({
			id: 'fluxion',
			name: 'Fluxion',
			description:
				'Automated evil twin + captive portal social engineering for WPA/WPA2 password capture',
			icon: toolIcons.wifi,
			deployment: 'native'
		})
	]
};

/** Bluetooth & BLE Exploitation subcategory */
export const btBleExploit: ToolCategory = {
	id: 'bt-ble-exploit',
	name: 'Bluetooth & BLE Exploitation',
	description: 'Attack Bluetooth devices to extract data or disrupt connections',
	icon: toolIcons.bluetooth,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'bluesnarfer',
			name: 'BlueSnarfer',
			description:
				'Bluetooth OBEX exploitation for unauthorized access to phonebooks, SMS, and files',
			icon: toolIcons.bluetooth,
			deployment: 'docker'
		}),
		createTool({
			id: 'bluetoolkit',
			name: 'BlueToolkit',
			description:
				'Bluetooth Classic/BLE attack framework with vulnerability scanning and exploit execution',
			icon: toolIcons.bluetooth,
			deployment: 'docker'
		}),
		createTool({
			id: 'bluing',
			name: 'Bluing',
			description:
				'Bluetooth Classic/BLE reconnaissance with service enumeration, vulnerability scanning, and JSON output',
			icon: toolIcons.bluetooth,
			deployment: 'docker'
		}),
		createTool({
			id: 'mirage-framework',
			name: 'Mirage Framework',
			description:
				'Multi-protocol wireless attack framework supporting BLE, ZigBee, Mosart, and IR',
			icon: toolIcons.bluetooth,
			deployment: 'docker'
		})
	]
};
