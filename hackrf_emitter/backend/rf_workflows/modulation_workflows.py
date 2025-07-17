import time
import threading
import numpy as np
from typing import Dict, Any, List
from .hackrf_controller import HackRFController
from .enhanced_workflows import EnhancedWorkflows

class ModulationWorkflows:
    """Manages different RF modulation workflows"""
    
    def __init__(self, hackrf_controller: HackRFController):
        self.hackrf = hackrf_controller
        self.active_workflow = None
        self.workflow_thread = None
        self.stop_flag = threading.Event()
        
        # Initialize enhanced workflows
        self.enhanced_workflows = EnhancedWorkflows(hackrf_controller)
        
    def get_available_workflows(self) -> List[Dict[str, Any]]:
        """Get list of available RF workflows"""
        # Get basic workflows
        basic_workflows = [
            {
                'name': 'sine_wave',
                'display_name': 'Sine Wave',
                'description': 'Generate a continuous sine wave signal',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 1e6, 'max': 6e9, 'default': 100e6, 'unit': 'Hz'},
                    'amplitude': {'type': 'float', 'min': 0.1, 'max': 1.0, 'default': 0.5, 'unit': 'V'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'fm_modulation',
                'display_name': 'FM Modulation',
                'description': 'Frequency modulated signal',
                'parameters': {
                    'carrier_freq': {'type': 'float', 'min': 1e6, 'max': 6e9, 'default': 100e6, 'unit': 'Hz'},
                    'mod_freq': {'type': 'float', 'min': 1, 'max': 100e3, 'default': 1e3, 'unit': 'Hz'},
                    'mod_depth': {'type': 'float', 'min': 0.1, 'max': 10, 'default': 1.0, 'unit': 'kHz'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'am_modulation',
                'display_name': 'AM Modulation',
                'description': 'Amplitude modulated signal',
                'parameters': {
                    'carrier_freq': {'type': 'float', 'min': 1e6, 'max': 6e9, 'default': 100e6, 'unit': 'Hz'},
                    'mod_freq': {'type': 'float', 'min': 1, 'max': 100e3, 'default': 1e3, 'unit': 'Hz'},
                    'mod_depth': {'type': 'float', 'min': 0.1, 'max': 1.0, 'default': 0.5, 'unit': '%'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'elrs_433',
                'display_name': 'ELRS 433MHz',
                'description': 'ExpressLRS protocol at 433MHz band',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 433e6, 'max': 433e6, 'default': 433e6, 'unit': 'Hz'},
                    'packet_rate': {'type': 'int', 'min': 50, 'max': 500, 'default': 250, 'unit': 'Hz', 'description': 'Packet transmission rate'},
                    'power': {'type': 'int', 'min': 10, 'max': 100, 'default': 25, 'unit': 'mW', 'description': 'Transmission power'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'elrs_915',
                'display_name': 'ELRS 915MHz',
                'description': 'ExpressLRS protocol at 915MHz band',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 915e6, 'max': 915e6, 'default': 915e6, 'unit': 'Hz'},
                    'packet_rate': {'type': 'int', 'min': 50, 'max': 500, 'default': 250, 'unit': 'Hz', 'description': 'Packet transmission rate'},
                    'power': {'type': 'int', 'min': 10, 'max': 100, 'default': 25, 'unit': 'mW', 'description': 'Transmission power'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'elrs_2_4',
                'display_name': 'ELRS 2.4GHz',
                'description': 'ExpressLRS protocol at 2.4GHz band',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 2.4e9, 'max': 2.4e9, 'default': 2.4e9, 'unit': 'Hz'},
                    'packet_rate': {'type': 'int', 'min': 50, 'max': 500, 'default': 250, 'unit': 'Hz', 'description': 'Packet transmission rate'},
                    'power': {'type': 'int', 'min': 10, 'max': 100, 'default': 25, 'unit': 'mW', 'description': 'Transmission power'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'gps_l1',
                'display_name': 'GPS L1 Band',
                'description': 'GPS L1 signal simulation (1575.42 MHz)',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 1575.42e6, 'max': 1575.42e6, 'default': 1575.42e6, 'unit': 'Hz'},
                    'satellite_id': {'type': 'int', 'min': 1, 'max': 32, 'default': 1, 'description': 'GPS Satellite ID (1-32)'},
                    'signal_strength': {'type': 'float', 'min': -130, 'max': -110, 'default': -120, 'unit': 'dBm', 'description': 'Signal strength'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'gps_l2',
                'display_name': 'GPS L2 Band',
                'description': 'GPS L2 signal simulation (1227.60 MHz)',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 1227.60e6, 'max': 1227.60e6, 'default': 1227.60e6, 'unit': 'Hz'},
                    'satellite_id': {'type': 'int', 'min': 1, 'max': 32, 'default': 1, 'description': 'GPS Satellite ID (1-32)'},
                    'signal_strength': {'type': 'float', 'min': -130, 'max': -110, 'default': -120, 'unit': 'dBm', 'description': 'Signal strength'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'gps_l5',
                'display_name': 'GPS L5 Band',
                'description': 'GPS L5 signal simulation (1176.45 MHz)',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 1176.45e6, 'max': 1176.45e6, 'default': 1176.45e6, 'unit': 'Hz'},
                    'satellite_id': {'type': 'int', 'min': 1, 'max': 32, 'default': 1, 'description': 'GPS Satellite ID (1-32)'},
                    'signal_strength': {'type': 'float', 'min': -130, 'max': -110, 'default': -120, 'unit': 'dBm', 'description': 'Signal strength'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'frequency_hopping',
                'display_name': 'Frequency Hopping',
                'description': 'Frequency hopping spread spectrum',
                'parameters': {
                    'start_freq': {'type': 'float', 'min': 1e6, 'max': 6e9, 'default': 100e6, 'unit': 'Hz'},
                    'end_freq': {'type': 'float', 'min': 1e6, 'max': 6e9, 'default': 200e6, 'unit': 'Hz'},
                    'hop_time': {'type': 'float', 'min': 0.01, 'max': 10, 'default': 0.1, 'unit': 's'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'ads_b_signal',
                'display_name': 'ADS-B Signal',
                'description': 'Automatic Dependent Surveillance-Broadcast signal',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 1090e6, 'max': 1090e6, 'default': 1090e6, 'unit': 'Hz'},
                    'icao_address': {'type': 'string', 'default': 'ABCDEF', 'description': 'ICAO aircraft address'},
                    'altitude': {'type': 'int', 'min': 0, 'max': 50000, 'default': 10000, 'unit': 'ft'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            },
            {
                'name': 'ais_signal',
                'display_name': 'AIS Signal',
                'description': 'Automatic Identification System signal',
                'parameters': {
                    'frequency': {'type': 'float', 'min': 161.975e6, 'max': 162.025e6, 'default': 162e6, 'unit': 'Hz'},
                    'mmsi': {'type': 'string', 'default': '123456789', 'description': 'MMSI number'},
                    'vessel_name': {'type': 'string', 'default': 'TEST VESSEL', 'description': 'Vessel name'},
                    'duration': {'type': 'float', 'min': 0.1, 'max': 3600, 'default': 10, 'unit': 's'}
                }
            }
        ]
        
        # Get enhanced workflows
        enhanced_workflows = self.enhanced_workflows.get_available_workflows()
        
        # Combine all workflows
        return basic_workflows + enhanced_workflows
    
    def start_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Start a specific RF workflow"""
        if self.active_workflow:
            raise Exception("Workflow already active")
        
        self.stop_flag.clear()
        self.active_workflow = workflow_name
        
        # Start workflow in separate thread
        self.workflow_thread = threading.Thread(
            target=self._run_workflow,
            args=(workflow_name, parameters)
        )
        self.workflow_thread.daemon = True
        self.workflow_thread.start()
    
    def stop_workflow(self) -> None:
        """Stop current workflow"""
        self.stop_flag.set()
        
        # Stop enhanced workflows if active
        if self.enhanced_workflows.active_workflow:
            self.enhanced_workflows.stop_workflow()
        
        if self.workflow_thread:
            self.workflow_thread.join(timeout=5)
        self.active_workflow = None
        self.hackrf.stop_transmission()
    
    def _run_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run the specified workflow"""
        try:
            # Check if it's an enhanced workflow
            enhanced_workflow_names = [w['name'] for w in self.enhanced_workflows.get_available_workflows()]
            
            if workflow_name in enhanced_workflow_names:
                # Delegate to enhanced workflows and wait for completion
                self.enhanced_workflows.start_workflow(workflow_name, parameters)
                
                # Wait for the enhanced workflow to complete or for stop signal
                while (self.enhanced_workflows.active_workflow is not None and 
                       not self.stop_flag.is_set()):
                    time.sleep(0.1)
                
                # If we were stopped by the stop flag, make sure enhanced workflow is stopped
                if self.stop_flag.is_set():
                    self.enhanced_workflows.stop_workflow()
                    
            elif workflow_name == 'sine_wave':
                self._run_sine_wave(parameters)
            elif workflow_name == 'fm_modulation':
                self._run_fm_modulation(parameters)
            elif workflow_name == 'am_modulation':
                self._run_am_modulation(parameters)
            elif workflow_name.startswith('elrs_'):
                self._run_elrs_workflow(workflow_name, parameters)
            elif workflow_name.startswith('gps_'):
                self._run_gps_workflow(workflow_name, parameters)
            elif workflow_name == 'frequency_hopping':
                self._run_frequency_hopping(parameters)
            elif workflow_name == 'ads_b_signal':
                self._run_ads_b_signal(parameters)
            elif workflow_name == 'ais_signal':
                self._run_ais_signal(parameters)
            else:
                raise Exception(f"Unknown workflow: {workflow_name}")
                
        except Exception as e:
            print(f"Error in workflow {workflow_name}: {e}")
            self.hackrf.stop_transmission()
        finally:
            # Always clean up the active workflow state
            self.active_workflow = None
    
    def _run_sine_wave(self, parameters: Dict[str, Any]) -> None:
        """Run sine wave generation"""
        print("Starting sine wave workflow...")
        rf_frequency = parameters.get('frequency', 100e6)  # RF frequency
        duration = parameters.get('duration', 10)
        baseband_freq = parameters.get('tone_freq', 1000)  # Baseband tone frequency (1kHz default)
        
        print(f"Parameters: RF={rf_frequency/1e6}MHz, Duration={duration}s, Tone={baseband_freq}Hz")
        
        # Generate sine wave signal with baseband tone
        print("Generating signal data...")
        signal_data = self.hackrf.generate_sine_wave(baseband_freq, duration)
        print(f"Generated {len(signal_data)} bytes of signal data")
        
        # Configure HackRF
        print("Configuring HackRF...")
        self.hackrf.set_frequency(int(rf_frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        print("Starting transmission...")
        result = self.hackrf.start_transmission(signal_data, int(rf_frequency), 2000000, 47)
        print(f"Transmission start result: {result}")
        
        # Wait for duration or stop signal
        print(f"Waiting for {duration} seconds or stop signal...")
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        print("Stopping transmission...")
        self.hackrf.stop_transmission()
        print("Sine wave workflow completed")
    
    def _run_fm_modulation(self, parameters: Dict[str, Any]) -> None:
        """Run FM modulation"""
        carrier_freq = parameters.get('carrier_freq', 100e6)
        mod_freq = parameters.get('mod_freq', 1e3)
        mod_depth = parameters.get('mod_depth', 1.0)
        duration = parameters.get('duration', 10)
        
        # Generate FM signal
        signal_data = self.hackrf.generate_fm_signal(
            carrier_freq, mod_freq, mod_depth, duration
        )
        
        # Configure HackRF
        self.hackrf.set_frequency(int(carrier_freq))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(carrier_freq), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_am_modulation(self, parameters: Dict[str, Any]) -> None:
        """Run AM modulation"""
        carrier_freq = parameters.get('carrier_freq', 100e6)
        mod_freq = parameters.get('mod_freq', 1e3)
        mod_depth = parameters.get('mod_depth', 0.5)
        duration = parameters.get('duration', 10)
        
        # Generate AM signal
        signal_data = self.hackrf.generate_am_signal(
            carrier_freq, mod_freq, mod_depth, duration
        )
        
        # Configure HackRF
        self.hackrf.set_frequency(int(carrier_freq))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(carrier_freq), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_elrs_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run ELRS (ExpressLRS) workflow"""
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
            
        packet_rate = parameters.get('packet_rate', 250)
        power = parameters.get('power', 25)
        duration = parameters.get('duration', 10)
        
        # Generate ELRS signal
        signal_data = self._generate_elrs_signal(frequency, packet_rate, power, duration)
        
        # Configure HackRF
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(frequency), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_gps_workflow(self, workflow_name: str, parameters: Dict[str, Any]) -> None:
        """Run GPS signal workflow"""
        frequency = parameters.get('frequency')
        if frequency is None:
            raise ValueError("Frequency parameter is required")
            
        satellite_id = parameters.get('satellite_id', 1)
        signal_strength = parameters.get('signal_strength', -120)
        duration = parameters.get('duration', 10)
        
        # Generate GPS signal
        signal_data = self._generate_gps_signal(frequency, satellite_id, signal_strength, duration)
        
        # Configure HackRF
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(frequency), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_frequency_hopping(self, parameters: Dict[str, Any]) -> None:
        """Run frequency hopping"""
        start_freq = parameters.get('start_freq', 100e6)
        end_freq = parameters.get('end_freq', 200e6)
        hop_time = parameters.get('hop_time', 0.1)
        duration = parameters.get('duration', 10)
        
        start_time = time.time()
        current_freq = start_freq
        
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            # Generate signal for current frequency
            signal_data = self.hackrf.generate_sine_wave(current_freq, hop_time)
            
            # Configure HackRF
            self.hackrf.set_frequency(int(current_freq))
            self.hackrf.set_sample_rate(2000000)
            self.hackrf.set_gain(47)  # Maximum gain for HackRF
            
            # Start transmission
            self.hackrf.start_transmission(signal_data, int(current_freq), 2000000, 47)
            
            # Wait for hop time
            time.sleep(hop_time)
            
            # Hop to next frequency
            current_freq += (end_freq - start_freq) / 10
            if current_freq > end_freq:
                current_freq = start_freq
        
        self.hackrf.stop_transmission()
    
    def _run_ads_b_signal(self, parameters: Dict[str, Any]) -> None:
        """Run ADS-B signal generation"""
        frequency = parameters.get('frequency', 1090e6)
        icao_address = parameters.get('icao_address', 'ABCDEF')
        altitude = parameters.get('altitude', 10000)
        duration = parameters.get('duration', 10)
        
        # Generate ADS-B signal (simplified)
        signal_data = self._generate_ads_b_packet(icao_address, altitude, duration)
        
        # Configure HackRF
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(frequency), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _run_ais_signal(self, parameters: Dict[str, Any]) -> None:
        """Run AIS signal generation"""
        frequency = parameters.get('frequency', 162e6)
        mmsi = parameters.get('mmsi', '123456789')
        vessel_name = parameters.get('vessel_name', 'TEST VESSEL')
        duration = parameters.get('duration', 10)
        
        # Generate AIS signal (simplified)
        signal_data = self._generate_ais_packet(mmsi, vessel_name, duration)
        
        # Configure HackRF
        self.hackrf.set_frequency(int(frequency))
        self.hackrf.set_sample_rate(2000000)
        self.hackrf.set_gain(47)  # Maximum gain for HackRF
        
        # Start transmission
        self.hackrf.start_transmission(signal_data, int(frequency), 2000000, 47)
        
        # Wait for duration or stop signal
        start_time = time.time()
        while time.time() - start_time < duration and not self.stop_flag.is_set():
            time.sleep(0.1)
        
        self.hackrf.stop_transmission()
    
    def _generate_elrs_signal(self, frequency: float, packet_rate: int, power: int, duration: float) -> bytes:
        """Generate ExpressLRS signal"""
        import numpy as np
        
        # ELRS signal parameters
        sample_rate = 2000000
        num_samples = int(duration * sample_rate)
        
        # ELRS uses LoRa-like modulation with specific parameters
        bandwidth = 500000  # 500 kHz bandwidth
        spreading_factor = 7
        coding_rate = 4/5
        
        # Create time array
        t = np.linspace(0, duration, num_samples, False)
        signal = np.zeros_like(t)
        
        # ELRS packet structure
        packet_duration = 1.0 / packet_rate  # seconds per packet
        packets_per_second = packet_rate
        
        for i in range(int(duration * packets_per_second)):
            packet_start = i * packet_duration
            packet_end = packet_start + packet_duration
            
            # Create LoRa-like chirp signal for each packet
            packet_samples_start = int(packet_start * sample_rate)
            packet_samples_end = int(packet_end * sample_rate)
            
            if packet_samples_end < len(signal):
                packet_duration_samples = packet_samples_end - packet_samples_start
                packet_t = np.linspace(0, packet_duration, packet_duration_samples, False)
                
                # LoRa chirp: frequency sweeps from -BW/2 to +BW/2
                chirp_freq = -bandwidth/2 + (bandwidth * packet_t / packet_duration)
                packet_signal = np.sin(2 * np.pi * chirp_freq * packet_t)
                
                # Add preamble and sync word
                preamble_samples = int(0.1 * packet_duration_samples)
                if preamble_samples > 0:
                    packet_signal[:preamble_samples] *= 0.5  # Lower amplitude preamble
                
                signal[packet_samples_start:packet_samples_end] = packet_signal
        
        # Convert to 8-bit unsigned integers
        signal_8bit = ((signal + 1) * 127.5).astype(np.uint8)
        return signal_8bit.tobytes()
    
    def _generate_gps_signal(self, frequency: float, satellite_id: int, signal_strength: float, duration: float) -> bytes:
        """Generate GPS signal for specified band"""
        import numpy as np
        
        # GPS signal parameters
        sample_rate = 2000000
        num_samples = int(duration * sample_rate)
        
        # GPS signal characteristics
        chip_rate = 1.023e6  # C/A code chip rate
        code_length = 1023   # C/A code length
        data_rate = 50       # Navigation data rate (50 bps)
        
        # Create time array
        t = np.linspace(0, duration, num_samples, False)
        signal = np.zeros_like(t)
        
        # Generate C/A code for the specified satellite
        ca_code = self._generate_gps_ca_code(satellite_id)
        
        # GPS signal structure
        code_period = code_length / chip_rate  # ~1ms
        data_period = 1.0 / data_rate  # 20ms
        
        for i in range(int(duration / code_period)):
            code_start = i * code_period
            code_end = code_start + code_period
            
            # Generate C/A code sequence
            code_samples_start = int(code_start * sample_rate)
            code_samples_end = int(code_end * sample_rate)
            
            if code_samples_end < len(signal):
                code_duration_samples = code_samples_end - code_samples_start
                code_t = np.linspace(0, code_period, code_duration_samples, False)
                
                # Repeat C/A code
                code_repeats = int(code_period * chip_rate / code_length)
                ca_sequence = np.tile(ca_code, code_repeats)
                
                # Interpolate to match sample rate
                if len(ca_sequence) < code_duration_samples:
                    ca_sequence = np.repeat(ca_sequence, int(code_duration_samples / len(ca_sequence)))
                
                # Ensure correct length
                if len(ca_sequence) > code_duration_samples:
                    ca_sequence = ca_sequence[:code_duration_samples]
                elif len(ca_sequence) < code_duration_samples:
                    ca_sequence = np.pad(ca_sequence, (0, code_duration_samples - len(ca_sequence)))
                
                # Create GPS signal with BPSK modulation
                carrier_freq = 1000  # 1 kHz carrier for GPS signal
                gps_signal = ca_sequence * np.sin(2 * np.pi * carrier_freq * code_t)
                
                signal[code_samples_start:code_samples_end] = gps_signal
        
        # Apply signal strength scaling
        signal *= (10 ** (signal_strength / 20))  # Convert dBm to linear scale
        
        # Convert to 8-bit unsigned integers
        signal_8bit = ((signal + 1) * 127.5).astype(np.uint8)
        return signal_8bit.tobytes()
    
    def _generate_gps_ca_code(self, satellite_id: int) -> np.ndarray:
        """Generate GPS C/A code for specified satellite"""
        import numpy as np
        
        # GPS C/A code generation (simplified)
        # In reality, each satellite has unique G1 and G2 register taps
        # This is a simplified implementation
        
        # G1 and G2 register lengths
        g1_length = 10
        g2_length = 10
        
        # Initialize registers
        g1 = np.ones(g1_length, dtype=int)
        g2 = np.ones(g2_length, dtype=int)
        
        # Generate 1023 chips
        ca_code = np.zeros(1023, dtype=int)
        
        for i in range(1023):
            # G1 feedback (XOR of taps 3 and 10)
            g1_feedback = g1[2] ^ g1[9]
            
            # G2 feedback (XOR of taps 2, 3, 6, 8, 9, 10)
            g2_feedback = g2[1] ^ g2[2] ^ g2[5] ^ g2[7] ^ g2[8] ^ g2[9]
            
            # Shift registers
            g1 = np.roll(g1, 1)
            g1[0] = g1_feedback
            
            g2 = np.roll(g2, 1)
            g2[0] = g2_feedback
            
            # C/A code output (XOR of G1 and G2 with satellite-specific taps)
            # Simplified: just use G1 output for now
            ca_code[i] = g1[9]
        
        # Convert to bipolar (-1, 1)
        ca_code = 1 - 2 * ca_code
        return ca_code
    
    def _generate_ads_b_packet(self, icao_address: str, altitude: int, duration: float) -> bytes:
        """Generate simplified ADS-B packet"""
        import numpy as np
        
        # Simplified ADS-B packet generation
        sample_rate = 2000000
        num_samples = int(duration * sample_rate)
        
        # Create a simple pulse pattern
        t = np.linspace(0, duration, num_samples, False)
        signal = np.zeros_like(t)
        
        # Add pulses at regular intervals (simulating ADS-B packets)
        packet_interval = 0.1  # seconds
        pulse_width = 0.0001   # seconds
        
        for i in range(int(duration / packet_interval)):
            packet_start = i * packet_interval
            pulse_start = int(packet_start * sample_rate)
            pulse_end = int((packet_start + pulse_width) * sample_rate)
            
            if pulse_end < len(signal):
                signal[pulse_start:pulse_end] = 1.0
        
        # Convert to 8-bit unsigned integers
        signal_8bit = ((signal + 1) * 127.5).astype(np.uint8)
        return signal_8bit.tobytes()
    
    def _generate_ais_packet(self, mmsi: str, vessel_name: str, duration: float) -> bytes:
        """Generate simplified AIS packet"""
        import numpy as np
        
        # Simplified AIS packet generation
        sample_rate = 2000000
        num_samples = int(duration * sample_rate)
        
        # Create a simple GMSK-like signal
        t = np.linspace(0, duration, num_samples, False)
        signal = np.zeros_like(t)
        
        # Add packets at regular intervals
        packet_interval = 0.2  # seconds
        packet_width = 0.026   # seconds (AIS slot time)
        
        for i in range(int(duration / packet_interval)):
            packet_start = i * packet_interval
            pulse_start = int(packet_start * sample_rate)
            pulse_end = int((packet_start + packet_width) * sample_rate)
            
            if pulse_end < len(signal):
                # Create a simple modulated signal
                packet_t = np.linspace(0, packet_width, pulse_end - pulse_start, False)
                packet_signal = np.sin(2 * np.pi * 1200 * packet_t)  # AIS uses 1200 Hz deviation
                signal[pulse_start:pulse_end] = packet_signal
        
        # Convert to 8-bit unsigned integers
        signal_8bit = ((signal + 1) * 127.5).astype(np.uint8)
        return signal_8bit.tobytes() 