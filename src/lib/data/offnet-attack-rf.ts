/**
 * OFFNET ATTACK RF and kinetic tool categories:
 * - Drone Defeat & GPS Spoofing
 * - RF Jamming & Spectrum Denial
 * - IoT & Sub-GHz Exploitation
 * - TAK Network Exploitation
 */

import type { ToolCategory } from '$lib/types/tools';

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
		{
			id: 'dronesploit',
			name: 'DroneSploit',
			description: 'Modular drone exploitation framework with MAVLink/DJI protocol attacks',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'gps-sdr-sim',
			name: 'GPS-SDR-SIM',
			description: 'GPS L1 C/A signal simulator for generating spoofed GPS signals via SDR',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		}
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
		{
			id: 'cleverjam-rfid',
			name: 'CleverJam',
			description:
				'Smart RF jammer with adaptive frequency targeting and power control for wireless disruption',
			icon: toolIcons.rfSpectrum,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'jamrf-rfid',
			name: 'JamRF',
			description:
				'Broadband RF jamming with proactive/reactive modes, swept-sine, and Gaussian noise',
			icon: toolIcons.rfSpectrum,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		}
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
		{
			id: 'rfcrack-rfid',
			name: 'RFCrack',
			description:
				'Sub-GHz replay, brute force, and jamming for garage doors, key fobs, and IoT (300-928 MHz)',
			icon: toolIcons.iot,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'laf-lora',
			name: 'LoRa Attack Toolkit (LAF)',
			description:
				'LoRaWAN security auditing with packet injection, replay, and gateway impersonation',
			icon: toolIcons.iot,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		}
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
				{
					id: 'cotproxy',
					name: 'CoTProxy',
					description:
						'In-line CoT transformation proxy for intercepting, modifying, and re-routing TAK messages',
					icon: toolIcons.counterAttack,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'push-cursor-on-target',
					name: 'Push Cursor on Target',
					description:
						'CLI tool for injecting fabricated CoT position and event data into TAK networks',
					icon: toolIcons.counterAttack,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				}
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
				{
					id: 'meshtastic-freq-calc',
					name: 'Meshtastic Frequency Calculator',
					description:
						'Computes exact LoRa frequency slots from Meshtastic channel names for precision RF targeting',
					icon: toolIcons.counterAttack,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				}
			]
		}
	]
};
