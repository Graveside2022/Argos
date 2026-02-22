/**
 * OFFNET RECON signal-oriented tool categories:
 * - Spectrum Analysis & Monitoring
 * - WiFi & Bluetooth Device Discovery
 * - Cellular & Trunked Radio Interception
 */

import type { ToolCategory } from '$lib/types/tools';

import { toolIcons } from './tool-icons';

/** Spectrum Analysis & Monitoring subcategory */
export const spectrumAnalysis: ToolCategory = {
	id: 'spectrum-analysis',
	name: 'Spectrum Analysis & Monitoring',
	description: "Scan radio frequencies to see what's transmitting nearby",
	icon: toolIcons.sdr,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'hackrf-spectrum',
			name: 'HackRF Spectrum',
			description:
				'Argos built-in wideband spectrum analyzer using hackrf_sweep (1 MHz\u20136 GHz)',
			icon: toolIcons.hackrf,
			isInstalled: true,
			deployment: 'native',
			viewName: 'hackrf',
			canOpen: true,
			shouldShowControls: false
		},
		{
			id: 'openwebrx',
			name: 'OpenWebRX',
			description:
				'Multi-user web-based SDR receiver with browser demodulation for multiple SDR hardware',
			icon: toolIcons.external,
			isInstalled: true,
			deployment: 'docker',
			viewName: 'openwebrx',
			canOpen: true,
			shouldShowControls: true
		},
		{
			id: 'qspectrumanalyzer',
			name: 'QSpectrumAnalyzer',
			description:
				'PyQt5 real-time spectrum analyzer supporting hackrf_sweep, rtl_power, and SoapySDR backends',
			icon: toolIcons.sdr,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		}
	]
};

/** WiFi & Bluetooth Device Discovery subcategory */
export const wifiBtDiscovery: ToolCategory = {
	id: 'wifi-bt-discovery',
	name: 'WiFi & Bluetooth Device Discovery',
	description: 'Detect and map wireless devices without connecting to them',
	icon: toolIcons.wifi,
	collapsible: true,
	defaultExpanded: false,
	children: [
		{
			id: 'kismet-wifi',
			name: 'Kismet WiFi',
			description:
				'Passive wireless sniffer for WiFi, Bluetooth, and RF with device fingerprinting and GPS logging',
			icon: toolIcons.kismet,
			isInstalled: true,
			deployment: 'native',
			viewName: 'kismet',
			canOpen: true,
			shouldShowControls: true
		},
		{
			id: 'btle-scanner',
			name: 'BTLE Scanner',
			description:
				'Passive BLE device discovery monitoring advertisement packets with RSSI and geolocation',
			icon: toolIcons.btle,
			isInstalled: true,
			deployment: 'native',
			viewName: 'btle',
			canOpen: true,
			shouldShowControls: false
		},
		{
			id: 'sparrow-wifi',
			name: 'Sparrow-WiFi',
			description: 'WiFi/Bluetooth spectrum analyzer with GPS hunt mode for field wardriving',
			icon: toolIcons.wifi,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'wigle',
			name: 'WiGLE',
			description:
				'Crowdsourced wireless network geolocation database and OSINT enrichment API',
			icon: toolIcons.wifi,
			isInstalled: false,
			deployment: 'native',
			canOpen: false,
			shouldShowControls: false
		},
		{
			id: 'wigletotak',
			name: 'WigleToTAK',
			description:
				'Flask bridge converting WiGLE wardriving data to TAK CoT messages for SA overlay',
			icon: toolIcons.wigletotak,
			isInstalled: true,
			deployment: 'native',
			viewName: 'wigletotak',
			canOpen: true,
			shouldShowControls: false
		}
	]
};

/** Cellular & Trunked Radio Interception subcategory */
export const cellularTrunked: ToolCategory = {
	id: 'cellular-trunked',
	name: 'Cellular & Trunked Radio Interception',
	description: 'Monitor cellular towers and land mobile radio systems',
	icon: toolIcons.cellular,
	children: [
		{
			id: 'gsm-lte-monitoring',
			name: 'GSM & LTE Monitoring',
			description: 'Intercept and decode cellular network traffic from the air',
			icon: toolIcons.cellular,
			collapsible: true,
			defaultExpanded: false,
			children: [
				{
					id: 'gr-gsm',
					name: 'gr-gsm',
					description:
						'GNU Radio blocks for receiving, decoding, and analyzing GSM transmissions',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'gsm-evil',
					name: 'GSM Evil',
					description: 'GSM signal monitoring and IMSI detection',
					icon: toolIcons.gsm,
					isInstalled: true,
					deployment: 'native',
					viewName: 'gsm-evil',
					canOpen: true,
					shouldShowControls: true
				},
				{
					id: 'imsi-catcher-oros42',
					name: 'IMSI-catcher (Oros42)',
					description: 'Lightweight passive IMSI collection using RTL-SDR and gr-gsm',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'docker',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'kalibrate-hackrf',
					name: 'Kalibrate-hackrf',
					description: 'GSM base station scanner and SDR frequency calibration tool',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'srsran',
					name: 'srsRAN',
					description:
						'Open-source 4G LTE and 5G NR software radio suite with passive sniffer mode',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'docker',
					canOpen: false,
					shouldShowControls: false
				}
			]
		},
		{
			id: 'trunked-radio-decoding',
			name: 'Trunked Radio Decoding',
			description:
				'Listen to P25, DMR, and TETRA radio systems used by military and first responders',
			icon: toolIcons.cellular,
			collapsible: true,
			defaultExpanded: false,
			children: [
				{
					id: 'trunk-recorder',
					name: 'trunk-recorder',
					description:
						'Records and decodes calls from P25 & SmartNet trunked radio systems with multi-SDR support',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'docker',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'dsd-neo',
					name: 'dsd-neo',
					description:
						'Modern digital voice decoder: DMR, P25, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'op25',
					name: 'OP25',
					description:
						'Open source P25 trunked radio decoder with real-time audio and web UI',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				},
				{
					id: 'osmo-tetra',
					name: 'osmo-tetra',
					description:
						'TETRA protocol decoder with voice and SDS message decoding for European military/emergency radio',
					icon: toolIcons.cellular,
					isInstalled: false,
					deployment: 'native',
					canOpen: false,
					shouldShowControls: false
				}
			]
		}
	]
};
