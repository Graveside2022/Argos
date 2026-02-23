/**
 * OFFNET UTILITIES tool categories:
 * - Signal Recording & Analysis
 * - SDR Infrastructure & Frameworks
 * - Password & Credential Recovery
 * - TAK Integration & Gateways
 */

import type { ToolCategory } from '$lib/types/tools';

import { createTool } from './tool-factory';
import { toolIcons } from './tool-icons';

/** Signal Recording & Analysis subcategory */
export const signalRecording: ToolCategory = {
	id: 'signal-recording',
	name: 'Signal Recording & Analysis',
	description: 'Save and review captured RF signals after collection',
	icon: toolIcons.sdr,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'sigmf',
			name: 'SigMF',
			description:
				'Signal Metadata Format \u2014 standardized JSON sidecar format for IQ signal recordings',
			icon: toolIcons.sdr,
			deployment: 'native'
		}),
		createTool({
			id: 'inspectrum',
			name: 'Inspectrum',
			description:
				'Offline RF signal analysis for visualizing and decoding recorded IQ files',
			icon: toolIcons.sdr,
			deployment: 'native'
		})
	]
};

/** SDR Infrastructure & Frameworks subcategory */
export const sdrInfrastructure: ToolCategory = {
	id: 'sdr-infrastructure',
	name: 'SDR Infrastructure & Frameworks',
	description: 'Configure, connect, and manage your SDR hardware and processing tools',
	icon: toolIcons.sdr,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'soapy-remote',
			name: 'SoapyRemote',
			description:
				'Stream any SoapySDR device over the network for distributed SDR architectures',
			icon: toolIcons.sdr,
			deployment: 'native'
		}),
		createTool({
			id: 'fissure',
			name: 'Fissure',
			description:
				'Comprehensive RF framework with 100+ attack scripts, signal detection, and protocol discovery',
			icon: toolIcons.sdr,
			deployment: 'native'
		}),
		createTool(
			{
				id: 'rfsec-toolkit',
				name: 'RFSEC Toolkit',
				description:
					'Curated RF security tool collection with scripts and documentation organized by SDR hardware',
				icon: toolIcons.sdr,
				deployment: 'native'
			},
			{ isInstalled: true }
		),
		createTool(
			{
				id: 'universal-radio-hacker',
				name: 'Universal Radio Hacker',
				description:
					'Wireless protocol investigation with signal recording, demodulation, and reverse engineering',
				icon: toolIcons.external,
				deployment: 'external'
			},
			{ isInstalled: true, externalUrl: 'http://localhost:8080', canOpen: true }
		),
		createTool(
			{
				id: 'rf-emitter',
				name: 'RF Emitter',
				description:
					'Argos built-in HackRF transmission module for active RF signal generation (1 MHz\u20136 GHz)',
				icon: toolIcons.rfemitter,
				deployment: 'native'
			},
			{ isInstalled: true, viewName: 'rf-emitter', canOpen: true }
		)
	]
};

/** Password & Credential Recovery subcategory */
export const passwordRecovery: ToolCategory = {
	id: 'password-recovery',
	name: 'Password & Credential Recovery',
	description: 'Crack captured password hashes and encrypted credentials offline',
	icon: toolIcons.network,
	collapsible: true,
	defaultExpanded: false,
	children: [
		createTool({
			id: 'hashcat',
			name: 'Hashcat',
			description: 'Password recovery and WPA/WPA2/WPA3 cracking (CPU-only on RPi 5)',
			icon: toolIcons.network,
			deployment: 'docker'
		})
	]
};

/** TAK Integration & Gateways subcategory */
export const takIntegration: ToolCategory = {
	id: 'tak-integration',
	name: 'TAK Integration & Gateways',
	description: 'Connect your sensors and tools to TAK for situational awareness',
	icon: toolIcons.counterAttack,
	children: [
		{
			id: 'cot-sensor-gateways',
			name: 'CoT Sensor Gateways',
			description: 'Feed live aircraft, ship, drone, and tracker data into your TAK server',
			icon: toolIcons.counterAttack,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool({
					id: 'adsbcot',
					name: 'ADSBCot',
					description:
						'ADS-B aircraft tracking to CoT bridge for TAK situational awareness displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'aiscot',
					name: 'AISCot',
					description:
						'AIS maritime vessel data to CoT bridge for TAK situational awareness displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'aprscot',
					name: 'APRSCot',
					description:
						'APRS amateur radio position reports to CoT bridge for TAK displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'djicot',
					name: 'DJICot',
					description:
						'DJI drone telemetry to CoT bridge for TAK drone tracking displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'dronecot',
					name: 'DroneCot',
					description: 'Drone Remote ID detection data to CoT bridge for TAK displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'inrcot',
					name: 'InrCot',
					description:
						'Garmin inReach satellite tracker positions to CoT bridge for TAK displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'spotcot',
					name: 'SpotCot',
					description:
						'Globalstar SPOT satellite tracker positions to CoT bridge for TAK displays',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				})
			]
		},
		{
			id: 'tak-protocol-libs',
			name: 'TAK Protocol Libraries & Analysis',
			description: 'Build, decode, and inspect TAK protocol messages',
			icon: toolIcons.counterAttack,
			collapsible: true,
			defaultExpanded: false,
			children: [
				createTool({
					id: 'pytak',
					name: 'PyTAK',
					description:
						'Python TAK client/server framework for CoT message routing and data gateways',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'takproto',
					name: 'TAKProto',
					description:
						'Pure Python library for encoding/decoding TAK Protocol Protobuf and CoT messages',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				}),
				createTool({
					id: 'wireshark-tak-dissector',
					name: 'Wireshark TAK Dissector',
					description:
						'Lua-based Wireshark dissector for native TAK/CoT protocol traffic analysis',
					icon: toolIcons.counterAttack,
					deployment: 'native'
				})
			]
		}
	]
};
