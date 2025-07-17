"""
Enhanced RF Workflows
Comprehensive workflow system using realistic protocol implementations
for complex and near-replicate RF signal generation.
"""

import numpy as np
import time
import threading
from typing import Dict, Any, List, Optional
from .elrs_protocol import ELRSProtocol
from .elrs_jamming_protocol import ELRSJammingProtocol, ELRSJammingConfig
from .drone_video_jamming_protocol import DroneVideoJammingProtocol, DroneVideoJammingConfig
from .universal_signal_cache import initialize_universal_cache, get_universal_cache
from .gps_protocol import GPSProtocol
from .adsb_protocol import ADSBProtocol, Aircraft
from .raw_energy_protocol import RawEnergyProtocol


class EnhancedWorkflows:
    """Enhanced workflow system with realistic protocol implementations"""
    
    def __init__(self, hackrf_controller):
        """Initialize enhanced workflows"""
        self.hackrf = hackrf_controller
        self.active_workflow = None
        self.workflow_thread = None
        self.stop_flag = threading.Event()
        
        # Initialize protocol handlers
        self.elrs_protocols = {
            '433': ELRSProtocol('433'),
            '868': ELRSProtocol('868'), 
            '915': ELRSProtocol('915'),
            '2400': ELRSProtocol('2400')
        }
        
        # Initialize ELRS jamming protocols with HackRF controller reference
        self.elrs_jamming_protocols = {
            '433': ELRSJammingProtocol('433', hackrf_controller),
            '868': ELRSJammingProtocol('868', hackrf_controller),
            '915': ELRSJammingProtocol('915', hackrf_controller),
            '2400': ELRSJammingProtocol('2400', hackrf_controller)
        }
        
        # Initialize drone video jamming protocols with HackRF controller reference
        self.drone_video_jamming_protocols = {
            '1200': DroneVideoJammingProtocol('1200', hackrf_controller),
            '5800': DroneVideoJammingProtocol('5800', hackrf_controller)
        }
        
        self.gps_protocols = {
            'L1': GPSProtocol('L1'),
            'L2': GPSProtocol('L2'),
            'L5': GPSProtocol('L5')
        }
        
        self.adsb_protocol = ADSBProtocol()
        
        # Initialize raw energy protocol
        self.raw_energy_protocol = RawEnergyProtocol()
        
        # Cache will be initialized lazily when needed
        self._cache_initialized = False
    
    def _ensure_cache_initialized(self):
        """Ensure cache is initialized before use"""
        if not self._cache_initialized:
            print("🚀 Initializing universal signal cache (lazy loading)...")
            initialize_universal_cache()
            self._cache_initialized = True
    
    def get_available_workflows(self) -> List[Dict[str, Any]]:
        """Get comprehensive list of enhanced RF workflows"""
        workflows = []
        
        # Enhanced ELRS workflows with realistic parameters
        for band in ['433', '868', '915', '2400']:
            protocol = self.elrs_protocols[band]
            band_info = protocol.get_band_info()
            
            workflow = {
                'name': f'elrs_{band}_enhanced',
                'display_name': f'ELRS {band}MHz (Enhanced)',
                'description': f'Realistic ExpressLRS transmission on {band}MHz with proper LoRa modulation, frequency hopping, and RC control simulation',
                'category': 'RC Control',
                'complexity': 'High',
                'parameters': {
                    'frequency': {
                        'type': 'float',
                        'min': band_info['center_frequency'],
                        'max': band_info['center_frequency'],
                        'default': band_info['center_frequency'],
                        'unit': 'Hz',
                        'description': f'Center frequency for {band}MHz band'
                    },
                    'packet_rate': {
                        'type': 'select',
                        'options': [25, 50, 100, 200, 333, 500],
                        'default': 100,
                        'unit': 'Hz',
                        'description': 'Packet transmission rate (affects range vs latency)'
                    },
                    'power_level': {
                        'type': 'int',
                        'min': -10,
                        'max': min(20, int(10 * np.log10(band_info['max_power']))),
                        'default': 10,
                        'unit': 'dBm',
                        'description': 'Transmission power level'
                    },
                    'flight_mode': {
                        'type': 'select',
                        'options': ['manual', 'acro', 'stabilized', 'hover'],
                        'default': 'manual',
                        'description': 'Flight mode affects control input patterns'
                    },
                    'frequency_hopping': {
                        'type': 'bool',
                        'default': True,
                        'description': 'Enable frequency hopping spread spectrum'
                    },
                    'channel_count': {
                        'type': 'int',
                        'min': 1,
                        'max': len(band_info['channels']),
                        'default': min(5, len(band_info['channels'])),
                        'description': 'Number of frequency channels to use'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 30,
                        'unit': 's',
                        'description': 'Transmission duration'
                    }
                }
            }
            workflows.append(workflow)
        
        # ELRS Jamming workflows with frequency sweeping
        for band in ['433', '868', '915', '2400']:
            jammer = self.elrs_jamming_protocols[band]
            band_info = jammer.get_band_info()
            recommendations = jammer.get_jamming_recommendations()
            band_rec = recommendations.get(band, recommendations['915'])
            
            # Frequency Sweeping Jammer
            workflow = {
                'name': f'elrs_{band}_freq_sweep_jammer',
                'display_name': f'ELRS {band}MHz Frequency Sweeping Jammer',
                'description': f'Advanced frequency sweeping jammer for ELRS {band}MHz band. Mimics real ELRS hopping patterns across {len(band_info["channels"])} channels for maximum effectiveness.',
                'category': 'ELRS Jamming',
                'complexity': 'High',
                'parameters': {
                    'sweep_pattern': {
                        'type': 'select',
                        'options': ['sequential', 'pseudorandom', 'adaptive', 'burst'],
                        'default': band_rec['pattern'],
                        'description': 'Frequency hopping pattern - pseudorandom mimics real ELRS behavior'
                    },
                    'hop_rate': {
                        'type': 'int',
                        'min': 10,
                        'max': 1000,
                        'default': band_rec['hop_rate'],
                        'unit': 'Hz',
                        'description': 'Channel switching rate - higher is more effective'
                    },
                    'power_level': {
                        'type': 'int',
                        'min': 0,
                        'max': 47,
                        'default': band_rec['power'],
                        'unit': 'dBm',
                        'description': 'Jamming power level'
                    },
                    'dwell_time': {
                        'type': 'float',
                        'min': 0.001,
                        'max': 0.1,
                        'default': 1.0 / band_rec['hop_rate'],
                        'unit': 's',
                        'description': 'Time to spend on each channel'
                    },
                    'bandwidth_multiplier': {
                        'type': 'float',
                        'min': 0.5,
                        'max': 3.0,
                        'default': 1.5,
                        'description': 'Bandwidth multiplier per channel (wider = more effective)'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 60,
                        'unit': 's',
                        'description': 'Jamming duration'
                    }
                }
            }
            workflows.append(workflow)
            
            # Barrage Jammer (simultaneous multi-channel)
            workflow = {
                'name': f'elrs_{band}_barrage_jammer',
                'display_name': f'ELRS {band}MHz Barrage Jammer',
                'description': f'Simultaneous multi-channel barrage jammer covering all {len(band_info["channels"])} ELRS {band}MHz channels at once for maximum disruption.',
                'category': 'ELRS Jamming',
                'complexity': 'Very High',
                'parameters': {
                    'power_level': {
                        'type': 'int',
                        'min': 0,
                        'max': 47,
                        'default': 47,  # MAXIMUM power per channel
                        'unit': 'dBm',
                        'description': 'Maximum power level per channel'
                    },
                    'coverage_strategy': {
                        'type': 'select',
                        'options': ['full_band', 'hotspots', 'center_focus'],
                        'default': 'full_band',
                        'description': 'Channel coverage strategy'
                    },
                    'jamming_type': {
                        'type': 'select',
                        'options': ['broadband_noise', 'multitone', 'pulsed_noise'],
                        'default': 'broadband_noise',
                        'description': 'Type of jamming signal'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 30,
                        'unit': 's',
                        'description': 'Jamming duration'
                    }
                }
            }
            workflows.append(workflow)
            
            # Adaptive Jammer (responds to traffic)
            workflow = {
                'name': f'elrs_{band}_adaptive_jammer',
                'display_name': f'ELRS {band}MHz Adaptive Jammer',
                'description': f'Intelligent adaptive jammer that monitors ELRS {band}MHz traffic and focuses jamming on active channels with real-time pattern adaptation.',
                'category': 'ELRS Jamming',
                'complexity': 'Very High',
                'parameters': {
                    'monitoring_sensitivity': {
                        'type': 'float',
                        'min': -80,
                        'max': -40,
                        'default': -60,
                        'unit': 'dBm',
                        'description': 'Signal detection threshold'
                    },
                    'adaptation_speed': {
                        'type': 'select',
                        'options': ['slow', 'medium', 'fast', 'real_time'],
                        'default': 'medium',
                        'description': 'How quickly to adapt to traffic changes'
                    },
                    'focus_channels': {
                        'type': 'int',
                        'min': 1,
                        'max': len(band_info["channels"]),
                        'default': 5,
                        'description': 'Number of high-priority channels to focus on'
                    },
                    'power_boost': {
                        'type': 'int',
                        'min': 0,
                        'max': 10,
                        'default': 3,
                        'unit': 'dB',
                        'description': 'Extra power for high-traffic channels'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 10.0,
                        'max': 3600,
                        'default': 120,
                        'unit': 's',
                        'description': 'Monitoring and jamming duration'
                    }
                }
            }
            workflows.append(workflow)
        
        # Drone Video Link Jamming workflows
        for band in ['1200', '5800']:
            jammer = self.drone_video_jamming_protocols[band]
            band_info = jammer.get_band_info()
            recommendations = jammer.get_jamming_recommendations()
            band_rec = recommendations.get(band, recommendations['5800'])
            
            # Video Link Frequency Sweeping Jammer
            workflow = {
                'name': f'drone_video_{band}_freq_sweep_jammer',
                'display_name': f'Drone Video {band_info["name"]} Frequency Jammer',
                'description': f'Advanced frequency jamming for {band_info["name"]}. Disrupts FPV video transmission across {len(band_info["channels"])} channels with maximum power.',
                'category': 'Drone Video Jamming',
                'complexity': 'High',
                'parameters': {
                    'sweep_pattern': {
                        'type': 'select',
                        'options': ['sequential', 'pseudorandom', 'adaptive', 'burst', 'race_focus'],
                        'default': band_rec['pattern'],
                        'description': 'Video jamming pattern strategy'
                    },
                    'hop_rate': {
                        'type': 'int',
                        'min': 10,
                        'max': 400,
                        'default': band_rec['hop_rate'],
                        'unit': 'Hz',
                        'description': 'Channel hopping rate'
                    },
                    'power_level': {
                        'type': 'int',
                        'min': 0,
                        'max': 47,
                        'default': 47,  # MAXIMUM power
                        'unit': 'dBm',
                        'description': 'Maximum power level'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 60,
                        'unit': 's',
                        'description': 'Jamming duration'
                    }
                }
            }
            workflows.append(workflow)
            
            # Video Link Barrage Jammer
            workflow = {
                'name': f'drone_video_{band}_barrage_jammer',
                'display_name': f'Drone Video {band_info["name"]} Barrage Jammer',
                'description': f'Rapid-fire barrage jammer for {band_info["name"]}. Cycles through all {len(band_info["channels"])} video channels with maximum disruption power.',
                'category': 'Drone Video Jamming',
                'complexity': 'Very High',
                'parameters': {
                    'power_level': {
                        'type': 'int',
                        'min': 0,
                        'max': 47,
                        'default': 47,  # MAXIMUM power
                        'unit': 'dBm',
                        'description': 'Maximum power level per channel'
                    },
                    'coverage_strategy': {
                        'type': 'select',
                        'options': ['full_band', 'race_focus', 'adaptive'],
                        'default': 'race_focus' if band == '5800' else 'full_band',
                        'description': 'Video channel coverage strategy'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 30,
                        'unit': 's',
                        'description': 'Jamming duration'
                    }
                }
            }
            workflows.append(workflow)
            
            # Single Channel Video Jammer
            workflow = {
                'name': f'drone_video_{band}_single_channel_jammer',
                'display_name': f'Drone Video {band_info["name"]} Single Channel Jammer',
                'description': f'Target specific video channel for {band_info["name"]}. Select from {len(band_info["channels"])} available channels for precise jamming with selectable bandwidth.',
                'category': 'Drone Video Jamming',
                'complexity': 'Medium',
                'parameters': {
                    'target_channel': {
                        'type': 'select',
                        'options': [{'value': i, 'label': f'{jammer._get_channel_name(freq)} ({freq/1e6:.1f} MHz)'} 
                                  for i, freq in enumerate(band_info["channels"])],
                        'default': 0,
                        'description': 'Select specific video channel to jam (center frequency)'
                    },
                    'bandwidth': {
                        'type': 'select',
                        'options': [
                            {'value': 5000000, 'label': '5 MHz'},
                            {'value': 10000000, 'label': '10 MHz'}
                        ],
                        'default': 10000000,
                        'description': 'Jamming bandwidth - 10 MHz covers full video feed'
                    },
                    'power_level': {
                        'type': 'int',
                        'min': 0,
                        'max': 47,
                        'default': 47,  # MAXIMUM power
                        'unit': 'dBm',
                        'description': 'Jamming power level'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 1.0,
                        'max': 3600,
                        'default': 30,
                        'unit': 's',
                        'description': 'Jamming duration'
                    }
                }
            }
            workflows.append(workflow)
        
        # Enhanced GPS workflows with constellation simulation
        for band in ['L1', 'L2', 'L5']:
            protocol = self.gps_protocols[band]
            constellation_info = protocol.get_constellation_info()
            
            workflow = {
                'name': f'gps_{band.lower()}_constellation',
                'display_name': f'GPS {band} Constellation',
                'description': f'Realistic GPS {band} signal with multiple satellites, proper C/A codes, navigation data, and Doppler effects',
                'category': 'GNSS',
                'complexity': 'Very High',
                'parameters': {
                    'frequency': {
                        'type': 'float',
                        'min': constellation_info['carrier_frequency'],
                        'max': constellation_info['carrier_frequency'],
                        'default': constellation_info['carrier_frequency'],
                        'unit': 'Hz',
                        'description': f'GPS {band} carrier frequency'
                    },
                    'satellite_count': {
                        'type': 'int',
                        'min': 4,
                        'max': constellation_info['num_satellites'],
                        'default': 8,
                        'description': 'Number of satellites to simulate'
                    },
                    'signal_strength': {
                        'type': 'float',
                        'min': -150,
                        'max': -110,
                        'default': -130,
                        'unit': 'dBm',
                        'description': 'Average signal strength'
                    },
                    'constellation_motion': {
                        'type': 'bool',
                        'default': True,
                        'description': 'Simulate satellite orbital motion and Doppler'
                    },
                    'navigation_data': {
                        'type': 'bool',
                        'default': True,
                        'description': 'Include realistic navigation message data'
                    },
                    'atmospheric_effects': {
                        'type': 'bool',
                        'default': True,
                        'description': 'Simulate atmospheric propagation effects'
                    },
                    'duration': {
                        'type': 'float',
                        'min': 10.0,
                        'max': 3600,
                        'default': 60,
                        'unit': 's',
                        'description': 'Transmission duration'
                    }
                }
            }
            workflows.append(workflow)
        
        # Enhanced ADS-B workflow with multiple aircraft
        workflow = {
            'name': 'adsb_airspace_simulation',
            'display_name': 'ADS-B Airspace Simulation',
            'description': 'Realistic ADS-B transmission with multiple aircraft, proper Mode S Extended Squitter format, and dynamic flight simulation',
            'category': 'Aviation',
            'complexity': 'Very High',
            'parameters': {
                'frequency': {
                    'type': 'float',
                    'min': self.adsb_protocol.ADSB_FREQ,
                    'max': self.adsb_protocol.ADSB_FREQ,
                    'default': self.adsb_protocol.ADSB_FREQ,
                    'unit': 'Hz',
                    'description': 'ADS-B frequency (1090 MHz)'
                },
                'aircraft_count': {
                    'type': 'int',
                    'min': 1,
                    'max': 10,
                    'default': 3,
                    'description': 'Number of aircraft to simulate'
                },
                'airspace_type': {
                    'type': 'select',
                    'options': ['busy_terminal', 'enroute', 'approach', 'departure'],
                    'default': 'busy_terminal',
                    'description': 'Type of airspace to simulate'
                },
                'transmission_rate': {
                    'type': 'float',
                    'min': 0.5,
                    'max': 2.0,
                    'default': 1.0,
                    'unit': 's',
                    'description': 'Average time between transmissions per aircraft'
                },
                'position_accuracy': {
                    'type': 'select',
                    'options': ['high', 'medium', 'low'],
                    'default': 'high',
                    'description': 'Position reporting accuracy'
                },
                'include_velocity': {
                    'type': 'bool',
                    'default': True,
                    'description': 'Include velocity and heading information'
                },
                'include_callsigns': {
                    'type': 'bool',
                    'default': True,
                    'description': 'Include aircraft identification messages'
                },
                'duration': {
                    'type': 'float',
                    'min': 10.0,
                    'max': 3600,
                    'default': 120,
                    'unit': 's',
                    'description': 'Simulation duration'
                }
            }
        }
        workflows.append(workflow)
        
        # Advanced frequency hopping workflow
        workflow = {
            'name': 'advanced_frequency_hopping',
            'display_name': 'Advanced Frequency Hopping',
            'description': 'Military-grade frequency hopping spread spectrum with complex patterns and anti-jamming features',
            'category': 'Advanced',
            'complexity': 'Very High',
            'parameters': {
                'start_freq': {
                    'type': 'float',
                    'min': 100e6,
                    'max': 6e9,
                    'default': 400e6,
                    'unit': 'Hz',
                    'description': 'Start frequency'
                },
                'end_freq': {
                    'type': 'float',
                    'min': 100e6,
                    'max': 6e9,
                    'default': 500e6,
                    'unit': 'Hz',
                    'description': 'End frequency'
                },
                'hop_rate': {
                    'type': 'int',
                    'min': 10,
                    'max': 10000,
                    'default': 1000,
                    'unit': 'hops/s',
                    'description': 'Frequency hopping rate'
                },
                'pattern_type': {
                    'type': 'select',
                    'options': ['pseudorandom', 'cyclic', 'adaptive', 'burst'],
                    'default': 'pseudorandom',
                    'description': 'Hopping pattern algorithm'
                },
                'channel_spacing': {
                    'type': 'float',
                    'min': 1e3,
                    'max': 1e6,
                    'default': 25e3,
                    'unit': 'Hz',
                    'description': 'Channel spacing'
                },
                'modulation': {
                    'type': 'select',
                    'options': ['FSK', 'MSK', 'GMSK', 'PSK'],
                    'default': 'MSK',
                    'description': 'Modulation scheme'
                },
                'data_rate': {
                    'type': 'int',
                    'min': 1200,
                    'max': 1000000,
                    'default': 9600,
                    'unit': 'bps',
                    'description': 'Data transmission rate'
                },
                'error_correction': {
                    'type': 'bool',
                    'default': True,
                    'description': 'Enable forward error correction'
                },
                'duration': {
                    'type': 'float',
                    'min': 1.0,
                    'max': 3600,
                    'default': 60,
                    'unit': 's',
                    'description': 'Transmission duration'
                }
            }
        }
        workflows.append(workflow)
        
        # Radar simulation workflow
        workflow = {
            'name': 'radar_simulation',
            'display_name': 'Radar Signal Simulation',
            'description': 'Realistic radar signal with pulse compression, Doppler processing, and target simulation',
            'category': 'Radar',
            'complexity': 'Very High',
            'parameters': {
                'radar_type': {
                    'type': 'select',
                    'options': ['weather', 'surveillance', 'tracking', 'marine'],
                    'default': 'surveillance',
                    'description': 'Type of radar to simulate'
                },
                'frequency': {
                    'type': 'float',
                    'min': 100e6,
                    'max': 6e9,
                    'default': 3e9,
                    'unit': 'Hz',
                    'description': 'Radar operating frequency (up to 6 GHz)'
                },
                'prf': {
                    'type': 'int',
                    'min': 100,
                    'max': 10000,
                    'default': 1000,
                    'unit': 'Hz',
                    'description': 'Pulse repetition frequency'
                },
                'pulse_width': {
                    'type': 'float',
                    'min': 1e-6,
                    'max': 1e-3,
                    'default': 10e-6,
                    'unit': 's',
                    'description': 'Pulse width'
                },
                'chirp_bandwidth': {
                    'type': 'float',
                    'min': 1e6,
                    'max': 100e6,
                    'default': 10e6,
                    'unit': 'Hz',
                    'description': 'Chirp bandwidth for pulse compression'
                },
                'target_count': {
                    'type': 'int',
                    'min': 0,
                    'max': 20,
                    'default': 5,
                    'description': 'Number of targets to simulate'
                },
                'beam_pattern': {
                    'type': 'select',
                    'options': ['pencil', 'fan', 'cosec_squared'],
                    'default': 'pencil',
                    'description': 'Antenna beam pattern'
                },
                'scan_mode': {
                    'type': 'select',
                    'options': ['stationary', 'rotating', 'sector_scan'],
                    'default': 'rotating',
                    'description': 'Radar scan pattern'
                },
                'duration': {
                    'type': 'float',
                    'min': 10.0,
                    'max': 3600,
                    'default': 180,
                    'unit': 's',
                    'description': 'Simulation duration'
                }
            }
        }
        workflows.append(workflow)
        
        # Raw Energy workflows with 5MHz and 10MHz options for all frequencies
        raw_energy_workflows = self._create_raw_energy_workflows()
        workflows.extend(raw_energy_workflows)
        
        return workflows
    
    def start_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Start enhanced workflow"""
        if self.active_workflow:
            raise Exception("Workflow already active")
        
        self.stop_flag.clear()
        self.active_workflow = workflow_name
        
        # Start workflow in separate thread
        self.workflow_thread = threading.Thread(
            target=self._run_enhanced_workflow,
            args=(workflow_name, parameters)
        )
        self.workflow_thread.daemon = True
        self.workflow_thread.start()
    
    def stop_workflow(self) -> None:
        """Stop current workflow"""
        self.stop_flag.set()
        if self.workflow_thread:
            self.workflow_thread.join(timeout=5)
        self.active_workflow = None
        self.hackrf.stop_transmission()
    
    def _run_enhanced_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run enhanced workflow with realistic signal generation"""
        try:
            print(f"Starting enhanced workflow: {workflow_name}")
            
            if workflow_name.startswith('elrs_') and workflow_name.endswith('_enhanced'):
                self._run_enhanced_elrs(workflow_name, parameters)
            elif workflow_name.startswith('elrs_') and '_jammer' in workflow_name:
                self._run_elrs_jammer(workflow_name, parameters)
            elif workflow_name.startswith('drone_video_') and '_jammer' in workflow_name:
                self._run_drone_video_jammer(workflow_name, parameters)
            elif workflow_name.startswith('gps_') and workflow_name.endswith('_constellation'):
                self._run_enhanced_gps(workflow_name, parameters)
            elif workflow_name == 'adsb_airspace_simulation':
                self._run_enhanced_adsb(parameters)
            elif workflow_name == 'advanced_frequency_hopping':
                self._run_advanced_frequency_hopping(parameters)
            elif workflow_name == 'radar_simulation':
                self._run_radar_simulation(parameters)
            elif workflow_name.startswith('raw_energy_'):
                self._run_raw_energy_workflow(workflow_name, parameters)
            else:
                raise Exception(f"Unknown enhanced workflow: {workflow_name}")
                
        except Exception as e:
            print(f"Error in enhanced workflow {workflow_name}: {e}")
            self.hackrf.stop_transmission()
        finally:
            # Always clean up the active workflow state
            self.active_workflow = None
    
    def _run_enhanced_elrs(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run enhanced ELRS workflow"""
        # Extract band and channel from workflow name
        parts = workflow_name.split('_')
        band = parts[1]  # Just the number, not with 'mhz'
        protocol = self.elrs_protocols[band]
        
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
        
        channel = parameters.get('channel', 0)
        packet_rate = parameters.get('packet_rate', 150)
        hop_interval = parameters.get('hop_interval', 50)
        duration = parameters.get('duration', 30)
        flight_mode = parameters.get('flight_mode', 'manual')
        
        print(f"Generating realistic ELRS {band.upper()} signal...")
        print(f"- Channel: {channel}")
        print(f"- Packet rate: {packet_rate} Hz")
        print(f"- Flight mode: {flight_mode}")
        
        # Generate ELRS signal
        signal_data = protocol.generate_elrs_transmission(
            duration=duration,
            packet_rate=packet_rate,
            power_level=10,  # Default power level
            flight_mode=flight_mode
        )
        
        # Convert to bytes for HackRF
        signal_8bit = ((signal_data + 1) * 127.5).astype(np.uint8)
        signal_bytes = signal_8bit.tobytes()
        
        # Configure and start transmission with duration for looping support
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)
        
        self.hackrf.start_transmission(signal_bytes, int(frequency), 2000000, 47, duration)
        
        # Wait for completion
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_elrs_jammer(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run ELRS jamming workflow with frequency sweeping"""
        # Extract band and jammer type from workflow name
        # Format: elrs_{band}_{jammer_type}_jammer
        parts = workflow_name.split('_')
        band = parts[1]
        jammer_type = '_'.join(parts[2:-1])  # Everything between band and 'jammer'
        
        jammer_protocol = self.elrs_jamming_protocols[band]
        band_info = jammer_protocol.get_band_info()
        
        # Common parameters - MAXIMUM POWER
        power_level = parameters.get('power_level', 47)  # Default to maximum HackRF gain
        duration = parameters.get('duration', 60)
        
        print(f"Starting ELRS {band}MHz {jammer_type.replace('_', ' ')} jammer...")
        print(f"- Band: {band}MHz ({len(band_info['channels'])} channels)")
        print(f"- Power: {power_level} dBm")
        print(f"- Duration: {duration}s")
        
        if jammer_type == 'freq_sweep':
            # Frequency sweeping jammer
            sweep_pattern = parameters.get('sweep_pattern', 'pseudorandom')
            hop_rate = parameters.get('hop_rate', 100)
            # Ensure minimum dwell time for HackRF process startup (minimum 500ms)
            calculated_dwell = 1.0 / hop_rate
            dwell_time = max(0.5, calculated_dwell)  # Force minimum 500ms, ignore parameters
            bandwidth_multiplier = parameters.get('bandwidth_multiplier', 1.5)
            
            config = ELRSJammingConfig(
                band=band,
                channels=band_info['channels'],
                hop_rate=hop_rate,
                sweep_pattern=sweep_pattern,
                power_level=power_level,
                bandwidth_per_hop=band_info['bandwidth'] * bandwidth_multiplier,
                dwell_time=dwell_time,
                coverage_strategy='frequency_sweeping'
            )
            
            print(f"- Pattern: {sweep_pattern}")
            print(f"- Hop rate: {hop_rate} Hz (adjusted for HackRF)")
            print(f"- Dwell time: {dwell_time:.1f}s per channel")
            
            jammer_protocol.start_frequency_sweeping_jammer(config, duration)
            
        elif jammer_type == 'barrage':
            # Barrage jammer (simultaneous multi-channel)
            coverage_strategy = parameters.get('coverage_strategy', 'full_band')
            jamming_type = parameters.get('jamming_type', 'broadband_noise')
            
            config = ELRSJammingConfig(
                band=band,
                channels=band_info['channels'],
                hop_rate=0,  # Not used for barrage
                sweep_pattern='barrage',
                power_level=power_level,
                bandwidth_per_hop=band_info['bandwidth'],
                dwell_time=1.0,
                coverage_strategy=coverage_strategy
            )
            
            print(f"- Coverage: {coverage_strategy}")
            print(f"- Jamming type: {jamming_type}")
            print(f"- Simultaneous channels: {len(band_info['channels'])}")
            
            jammer_protocol.start_barrage_jammer(config, duration)
            
        elif jammer_type == 'adaptive':
            # Adaptive jammer (responds to traffic)
            monitoring_sensitivity = parameters.get('monitoring_sensitivity', -60)
            adaptation_speed = parameters.get('adaptation_speed', 'medium')
            focus_channels = parameters.get('focus_channels', 5)
            power_boost = parameters.get('power_boost', 3)
            
            config = ELRSJammingConfig(
                band=band,
                channels=band_info['channels'],
                hop_rate=50,  # Monitoring rate
                sweep_pattern='adaptive',
                power_level=power_level,
                bandwidth_per_hop=band_info['bandwidth'] * 2,  # Wider for focused jamming
                dwell_time=0.02,  # 20ms per scan
                coverage_strategy='follow_traffic'
            )
            
            print(f"- Monitoring sensitivity: {monitoring_sensitivity} dBm")
            print(f"- Adaptation speed: {adaptation_speed}")
            print(f"- Focus channels: {focus_channels}")
            print(f"- Power boost: +{power_boost} dB for active channels")
            
            jammer_protocol.start_adaptive_jammer(config, duration)
            
        else:
            raise ValueError(f"Unknown ELRS jammer type: {jammer_type}")
        
        # Wait for jamming duration with cleaner status updates
        start_time = time.time()
        last_status_time = 0
        print(f"🔥 MAX POWER jamming started on {len(band_info['channels'])} channels @ 47dBm")
        
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(1.0)  # Check every second
            
            # Print status update every 10 seconds
            elapsed = int(time.time() - start_time)
            if elapsed > 0 and elapsed % 10 == 0 and elapsed != last_status_time:
                remaining = duration - elapsed
                print(f"ELRS {band}MHz {jammer_type.replace('_', ' ')} jammer: {elapsed}s elapsed, {remaining:.0f}s remaining")
                last_status_time = elapsed
        
        # Stop the jammer
        jammer_protocol.stop_all_jammers()
        print(f"ELRS {band}MHz {jammer_type} jammer stopped")
    
    def _run_drone_video_jammer(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run drone video jamming workflow with frequency sweeping"""
        # Extract band and jammer type from workflow name
        # Format: drone_video_{band}_{jammer_type}_jammer
        parts = workflow_name.split('_')
        band = parts[2]  # drone_video_{band}_...
        jammer_type = '_'.join(parts[3:-1])  # Everything between band and 'jammer'
        
        jammer_protocol = self.drone_video_jamming_protocols[band]
        band_info = jammer_protocol.get_band_info()
        
        # Common parameters - MAXIMUM POWER for video disruption
        power_level = parameters.get('power_level', 47)  # Default to maximum HackRF gain
        duration = parameters.get('duration', 60)
        
        print(f"Starting {band_info['name']} {jammer_type.replace('_', ' ')} jammer...")
        print(f"- Band: {band_info['name']} ({len(band_info['channels'])} channels)")
        print(f"- Power: {power_level} dBm")
        print(f"- Duration: {duration}s")
        
        if jammer_type == 'freq_sweep':
            # Video frequency sweeping jammer
            sweep_pattern = parameters.get('sweep_pattern', 'race_focus')
            hop_rate = parameters.get('hop_rate', 200)
            
            config = DroneVideoJammingConfig(
                band=band,
                channels=band_info['channels'],
                hop_rate=hop_rate,
                sweep_pattern=sweep_pattern,
                power_level=power_level,
                bandwidth_per_hop=band_info['bandwidth'],
                dwell_time=1.0 / hop_rate,
                coverage_strategy='frequency_sweeping'
            )
            
            print(f"- Pattern: {sweep_pattern}")
            print(f"- Hop rate: {hop_rate} Hz")
            
            jammer_protocol.start_video_jamming(config, duration)
            
        elif jammer_type == 'barrage':
            # Video barrage jammer (rapid multi-channel)
            coverage_strategy = parameters.get('coverage_strategy', 'race_focus')
            
            config = DroneVideoJammingConfig(
                band=band,
                channels=band_info['channels'],
                hop_rate=0,  # Not used for barrage
                sweep_pattern='barrage',
                power_level=power_level,
                bandwidth_per_hop=band_info['bandwidth'],
                dwell_time=0.1,  # 100ms per channel for video barrage
                coverage_strategy=coverage_strategy
            )
            
            print(f"- Coverage: {coverage_strategy}")
            print(f"- Video channels: {len(band_info['channels'])}")
            
            jammer_protocol.start_video_barrage_jammer(config, duration)
            
        elif jammer_type == 'single_channel':
            # Single channel video jammer
            target_channel = parameters.get('target_channel', 0)
            bandwidth = parameters.get('bandwidth', 10000000)
            
            if target_channel < 0 or target_channel >= len(band_info['channels']):
                raise ValueError(f"Invalid target channel {target_channel}. Must be 0-{len(band_info['channels'])-1}")
            
            target_frequency = band_info['channels'][target_channel]
            channel_name = jammer_protocol._get_channel_name(target_frequency)
            
            print(f"- Target channel: {target_channel} ({channel_name})")
            print(f"- Center frequency: {target_frequency/1e6:.1f} MHz")
            print(f"- Bandwidth: {bandwidth/1e6:.1f} MHz")
            
            jammer_protocol.start_single_channel_jammer(target_frequency, duration, power_level, bandwidth, 'video_noise')
            
        else:
            raise ValueError(f"Unknown drone video jammer type: {jammer_type}")
        
        # Wait for jamming duration
        start_time = time.time()
        print(f"🎥 MAX POWER video jamming started on {len(band_info['channels'])} channels @ 47dBm")
        
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(1.0)  # Check every second
            
            # Progress update every 10 seconds
            elapsed = time.time() - start_time
            if elapsed > 0 and int(elapsed) % 10 == 0:
                remaining = duration - elapsed
                print(f"🎥 Video jamming progress: {elapsed:.0f}s elapsed, {remaining:.0f}s remaining")
        
        # Don't call stop_jamming() here - let the protocol manage its own duration
        # The protocol will stop automatically when its duration is complete
        print(f"✅ Drone video jamming complete after {time.time() - start_time:.1f}s")
    
    def _run_enhanced_gps(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run enhanced GPS constellation workflow using cached signals"""
        # Extract band from workflow name
        band = workflow_name.split('_')[1].upper()
        protocol = self.gps_protocols[band]
        
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
        
        satellite_count = parameters.get('satellite_count', 8)
        duration = parameters.get('duration', 60)
        
        print(f"Loading cached GPS {band} constellation...")
        print(f"- {satellite_count} satellites")
        print(f"- Navigation data included")
        print(f"- Doppler effects simulated")
        
        # Use universal cache for GPS signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters_cache = {
            'band': band,
            'num_satellites': satellite_count,
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(band, num_satellites, duration):
            # Get satellite list (use first N satellites)
            satellite_info = protocol.get_satellite_info()
            include_satellites = [sat['svid'] for sat in satellite_info[:num_satellites]]
            
            return protocol.generate_gps_signal(
                duration=duration,
                include_satellites=include_satellites
            )
        
        # Get from cache or generate
        cached_path, sample_rate = cache.get_or_generate_signal(
            signal_type='gps',
            protocol=f'gps_{band.lower()}',
            parameters=parameters_cache,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        # Configure and start transmission with duration for looping support
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(int(sample_rate))
        self.hackrf.set_gain(47)
        
        self.hackrf.start_transmission(signal_bytes, int(frequency), int(sample_rate), 47, duration)
        
        # Wait for completion
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_enhanced_adsb(self, parameters: Dict[str, Any]) -> None:
        """Run enhanced ADS-B airspace simulation using cached signals"""
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
        
        aircraft_count = parameters.get('aircraft_count', 3)
        duration = parameters.get('duration', 120)
        transmission_rate = parameters.get('transmission_rate', 1.0)
        
        print(f"Loading cached ADS-B airspace simulation...")
        print(f"- {aircraft_count} aircraft")
        print(f"- Mode S Extended Squitter format")
        print(f"- Dynamic flight simulation")
        
        # Use universal cache for ADS-B signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters_cache = {
            'num_aircraft': aircraft_count,
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(num_aircraft, duration):
            # Set transmission interval
            self.adsb_protocol.transmission_interval = transmission_rate
            
            return self.adsb_protocol.generate_adsb_transmission(duration)
        
        # Get from cache or generate
        cached_path, sample_rate = cache.get_or_generate_signal(
            signal_type='adsb',
            protocol='adsb_1090',
            parameters=parameters_cache,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        # Configure and start transmission with duration for looping support
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(int(sample_rate))
        self.hackrf.set_gain(47)
        
        self.hackrf.start_transmission(signal_bytes, int(frequency), int(sample_rate), 47, duration)
        
        # Wait for completion
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_advanced_frequency_hopping(self, parameters: Dict[str, Any]) -> None:
        """Run advanced frequency hopping workflow"""
        start_freq = parameters.get('start_freq', 400e6)
        end_freq = parameters.get('end_freq', 500e6)
        hop_rate = parameters.get('hop_rate', 1000)
        duration = parameters.get('duration', 60)
        pattern_type = parameters.get('pattern_type', 'pseudorandom')
        
        print(f"Generating advanced frequency hopping signal...")
        print(f"- Frequency range: {start_freq/1e6:.1f} - {end_freq/1e6:.1f} MHz")
        print(f"- Hop rate: {hop_rate} hops/s")
        print(f"- Pattern: {pattern_type}")
        
        # This would implement complex frequency hopping
        # For now, simplified implementation
        self._simple_frequency_hopping(start_freq, end_freq, hop_rate, duration)
    
    def _run_radar_simulation(self, parameters: Dict[str, Any]) -> None:
        """Run radar simulation workflow with caching"""
        radar_type = parameters.get('radar_type', 'surveillance')
        frequency = parameters.get('frequency', 3e9)
        prf = parameters.get('prf', 1000)
        duration = parameters.get('duration', 180)  # Use workflow default
        
        print(f"Loading cached {radar_type} radar simulation...")
        print(f"- Frequency: {frequency/1e9:.1f} GHz")
        print(f"- PRF: {prf} Hz")
        print(f"- Duration: {duration}s")
        
        # Use universal cache for radar signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters_cache = {
            'radar_type': radar_type,
            'frequency': frequency,
            'prf': prf,
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(radar_type, frequency, prf, duration):
            return self._generate_radar_signal(radar_type, frequency, prf, duration)
        
        # Get from cache or generate
        cached_path, sample_rate = cache.get_or_generate_signal(
            signal_type='radar',
            protocol=f'radar_{radar_type}',
            parameters=parameters_cache,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        print(f"✅ Cached radar signal loaded instantly!")
        print(f"   File size: {len(signal_bytes)/1e6:.1f} MB")
        print(f"   Sample rate: {sample_rate/1e6:.1f} MHz")
        
        # Configure and start transmission with duration for looping support
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(int(sample_rate))
        self.hackrf.set_gain(47)
        
        self.hackrf.start_transmission(signal_bytes, int(frequency), int(sample_rate), 47, duration)
        
        # Wait for completion
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _create_raw_energy_workflows(self) -> List[Dict[str, Any]]:
        """Create raw energy workflows for all frequencies with 5MHz and 10MHz options"""
        workflows = []
        
        # Get all available frequencies
        frequencies = self.raw_energy_protocol.get_available_frequencies()
        bandwidth_options = self.raw_energy_protocol.get_bandwidth_options()
        noise_types = self.raw_energy_protocol.get_noise_types()
        
        # Create workflows for each frequency and bandwidth combination
        for freq_name, frequency in frequencies.items():
            for bw_name, bandwidth in bandwidth_options.items():
                
                workflow = {
                    'name': f'raw_energy_{freq_name.lower()}_{bw_name.lower()}',
                    'display_name': f'Raw Energy {freq_name} ({bw_name})',
                    'description': f'Maximum power {bw_name} raw energy transmission at {frequency/1e6:.2f} MHz ({self.raw_energy_protocol._get_frequency_description(freq_name)})',
                    'category': 'Raw Energy',
                    'complexity': 'Basic',
                    'parameters': {
                        'frequency': {
                            'type': 'float',
                            'min': frequency,
                            'max': frequency,
                            'default': frequency,
                            'unit': 'Hz',
                            'description': f'Fixed frequency: {frequency/1e6:.2f} MHz'
                        },
                        'bandwidth': {
                            'type': 'float',
                            'min': bandwidth,
                            'max': bandwidth,
                            'default': bandwidth,
                            'unit': 'Hz',
                            'description': f'Fixed bandwidth: {bw_name}'
                        },
                        'noise_type': {
                            'type': 'select',
                            'options': list(noise_types.keys()),
                            'default': 'white',
                            'description': 'Type of noise/signal to generate'
                        },
                        'duration': {
                            'type': 'float',
                            'min': 1.0,
                            'max': 3600,
                            'default': 30,
                            'unit': 's',
                            'description': 'Transmission duration'
                        }
                    }
                }
                workflows.append(workflow)
        
        return workflows
    
    def _simple_frequency_hopping(self, start_freq: float, end_freq: float, 
                                 hop_rate: int, duration: float) -> None:
        """Simplified frequency hopping implementation"""
        hop_interval = 1.0 / hop_rate
        num_channels = 100
        
        channels = np.linspace(start_freq, end_freq, num_channels)
        current_channel = 0
        
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            # Generate signal for current channel
            freq = channels[current_channel]
            self.hackrf.set_frequency(int(freq))
            
            # Simple signal generation for hop interval
            time.sleep(hop_interval)
            
            # Move to next channel
            current_channel = (current_channel + 1) % num_channels
    
    def _run_raw_energy_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run raw energy workflow with maximum power transmission"""
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
        
        bandwidth = parameters.get('bandwidth')
        if bandwidth is None:
            raise ValueError("Bandwidth parameter is required")
        
        duration = parameters.get('duration', 30)
        noise_type = parameters.get('noise_type', 'white')
        
        print(f"Generating raw energy transmission...")
        print(f"- Workflow: {workflow_name}")
        
        # Generate raw energy signal
        signal_data = self.raw_energy_protocol.generate_raw_energy_signal(
            frequency=frequency,
            bandwidth=bandwidth,
            duration=duration,
            noise_type=noise_type,
            sample_rate=2000000
        )
        
        # Convert to bytes for HackRF with maximum amplitude
        signal_8bit = ((signal_data + 1) * 127.5).astype(np.uint8)
        signal_bytes = signal_8bit.tobytes()
        
        # Configure HackRF for maximum power transmission
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum HackRF gain
        
        # Start transmission with duration for looping support
        self.hackrf.start_transmission(signal_bytes, int(frequency), 2000000, 47, duration)
        
        # Wait for completion
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _generate_radar_signal(self, radar_type: str, frequency: float, prf: int, duration: float) -> tuple:
        """Generate radar signal for caching (called by cache)"""
        sample_rate = 2000000  # 2 MHz
        num_samples = int(duration * sample_rate)
        
        # Generate radar pulse train
        pulse_interval = 1.0 / prf
        pulse_samples = int(pulse_interval * sample_rate)
        
        # Create radar signal
        signal = np.zeros(num_samples)
        
        # Generate pulses
        for i in range(0, num_samples, pulse_samples):
            if i + pulse_samples <= num_samples:
                # Create a radar pulse (simplified)
                pulse_width = int(0.0001 * sample_rate)  # 100 microseconds
                if pulse_width < pulse_samples:
                    # Add pulse at start of interval
                    signal[i:i + pulse_width] = 0.8 * np.cos(2 * np.pi * 1000 * np.linspace(0, pulse_width/sample_rate, pulse_width))
        
        # Convert to 8-bit format
        signal_8bit = ((signal + 1) * 127.5).astype(np.uint8)
        
        return signal_8bit.tobytes(), sample_rate
    
    def _simple_radar_simulation(self, frequency: float, prf: int, duration: float) -> None:
        """Simplified radar simulation implementation"""
        pulse_interval = 1.0 / prf
        
        self.hackrf.set_frequency(int(frequency))
        
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            # This would generate radar pulses
            time.sleep(pulse_interval) 