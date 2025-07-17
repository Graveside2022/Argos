"""
ADS-B (Automatic Dependent Surveillance-Broadcast) Protocol Implementation
Realistic ADS-B signal generation with proper Mode S Extended Squitter format,
aircraft position simulation, and realistic flight patterns.
"""

import numpy as np
import time
import struct
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import math


@dataclass
class Aircraft:
    """Aircraft configuration and state"""
    icao: str  # 24-bit ICAO address (hex)
    callsign: str  # Aircraft callsign
    category: int  # Aircraft category
    latitude: float  # degrees
    longitude: float  # degrees
    altitude: int  # feet
    velocity: float  # knots
    heading: float  # degrees (0-359)
    vertical_rate: int  # feet/minute
    squawk: int  # Transponder code
    on_ground: bool
    aircraft_type: str  # Aircraft type code
    

@dataclass
class FlightPlan:
    """Flight plan for aircraft movement simulation"""
    waypoints: List[Tuple[float, float, int]]  # (lat, lon, alt)
    cruise_speed: float  # knots
    climb_rate: int  # feet/minute
    descent_rate: int  # feet/minute


class ADSBProtocol:
    """ADS-B Mode S Extended Squitter implementation"""
    
    # ADS-B frequency (1090 MHz)
    ADSB_FREQ = 1090e6  # Hz
    
    # Mode S parameters
    PREAMBLE_DURATION = 8e-6  # 8 microseconds
    BIT_DURATION = 1e-6  # 1 microsecond per bit
    MESSAGE_LENGTH = 112  # bits
    FRAME_DURATION = (PREAMBLE_DURATION + MESSAGE_LENGTH * BIT_DURATION)  # ~120 microseconds
    
    # Message types
    MSG_TYPE_IDENT = 1  # Aircraft identification
    MSG_TYPE_SURFACE = 5  # Surface position
    MSG_TYPE_AIRBORNE_POS = 11  # Airborne position
    MSG_TYPE_AIRBORNE_VEL = 19  # Airborne velocity
    MSG_TYPE_STATUS = 28  # Aircraft status
    
    # Aircraft categories
    AIRCRAFT_CATEGORIES = {
        'light': 1,   # Light aircraft
        'small': 2,   # Small aircraft
        'large': 3,   # Large aircraft
        'heavy': 4,   # Heavy aircraft
        'high_perf': 5,  # High performance
        'rotorcraft': 6  # Rotorcraft
    }
    
    def __init__(self):
        """Initialize ADS-B protocol"""
        self.aircraft_list = []
        self.transmission_interval = 0.5  # Default 0.5 seconds between transmissions
        
    def add_aircraft(self, aircraft: Aircraft, flight_plan: Optional[FlightPlan] = None):
        """Add aircraft to simulation"""
        aircraft_data = {
            'aircraft': aircraft,
            'flight_plan': flight_plan,
            'last_transmission': 0,
            'message_sequence': 0
        }
        self.aircraft_list.append(aircraft_data)
    
    def _calculate_crc(self, message: np.ndarray) -> int:
        """Calculate 24-bit CRC for Mode S message"""
        # Mode S CRC polynomial: x^24 + x^22 + x^20 + x^19 + x^18 + x^16 + x^14 + x^13 + x^11 + x^10 + x^8 + x^7 + x^5 + x^4 + x^2 + x + 1
        generator = 0x1FFF409  # CRC-24 polynomial
        
        # Convert message to integer
        msg_int = 0
        for i, bit in enumerate(message[:88]):  # First 88 bits (exclude CRC field)
            if bit:
                msg_int |= (1 << (87 - i))
        
        # Shift message for CRC calculation
        msg_int <<= 24
        
        # Calculate CRC
        for i in range(88):
            if msg_int & (1 << (111 - i)):
                msg_int ^= (generator << (87 - i))
        
        return msg_int & 0xFFFFFF
    
    def _encode_aircraft_identification(self, aircraft: Aircraft) -> np.ndarray:
        """Encode aircraft identification message (Type 1-4)"""
        message = np.zeros(112, dtype=int)
        
        # Downlink Format (5 bits) = 17 (ADS-B)
        df = 17
        for i in range(5):
            message[i] = (df >> (4 - i)) & 1
        
        # Capability (3 bits)
        ca = 5  # Level 2+ transponder
        for i in range(3):
            message[5 + i] = (ca >> (2 - i)) & 1
        
        # ICAO address (24 bits)
        icao_int = int(aircraft.icao, 16)
        for i in range(24):
            message[8 + i] = (icao_int >> (23 - i)) & 1
        
        # Type Code (5 bits) = 4 (Aircraft Identification)
        tc = 4
        for i in range(5):
            message[32 + i] = (tc >> (4 - i)) & 1
        
        # Aircraft Category (3 bits)
        for i in range(3):
            message[37 + i] = (aircraft.category >> (2 - i)) & 1
        
        # Callsign (48 bits, 8 characters x 6 bits each)
        callsign_padded = (aircraft.callsign + "        ")[:8]  # Pad to 8 chars
        for char_idx, char in enumerate(callsign_padded):
            char_code = self._encode_adsb_char(char)
            for bit_idx in range(6):
                message[40 + char_idx * 6 + bit_idx] = (char_code >> (5 - bit_idx)) & 1
        
        # Calculate and set CRC (24 bits)
        crc = self._calculate_crc(message)
        for i in range(24):
            message[88 + i] = (crc >> (23 - i)) & 1
        
        return message
    
    def _encode_adsb_char(self, char: str) -> int:
        """Encode character for ADS-B callsign"""
        if char == ' ':
            return 32
        elif 'A' <= char <= 'Z':
            return ord(char) - ord('A') + 1
        elif '0' <= char <= '9':
            return ord(char) - ord('0') + 48
        else:
            return 32  # Space for unknown characters
    
    def _encode_airborne_position(self, aircraft: Aircraft, odd_even: int) -> np.ndarray:
        """Encode airborne position message (Type 11)"""
        message = np.zeros(112, dtype=int)
        
        # Downlink Format (5 bits) = 17
        df = 17
        for i in range(5):
            message[i] = (df >> (4 - i)) & 1
        
        # Capability (3 bits)
        ca = 5
        for i in range(3):
            message[5 + i] = (ca >> (2 - i)) & 1
        
        # ICAO address (24 bits)
        icao_int = int(aircraft.icao, 16)
        for i in range(24):
            message[8 + i] = (icao_int >> (23 - i)) & 1
        
        # Type Code (5 bits) = 11 (Airborne Position)
        tc = 11
        for i in range(5):
            message[32 + i] = (tc >> (4 - i)) & 1
        
        # Surveillance Status (2 bits)
        ss = 0  # No condition information
        for i in range(2):
            message[37 + i] = (ss >> (1 - i)) & 1
        
        # Single Antenna Flag (1 bit)
        message[39] = 0
        
        # Altitude (12 bits) - encoded altitude in 25-foot increments
        alt_encoded = self._encode_altitude(aircraft.altitude)
        for i in range(12):
            message[40 + i] = (alt_encoded >> (11 - i)) & 1
        
        # Time synchronization (1 bit)
        message[52] = 0
        
        # CPR format (1 bit) - 0 for even, 1 for odd
        message[53] = odd_even
        
        # Encoded latitude (17 bits)
        lat_cpr = self._encode_cpr_latitude(aircraft.latitude, odd_even)
        for i in range(17):
            message[54 + i] = (lat_cpr >> (16 - i)) & 1
        
        # Encoded longitude (17 bits)
        lon_cpr = self._encode_cpr_longitude(aircraft.longitude, odd_even)
        for i in range(17):
            message[71 + i] = (lon_cpr >> (16 - i)) & 1
        
        # Calculate and set CRC (24 bits)
        crc = self._calculate_crc(message)
        for i in range(24):
            message[88 + i] = (crc >> (23 - i)) & 1
        
        return message
    
    def _encode_altitude(self, altitude_ft: int) -> int:
        """Encode altitude in ADS-B format"""
        # Altitude encoding in 25-foot increments
        # Remove the least significant bit for Mode S altitude encoding
        alt_code = (altitude_ft + 1000) // 25  # Add 1000ft offset, divide by 25
        
        # Ensure within valid range
        alt_code = max(0, min(0xFFF, alt_code))
        
        return alt_code
    
    def _encode_cpr_latitude(self, latitude: float, odd_even: int) -> int:
        """Encode latitude using CPR (Compact Position Reporting)"""
        # CPR encoding parameters
        nb = 17  # Number of bits
        
        if odd_even == 0:  # Even frame
            nl = 60  # Number of longitude zones
        else:  # Odd frame
            nl = 59
        
        # Normalize latitude to 0-1 range
        lat_norm = (latitude + 90) / 180
        
        # CPR encoding
        lat_cpr = int(lat_norm * (2**nb))
        lat_cpr = lat_cpr & ((1 << nb) - 1)  # Mask to 17 bits
        
        return lat_cpr
    
    def _encode_cpr_longitude(self, longitude: float, odd_even: int) -> int:
        """Encode longitude using CPR"""
        nb = 17  # Number of bits
        
        if odd_even == 0:  # Even frame
            nl = 60
        else:  # Odd frame
            nl = 59
        
        # Normalize longitude to 0-1 range
        lon_norm = (longitude + 180) / 360
        
        # CPR encoding
        lon_cpr = int(lon_norm * (2**nb))
        lon_cpr = lon_cpr & ((1 << nb) - 1)  # Mask to 17 bits
        
        return lon_cpr
    
    def _encode_velocity(self, aircraft: Aircraft) -> np.ndarray:
        """Encode velocity message (Type 19)"""
        message = np.zeros(112, dtype=int)
        
        # Downlink Format (5 bits) = 17
        df = 17
        for i in range(5):
            message[i] = (df >> (4 - i)) & 1
        
        # Capability (3 bits)
        ca = 5
        for i in range(3):
            message[5 + i] = (ca >> (2 - i)) & 1
        
        # ICAO address (24 bits)
        icao_int = int(aircraft.icao, 16)
        for i in range(24):
            message[8 + i] = (icao_int >> (23 - i)) & 1
        
        # Type Code (5 bits) = 19 (Velocity)
        tc = 19
        for i in range(5):
            message[32 + i] = (tc >> (4 - i)) & 1
        
        # Subtype (3 bits) = 1 (Ground speed and track angle)
        st = 1
        for i in range(3):
            message[37 + i] = (st >> (2 - i)) & 1
        
        # Intent change flag (1 bit)
        message[40] = 0
        
        # Reserved (1 bit)
        message[41] = 0
        
        # Calculate velocity components
        vel_ew = int(aircraft.velocity * np.sin(np.radians(aircraft.heading)))  # East-West
        vel_ns = int(aircraft.velocity * np.cos(np.radians(aircraft.heading)))  # North-South
        
        # East-West velocity sign and magnitude (11 bits)
        if vel_ew >= 0:
            message[42] = 0  # East
            vel_ew_mag = min(vel_ew, 1023)
        else:
            message[42] = 1  # West
            vel_ew_mag = min(-vel_ew, 1023)
        
        for i in range(10):
            message[43 + i] = (vel_ew_mag >> (9 - i)) & 1
        
        # North-South velocity sign and magnitude (11 bits)
        if vel_ns >= 0:
            message[53] = 0  # North
            vel_ns_mag = min(vel_ns, 1023)
        else:
            message[53] = 1  # South
            vel_ns_mag = min(-vel_ns, 1023)
        
        for i in range(10):
            message[54 + i] = (vel_ns_mag >> (9 - i)) & 1
        
        # Vertical rate source (1 bit)
        message[64] = 0  # Barometric
        
        # Vertical rate sign and magnitude (9 bits)
        if aircraft.vertical_rate >= 0:
            message[65] = 0  # Up
            vr_mag = min(aircraft.vertical_rate // 64, 511)  # 64 ft/min resolution
        else:
            message[65] = 1  # Down
            vr_mag = min(-aircraft.vertical_rate // 64, 511)
        
        for i in range(9):
            message[66 + i] = (vr_mag >> (8 - i)) & 1
        
        # Reserved bits and difference signs
        for i in range(13):
            message[75 + i] = 0
        
        # Calculate and set CRC (24 bits)
        crc = self._calculate_crc(message)
        for i in range(24):
            message[88 + i] = (crc >> (23 - i)) & 1
        
        return message
    
    def _generate_preamble(self) -> np.ndarray:
        """Generate Mode S preamble pattern"""
        # Mode S preamble: 1010000101000000 (16 bits)
        preamble_bits = [1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]
        return np.array(preamble_bits, dtype=int)
    
    def _modulate_message(self, message_bits: np.ndarray, sample_rate: int) -> np.ndarray:
        """Modulate ADS-B message using PPM (Pulse Position Modulation)"""
        # Mode S uses pulse position modulation
        # 0 bit: pulse at start of bit period
        # 1 bit: pulse at middle of bit period
        
        samples_per_bit = int(self.BIT_DURATION * sample_rate)
        pulse_width_samples = samples_per_bit // 4  # Pulse width = 0.25 microseconds
        
        modulated_signal = np.zeros(len(message_bits) * samples_per_bit)
        
        for i, bit in enumerate(message_bits):
            bit_start = i * samples_per_bit
            
            if bit == 0:
                # Pulse at start of bit period
                pulse_start = bit_start
            else:
                # Pulse at middle of bit period
                pulse_start = bit_start + samples_per_bit // 2
            
            # Add pulse
            pulse_end = min(pulse_start + pulse_width_samples, len(modulated_signal))
            modulated_signal[pulse_start:pulse_end] = 1.0
        
        return modulated_signal
    
    def _simulate_aircraft_movement(self, aircraft_data: Dict[str, Any], time_delta: float):
        """Simulate aircraft movement based on flight plan"""
        aircraft = aircraft_data['aircraft']
        flight_plan = aircraft_data['flight_plan']
        
        if flight_plan is None:
            # No flight plan, generate random movement
            # Small random changes to simulate realistic flight
            aircraft.heading += np.random.normal(0, 2)  # Small heading changes
            aircraft.heading = aircraft.heading % 360
            
            # Move aircraft based on current heading and velocity
            distance_nm = (aircraft.velocity * time_delta) / 3600  # nautical miles
            
            # Convert to lat/lon changes
            lat_change = distance_nm * np.cos(np.radians(aircraft.heading)) / 60
            lon_change = distance_nm * np.sin(np.radians(aircraft.heading)) / (60 * np.cos(np.radians(aircraft.latitude)))
            
            aircraft.latitude += lat_change
            aircraft.longitude += lon_change
            
            # Random altitude changes
            aircraft.altitude += int(np.random.normal(0, 100))
            aircraft.altitude = max(0, aircraft.altitude)
            
            # Random vertical rate
            aircraft.vertical_rate = int(np.random.normal(0, 500))
            
        else:
            # Follow flight plan (simplified implementation)
            # This would be more complex in a real implementation
            pass
    
    def generate_adsb_transmission(self, duration: float, sample_rate: int = 2000000) -> np.ndarray:
        """Generate realistic ADS-B transmission with multiple aircraft using cache"""
        # Use cache for ADS-B signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        if not self.aircraft_list:
            # Create some default aircraft if none exist
            self._create_default_aircraft()
        
        # Define parameters for caching
        parameters = {
            'num_aircraft': len(self.aircraft_list),
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(num_aircraft, duration):
            return self._generate_adsb_transmission_internal(duration, sample_rate)
        
        # Get from cache or generate
        cached_path, actual_sample_rate = cache.get_or_generate_signal(
            signal_type='adsb',
            protocol='adsb_1090',
            parameters=parameters,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        return signal_data
    
    def _generate_adsb_transmission_internal(self, duration: float, sample_rate: int = 2000000) -> tuple:
        """Internal method to generate ADS-B transmission (called by cache)"""
        if not self.aircraft_list:
            # Create some default aircraft if none exist
            self._create_default_aircraft()
        
        total_samples = int(duration * sample_rate)
        signal = np.zeros(total_samples)
        
        current_time = 0
        time_step = 0.1  # 100ms time steps
        
        while current_time < duration:
            # Update aircraft positions
            for aircraft_data in self.aircraft_list:
                self._simulate_aircraft_movement(aircraft_data, time_step)
                
                # Check if it's time for this aircraft to transmit
                if (current_time - aircraft_data['last_transmission']) >= self.transmission_interval:
                    aircraft = aircraft_data['aircraft']
                    
                    # Determine message type to send
                    seq = aircraft_data['message_sequence'] % 4
                    
                    if seq == 0:
                        # Send identification message
                        message = self._encode_aircraft_identification(aircraft)
                    elif seq == 1:
                        # Send position message (even)
                        message = self._encode_airborne_position(aircraft, 0)
                    elif seq == 2:
                        # Send position message (odd)
                        message = self._encode_airborne_position(aircraft, 1)
                    else:
                        # Send velocity message
                        message = self._encode_velocity(aircraft)
                    
                    # Add preamble
                    preamble = self._generate_preamble()
                    full_message = np.concatenate([preamble, message])
                    
                    # Modulate message
                    modulated = self._modulate_message(full_message, sample_rate)
                    
                    # Place in signal at current time
                    start_sample = int(current_time * sample_rate)
                    end_sample = min(start_sample + len(modulated), total_samples)
                    
                    if end_sample <= total_samples:
                        signal[start_sample:end_sample] += modulated[:end_sample-start_sample]
                    
                    # Update transmission time and sequence
                    aircraft_data['last_transmission'] = current_time
                    aircraft_data['message_sequence'] += 1
            
            current_time += time_step
        
        # Add some noise and normalize
        noise_level = 0.01
        noise = np.random.normal(0, noise_level, len(signal))
        signal += noise
        
        # Normalize signal to maximum amplitude for HackRF output
        max_val = np.max(np.abs(signal))
        if max_val > 0:
            signal = signal / max_val * 1.0  # Use full amplitude
        
        return signal, sample_rate
    
    def _create_default_aircraft(self):
        """Create some default aircraft for demonstration"""
        aircraft_configs = [
            {
                'icao': 'A12345', 'callsign': 'UAL123', 'category': 3,
                'lat': 37.7749, 'lon': -122.4194, 'alt': 35000,
                'vel': 450, 'hdg': 90, 'vr': 0, 'type': 'B738'
            },
            {
                'icao': 'B67890', 'callsign': 'DAL456', 'category': 3,
                'lat': 40.7128, 'lon': -74.0060, 'alt': 28000,
                'vel': 420, 'hdg': 270, 'vr': -500, 'type': 'A320'
            },
            {
                'icao': 'C11111', 'callsign': 'SWA789', 'category': 3,
                'lat': 34.0522, 'lon': -118.2437, 'alt': 15000,
                'vel': 380, 'hdg': 45, 'vr': 1200, 'type': 'B737'
            }
        ]
        
        for config in aircraft_configs:
            aircraft = Aircraft(
                icao=config['icao'],
                callsign=config['callsign'],
                category=config['category'],
                latitude=config['lat'],
                longitude=config['lon'],
                altitude=config['alt'],
                velocity=config['vel'],
                heading=config['hdg'],
                vertical_rate=config['vr'],
                squawk=1200,
                on_ground=False,
                aircraft_type=config['type']
            )
            self.add_aircraft(aircraft)
    
    def get_aircraft_list(self) -> List[Dict[str, Any]]:
        """Get list of all aircraft in simulation"""
        aircraft_info = []
        for aircraft_data in self.aircraft_list:
            aircraft = aircraft_data['aircraft']
            info = {
                'icao': aircraft.icao,
                'callsign': aircraft.callsign,
                'latitude': aircraft.latitude,
                'longitude': aircraft.longitude,
                'altitude': aircraft.altitude,
                'velocity': aircraft.velocity,
                'heading': aircraft.heading,
                'vertical_rate': aircraft.vertical_rate,
                'on_ground': aircraft.on_ground,
                'aircraft_type': aircraft.aircraft_type
            }
            aircraft_info.append(info)
        return aircraft_info 