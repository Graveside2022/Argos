/**
 * Complete tool hierarchy for Argos
 * Organized as: TOOLS → OFFNET/ONNET → Workflow → Categories → Tools
 */

import type { ToolHierarchy, ToolCategory, ToolDefinition } from '$lib/types/tools';
import { toolIcons } from './tool-icons';

export const toolHierarchy: ToolHierarchy = {
	root: {
		id: 'tools-root',
		name: 'TOOLS',
		children: [
			// ============================================================
			// OFFNET — Tools that work without connecting to a target network
			// ============================================================
			{
				id: 'offnet',
				name: 'OFFNET',
				description: 'Tools that work without connecting to a target network',
				icon: toolIcons.rfSpectrum,
				children: [
					// ────────────────────────────────────────────────────
					// RECON — Find and identify signals, devices, and emitters
					// ────────────────────────────────────────────────────
					{
						id: 'recon',
						name: 'RECON',
						description:
							'Find and identify signals, devices, and emitters in your area',
						icon: toolIcons.rfSpectrum,
						children: [
							// Spectrum Analysis & Monitoring
							{
								id: 'spectrum-analysis',
								name: 'Spectrum Analysis & Monitoring',
								description:
									"Scan radio frequencies to see what's transmitting nearby",
								icon: toolIcons.sdr,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'hackrf-spectrum',
										name: 'HackRF Spectrum',
										description:
											'Argos built-in wideband spectrum analyzer using hackrf_sweep (1 MHz–6 GHz)',
										icon: toolIcons.hackrf,
										installed: true,
										deployment: 'native',
										viewName: 'hackrf',
										canOpen: true,
										showControls: false
									},
									{
										id: 'rf-sweep',
										name: 'RF Sweep',
										description:
											'Argos built-in RF spectrum sweep module supporting HackRF and USRP hardware',
										icon: toolIcons.rfsweep,
										installed: true,
										deployment: 'native',
										viewName: 'rfsweep',
										canOpen: true,
										showControls: false
									},
									{
										id: 'openwebrx',
										name: 'OpenWebRX',
										description:
											'Multi-user web-based SDR receiver with browser demodulation for multiple SDR hardware',
										icon: toolIcons.external,
										installed: true,
										deployment: 'docker',
										viewName: 'openwebrx',
										canOpen: true,
										showControls: true
									},
									{
										id: 'qspectrumanalyzer',
										name: 'QSpectrumAnalyzer',
										description:
											'PyQt5 real-time spectrum analyzer supporting hackrf_sweep, rtl_power, and SoapySDR backends',
										icon: toolIcons.sdr,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// WiFi & Bluetooth Device Discovery
							{
								id: 'wifi-bt-discovery',
								name: 'WiFi & Bluetooth Device Discovery',
								description:
									'Detect and map wireless devices without connecting to them',
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
										installed: true,
										deployment: 'native',
										viewName: 'kismet',
										canOpen: true,
										showControls: true
									},
									{
										id: 'btle-scanner',
										name: 'BTLE Scanner',
										description:
											'Passive BLE device discovery monitoring advertisement packets with RSSI and geolocation',
										icon: toolIcons.btle,
										installed: true,
										deployment: 'native',
										viewName: 'btle',
										canOpen: true,
										showControls: false
									},
									{
										id: 'sparrow-wifi',
										name: 'Sparrow-WiFi',
										description:
											'WiFi/Bluetooth spectrum analyzer with GPS hunt mode for field wardriving',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'wigle',
										name: 'WiGLE',
										description:
											'Crowdsourced wireless network geolocation database and OSINT enrichment API',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'wigletotak',
										name: 'WigleToTAK',
										description:
											'Flask bridge converting WiGLE wardriving data to TAK CoT messages for SA overlay',
										icon: toolIcons.wigletotak,
										installed: true,
										deployment: 'native',
										viewName: 'wigletotak',
										canOpen: true,
										showControls: false
									}
								]
							},
							// Cellular & Trunked Radio Interception
							{
								id: 'cellular-trunked',
								name: 'Cellular & Trunked Radio Interception',
								description:
									'Monitor cellular towers and land mobile radio systems',
								icon: toolIcons.cellular,
								children: [
									// GSM & LTE Monitoring
									{
										id: 'gsm-lte-monitoring',
										name: 'GSM & LTE Monitoring',
										description:
											'Intercept and decode cellular network traffic from the air',
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
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'gsm-evil',
												name: 'GSM Evil',
												description:
													'GSM signal monitoring and IMSI detection',
												icon: toolIcons.gsm,
												installed: true,
												deployment: 'native',
												viewName: 'gsm-evil',
												canOpen: true,
												showControls: true
											},
											{
												id: 'imsi-catcher-oros42',
												name: 'IMSI-catcher (Oros42)',
												description:
													'Lightweight passive IMSI collection using RTL-SDR and gr-gsm',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'docker',
												canOpen: false,
												showControls: false
											},
											{
												id: 'kalibrate-hackrf',
												name: 'Kalibrate-hackrf',
												description:
													'GSM base station scanner and SDR frequency calibration tool',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'srsran',
												name: 'srsRAN',
												description:
													'Open-source 4G LTE and 5G NR software radio suite with passive sniffer mode',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'docker',
												canOpen: false,
												showControls: false
											}
										]
									},
									// Trunked Radio Decoding
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
												installed: false,
												deployment: 'docker',
												canOpen: false,
												showControls: false
											},
											{
												id: 'dsd-neo',
												name: 'dsd-neo',
												description:
													'Modern digital voice decoder: DMR, P25, NXDN, D-STAR, EDACS, dPMR, ProVoice, X2-TDMA, M17, YSF',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'op25',
												name: 'OP25',
												description:
													'Open source P25 trunked radio decoder with real-time audio and web UI',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'osmo-tetra',
												name: 'osmo-tetra',
												description:
													'TETRA protocol decoder with voice and SDS message decoding for European military/emergency radio',
												icon: toolIcons.cellular,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									}
								]
							},
							// Aircraft & Maritime Tracking
							{
								id: 'aircraft-maritime',
								name: 'Aircraft & Maritime Tracking',
								description:
									'Track aircraft positions and ship movements from their radio broadcasts',
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
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'ais-catcher',
										name: 'AIS Catcher',
										description:
											'High-performance AIS maritime vessel tracking via RTL-SDR with VHF signal decoding',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'dump1090',
										name: 'Dump1090',
										description:
											'Industry-standard ADS-B 1090 MHz decoder for real-time aircraft position plotting',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'dumpvdl2',
										name: 'dumpvdl2',
										description:
											'VDL Mode 2 message decoder for CPDLC, ADS-C, and digital aviation datalink intelligence',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'readsb',
										name: 'ReadSB',
										description:
											'ARM-optimized ADS-B decoder with 30-50% lower CPU than dump1090 (drop-in replacement)',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'tar1090',
										name: 'Tar1090',
										description:
											'Enhanced ADS-B web visualization with interactive mapping, trail history, and range rings',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// Satellite Signal Intelligence
							{
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
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'gr-satellites',
										name: 'gr-satellites',
										description:
											'GNU Radio decoder for 100+ amateur and research satellite telemetry protocols',
										icon: toolIcons.rfSpectrum,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// Pager & Analog Signal Decoding
							{
								id: 'pager-analog',
								name: 'Pager & Analog Signal Decoding',
								description:
									'Decode pager messages, emergency alerts, and legacy radio signals',
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
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'pagermon',
										name: 'Pagermon',
										description:
											'POCSAG/FLEX pager signal monitoring and decoding with web interface',
										icon: toolIcons.pagermon,
										installed: true,
										deployment: 'native',
										viewName: 'pagermon',
										canOpen: true,
										showControls: false
									}
								]
							},
							// IoT & Sub-GHz Signal Collection
							{
								id: 'iot-subghz-collection',
								name: 'IoT & Sub-GHz Signal Collection',
								description:
									'Pick up transmissions from sensors, smart devices, and LoRa networks',
								icon: toolIcons.iot,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'rtl-433',
										name: 'RTL-433',
										description:
											'ISM band decoder for 280+ IoT device protocols (433/315/868/915 MHz)',
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
										description:
											'LoRa PHY-layer SDR implementation with GNU Radio for signal generation and analysis',
										icon: toolIcons.iot,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'zigator',
										name: 'Zigator',
										description:
											'ZigBee traffic analysis and visualization with protocol dissection and encryption analysis',
										icon: toolIcons.iot,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// Drone & UAS Detection
							{
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
										description:
											'Passive DJI DroneID decoding from WiFi traffic',
										icon: toolIcons.droneid,
										installed: true,
										deployment: 'native',
										viewName: 'droneid',
										canOpen: true,
										showControls: false
									},
									{
										id: 'dronesecurity',
										name: 'DroneSecurity',
										description:
											'Passive DJI DroneID protocol reverse-engineering and decoder',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'rf-drone-detection',
										name: 'RF-Drone-Detection',
										description:
											'Passive RF drone detection using GNU Radio with ML classification',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// RF Device Fingerprinting & Geolocation
							{
								id: 'rf-fingerprinting-geo',
								name: 'RF Device Fingerprinting & Geolocation',
								description:
									'Locate and identify specific RF emitters by their unique signal characteristics',
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
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'find-lf',
										name: 'Find-LF',
										description:
											'Distributed WiFi device positioning using multiple RPi sensor nodes for passive triangulation',
										icon: toolIcons.geolocation,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'trackerjacker',
										name: 'TrackerJacker',
										description:
											'Passive WiFi device tracker via probe request sniffing for covert location monitoring',
										icon: toolIcons.geolocation,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							}
						]
					},
					// ────────────────────────────────────────────────────
					// ATTACK — Disrupt, deny, or exploit targets
					// ────────────────────────────────────────────────────
					{
						id: 'attack',
						name: 'ATTACK',
						description:
							'Disrupt, deny, or exploit targets using RF and wireless techniques',
						icon: toolIcons.counterAttack,
						children: [
							// WiFi Disruption & Exploitation
							{
								id: 'wifi-disruption',
								name: 'WiFi Disruption & Exploitation',
								description: 'Break into or shut down WiFi networks',
								icon: toolIcons.wifi,
								children: [
									// Denial & Deauthentication
									{
										id: 'wifi-denial-deauth',
										name: 'Denial & Deauthentication',
										description:
											'Kick devices off WiFi networks and disrupt wireless communications',
										icon: toolIcons.wifi,
										collapsible: true,
										defaultExpanded: false,
										children: [
											{
												id: 'aireplay-ng',
												name: 'Aireplay-NG',
												description:
													'Packet injection for deauthentication, WPA handshake capture, and fragmentation attacks',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'mdk4',
												name: 'mdk4',
												description:
													'Multi-mode WiFi DoS: beacon flooding, deauthentication, SSID brute force',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'block',
												name: 'Bl0ck',
												description:
													'WiFi 5/6 QoS Data frame interruption exploiting Block Ack frame vulnerabilities (802.11ac/ax)',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'scapy-80211',
												name: 'Scapy 802.11',
												description:
													'Custom 802.11 frame crafting for beacon injection, spoofing, and deauth',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									},
									// Handshake Capture & Cracking
									{
										id: 'handshake-capture',
										name: 'Handshake Capture & Cracking',
										description:
											'Capture WiFi passwords and break into protected networks',
										icon: toolIcons.wifi,
										collapsible: true,
										defaultExpanded: false,
										children: [
											{
												id: 'wifite2',
												name: 'Wifite2',
												description:
													'Automated WiFi auditing chaining handshake capture, PMKID, WPS, and cracking',
												icon: toolIcons.wifite,
												installed: true,
												deployment: 'native',
												viewName: 'wifite',
												canOpen: true,
												showControls: false
											},
											{
												id: 'hcxdumptool',
												name: 'HCXDumpTool',
												description:
													'PMKID and WPA handshake capture without client deauthentication',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'airgeddon',
												name: 'Airgeddon',
												description:
													'Menu-driven WiFi multi-attack suite orchestrating handshake capture, WPS, and evil twin',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'wef',
												name: 'WEF',
												description:
													'Automated WiFi exploitation framework with guided workflows for common attacks',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'fragattacks',
												name: 'FragAttacks',
												description:
													'802.11 protocol flaw exploitation for fragmentation and aggregation vulnerabilities',
												icon: toolIcons.wifi,
												installed: false,
												deployment: 'docker',
												canOpen: false,
												showControls: false
											}
										]
									}
								]
							},
							// Rogue Access Point & Credential Capture
							{
								id: 'rogue-ap',
								name: 'Rogue Access Point & Credential Capture',
								description:
									'Create fake WiFi networks that targets connect to, then capture their credentials',
								icon: toolIcons.wifi,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'wifi-pumpkin3',
										name: 'WiFi Pumpkin3',
										description:
											'Rogue AP framework with MITM interception, SSL stripping, and DNS spoofing',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'wifiphisher',
										name: 'Wifiphisher',
										description:
											'Automated rogue AP framework with social engineering phishing templates',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'wifi-pineapple-pi',
										name: 'WiFi Pineapple Pi',
										description:
											'Rogue AP, MITM, captive portal, and credential harvesting platform',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'eaphammer',
										name: 'EAPHammer',
										description:
											'WPA2-Enterprise evil twin targeting 802.1X/EAP networks for credential harvesting',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'fluxion',
										name: 'Fluxion',
										description:
											'Automated evil twin + captive portal social engineering for WPA/WPA2 password capture',
										icon: toolIcons.wifi,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// Bluetooth & BLE Exploitation
							{
								id: 'bt-ble-exploit',
								name: 'Bluetooth & BLE Exploitation',
								description:
									'Attack Bluetooth devices to extract data or disrupt connections',
								icon: toolIcons.bluetooth,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'bluesnarfer',
										name: 'BlueSnarfer',
										description:
											'Bluetooth OBEX exploitation for unauthorized access to phonebooks, SMS, and files',
										icon: toolIcons.bluetooth,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'bluetoolkit',
										name: 'BlueToolkit',
										description:
											'Bluetooth Classic/BLE attack framework with vulnerability scanning and exploit execution',
										icon: toolIcons.bluetooth,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'bluing',
										name: 'Bluing',
										description:
											'Bluetooth Classic/BLE reconnaissance with service enumeration, vulnerability scanning, and JSON output',
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
											'Multi-protocol wireless attack framework supporting BLE, ZigBee, Mosart, and IR',
										icon: toolIcons.bluetooth,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// Drone Defeat & GPS Spoofing
							{
								id: 'drone-defeat-gps',
								name: 'Drone Defeat & GPS Spoofing',
								description:
									'Take control of or disable drones by exploiting their communications',
								icon: toolIcons.drone,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'dronesploit',
										name: 'DroneSploit',
										description:
											'Modular drone exploitation framework with MAVLink/DJI protocol attacks',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									},
									{
										id: 'gps-sdr-sim',
										name: 'GPS-SDR-SIM',
										description:
											'GPS L1 C/A signal simulator for generating spoofed GPS signals via SDR',
										icon: toolIcons.drone,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// RF Jamming & Spectrum Denial
							{
								id: 'rf-jamming',
								name: 'RF Jamming & Spectrum Denial',
								description:
									'Block radio communications across targeted frequency bands',
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
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'jamrf-rfid',
										name: 'JamRF',
										description:
											'Broadband RF jamming with proactive/reactive modes, swept-sine, and Gaussian noise',
										icon: toolIcons.rfSpectrum,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// IoT & Sub-GHz Exploitation
							{
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
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'laf-lora',
										name: 'LoRa Attack Toolkit (LAF)',
										description:
											'LoRaWAN security auditing with packet injection, replay, and gateway impersonation',
										icon: toolIcons.iot,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// TAK Network Exploitation
							{
								id: 'tak-exploit',
								name: 'TAK Network Exploitation',
								description:
									'Disrupt or deceive adversary TAK command and control systems',
								icon: toolIcons.counterAttack,
								children: [
									// CoT Message Injection & Manipulation
									{
										id: 'cot-injection',
										name: 'CoT Message Injection & Manipulation',
										description:
											'Inject false positions or modify messages on enemy TAK networks',
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
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'push-cursor-on-target',
												name: 'Push Cursor on Target',
												description:
													'CLI tool for injecting fabricated CoT position and event data into TAK networks',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									},
									// Meshtastic Targeting
									{
										id: 'meshtastic-targeting',
										name: 'Meshtastic Targeting',
										description:
											'Identify and target Meshtastic LoRa mesh networks',
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
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									}
								]
							}
						]
					},
					// ────────────────────────────────────────────────────
					// DEFENSE — Detect threats targeting your own systems
					// ────────────────────────────────────────────────────
					{
						id: 'defense',
						name: 'DEFENSE',
						description: 'Detect threats targeting your own systems and communications',
						icon: toolIcons.network,
						children: [
							// Cellular Threat Detection
							{
								id: 'cellular-threat-detection',
								name: 'Cellular Threat Detection',
								description:
									'Detect fake cell towers and rogue base stations near your position',
								icon: toolIcons.cellular,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'crocodile-hunter',
										name: 'Crocodile Hunter',
										description:
											'EFF 4G/LTE fake base station detector using srsRAN',
										icon: toolIcons.cellular,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							}
						]
					},
					// ────────────────────────────────────────────────────
					// UTILITIES — Supporting tools for operations
					// ────────────────────────────────────────────────────
					{
						id: 'utilities',
						name: 'UTILITIES',
						description: 'Supporting tools for recording, analysis, and infrastructure',
						icon: toolIcons.folder,
						children: [
							// Signal Recording & Analysis
							{
								id: 'signal-recording',
								name: 'Signal Recording & Analysis',
								description: 'Save and review captured RF signals after collection',
								icon: toolIcons.sdr,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'sigmf',
										name: 'SigMF',
										description:
											'Signal Metadata Format — standardized JSON sidecar format for IQ signal recordings',
										icon: toolIcons.sdr,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'inspectrum',
										name: 'Inspectrum',
										description:
											'Offline RF signal analysis for visualizing and decoding recorded IQ files',
										icon: toolIcons.sdr,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									}
								]
							},
							// SDR Infrastructure & Frameworks
							{
								id: 'sdr-infrastructure',
								name: 'SDR Infrastructure & Frameworks',
								description:
									'Configure, connect, and manage your SDR hardware and processing tools',
								icon: toolIcons.sdr,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'soapy-remote',
										name: 'SoapyRemote',
										description:
											'Stream any SoapySDR device over the network for distributed SDR architectures',
										icon: toolIcons.sdr,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'fissure',
										name: 'Fissure',
										description:
											'Comprehensive RF framework with 100+ attack scripts, signal detection, and protocol discovery',
										icon: toolIcons.sdr,
										installed: false,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'rfsec-toolkit',
										name: 'RFSEC Toolkit',
										description:
											'Curated RF security tool collection with scripts and documentation organized by SDR hardware',
										icon: toolIcons.sdr,
										installed: true,
										deployment: 'native',
										canOpen: false,
										showControls: false
									},
									{
										id: 'universal-radio-hacker',
										name: 'Universal Radio Hacker',
										description:
											'Wireless protocol investigation with signal recording, demodulation, and reverse engineering',
										icon: toolIcons.external,
										installed: true,
										deployment: 'external',
										externalUrl: 'http://localhost:8080',
										canOpen: true,
										showControls: false
									},
									{
										id: 'rf-emitter',
										name: 'RF Emitter',
										description:
											'Argos built-in HackRF transmission module for active RF signal generation (1 MHz–6 GHz)',
										icon: toolIcons.rfemitter,
										installed: true,
										deployment: 'native',
										viewName: 'rf-emitter',
										canOpen: true,
										showControls: false
									}
								]
							},
							// Password & Credential Recovery
							{
								id: 'password-recovery',
								name: 'Password & Credential Recovery',
								description:
									'Crack captured password hashes and encrypted credentials offline',
								icon: toolIcons.network,
								collapsible: true,
								defaultExpanded: false,
								children: [
									{
										id: 'hashcat',
										name: 'Hashcat',
										description:
											'Password recovery and WPA/WPA2/WPA3 cracking (CPU-only on RPi 5)',
										icon: toolIcons.network,
										installed: false,
										deployment: 'docker',
										canOpen: false,
										showControls: false
									}
								]
							},
							// TAK Integration & Gateways
							{
								id: 'tak-integration',
								name: 'TAK Integration & Gateways',
								description:
									'Connect your sensors and tools to TAK for situational awareness',
								icon: toolIcons.counterAttack,
								children: [
									// CoT Sensor Gateways
									{
										id: 'cot-sensor-gateways',
										name: 'CoT Sensor Gateways',
										description:
											'Feed live aircraft, ship, drone, and tracker data into your TAK server',
										icon: toolIcons.counterAttack,
										collapsible: true,
										defaultExpanded: false,
										children: [
											{
												id: 'adsbcot',
												name: 'ADSBCot',
												description:
													'ADS-B aircraft tracking to CoT bridge for TAK situational awareness displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'aiscot',
												name: 'AISCot',
												description:
													'AIS maritime vessel data to CoT bridge for TAK situational awareness displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'aprscot',
												name: 'APRSCot',
												description:
													'APRS amateur radio position reports to CoT bridge for TAK displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'djicot',
												name: 'DJICot',
												description:
													'DJI drone telemetry to CoT bridge for TAK drone tracking displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'dronecot',
												name: 'DroneCot',
												description:
													'Drone Remote ID detection data to CoT bridge for TAK displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'inrcot',
												name: 'InrCot',
												description:
													'Garmin inReach satellite tracker positions to CoT bridge for TAK displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'spotcot',
												name: 'SpotCot',
												description:
													'Globalstar SPOT satellite tracker positions to CoT bridge for TAK displays',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									},
									// TAK Protocol Libraries & Analysis
									{
										id: 'tak-protocol-libs',
										name: 'TAK Protocol Libraries & Analysis',
										description:
											'Build, decode, and inspect TAK protocol messages',
										icon: toolIcons.counterAttack,
										collapsible: true,
										defaultExpanded: false,
										children: [
											{
												id: 'pytak',
												name: 'PyTAK',
												description:
													'Python TAK client/server framework for CoT message routing and data gateways',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'takproto',
												name: 'TAKProto',
												description:
													'Pure Python library for encoding/decoding TAK Protocol Protobuf and CoT messages',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											},
											{
												id: 'wireshark-tak-dissector',
												name: 'Wireshark TAK Dissector',
												description:
													'Lua-based Wireshark dissector for native TAK/CoT protocol traffic analysis',
												icon: toolIcons.counterAttack,
												installed: false,
												deployment: 'native',
												canOpen: false,
												showControls: false
											}
										]
									}
								]
							}
						]
					}
				]
			},
			// ============================================================
			// ONNET — Tools that require a connection to the target network
			// ============================================================
			{
				id: 'onnet',
				name: 'ONNET',
				description: 'Tools that require a connection to the target network',
				icon: toolIcons.network,
				children: [
					// Network Reconnaissance & Fingerprinting
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
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'ndpi',
								name: 'nDPI',
								description:
									'Deep packet inspection identifying 300+ application protocols from network traffic',
								icon: toolIcons.network,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'satori',
								name: 'Satori',
								description:
									'Device fingerprinting via DHCP, CDP, mDNS, and UPnP signatures',
								icon: toolIcons.network,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'cryptolyzer',
								name: 'CryptoLyzer',
								description:
									'TLS/SSL cipher suite and certificate analysis for cryptographic vulnerability detection',
								icon: toolIcons.network,
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							}
						]
					},
					// Network Attack & Credential Capture
					{
						id: 'net-attack-credential',
						name: 'Network Attack & Credential Capture',
						description:
							'Intercept traffic and steal credentials from devices on the same network',
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
								installed: false,
								deployment: 'native',
								canOpen: false,
								showControls: false
							},
							{
								id: 'responder',
								name: 'Responder',
								description:
									'LLMNR/NBT-NS/mDNS poisoner for NTLMv2 hash and credential capture from Windows hosts',
								icon: toolIcons.network,
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
								id: 'mqtt-pwn',
								name: 'MQTT-PWN',
								description:
									'MQTT broker exploitation with topic enumeration, credential brute-forcing, and message injection',
								icon: toolIcons.network,
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
			const found: ToolCategory | ToolDefinition | undefined = current.children.find(
				(child) => child.id === id
			);
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
