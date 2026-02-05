/**
 * Complete tool hierarchy for Argos
 * Organized as: TOOLS → OFFNET → Categories → Subcategories → Individual Tools
 */

import type { ToolHierarchy, ToolCategory, ToolDefinition } from '$lib/types/tools';
import { toolIcons } from './toolIcons';

export const toolHierarchy: ToolHierarchy = {
	root: {
		id: 'offnet',
		name: 'OFFNET',
		description: 'Passive/Active Recon & Attacks - Not Connected to Target',
		children: [
			// RF & SPECTRUM
			{
				id: 'rf-spectrum',
				name: 'RF & SPECTRUM',
				icon: toolIcons.rfSpectrum,
				children: [
					// Bluetooth
					{
						id: 'bluetooth',
						name: 'Bluetooth',
						icon: toolIcons.bluetooth,
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'btle-scanner',
								name: 'BTLE Scanner',
								description: 'Bluetooth Low Energy scanner and analyzer',
								icon: toolIcons.btle,
								installed: true,
								deployment: 'native',
								viewName: 'btle',
								canOpen: true,
								showControls: false
							},
							{
								id: 'bluefang',
								name: 'BlueFang',
								description: 'Bluetooth device fingerprinting and reconnaissance',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'bluesnarfer',
								name: 'BlueSnarfer',
								description: 'Bluetooth device data extraction tool',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'bluetoolkit',
								name: 'BlueToolkit',
								description: 'Comprehensive Bluetooth security testing suite',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'bluing',
								name: 'Bluing',
								description: 'Bluetooth intelligence gathering tool',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'braktooth',
								name: 'BrakTooth',
								description: 'Bluetooth vulnerability exploitation framework',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'bsniffhub',
								name: 'BSniffHub',
								description: 'Bluetooth traffic sniffing and analysis hub',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'btlejack',
								name: 'BTLEJack',
								description: 'Bluetooth Low Energy hijacking tool',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'butterfly',
								name: 'Butterfly',
								description: 'Bluetooth fuzzing and testing framework',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'mirage-framework',
								name: 'Mirage Framework',
								description:
									'Wireless security assessment framework (Bluetooth/Zigbee)',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'nrf-sniffer',
								name: 'NRF Sniffer',
								description: 'Nordic nRF Bluetooth Low Energy sniffer',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'nrf52-attack-toolkit',
								name: 'NRF52 Attack Toolkit',
								description: 'Security testing toolkit for nRF52 devices',
								icon: toolIcons.bluetooth,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					// Software Defined Radio (SDR)
					{
						id: 'sdr',
						name: 'Software Defined Radio',
						icon: toolIcons.sdr,
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'fissure',
								name: 'Fissure',
								description: 'RF analysis and attack framework',
								icon: toolIcons.sdr,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'gqrx-spectrum',
								name: 'GQRX Spectrum',
								description: 'Software defined radio receiver',
								icon: toolIcons.sdr,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'hackrf-spectrum',
								name: 'HackRF Spectrum',
								description: 'Wideband spectrum analysis and signal hunting',
								icon: toolIcons.hackrf,
								installed: true,
								deployment: 'native',
								viewName: 'hackrf',
								canOpen: true,
								showControls: false
							},
							{
								id: 'inspectrum',
								name: 'Inspectrum',
								description: 'RF signal analysis and visualization tool',
								icon: toolIcons.sdr,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'openwebrx',
								name: 'OpenWebRX',
								description: 'SDR web interface for HackRF spectrum analysis',
								icon: toolIcons.external,
								installed: true,
								deployment: 'external',
								viewName: 'openwebrx',
								canOpen: true,
								showControls: false
							},
							{
								id: 'qspectrumanalyzer',
								name: 'QSpectrumAnalyzer',
								description: 'Real-time spectrum analyzer with waterfall display',
								icon: toolIcons.sdr,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rf-emitter',
								name: 'RF Emitter',
								description: 'HackRF signal transmission and RF testing',
								icon: toolIcons.rfemitter,
								installed: true,
								deployment: 'native',
								viewName: 'rf-emitter',
								canOpen: true,
								showControls: false
							},
							{
								id: 'rfsec-toolkit',
								name: 'RFSEC Toolkit',
								description: 'RF security analysis toolkit',
								icon: toolIcons.sdr,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'universal-radio-hacker',
								name: 'Universal Radio Hacker',
								description: 'Wireless protocol analysis',
								icon: toolIcons.external,
								installed: true,
								deployment: 'external',
								externalUrl: 'http://localhost:8080',
								canOpen: true,
								showControls: false
							},
							{
								id: 'usrp-sweep',
								name: 'USRP Sweep',
								description: 'USRP wideband spectrum sweep analyzer',
								icon: toolIcons.usrpsweep,
								installed: true,
								deployment: 'native',
								viewName: 'usrpsweep',
								canOpen: true,
								showControls: false
							}
						]
					},
					// IoT/RFID/Zigbee
					{
						id: 'iot-rfid-zigbee',
						name: 'IoT/RFID/Zigbee',
						icon: toolIcons.iot,
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'attify-zigbee',
								name: 'Attify Zigbee',
								description: 'Zigbee security testing framework',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'cleverjam-rfid',
								name: 'CleverJam (RFID)',
								description: 'RFID jamming and security testing',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'iot-exploits',
								name: 'IoT Exploits',
								description: 'IoT device exploitation framework',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'jamrf-rfid',
								name: 'JamRF (RFID)',
								description: 'RFID interference and jamming tool',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'killerbee',
								name: 'KillerBee',
								description: 'IEEE 802.15.4/Zigbee security research toolkit',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'laf-lora',
								name: 'Laf-Lora',
								description: 'LoRa network analysis and testing',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'mqtt-pwn',
								name: 'MQTT-PWN',
								description: 'MQTT protocol security testing tool',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'pagermon',
								name: 'Pagermon',
								description: 'Pager signal monitoring and decoding',
								icon: toolIcons.pagermon,
								installed: true,
								deployment: 'native',
								viewName: 'pagermon',
								canOpen: true,
								showControls: false
							},
							{
								id: 'proxmark3-rfid',
								name: 'ProxMark3 (RFID)',
								description: 'RFID/NFC research and testing platform',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rfcat',
								name: 'RFCAT',
								description: 'Sub-GHz transceiver control library',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rfcrack-rfid',
								name: 'RFCrack (RFID)',
								description: 'RFID cracking and analysis tool',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rfid-subghz',
								name: 'RFID SubGHz',
								description: 'Sub-GHz RFID analysis toolkit',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rtl-433',
								name: 'RTL-433',
								description: 'ISM band device decoder (433 MHz)',
								icon: toolIcons.rtl433,
								installed: true,
								deployment: 'native',
								viewName: 'rtl-433',
								canOpen: true,
								showControls: false
							},
							{
								id: 'sdr-lora',
								name: 'SDR-Lora',
								description: 'LoRa signal analysis with SDR',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'z3sec',
								name: 'Z3Sec',
								description: 'Zigbee security assessment tool',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'zigator',
								name: 'Zigator',
								description: 'Zigbee security testing framework',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'zigdiggity',
								name: 'ZigDiggity',
								description: 'Zigbee hacking toolkit',
								icon: toolIcons.iot,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					// Drones & Aircraft
					{
						id: 'drones-aircraft',
						name: 'Drones & Aircraft',
						icon: toolIcons.drone,
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'drone-defeat',
								name: 'Drone Defeat',
								description: 'Counter-drone systems and techniques',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'drone-detection',
								name: 'Drone Detection',
								description: 'Detect and track nearby drones',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'drone-id',
								name: 'Drone ID',
								description: 'Remote drone identification and tracking',
								icon: toolIcons.droneid,
								installed: true,
								deployment: 'native',
								viewName: 'droneid',
								canOpen: true,
								showControls: false
							},
							{
								id: 'aircraft-ship-tracking',
								name: 'Aircraft Ship Tracking',
								description: 'ADS-B and AIS tracking integration',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'ais-catcher',
								name: 'AIS Catcher',
								description: 'Automatic Identification System receiver',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'dump1090',
								name: 'Dump1090',
								description: 'ADS-B Mode S decoder for aircraft tracking',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'readsb',
								name: 'ReadSB',
								description: 'Mode-S/ADS-B/TIS decoder',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'tar1090',
								name: 'Tar1090',
								description: 'Web interface for ADS-B aircraft tracking',
								icon: toolIcons.drone,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					// Electromagnetic
					{
						id: 'electromagnetic',
						name: 'Electromagnetic',
						icon: toolIcons.electromagnetic,
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'tempestsdr',
								name: 'TempestSDR',
								description: 'TEMPEST electromagnetic eavesdropping',
								icon: toolIcons.external,
								installed: true,
								deployment: 'external',
								externalUrl: 'http://localhost:8081',
								canOpen: true,
								showControls: false
							}
						]
					}
				]
			},
			// WIFI
			{
				id: 'wifi',
				name: 'WIFI',
				icon: toolIcons.wifi,
				children: [
					// Reconnaissance
					{
						id: 'wifi-reconnaissance',
						name: 'Reconnaissance',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'kismet-wifi',
								name: 'Kismet WiFi',
								description:
									'WiFi scanning, device tracking, and network intelligence',
								icon: toolIcons.kismet,
								installed: true,
								deployment: 'native',
								viewName: 'kismet',
								canOpen: true,
								showControls: true
							},
							{
								id: 'wigletotak',
								name: 'WigleToTAK',
								description: 'WiGLE data integration for TAK systems',
								icon: toolIcons.wigletotak,
								installed: true,
								deployment: 'native',
								viewName: 'wigletotak',
								canOpen: true,
								showControls: false
							},
							{
								id: 'wifiphisher',
								name: 'WiFiPhisher',
								description: 'Rogue access point and phishing framework',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					// Attacks & Exploitation
					{
						id: 'wifi-attacks',
						name: 'Attacks & Exploitation',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'airgeddon',
								name: 'Airgeddon',
								description: 'Multi-use WiFi security auditing toolkit',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'aireplay-ng',
								name: 'Aireplay-NG',
								description: 'WiFi packet injection and deauthentication',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'bettercap',
								name: 'Bettercap',
								description: 'Network attack and monitoring framework',
								icon: toolIcons.bettercap,
								installed: true,
								deployment: 'native',
								viewName: 'bettercap',
								canOpen: true,
								showControls: false
							},
							{
								id: 'block',
								name: 'Block',
								description: 'WiFi jamming and blocking tool',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'eaphammer',
								name: 'EAPHammer',
								description: 'Targeted evil twin attacks against WPA2-Enterprise',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'fluxion',
								name: 'Fluxion',
								description: 'Automated MITM WPA/WPA2 attack framework',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'fragattacks',
								name: 'FragAttacks',
								description: 'WiFi fragmentation and aggregation attacks',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'hashcat',
								name: 'Hashcat',
								description: 'Advanced password recovery and cracking',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'hcxdumptool',
								name: 'HCXDumpTool',
								description: 'WiFi packet capture for hashcat',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'mdk4',
								name: 'MDK4',
								description: 'WiFi testing and attack toolkit',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'scapy-80211',
								name: 'SCAPY-80211',
								description: 'WiFi packet crafting and analysis',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wefr',
								name: 'WEFR',
								description: 'WiFi exploitation framework',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wifi-exploits',
								name: 'WiFi Exploits',
								description: 'Collection of WiFi vulnerability exploits',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wifi-injection-tester',
								name: 'WiFi Injection Tester',
								description: 'Test WiFi adapter injection capabilities',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wifi-pumpkin3',
								name: 'WiFi Pumpkin3',
								description: 'Rogue AP framework and MITM tool',
								icon: toolIcons.wifi,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wifite2',
								name: 'Wifite2',
								description: 'Automated wireless network attack tool',
								icon: toolIcons.wifite,
								installed: true,
								deployment: 'native',
								viewName: 'wifite',
								canOpen: true,
								showControls: false
							}
						]
					},
					// Counter-UAS
					{
						id: 'counter-uas',
						name: 'Counter-UAS',
						description: 'See Drone Defeat in RF & Spectrum section',
						collapsible: false,
						children: []
					}
				]
			},
			// CELLULAR
			{
				id: 'cellular',
				name: 'CELLULAR',
				icon: toolIcons.cellular,
				children: [
					{
						id: 'imsi-operations',
						name: 'IMSI Operations',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'imsi-catching',
								name: 'IMSI Catching',
								description: 'IMSI catcher operations and detection',
								icon: toolIcons.cellular,
								installed: false,
								deployment: 'incompatible',
								canOpen: false,
								showControls: false
							},
							{
								id: 'imsi-defense',
								name: 'IMSI Defense',
								description: 'IMSI catcher detection and defense',
								icon: toolIcons.cellular,
								installed: false,
								deployment: 'incompatible',
								canOpen: false,
								showControls: false
							}
						]
					},
					{
						id: 'gsm-mobile-attacks',
						name: 'GSM/Mobile Attacks',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'gsm-evil',
								name: 'GSM Evil',
								description: 'GSM signal monitoring and IMSI detection',
								icon: toolIcons.gsm,
								installed: true,
								deployment: 'native',
								viewName: 'gsm-evil',
								canOpen: true,
								showControls: true
							}
						]
					}
				]
			},
			// NETWORK RECONNAISSANCE
			{
				id: 'network-reconnaissance',
				name: 'NETWORK RECONNAISSANCE',
				icon: toolIcons.network,
				collapsible: true,
				defaultExpanded: false,
				children: [
					{
						id: 'bettercap-net',
						name: 'Bettercap',
						description: 'Network attack and monitoring framework',
						icon: toolIcons.bettercap,
						installed: true,
						deployment: 'native',
						viewName: 'bettercap',
						canOpen: true,
						showControls: false
					},
					{
						id: 'cryptolyzer',
						name: 'CryptoLyzer',
						description: 'SSL/TLS protocol analyzer',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'ettercap',
						name: 'Ettercap',
						description: 'Network sniffing and MITM attacks',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'ndpi',
						name: 'NDPI',
						description: 'Deep packet inspection library',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'network-recon',
						name: 'Network Recon',
						description: 'Network reconnaissance toolkit',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'p0f',
						name: 'P0f',
						description: 'Passive OS fingerprinting tool',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'responder',
						name: 'Responder',
						description: 'LLMNR/NBT-NS/MDNS poisoner',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'satori',
						name: 'Satori',
						description: 'Device fingerprinting and identification',
						icon: toolIcons.network,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					}
				]
			},
			// ATTACK HARDWARE
			{
				id: 'attack-hardware',
				name: 'ATTACK HARDWARE',
				icon: toolIcons.hardware,
				collapsible: true,
				defaultExpanded: false,
				children: [
					{
						id: 'esp32-marauder',
						name: 'ESP32 Marauder',
						description: 'ESP32 WiFi attack and testing toolkit',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'esp8266-deauther',
						name: 'ESP8266 Deauther',
						description: 'WiFi deauthentication device',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'flipper-zero-unleashed',
						name: 'Flipper Zero Unleashed',
						description: 'Multi-tool device for security research',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'lora-attack-toolkit',
						name: 'LoRa Attack Toolkit',
						description: 'LoRa network security testing',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'm5stack-wifi-toolkit',
						name: 'M5Stack WiFi Toolkit',
						description: 'M5Stack-based WiFi security tools',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'minigotchi',
						name: 'MiniGotchi',
						description: 'Portable Pwnagotchi alternative',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'pwnagotchi',
						name: 'PwnAGotchi',
						description: 'AI-powered WiFi handshake capture',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					},
					{
						id: 'wifi-pineapple-shrimp',
						name: 'WiFi Pineapple Shrimp',
						description: 'Portable pentesting platform',
						icon: toolIcons.hardware,
						installed: false,
						deployment: 'native',
						canOpen: false,
						showControls: false
					}
				]
			},
			// KEYBOARD/MOUSE ATTACKS
			{
				id: 'keyboard-mouse-attacks',
				name: 'KEYBOARD/MOUSE ATTACKS',
				icon: toolIcons.keyboard,
				collapsible: true,
				defaultExpanded: false,
				children: [
					{
						id: 'keyboard-mouse-attacks',
						name: 'Keyboard Mouse Attacks',
						description: 'HID injection and BadUSB attacks',
						icon: toolIcons.keyboard,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'mousejack',
						name: 'MouseJack',
						description: 'Wireless mouse and keyboard hijacking',
						icon: toolIcons.keyboard,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					}
				]
			},
			// EM EAVESDROPPING
			{
				id: 'em-eavesdropping',
				name: 'EM EAVESDROPPING',
				icon: toolIcons.electromagnetic,
				collapsible: true,
				defaultExpanded: false,
				children: [
					{
						id: 'em-eavesdropping',
						name: 'EM Eavesdropping',
						description: 'Electromagnetic emanation analysis',
						icon: toolIcons.electromagnetic,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'tempestsdr-em',
						name: 'TempestSDR',
						description: 'TEMPEST electromagnetic eavesdropping',
						icon: toolIcons.external,
						installed: true,
						deployment: 'external',
						externalUrl: 'http://localhost:8081',
						canOpen: true,
						showControls: false
					}
				]
			},
			// RF GEOLOCATION
			{
				id: 'rf-geolocation',
				name: 'RF GEOLOCATION',
				icon: toolIcons.geolocation,
				collapsible: true,
				defaultExpanded: false,
				children: [
					{
						id: 'df-aggregator',
						name: 'DF Aggregator',
						description: 'Direction finding data aggregation',
						icon: toolIcons.geolocation,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'krakensdr',
						name: 'KrakenSDR',
						description: 'Multi-channel direction finding system',
						icon: toolIcons.geolocation,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'rf-geolocation',
						name: 'RF Geolocation',
						description: 'RF signal geolocation toolkit',
						icon: toolIcons.geolocation,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					},
					{
						id: 'rtl-coherent',
						name: 'RTL Coherent',
						description: 'Coherent RTL-SDR direction finding',
						icon: toolIcons.geolocation,
						installed: false,
						deployment: 'docker',
						canOpen: false,
						showControls: false
					}
				]
			},
			// COUNTER-ATTACK (C-ATAK)
			{
				id: 'counter-attack',
				name: 'COUNTER-ATTACK (C-ATAK)',
				icon: toolIcons.counterAttack,
				children: [
					{
						id: 'cot-gateways',
						name: 'CoT Gateways',
						description: 'Cursor on Target protocol gateways',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'adsbcot',
								name: 'ADSBCot',
								description: 'ADS-B to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'aiscot',
								name: 'AISCot',
								description: 'AIS to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'aprscot',
								name: 'APRSCot',
								description: 'APRS to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'cot-gateways-general',
								name: 'CoT-Gateways',
								description: 'General CoT gateway framework',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'djicot',
								name: 'DJICot',
								description: 'DJI drone to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'dronecot',
								name: 'DroneCot',
								description: 'Drone telemetry to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'inrcot',
								name: 'InrCot',
								description: 'INR to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'spotcot',
								name: 'SpotCot',
								description: 'SPOT tracker to CoT gateway',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					{
						id: 'meshtastic-integration',
						name: 'Meshtastic Integration',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'meshtastic-attacks',
								name: 'Meshtastic Attacks',
								description: 'Meshtastic network security testing',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'meshtastic-freq-calc',
								name: 'Meshtastic Frequency Calculator',
								description: 'Calculate Meshtastic frequencies',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					{
						id: 'rf-fingerprinting',
						name: 'RF Fingerprinting',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'atakrr',
								name: 'ATAKrr',
								description: 'ATAK radio reconnaissance',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'find-lf',
								name: 'Find-LF',
								description: 'Low frequency signal detection',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'rf-fingerprinting-tool',
								name: 'RF Fingerprinting',
								description: 'RF device fingerprinting toolkit',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'sigider',
								name: 'SigIDer',
								description: 'Signal identification and classification',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					},
					{
						id: 'tak-protocol-tools',
						name: 'TAK Protocol Tools',
						collapsible: true,
						defaultExpanded: false,
						children: [
							{
								id: 'cotproxy',
								name: 'CoTProxy',
								description: 'CoT protocol proxy and router',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'push-cursor-on-target',
								name: 'Push Cursor on Target',
								description: 'CoT data injection tool',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'pytak',
								name: 'PyTAK',
								description: 'Python TAK library and tools',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'tak-protocol-tools-general',
								name: 'TAK Protocol Tools',
								description: 'General TAK protocol utilities',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'takproto',
								name: 'TAKProto',
								description: 'TAK protobuf definitions',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							},
							{
								id: 'wireshark-tak-dissector',
								name: 'Wireshark TAK Dissector',
								description: 'Wireshark plugin for TAK protocol analysis',
								icon: toolIcons.counterAttack,
								installed: false,
								deployment: 'docker',
								canOpen: false,
								showControls: false
							}
						]
					}
				]
			}
		]
	}
};

/**
 * Helper to find category/tool by navigation path
 */
export function findByPath(
	path: string[],
	root: ToolCategory
): ToolCategory | ToolDefinition | null {
	if (path.length === 0) return root;

	let current: ToolCategory | ToolDefinition = root;
	for (const id of path) {
		if ('children' in current) {
			const found = current.children.find((child) => child.id === id);
			if (!found) return null;
			current = found;
		} else {
			return null;
		}
	}
	return current;
}

/**
 * Helper to count tools in a category (installed vs total)
 */
export function countTools(category: ToolCategory): { installed: number; total: number } {
	let installed = 0;
	let total = 0;

	for (const child of category.children) {
		if ('children' in child) {
			const childCount = countTools(child);
			installed += childCount.installed;
			total += childCount.total;
		} else {
			total++;
			if (child.installed) installed++;
		}
	}

	return { installed, total };
}
