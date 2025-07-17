"""
GPS Signal Generation Module
Realistic GPS signal generation with proper C/A codes, navigation data,
ephemeris information, and multi-satellite simulation.
"""

import numpy as np
import time
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timezone
import struct


@dataclass
class GPSSatellite:
    """GPS satellite configuration and ephemeris data"""
    svid: int  # Satellite ID (1-32)
    health: int  # 0 = healthy
    elevation: float  # degrees
    azimuth: float  # degrees
    signal_strength: float  # dBm
    doppler: float  # Hz
    code_phase: float  # chips
    carrier_phase: float  # cycles


@dataclass
class GPSEphemeris:
    """GPS ephemeris data for satellite orbit calculation"""
    svid: int
    toe: float  # Time of ephemeris
    m0: float   # Mean anomaly at reference time
    delta_n: float  # Mean motion difference
    e: float    # Eccentricity
    sqrt_a: float  # Square root of semi-major axis
    omega0: float  # Longitude of ascending node
    i0: float   # Inclination angle
    omega: float  # Argument of perigee
    omega_dot: float  # Rate of right ascension
    idot: float  # Rate of inclination angle
    cuc: float  # Amplitude of cosine harmonic correction (argument of latitude)
    cus: float  # Amplitude of sine harmonic correction (argument of latitude)
    crc: float  # Amplitude of cosine harmonic correction (orbit radius)
    crs: float  # Amplitude of sine harmonic correction (orbit radius)
    cic: float  # Amplitude of cosine harmonic correction (inclination)
    cis: float  # Amplitude of sine harmonic correction (inclination)


class GPSProtocol:
    """GPS signal generation with realistic multi-satellite simulation"""
    
    # GPS L1 C/A code properties
    GPS_L1_FREQ = 1575.42e6  # Hz
    GPS_L2_FREQ = 1227.60e6  # Hz
    GPS_L5_FREQ = 1176.45e6  # Hz
    
    CA_CODE_RATE = 1.023e6   # chips/sec
    CA_CODE_LENGTH = 1023    # chips
    CA_CODE_PERIOD = 1e-3    # seconds
    
    NAV_DATA_RATE = 50       # bits/sec
    NAV_BIT_DURATION = 0.02  # seconds (20ms)
    
    # GPS C/A code generator polynomials for each satellite
    CA_CODE_TAPS = {
        1: (2, 6), 2: (3, 7), 3: (4, 8), 4: (5, 9), 5: (1, 9),
        6: (2, 10), 7: (1, 8), 8: (2, 9), 9: (3, 10), 10: (2, 3),
        11: (3, 4), 12: (5, 6), 13: (6, 7), 14: (7, 8), 15: (8, 9),
        16: (9, 10), 17: (1, 4), 18: (2, 5), 19: (3, 6), 20: (4, 7),
        21: (5, 8), 22: (6, 9), 23: (1, 3), 24: (4, 6), 25: (5, 7),
        26: (6, 8), 27: (7, 9), 28: (8, 10), 29: (1, 6), 30: (2, 7),
        31: (3, 8), 32: (4, 9)
    }
    
    def __init__(self, frequency_band: str = 'L1'):
        """Initialize GPS protocol for specified frequency band"""
        self.frequency_band = frequency_band
        self.carrier_freq = {
            'L1': self.GPS_L1_FREQ,
            'L2': self.GPS_L2_FREQ,
            'L5': self.GPS_L5_FREQ
        }.get(frequency_band, self.GPS_L1_FREQ)
        
        self.satellites = self._initialize_satellites()
        self.ephemeris_data = self._generate_ephemeris_data()
        
    def _initialize_satellites(self) -> List[GPSSatellite]:
        """Initialize realistic satellite constellation"""
        satellites = []
        
        # Typical GPS constellation has 24-32 satellites
        # Simulate 8 visible satellites with realistic parameters
        visible_sats = [1, 3, 6, 11, 14, 18, 22, 25]
        
        for i, svid in enumerate(visible_sats):
            # Generate realistic satellite parameters
            elevation = 15 + 70 * np.random.random()  # 15-85 degrees
            azimuth = i * 45 + np.random.normal(0, 10)  # Spread around sky
            
            # Signal strength based on elevation (higher = stronger)
            signal_strength = -140 + 20 * (elevation / 90)  # -140 to -120 dBm
            
            # Doppler shift based on satellite motion (-5 to +5 kHz)
            doppler = np.random.normal(0, 2000)  # Hz
            
            # Random code and carrier phase
            code_phase = np.random.random() * self.CA_CODE_LENGTH
            carrier_phase = np.random.random() * 2 * np.pi
            
            satellite = GPSSatellite(
                svid=svid,
                health=0,  # Healthy
                elevation=elevation,
                azimuth=azimuth,
                signal_strength=signal_strength,
                doppler=doppler,
                code_phase=code_phase,
                carrier_phase=carrier_phase
            )
            satellites.append(satellite)
            
        return satellites
    
    def _generate_ephemeris_data(self) -> Dict[int, GPSEphemeris]:
        """Generate realistic ephemeris data for satellites"""
        ephemeris = {}
        
        for sat in self.satellites:
            # Generate realistic orbital parameters
            eph = GPSEphemeris(
                svid=sat.svid,
                toe=time.time(),  # Current time
                m0=np.random.uniform(0, 2*np.pi),  # Mean anomaly
                delta_n=4.8e-9,  # Typical value
                e=0.01,  # Low eccentricity for GPS
                sqrt_a=5153.7,  # GPS semi-major axis sqrt(m)
                omega0=np.random.uniform(0, 2*np.pi),  # Longitude of ascending node
                i0=np.radians(55),  # GPS inclination ~55 degrees
                omega=np.random.uniform(0, 2*np.pi),  # Argument of perigee
                omega_dot=-2.6e-9,  # Typical rotation rate
                idot=0,  # Small inclination rate
                cuc=1e-6, cus=1e-6,  # Small harmonic corrections
                crc=300, crs=50,
                cic=1e-7, cis=1e-7
            )
            ephemeris[sat.svid] = eph
            
        return ephemeris
    
    def _generate_ca_code(self, svid: int) -> np.ndarray:
        """Generate C/A code for specified satellite"""
        if svid not in self.CA_CODE_TAPS:
            raise ValueError(f"Invalid satellite ID: {svid}")
        
        # G1 register (10-bit, feedback from taps 3 and 10)
        g1 = np.ones(10, dtype=int)
        
        # G2 register (10-bit, feedback from taps 2,3,6,8,9,10)
        g2 = np.ones(10, dtype=int)
        
        # Get satellite-specific G2 taps
        tap1, tap2 = self.CA_CODE_TAPS[svid]
        
        ca_code = np.zeros(self.CA_CODE_LENGTH, dtype=int)
        
        for i in range(self.CA_CODE_LENGTH):
            # Generate C/A code chip
            ca_code[i] = g1[9] ^ g2[tap1-1] ^ g2[tap2-1]
            
            # Shift G1 register
            g1_feedback = g1[2] ^ g1[9]
            g1[1:] = g1[:-1]
            g1[0] = g1_feedback
            
            # Shift G2 register
            g2_feedback = g2[1] ^ g2[2] ^ g2[5] ^ g2[7] ^ g2[8] ^ g2[9]
            g2[1:] = g2[:-1]
            g2[0] = g2_feedback
        
        # Convert to bipolar (-1, +1)
        return 1 - 2 * ca_code
    
    def _generate_navigation_data(self, svid: int, duration: float) -> np.ndarray:
        """Generate GPS navigation message data"""
        # GPS navigation message structure:
        # - 1500 bits per frame (30 seconds)
        # - 5 subframes per frame (6 seconds each)
        # - 10 words per subframe (0.6 seconds each)
        # - 30 bits per word (20ms per bit)
        
        num_bits = int(duration * self.NAV_DATA_RATE)
        nav_bits = np.zeros(num_bits, dtype=int)
        
        # Simplified navigation message generation
        bit_index = 0
        
        while bit_index < num_bits:
            # Generate one frame (1500 bits)
            frame_bits = self._generate_nav_frame(svid)
            
            # Copy frame bits to output
            end_index = min(bit_index + len(frame_bits), num_bits)
            nav_bits[bit_index:end_index] = frame_bits[:end_index-bit_index]
            bit_index = end_index
        
        return nav_bits
    
    def _generate_nav_frame(self, svid: int) -> np.ndarray:
        """Generate one GPS navigation frame (1500 bits)"""
        frame = np.zeros(1500, dtype=int)
        
        # Subframe 1: Clock data and satellite health
        subframe1 = self._generate_subframe1(svid)
        frame[0:300] = subframe1
        
        # Subframe 2: Ephemeris data (part 1)
        subframe2 = self._generate_subframe2(svid)
        frame[300:600] = subframe2
        
        # Subframe 3: Ephemeris data (part 2)
        subframe3 = self._generate_subframe3(svid)
        frame[600:900] = subframe3
        
        # Subframes 4 and 5: Almanac data (simplified)
        subframe4 = self._generate_almanac_subframe(svid, 4)
        frame[900:1200] = subframe4
        
        subframe5 = self._generate_almanac_subframe(svid, 5)
        frame[1200:1500] = subframe5
        
        return frame
    
    def _generate_subframe1(self, svid: int) -> np.ndarray:
        """Generate subframe 1 (clock and health data)"""
        subframe = np.zeros(300, dtype=int)
        
        # Preamble (8 bits): 10001011
        preamble = [1, 0, 0, 0, 1, 0, 1, 1]
        subframe[0:8] = preamble
        
        # TLM word (30 bits total, 22 bits data + 6 parity + 2 reserved)
        tlm_data = np.random.randint(0, 2, 22)
        subframe[8:30] = tlm_data
        
        # HOW word (Hand Over Word)
        how_data = np.random.randint(0, 2, 22)
        subframe[30:52] = how_data
        
        # Clock data and satellite health (simplified)
        clock_health = np.random.randint(0, 2, 248)
        subframe[52:300] = clock_health
        
        return subframe
    
    def _generate_subframe2(self, svid: int) -> np.ndarray:
        """Generate subframe 2 (ephemeris data part 1)"""
        subframe = np.zeros(300, dtype=int)
        
        # Preamble
        preamble = [1, 0, 0, 0, 1, 0, 1, 1]
        subframe[0:8] = preamble
        
        # Ephemeris data (simplified - real implementation would encode actual orbital parameters)
        if svid in self.ephemeris_data:
            eph = self.ephemeris_data[svid]
            # In real GPS, this would be properly formatted ephemeris data
            # For simulation, we use random data
            eph_bits = np.random.randint(0, 2, 292)
            subframe[8:300] = eph_bits
        else:
            subframe[8:300] = np.random.randint(0, 2, 292)
        
        return subframe
    
    def _generate_subframe3(self, svid: int) -> np.ndarray:
        """Generate subframe 3 (ephemeris data part 2)"""
        subframe = np.zeros(300, dtype=int)
        
        # Preamble
        preamble = [1, 0, 0, 0, 1, 0, 1, 1]
        subframe[0:8] = preamble
        
        # More ephemeris data
        eph_bits = np.random.randint(0, 2, 292)
        subframe[8:300] = eph_bits
        
        return subframe
    
    def _generate_almanac_subframe(self, svid: int, subframe_id: int) -> np.ndarray:
        """Generate almanac subframe (4 or 5)"""
        subframe = np.zeros(300, dtype=int)
        
        # Preamble
        preamble = [1, 0, 0, 0, 1, 0, 1, 1]
        subframe[0:8] = preamble
        
        # Almanac data (simplified)
        almanac_bits = np.random.randint(0, 2, 292)
        subframe[8:300] = almanac_bits
        
        return subframe
    
    def _apply_doppler_shift(self, signal: np.ndarray, doppler_hz: float, 
                           sample_rate: int) -> np.ndarray:
        """Apply Doppler shift to signal"""
        if abs(doppler_hz) < 1:  # Skip if negligible
            return signal
        
        # Create frequency shift
        t = np.arange(len(signal)) / sample_rate
        doppler_shift = np.exp(1j * 2 * np.pi * doppler_hz * t)
        
        # Apply shift (assuming complex signal)
        if np.iscomplexobj(signal):
            return signal * doppler_shift
        else:
            # For real signals, apply as frequency modulation
            return signal * np.real(doppler_shift)
    
    def generate_gps_signal(self, duration: float, sample_rate: int = 2000000,
                           include_satellites: Optional[List[int]] = None) -> np.ndarray:
        """Generate realistic GPS signal with multiple satellites using cache"""
        # Use cache for GPS signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        if include_satellites is None:
            include_satellites = [sat.svid for sat in self.satellites]
        
        # Define parameters for caching
        parameters = {
            'band': self.frequency_band,
            'num_satellites': len(include_satellites),
            'duration': duration
        }
        
        # Debug logging removed for clean output
        
        # Define generator function
        def generate_signal(band, num_satellites, duration):
            return self._generate_gps_signal_internal(duration, sample_rate, include_satellites)
        
        # Get from cache or generate
        cached_path, actual_sample_rate = cache.get_or_generate_signal(
            signal_type='gps',
            protocol=f'gps_{self.frequency_band.lower()}',
            parameters=parameters,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        return signal_data
    
    def _generate_gps_signal_internal(self, duration: float, sample_rate: int = 2000000,
                                    include_satellites: Optional[List[int]] = None) -> Tuple[np.ndarray, float]:
        """Internal method to generate GPS signal (called by cache)"""
        if include_satellites is None:
            include_satellites = [sat.svid for sat in self.satellites]
        
        # Initialize composite signal
        total_samples = int(duration * sample_rate)
        composite_signal = np.zeros(total_samples, dtype=complex)
        
        for satellite in self.satellites:
            if satellite.svid not in include_satellites:
                continue
                
            print(f"Generating signal for GPS satellite {satellite.svid}")
            
            # Generate C/A code for this satellite
            ca_code = self._generate_ca_code(satellite.svid)
            
            # Generate navigation data
            nav_data = self._generate_navigation_data(satellite.svid, duration)
            
            # Create time arrays
            t = np.linspace(0, duration, total_samples, False)
            
            # Generate C/A code sequence for full duration
            ca_sequence = np.zeros(total_samples)
            ca_chip_duration = 1.0 / self.CA_CODE_RATE
            samples_per_chip = int(ca_chip_duration * sample_rate)
            
            for i in range(total_samples):
                chip_index = int((i / sample_rate) * self.CA_CODE_RATE) % self.CA_CODE_LENGTH
                ca_sequence[i] = ca_code[chip_index]
            
            # Generate navigation data sequence
            nav_sequence = np.zeros(total_samples)
            nav_bit_duration = self.NAV_BIT_DURATION
            samples_per_bit = int(nav_bit_duration * sample_rate)
            
            for i in range(total_samples):
                bit_index = int((i / sample_rate) / nav_bit_duration) % len(nav_data)
                nav_bit = 1 if nav_data[bit_index] == 0 else -1  # NRZ encoding
                nav_sequence[i] = nav_bit
            
            # Combine C/A code and navigation data (BPSK modulation)
            baseband_signal = ca_sequence * nav_sequence
            
            # Apply carrier frequency (complex exponential)
            carrier_freq_with_doppler = self.carrier_freq + satellite.doppler
            carrier = np.exp(1j * 2 * np.pi * carrier_freq_with_doppler * t + satellite.carrier_phase)
            
            # Modulate signal
            modulated_signal = baseband_signal * carrier
            
            # Apply maximum signal strength for HackRF output
            signal_amplitude = 1.0  # Use maximum amplitude
            modulated_signal *= signal_amplitude
            
            # Add to composite signal
            composite_signal += modulated_signal
        
        # Add noise (thermal noise + atmospheric effects)
        noise_power = 1e-12  # Very low noise floor for GPS
        noise = np.sqrt(noise_power) * (np.random.randn(total_samples) + 1j * np.random.randn(total_samples))
        composite_signal += noise
        
        # Convert to real signal (take real part)
        real_signal = np.real(composite_signal)
        
        # Normalize to maximum amplitude for HackRF output
        max_val = np.max(np.abs(real_signal))
        if max_val > 0:
            real_signal = real_signal / max_val * 1.0  # Use full amplitude
        
        return real_signal, sample_rate
    
    def get_satellite_info(self) -> List[Dict[str, Any]]:
        """Get information about all satellites"""
        satellite_info = []
        for sat in self.satellites:
            info = {
                'svid': sat.svid,
                'elevation': sat.elevation,
                'azimuth': sat.azimuth,
                'signal_strength': sat.signal_strength,
                'doppler': sat.doppler,
                'health': 'Healthy' if sat.health == 0 else 'Unhealthy'
            }
            satellite_info.append(info)
        return satellite_info
    
    def get_constellation_info(self) -> Dict[str, Any]:
        """Get GPS constellation information"""
        return {
            'frequency_band': self.frequency_band,
            'carrier_frequency': self.carrier_freq,
            'num_satellites': len(self.satellites),
            'satellites': [sat.svid for sat in self.satellites],
            'code_rate': self.CA_CODE_RATE,
            'nav_data_rate': self.NAV_DATA_RATE
        } 