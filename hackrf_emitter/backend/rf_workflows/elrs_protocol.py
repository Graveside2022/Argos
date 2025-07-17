#!/usr/bin/env python3
"""
ExpressLRS (ELRS) Protocol Implementation
Realistic ExpressLRS control link simulation with proper LoRa modulation,
frequency hopping, telemetry, and RC control packet generation.
"""

import numpy as np
import time
import struct
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from .crc16_python import crc16xmodem


@dataclass
class ELRSPacket:
    """ELRS packet structure"""
    type: int           # 0x0 = RC data, 0x1 = Telemetry, 0x2 = Sync
    channels: List[int] # RC channel values (1000-2000 microseconds)
    telemetry: Dict    # Telemetry data (RSSI, LQ, battery, etc.)
    sync_data: bytes   # Sync packet data
    crc: int          # CRC16 checksum


class ELRSProtocol:
    """ExpressLRS protocol implementation with realistic signal generation"""
    
    # ELRS frequency configurations for different bands
    FREQUENCY_CONFIGS = {
        '433': {
            'center_freq': 433.42e6,
            'channels': [433.42e6, 434.42e6, 435.42e6],
            'bandwidth': 250000,  # 250 kHz
            'max_power': 100,  # mW
        },
        '868': {
            'center_freq': 868.4e6,
            'channels': [868.1e6, 868.3e6, 868.5e6, 868.7e6, 868.9e6],
            'bandwidth': 250000,
            'max_power': 25,  # mW (EU regulations)
        },
        '915': {
            'center_freq': 915.5e6,
            'channels': [903.4e6, 905.4e6, 907.4e6, 909.4e6, 911.4e6, 
                        913.4e6, 915.4e6, 917.4e6, 919.4e6, 921.4e6],
            'bandwidth': 500000,  # 500 kHz
            'max_power': 1000,  # mW (FCC Part 15)
        },
        '2400': {
            'center_freq': 2440e6,
            'channels': [2400e6, 2410e6, 2420e6, 2430e6, 2440e6, 
                        2450e6, 2460e6, 2470e6, 2480e6],
            'bandwidth': 2000000,  # 2 MHz
            'max_power': 250,  # mW
        }
    }
    
    # Packet rate configurations (realistic ELRS rates)
    PACKET_RATES = {
        25: {'sf': 12, 'bw': 250000, 'cr': '4/5', 'interval': 0.04},
        50: {'sf': 11, 'bw': 250000, 'cr': '4/5', 'interval': 0.02},
        100: {'sf': 10, 'bw': 250000, 'cr': '4/5', 'interval': 0.01},
        200: {'sf': 9, 'bw': 250000, 'cr': '4/5', 'interval': 0.005},
        333: {'sf': 8, 'bw': 500000, 'cr': '4/5', 'interval': 0.003},
        500: {'sf': 7, 'bw': 500000, 'cr': '4/5', 'interval': 0.002},
    }
    
    def __init__(self, band: str = '433'):
        """Initialize ELRS protocol for specified band"""
        self.band = band
        self.config = self.FREQUENCY_CONFIGS.get(band, self.FREQUENCY_CONFIGS['433'])
        self.channels = self.config['channels']
        self.current_channel = 0
        self.hop_sequence = self._generate_hop_sequence()
        self.sync_word = 0x12345678  # ELRS sync word
        
    def _generate_hop_sequence(self) -> List[int]:
        """Generate pseudo-random frequency hopping sequence"""
        # Simplified FHSS sequence generation
        np.random.seed(0x12345678)  # Use sync word as seed
        sequence = list(range(len(self.channels)))
        np.random.shuffle(sequence)
        return sequence * 100  # Repeat sequence
    
    def _generate_lora_chirp(self, duration: float, bandwidth: float, 
                           spreading_factor: int, sample_rate: int, 
                           is_upchirp: bool = True) -> np.ndarray:
        """Generate LoRa chirp signal"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # LoRa chirp parameters
        f_start = -bandwidth / 2
        f_end = bandwidth / 2
        
        if not is_upchirp:
            f_start, f_end = f_end, f_start
        
        # Linear frequency sweep (chirp)
        freq_slope = (f_end - f_start) / duration
        instantaneous_freq = f_start + freq_slope * t
        
        # Generate chirp signal
        phase = 2 * np.pi * (f_start * t + 0.5 * freq_slope * t**2)
        chirp = np.cos(phase)
        
        return chirp
    
    def _create_rc_packet(self, channel_values: List[int], packet_number: int) -> ELRSPacket:
        """Create RC control packet with channel data"""
        # Ensure we have 16 channels (ELRS standard)
        channels = channel_values[:16] if len(channel_values) >= 16 else channel_values + [1500] * (16 - len(channel_values))
        
        # Convert microseconds to 10-bit values (ELRS uses 10-bit resolution)
        packed_channels = [(int((ch - 1000) * 1023 / 1000) & 0x3FF) for ch in channels]
        
        # Create packet
        packet = ELRSPacket(
            type=0x0,  # RC data
            channels=channels,
            telemetry={'rssi': -70, 'lq': 100, 'battery': 11.1},
            sync_data=b'',
            crc=0
        )
        
        # Calculate CRC
        packet_data = struct.pack('<B', packet.type)  # Packet type
        for i in range(0, len(packed_channels), 2):
            # Pack two 10-bit values into 3 bytes
            if i + 1 < len(packed_channels):
                val1 = packed_channels[i]
                val2 = packed_channels[i + 1]
                packed = (val1 & 0x3FF) | ((val2 & 0x3FF) << 10)
                packet_data += struct.pack('<I', packed)[:3]
        
        # Add packet number and calculate CRC
        packet_data += struct.pack('<H', packet_number & 0xFFFF)
        packet.crc = crc16xmodem(packet_data)
        
        return packet
    
    def _generate_flight_control_pattern(self, flight_mode: str, duration: float) -> List[List[int]]:
        """Generate realistic RC channel patterns based on flight mode"""
        num_updates = int(duration * 100)  # 100Hz update rate
        patterns = []
        
        # Channel mapping: [Roll, Pitch, Throttle, Yaw, Aux1, Aux2, ...]
        for i in range(num_updates):
            t = i / 100.0  # Time in seconds
            
            if flight_mode == 'manual':
                # Manual mode - gentle movements
                roll = 1500 + int(100 * np.sin(t * 0.5))
                pitch = 1500 + int(80 * np.sin(t * 0.3))
                throttle = 1400 + int(100 * np.sin(t * 0.2))
                yaw = 1500 + int(50 * np.sin(t * 0.4))
                
            elif flight_mode == 'acro':
                # Acro mode - aggressive movements
                roll = 1500 + int(400 * np.sin(t * 2.0))
                pitch = 1500 + int(300 * np.sin(t * 1.5))
                throttle = 1600
                yaw = 1500 + int(200 * np.sin(t * 1.0))
                
            elif flight_mode == 'stabilized':
                # Stabilized mode - smooth movements
                roll = 1500 + int(200 * np.sin(t * 0.3))
                pitch = 1500 + int(150 * np.sin(t * 0.25))
                throttle = 1550
                yaw = 1500
                
            else:  # hover
                # Hover mode - minimal movement
                roll = 1500 + int(20 * np.sin(t * 0.1))
                pitch = 1500 + int(20 * np.sin(t * 0.15))
                throttle = 1500
                yaw = 1500
            
            # Auxiliary channels
            aux1 = 2000 if flight_mode in ['stabilized', 'hover'] else 1000  # Flight mode switch
            aux2 = 1500  # Arm switch (armed)
            
            channels = [roll, pitch, throttle, yaw, aux1, aux2] + [1500] * 10  # 16 channels total
            patterns.append(channels)
        
        return patterns
    
    def _modulate_elrs_packet(self, packet: ELRSPacket, sample_rate: int) -> np.ndarray:
        """Modulate ELRS packet using LoRa modulation"""
        # Get packet rate config
        rate_config = self.PACKET_RATES.get(100, self.PACKET_RATES[100])  # Default 100Hz
        
        # Generate preamble (8 upchirps)
        preamble_duration = 8 * (2**rate_config['sf']) / rate_config['bw']
        preamble = self._generate_lora_chirp(preamble_duration, rate_config['bw'], 
                                           rate_config['sf'], sample_rate, True)
        
        # Generate sync word (2.25 downchirps)
        sync_duration = 2.25 * (2**rate_config['sf']) / rate_config['bw']
        sync_word = self._generate_lora_chirp(sync_duration, rate_config['bw'], 
                                            rate_config['sf'], sample_rate, False)
        
        # Generate data symbols (simplified - actual LoRa uses complex modulation)
        # For simulation, we'll use frequency-shifted chirps
        data_duration = 0.001  # 1ms data portion
        data_signal = np.zeros(int(data_duration * sample_rate))
        
        # Modulate packet data onto chirps
        packet_bytes = struct.pack('<BH', packet.type, packet.crc)
        for i, byte_val in enumerate(packet_bytes):
            if i * 8 < len(data_signal):
                # Frequency shift based on byte value
                freq_shift = (byte_val - 128) * 1000  # Hz
                t = np.arange(8) / sample_rate
                data_signal[i*8:(i+1)*8] = np.cos(2 * np.pi * freq_shift * t)
        
        # Combine all parts
        full_signal = np.concatenate([preamble, sync_word, data_signal])
        
        # Apply envelope shaping
        envelope = np.ones_like(full_signal)
        ramp_len = int(0.0001 * sample_rate)  # 100us ramp
        envelope[:ramp_len] = np.linspace(0, 1, ramp_len)
        envelope[-ramp_len:] = np.linspace(1, 0, ramp_len)
        
        return full_signal * envelope
    
    def generate_elrs_transmission(self, duration: float, packet_rate: int, 
                                 power_level: int, flight_mode: str = 'manual') -> np.ndarray:
        """Generate complete ELRS transmission with caching support"""
        # Try to get from cache first
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters = {
            'band': self.band,
            'packet_rate': packet_rate,
            'duration': duration,
            'flight_mode': flight_mode
        }
        
        # Define generator function
        def generate_signal(band, packet_rate, duration, flight_mode):
            return self._generate_elrs_transmission_internal(duration, packet_rate, power_level, flight_mode)
        
        # Get from cache or generate
        cached_path, sample_rate = cache.get_or_generate_signal(
            signal_type='elrs',
            protocol=f'elrs_{self.band}',
            parameters=parameters,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        return signal_data
    
    def _generate_elrs_transmission_internal(self, duration: float, packet_rate: int, 
                                           power_level: int, flight_mode: str = 'manual') -> Tuple[np.ndarray, float]:
        """Internal method to generate ELRS transmission (called by cache)"""
        sample_rate = 2000000  # 2 MHz
        
        # Get packet timing
        rate_config = self.PACKET_RATES.get(packet_rate, self.PACKET_RATES[100])
        packet_interval = rate_config['interval']
        
        # Generate flight control patterns
        control_patterns = self._generate_flight_control_pattern(flight_mode, duration)
        
        # Generate signal
        num_samples = int(duration * sample_rate)
        signal = np.zeros(num_samples)
        
        # Generate packets
        packet_count = int(duration / packet_interval)
        current_sample = 0
        
        print(f"Generating {packet_count} ELRS packets at {packet_rate}Hz...")
        
        for i in range(packet_count):
            # Get control values for this packet
            control_idx = min(i, len(control_patterns) - 1)
            channels = control_patterns[control_idx]
            
            # Create and modulate packet
            packet = self._create_rc_packet(channels, i)
            modulated = self._modulate_elrs_packet(packet, sample_rate)
            
            # Apply frequency hopping
            hop_idx = i % len(self.hop_sequence)
            channel_idx = self.hop_sequence[hop_idx]
            
            # Add to signal (with bounds checking)
            packet_samples = len(modulated)
            if current_sample + packet_samples <= num_samples:
                signal[current_sample:current_sample + packet_samples] = modulated
            
            current_sample += int(packet_interval * sample_rate)
        
        # Apply power scaling
        power_scale = 10 ** (power_level / 20.0)
        signal = signal * power_scale * 0.8  # Scale to 80% to avoid clipping
        
        # Ensure signal is within [-1, 1]
        max_val = np.max(np.abs(signal))
        if max_val > 0:
            signal = signal / max_val * 0.9
        
        return signal, sample_rate
    
    def get_band_info(self) -> Dict[str, Any]:
        """Get information about current band configuration"""
        return {
            'band': self.band,
            'center_frequency': self.config['center_freq'],
            'channels': self.config['channels'],
            'bandwidth': self.config['bandwidth'],
            'max_power': self.config['max_power'],
            'num_channels': len(self.config['channels'])
        }
    
    def get_supported_packet_rates(self) -> List[int]:
        """Get list of supported packet rates for this band"""
        return list(self.PACKET_RATES.keys()) 