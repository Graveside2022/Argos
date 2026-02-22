/**
 * OFFNET RECON tracking and collection tool categories:
 * - Aircraft & Maritime Tracking
 * - Satellite Signal Intelligence
 * - Pager & Analog Signal Decoding
 * - IoT & Sub-GHz Signal Collection
 * - Drone & UAS Detection
 * - RF Device Fingerprinting & Geolocation
 */

import type { ToolCategory } from '$lib/types/tools';

import { toolIcons } from './tool-icons';

/** Aircraft & Maritime Tracking subcategory */
export const aircraftMaritime: ToolCategory = {
	id: 'aircraft-maritime',
	name: 'Aircraft & Maritime Tracking',
	description: 'Track aircraft positions and ship movements from their radio broadcasts',
	icon: toolIcons.drone,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'acarsdec',
			name: 'acarsdec',
			description:
				'ACARS multi-channel decoder for aircraft VHF text messages (position reports, weather, comms)',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'ais-catcher',
			name: 'AIS Catcher',
			description:
				'High-performance AIS maritime vessel tracking via RTL-SDR with VHF signal decoding',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'dump1090',
			name: 'Dump1090',
			description:
				'Industry-standard ADS-B 1090 MHz decoder for real-time aircraft position plotting',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'dumpvdl2',
			name: 'dumpvdl2',
			description:
				'VDL Mode 2 message decoder for CPDLC, ADS-C, and digital aviation datalink intelligence',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'readsb',
			name: 'ReadSB',
			description:
				'ARM-optimized ADS-B decoder with 30-50% lower CPU than dump1090 (drop-in replacement)',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'tar1090',
			name: 'Tar1090',
			description:
				'Enhanced ADS-B web visualization with interactive mapping, trail history, and range rings',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		}
	]
};

/** Satellite Signal Intelligence subcategory */
export const satelliteSigint: ToolCategory = {
	id: 'satellite-sigint',
	name: 'Satellite Signal Intelligence',
	description: 'Capture and decode signals from satellites overhead',
	icon: toolIcons.rfSpectrum,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'gr-iridium',
			name: 'gr-iridium',
			description:
				'Iridium satellite burst detector and demodulator for L-band satellite SIGINT (1626 MHz)',
			icon: toolIcons.rfSpectrum,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'gr-satellites',
			name: 'gr-satellites',
			description:
				'GNU Radio decoder for 100+ amateur and research satellite telemetry protocols',
			icon: toolIcons.rfSpectrum,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		}
	]
};

/** Pager & Analog Signal Decoding subcategory */
export const pagerAnalog: ToolCategory = {
	id: 'pager-analog',
	name: 'Pager & Analog Signal Decoding',
	description: 'Decode pager messages, emergency alerts, and legacy radio signals',
	icon: toolIcons.rfSpectrum,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'multimon-ng',
			name: 'multimon-ng',
			description:
				'Multi-protocol decoder: POCSAG pagers, FLEX, EAS alerts, DTMF, AFSK/APRS, Morse, ZVEI',
			icon: toolIcons.rfSpectrum,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'pagermon',
			name: 'Pagermon',
			description: 'POCSAG/FLEX pager signal monitoring and decoding with web interface',
			icon: toolIcons.pagermon,
			isInstalled: true,
			deployment: 'native',
			viewName: 'pagermon',
			canOpen: true,
			shouldShowControls: false
		}
	]
};

/** IoT & Sub-GHz Signal Collection subcategory */
export const iotSubghzCollection: ToolCategory = {
	id: 'iot-subghz-collection',
	name: 'IoT & Sub-GHz Signal Collection',
	description: 'Pick up transmissions from sensors, smart devices, and LoRa networks',
	icon: toolIcons.iot,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'rtl-433',
			name: 'RTL-433',
			description: 'ISM band decoder for 280+ IoT device protocols (433/315/868/915 MHz)',
			icon: toolIcons.rtl433,
			isInstalled: true,
			deployment: 'native',
			viewName: 'rtl-433',
			canOpen: true,
			shouldShowControls: false
		},
		{
			id: 'sdr-lora',
			name: 'SDR-Lora',
			description:
				'LoRa PHY-layer SDR implementation with GNU Radio for signal generation and analysis',
			icon: toolIcons.iot,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'zigator',
			name: 'Zigator',
			description:
				'ZigBee traffic analysis and visualization with protocol dissection and encryption analysis',
			icon: toolIcons.iot,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		}
	]
};

/** Drone & UAS Detection subcategory */
export const droneUasDetection: ToolCategory = {
	id: 'drone-uas-detection',
	name: 'Drone & UAS Detection',
	description: 'Detect and identify drones operating in your area',
	icon: toolIcons.drone,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'drone-id',
			name: 'Drone ID',
			description: 'Passive DJI DroneID decoding from WiFi traffic',
			icon: toolIcons.droneid,
			isInstalled: true,
			deployment: 'native',
			viewName: 'droneid',
			canOpen: true,
			shouldShowControls: false
		},
		{
			id: 'dronesecurity',
			name: 'DroneSecurity',
			description: 'Passive DJI DroneID protocol reverse-engineering and decoder',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'rf-drone-detection',
			name: 'RF-Drone-Detection',
			description: 'Passive RF drone detection using GNU Radio with ML classification',
			icon: toolIcons.drone,
			isInstalled: false,
			deployment: 'docker',
			canOpen: false,
			shouldShowControls: false
		}
	]
};

/** RF Device Fingerprinting & Geolocation subcategory */
export const rfFingerprintingGeo: ToolCategory = {
	id: 'rf-fingerprinting-geo',
	name: 'RF Device Fingerprinting & Geolocation',
	description: 'Locate and identify specific RF emitters by their unique signal characteristics',
	icon: toolIcons.geolocation,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'atakrr',
			name: 'ATAKrr',
			description:
				'AI/ML RF device fingerprinting with automatic modulation classification and CoT output',
			icon: toolIcons.geolocation,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'find-lf',
			name: 'Find-LF',
			description:
				'Distributed WiFi device positioning using multiple RPi sensor nodes for passive triangulation',
			icon: toolIcons.geolocation,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'trackerjacker',
			name: 'TrackerJacker',
			description:
				'Passive WiFi device tracker via probe request sniffing for covert location monitoring',
			icon: toolIcons.geolocation,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		}
	]
};
