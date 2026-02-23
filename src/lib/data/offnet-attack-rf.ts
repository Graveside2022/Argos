/**
 * OFFNET ATTACK RF and kinetic tool categories:
 * - Drone Defeat & GPS Spoofing
 * - RF Jamming & Spectrum Denial
 * - IoT & Sub-GHz Exploitation
 * - TAK Network Exploitation
 */

import type { ToolCategory } from '$lib/types/tools';

import { createTool } from './tool-factory';
import { toolIcons } from './tool-icons';

/** Drone Defeat & GPS Spoofing subcategory */
export const droneDefeatGps: ToolCategory = {
	id: 'drone-defeat-gps',
	name: 'Drone Defeat & GPS Spoofing',
	description: 'Take control of or disable drones by exploiting their communications',
	icon: toolIcons.drone,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'dronesploit',
			name: 'DroneSploit',
			description: 'Modular drone exploitation framework with MAVLink/DJI protocol attacks',
			icon: toolIcons.drone,
			deployment: 'docker'
		}),
		createTool({
			id: 'gps-sdr-sim',
			name: 'GPS-SDR-SIM',
			description: 'GPS L1 C/A signal simulator for generating spoofed GPS signals via SDR',
			icon: toolIcons.drone,
			deployment: 'docker'
		})
	]
};

/** RF Jamming & Spectrum Denial subcategory */
export const rfJamming: ToolCategory = {
	id: 'rf-jamming',
	name: 'RF Jamming & Spectrum Denial',
	description: 'Block radio communications across targeted frequency bands',
	icon: toolIcons.rfSpectrum,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'cleverjam-rfid',
			name: 'CleverJam',
			description:
				'Smart RF jammer with adaptive frequency targeting and power control for wireless disruption',
			icon: toolIcons.rfSpectrum,
			deployment: 'native'
		}),
		createTool({
			id: 'jamrf-rfid',
			name: 'JamRF',
			description:
				'Broadband RF jamming with proactive/reactive modes, swept-sine, and Gaussian noise',
			icon: toolIcons.rfSpectrum,
			deployment: 'native'
		})
	]
};

/** IoT & Sub-GHz Exploitation subcategory */
export const iotSubghzExploit: ToolCategory = {
	id: 'iot-subghz-exploit',
	name: 'IoT & Sub-GHz Exploitation',
	description: 'Attack IoT devices, key fobs, and LoRa networks',
	icon: toolIcons.iot,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'rfcrack-rfid',
			name: 'RFCrack',
			description:
				'Sub-GHz replay, brute force, and jamming for garage doors, key fobs, and IoT (300-928 MHz)',
			icon: toolIcons.iot,
			deployment: 'native'
		}),
		createTool({
			id: 'laf-lora',
			name: 'LoRa Attack Toolkit (LAF)',
			description:
				'LoRaWAN security auditing with packet injection, replay, and gateway impersonation',
			icon: toolIcons.iot,
			deployment: 'docker'
		})
	]
};

/** TAK Network Exploitation subcategory */
export const takExploit: ToolCategory = {
	id: 'tak-exploit',
	name: 'TAK Network Exploitation',
	description: 'Disrupt or deceive adversary TAK command and control systems',
	icon: toolIcons.counterAttack,
	children: [
		{
			id: 'cot-injection',
			name: 'CoT Message Injection & Manipulation',
			description: 'Inject false positions or modify messages on enemy TAK networks',
			icon: toolIcons.counterAttack,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool({
					id: 'cotproxy',
					name: 'CoTProxy',
					description:
						'In-line CoT transformation proxy for intercepting, modifying, and re-routing TAK messages',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'push-cursor-on-target',
					name: 'Push Cursor on Target',
					description:
						'CLI tool for injecting fabricated CoT position and event data into TAK networks',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				})
			]
		},
		{
			id: 'meshtastic-targeting',
			name: 'Meshtastic Targeting',
			description: 'Identify and target Meshtastic LoRa mesh networks',
			icon: toolIcons.counterAttack,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool({
					id: 'meshtastic-freq-calc',
					name: 'Meshtastic Frequency Calculator',
					description:
						'Computes exact LoRa frequency slots from Meshtastic channel names for precision RF targeting',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				})
			]
		}
	]
};
