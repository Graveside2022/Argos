/**
 * ONNET tool category: tools that require a connection to the target network
 * - Network Reconnaissance & Fingerprinting
 * - Network Attack & Credential Capture
 */

import type { ToolCategory } from '$lib/types/tools';

import { toolIcons } from './tool-icons';

/** ONNET top-level category with all on-network tools */
export const onnetCategory: ToolCategory = {
	id: 'onnet',
	name: 'ONNET',
	description: 'Tools that require a connection to the target network',
	icon: toolIcons.network,
	children: [
		{
			id: 'net-recon-fingerprint',
			name: 'Network Reconnaissance & Fingerprinting',
			description:
				"Identify devices, operating systems, and services on a network you've accessed",
			icon: toolIcons.network,
			collapsible: true,
			defaultExpanded: false,
			children: [
				{
					id: 'p0f',
					name: 'p0f',
					description:
						'Passive OS fingerprinting from TCP/IP stack behavior without generating traffic',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'ndpi',
					name: 'nDPI',
					description:
						'Deep packet inspection identifying 300+ application protocols from network traffic',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'satori',
					name: 'Satori',
					description: 'Device fingerprinting via DHCP, CDP, mDNS, and UPnP signatures',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'cryptolyzer',
					name: 'CryptoLyzer',
					description:
						'TLS/SSL cipher suite and certificate analysis for cryptographic vulnerability detection',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				}
			]
		},
		{
			id: 'net-attack-credential',
			name: 'Network Attack & Credential Capture',
			description: 'Intercept traffic and steal credentials from devices on the same network',
			icon: toolIcons.network,
			collapsible: true,
			defaultExpanded: false,
			children: [
				{
					id: 'ettercap',
					name: 'Ettercap',
					description:
						'Network MITM framework for ARP poisoning, DNS spoofing, and credential sniffing',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'responder',
					name: 'Responder',
					description:
						'LLMNR/NBT-NS/mDNS poisoner for NTLMv2 hash and credential capture from Windows hosts',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'bettercap',
					name: 'Bettercap',
					description: 'Network attack and monitoring framework',
					icon: toolIcons.bettercap,
					isInstalled: true,
					deployment: 'native',
					viewName: 'bettercap',
					canOpen: true,
					shouldShowControls: false
				},
				{
					id: 'mqtt-pwn',
					name: 'MQTT-PWN',
					description:
						'MQTT broker exploitation with topic enumeration, credential brute-forcing, and message injection',
					icon: toolIcons.network,
					isInstalled: false,
					deployment: 'docker',
					canOpen: false,
					shouldShowControls: false
				}
			]
		}
	]
};
