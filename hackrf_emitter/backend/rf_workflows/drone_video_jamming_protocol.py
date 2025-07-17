"""
Drone Video Link Jamming Protocol
Advanced jamming for drone FPV video frequencies at 1.2 GHz and 5.8 GHz
Targets common video transmission channels used by FPV drones
"""

import numpy as np
import time
import threading
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import random
from .universal_signal_cache import get_universal_cache


@dataclass
class DroneVideoJammingConfig:
    """Drone video jamming configuration parameters"""
    band: str
    channels: List[float]
    hop_rate: float  # hops per second
    sweep_pattern: str  # 'sequential', 'pseudorandom', 'adaptive', 'burst'
    power_level: int  # dBm
    bandwidth_per_hop: float  # Hz
    dwell_time: float  # seconds per frequency
    coverage_strategy: str  # 'full_band', 'hotspots', 'follow_traffic'


class DroneVideoJammingProtocol:
    """Advanced drone video link jamming targeting FPV frequencies"""
    
    # Drone video link band configurations
    DRONE_VIDEO_BANDS = {
        '1200': {
            'name': '1.2 GHz FPV Video',
            'center_freq': 1280e6,
            'channels': [
                # 1.2 GHz FPV channels (commonly used)
                1240e6, 1250e6, 1260e6, 1270e6, 1280e6, 1290e6, 1300e6,
                1310e6, 1320e6, 1330e6, 1340e6, 1350e6, 1360e6, 1370e6,
                1380e6, 1390e6, 1400e6, 1410e6, 1420e6, 1430e6
            ],
            'bandwidth': 10000000,  # 10 MHz per channel for video jamming
            'hop_rates': [10, 20, 40, 80],  # Lower rates for wider bandwidth
            'max_power': 1000,  # mW
            'description': 'Long-range FPV video transmission with 10 MHz white noise jamming'
        },
        '5800': {
            'name': '5.7-5.9 GHz FPV Video',
            'center_freq': 5800e6,
            'channels': [
                # Extended 5.7-5.9 GHz FPV channels - comprehensive coverage
                # 5.7 GHz range (often overlooked but used)
                5700e6, 5705e6, 5710e6, 5715e6, 5720e6, 5725e6, 5730e6, 5735e6,
                # Band A (5.865, 5.845, 5.825, 5.805, 5.785, 5.765, 5.745, 5.725)
                5865e6, 5845e6, 5825e6, 5805e6, 5785e6, 5765e6, 5745e6, 5725e6,
                # Band B (5.733, 5.752, 5.771, 5.790, 5.809, 5.828, 5.847, 5.866)
                5733e6, 5752e6, 5771e6, 5790e6, 5809e6, 5828e6, 5847e6, 5866e6,
                # Band C (5.705, 5.685, 5.665, 5.645, 5.885, 5.905, 5.925, 5.945)
                5705e6, 5685e6, 5665e6, 5645e6, 5885e6, 5905e6, 5925e6, 5945e6,
                # Band D (5.740, 5.760, 5.780, 5.800, 5.820, 5.840, 5.860, 5.880)
                5740e6, 5760e6, 5780e6, 5800e6, 5820e6, 5840e6, 5860e6, 5880e6,
                # Band E (5.705, 5.685, 5.665, 5.645, 5.885, 5.905, 5.925, 5.945)
                5705e6, 5685e6, 5665e6, 5645e6, 5885e6, 5905e6, 5925e6, 5945e6,
                # Race band (R1-R8) - Most common for racing
                5658e6, 5695e6, 5732e6, 5769e6, 5806e6, 5843e6, 5880e6, 5917e6,
                # Fatshark (F1-F8)
                5740e6, 5760e6, 5780e6, 5800e6, 5820e6, 5840e6, 5860e6, 5880e6,
                # ImmersionRC (I1-I8)
                5732e6, 5752e6, 5771e6, 5790e6, 5809e6, 5828e6, 5847e6, 5866e6,
                # Additional 5.7 GHz channels (comprehensive coverage)
                5675e6, 5690e6, 5708e6, 5712e6, 5717e6, 5722e6, 5727e6, 5737e6,
                # More 5.8-5.9 GHz channels
                5750e6, 5755e6, 5775e6, 5795e6, 5815e6, 5835e6, 5855e6, 5875e6,
                5890e6, 5895e6, 5900e6, 5910e6, 5915e6, 5920e6, 5930e6, 5935e6
            ],
            'bandwidth': 10000000,  # 10 MHz per channel for video jamming
            'hop_rates': [50, 100, 200, 400],  # Faster rates for narrower bandwidth
            'max_power': 800,  # mW  
            'description': 'Comprehensive FPV video coverage with 10 MHz white noise jamming'
        }
    }
    
    # Jamming patterns optimized for video links
    SWEEP_PATTERNS = {
        'sequential': 'Sequential sweep through all video channels',
        'pseudorandom': 'Random hopping across video frequencies',
        'adaptive': 'Adaptive pattern based on video traffic detection',
        'burst': 'High-speed burst across multiple video channels',
        'race_focus': 'Focus on race band frequencies (most common)',
        'barrage': 'Simultaneous multi-channel video disruption'
    }
    
    def __init__(self, band: str = '5800', hackrf_controller=None):
        """Initialize drone video jamming protocol for specified band"""
        self.band = band
        self.config = self.DRONE_VIDEO_BANDS.get(band, self.DRONE_VIDEO_BANDS['5800'])
        self.channels = self.config['channels']
        self.current_channel_idx = 0
        self.stop_flag = threading.Event()
        self.active_jammers = []
        self.hackrf = hackrf_controller
        
        # Generate hopping sequences for different patterns
        self.hop_sequences = self._generate_hop_sequences()
        
    def _generate_hop_sequences(self) -> Dict[str, List[int]]:
        """Generate different frequency hopping sequences optimized for video jamming"""
        num_channels = len(self.channels)
        sequences = {}
        
        # Sequential pattern
        sequences['sequential'] = list(range(num_channels))
        
        # Pseudo-random pattern
        random.seed(0x5A5A5A5A)  # Different seed from ELRS
        sequences['pseudorandom'] = list(range(num_channels))
        random.shuffle(sequences['pseudorandom'])
        
        # Race focus pattern (prioritizes race band frequencies)
        if self.band == '5800':
            # Race band indices (R1-R8) - most commonly used
            race_indices = [40, 41, 42, 43, 44, 45, 46, 47]  # Approximate race band positions
            race_pattern = []
            for i in range(num_channels):
                if i in race_indices:
                    race_pattern.extend([i] * 3)  # 3x weight for race band
                else:
                    race_pattern.append(i)
            sequences['race_focus'] = race_pattern
        else:
            # For 1.2 GHz, focus on center frequencies
            center_idx = num_channels // 2
            sequences['race_focus'] = []
            for i in range(num_channels):
                weight = 1.0 / (1.0 + abs(i - center_idx) * 0.1)
                sequences['race_focus'].extend([i] * int(weight * 2))
        
        # Adaptive pattern (focuses on high-traffic video channels)
        sequences['adaptive'] = sequences['race_focus']  # Start with race focus
        
        # Burst pattern (rapid coverage for video disruption)
        sequences['burst'] = []
        for step in [1, 2, 4, 8, 3, 6, 12, 5, 10]:
            for start in range(step):
                for i in range(start, num_channels, step):
                    sequences['burst'].append(i)
        
        return sequences
    
    def generate_video_jamming_signal(self, frequency: float, bandwidth: float, 
                                    duration: float, power_level: int,
                                    jamming_type: str = 'video_noise') -> tuple:
        """Generate wideband jamming signal optimized for video transmission disruption"""
        # Use 2.5x bandwidth as sample rate for proper wideband coverage (Nyquist + margin)
        sample_rate = int(bandwidth * 2.5)  # 25 MHz for 10 MHz bandwidth, 12.5 MHz for 5 MHz bandwidth
        
        # For video jamming, we need to cover the FULL bandwidth effectively
        # This requires high sample rate and proper spectral shaping
        num_samples = int(duration * sample_rate)
        
        print(f"🎯 Generating WIDEBAND noise: {sample_rate/1e6:.1f} MHz sample rate for {bandwidth/1e6:.1f} MHz bandwidth")
        print(f"   Signal size: {num_samples} samples ({num_samples * 2 / 1e6:.1f}M I/Q samples)")
        
        # Generate complex wideband white noise
        # Use higher amplitude for better jamming effectiveness
        noise_amplitude = 0.8  # Higher amplitude for stronger jamming
        
        # Generate independent I and Q noise for full complex bandwidth utilization
        i_signal = np.random.normal(0, noise_amplitude, num_samples)
        q_signal = np.random.normal(0, noise_amplitude, num_samples)
        
        # Add spectral shaping for more effective video jamming
        # Create bandpass characteristics to focus energy in target bandwidth
        if len(i_signal) > 1000:  # Only apply filtering for longer signals
            try:
                from scipy import signal as scipy_signal
                
                # Design bandpass filter to shape the noise spectrum
                nyquist = sample_rate / 2
                low_freq = max(100e3, bandwidth * 0.1)  # 10% of bandwidth or 100 kHz minimum
                high_freq = min(nyquist - 100e3, bandwidth * 0.9)  # 90% of bandwidth
                
                # Butterworth bandpass filter for spectral shaping
                sos = scipy_signal.butter(4, [low_freq, high_freq], btype='bandpass', 
                                        fs=sample_rate, output='sos')
                
                # Apply filter to both I and Q channels
                i_signal = scipy_signal.sosfilt(sos, i_signal)
                q_signal = scipy_signal.sosfilt(sos, q_signal)
                print(f"   Applied bandpass filter: {low_freq/1e3:.1f} - {high_freq/1e3:.1f} kHz")
                
            except Exception as e:
                print(f"   Spectral shaping failed (using raw noise): {e}")
        
        # Normalize to prevent clipping while maintaining high amplitude
        max_i = np.max(np.abs(i_signal))
        max_q = np.max(np.abs(q_signal))
        max_amplitude = max(max_i, max_q)
        
        if max_amplitude > 0:
            # Normalize to 90% of full scale for maximum power without clipping
            scale_factor = 0.9 / max_amplitude
            i_signal = i_signal * scale_factor
            q_signal = q_signal * scale_factor
        
        signal_size_mb = (len(i_signal) * 2 * 2) / 1e6  # 2 channels * 2 bytes per sample
        print(f"   Generated signal: {signal_size_mb:.1f} MB ({duration}s at {sample_rate/1e6:.1f} MHz)")
        
        return i_signal, q_signal, sample_rate  # Return sample rate for HackRF configuration
    
    def start_video_jamming(self, config: DroneVideoJammingConfig, duration: float) -> None:
        """Start video link jamming with specified configuration"""
        print(f"Starting {self.config['name']} jamming...")
        print(f"- Pattern: {config.sweep_pattern}")
        print(f"- Channels: {len(config.channels)}")
        print(f"- Power: {config.power_level} dBm")
        print(f"- Duration: {duration}s")
        print(f"🎥 Targeting drone video transmissions @ 47dBm")
        
        # Start transmission in separate thread
        def jammer_thread():
            self._transmit_video_jamming_sequence(config, duration)
        
        thread = threading.Thread(target=jammer_thread, daemon=True)
        thread.start()
        self.active_jammers.append(thread)
    
    def start_video_barrage_jammer(self, config: DroneVideoJammingConfig, duration: float) -> None:
        """Start barrage jammer for video links"""
        print(f"Starting {self.config['name']} BARRAGE jammer...")
        print(f"- RAPID barrage through {len(config.channels)} video channels")
        print(f"- Power per channel: {config.power_level} dBm")
        print(f"- Duration: {duration}s")
        print(f"🎥 Starting TRUE video link barrage jamming...")
        
        # Set barrage pattern
        config.sweep_pattern = 'barrage'
        
        # Start transmission
        def barrage_thread():
            self._transmit_video_jamming_sequence(config, duration)
        
        thread = threading.Thread(target=barrage_thread, daemon=True)
        thread.start()
        self.active_jammers.append(thread)
    
    def start_single_channel_jammer(self, frequency: float, duration: float, 
                                  power_level: int = 47, bandwidth: float = 10000000, 
                                  jamming_type: str = 'video_noise') -> None:
        """Start single channel jammer for specific video frequency"""
        print(f"Starting single channel video jammer...")
        print(f"- Center frequency: {frequency/1e6:.1f} MHz")
        print(f"- Bandwidth: {bandwidth/1e6:.1f} MHz")
        print(f"- Power: {power_level} dBm")
        print(f"- Duration: {duration}s")
        print(f"- Jamming type: white noise")
        print(f"🎯 Targeting specific video channel @ {power_level}dBm")
        
        # Start transmission in separate thread
        def single_channel_thread():
            self._transmit_single_channel_jamming(frequency, duration, power_level, bandwidth, jamming_type)
        
        thread = threading.Thread(target=single_channel_thread, daemon=True)
        thread.start()
        self.active_jammers.append(thread)
    
    def _transmit_video_jamming_sequence(self, config: DroneVideoJammingConfig, duration: float) -> None:
        """Transmit video jamming with frequency hopping"""
        if self.hackrf is None:
            print(f"🎥 Simulating MAX POWER video jamming: {duration}s @ 47dBm")
            time.sleep(duration)
            return
        
        try:
            # Video jamming optimized timing
            if config.sweep_pattern == 'barrage':
                # Rapid barrage for video disruption
                dwell_time = 0.1  # 100ms per channel - faster than ELRS for video
                cycles_needed = int(duration / (len(config.channels) * dwell_time))
                hop_sequence = list(range(len(config.channels))) * cycles_needed
                print(f"⚡ VIDEO BARRAGE: {cycles_needed} cycles, {len(config.channels) * dwell_time:.1f}s per sweep")
            else:
                # Standard video jamming
                dwell_time = max(0.2, config.dwell_time)  # Minimum 200ms for video
                sequence = self.hop_sequences.get(config.sweep_pattern, 
                                                self.hop_sequences['pseudorandom'])
                hops_needed = int(duration / dwell_time)
                hop_sequence = [sequence[i % len(sequence)] for i in range(hops_needed)]
            
            print(f"🎥 Starting video link frequency hopping @ 47dBm")
            print(f"📡 Hopping across {len(config.channels)} video channels")
            
            # Pre-generate jamming signal
            i_signal, q_signal = self.generate_video_jamming_signal(
                frequency=0,  # Will be frequency-shifted by HackRF
                bandwidth=10000000,  # 10 MHz video bandwidth
                duration=dwell_time,
                power_level=config.power_level,
                jamming_type='video_noise'
            )
            
            # Convert to interleaved I/Q for HackRF
            iq_samples = np.zeros(len(i_signal) * 2)
            iq_samples[0::2] = i_signal
            iq_samples[1::2] = q_signal
            
            signal_8bit = ((iq_samples + 1) * 127.5).astype(np.uint8)
            signal_bytes = signal_8bit.tobytes()
            
            # Configure HackRF
            self.hackrf.set_sample_rate(10000000)  # 10 MHz for video jamming
            self.hackrf.set_gain(47)
            
            start_time = time.time()
            hop_count = 0
            
            # Execute video jamming sequence
            for hop_idx in hop_sequence:
                if self.stop_flag.is_set():
                    break
                    
                elapsed = time.time() - start_time
                if elapsed + dwell_time > duration:
                    break
                
                # Get video frequency
                frequency = config.channels[hop_idx % len(config.channels)]
                
                # Change to video frequency
                self.hackrf.set_frequency(int(frequency))
                
                # Transmit jamming signal on video frequency
                hop_start = time.time()
                success = self.hackrf.start_transmission(signal_bytes, int(frequency), 10000000, 47)
                
                if success:
                    # Wait for dwell time
                    while time.time() - hop_start < dwell_time and not self.stop_flag.is_set():
                        time.sleep(0.01)
                    
                    self.hackrf.stop_transmission()
                    hop_count += 1
                    
                    # Progress reporting for barrage mode
                    if config.sweep_pattern == 'barrage' and hop_count % 10 == 0:
                        elapsed = time.time() - start_time
                        remaining = duration - elapsed
                        print(f"🎥 BARRAGE: {hop_count} hops, {remaining:.1f}s remaining")
                else:
                    print(f"❌ Failed to transmit on {frequency/1e6:.1f} MHz")
            
            print(f"✅ Video jamming complete: {hop_count} hops over {time.time() - start_time:.1f}s")
            
        except Exception as e:
            print(f"❌ Video jamming error: {e}")
        finally:
            if self.hackrf:
                self.hackrf.stop_transmission()
    
    def _transmit_single_channel_jamming(self, frequency: float, duration: float, 
                                       power_level: int, bandwidth: float, jamming_type: str) -> None:
        """Transmit wideband jamming signal on a single video frequency using cached signals"""
        try:
            # Use cached signal for instant transmission
            max_signal_duration = min(30.0, duration)  # Max 30 seconds cached
            
            print(f"🎯 Loading CACHED wideband signal for {frequency/1e6:.1f} MHz...")
            print(f"   Target bandwidth: {bandwidth/1e6:.1f} MHz")
            print(f"   Pattern duration: {max_signal_duration}s")
            
            # Get cached signal file using universal cache
            from .universal_signal_cache import get_universal_cache
            cache = get_universal_cache()
            params = {
                'bandwidth': bandwidth,
                'duration': max_signal_duration,
                'jamming_type': jamming_type
            }
            print(f"🔍 Looking for cached signal with params: {params}")
            signal_file_path = cache.get_cached_signal('jamming', 'drone_video', params)
            if not signal_file_path:
                print(f"❌ No cached signal found for {bandwidth/1e6:.1f} MHz, {max_signal_duration}s")
                # Debug: check what's actually in cache
                cache_key = cache.get_cache_key('jamming', 'drone_video', params)
                print(f"🔍 Cache key: {cache_key}")
                print(f"🔍 Key exists: {cache_key in cache.cached_signals}")
                return
            # Get sample rate from metadata
            cache_key = cache.get_cache_key('jamming', 'drone_video', params)
            sample_rate = cache.cached_signals[cache_key].sample_rate
            
            # Load cached signal
            print(f"🎯 Loading cached signal from: {signal_file_path}")
            with open(signal_file_path, 'rb') as f:
                signal_bytes = f.read()
            
            signal_size_mb = len(signal_bytes) / 1e6
            
            print(f"✅ Cached signal loaded instantly!")
            print(f"   File size: {signal_size_mb:.1f} MB")
            print(f"   Sample rate: {sample_rate/1e6:.1f} MHz")
            
            # Use the HackRF controller from enhanced workflows (passed via constructor)
            if self.hackrf is None:
                print(f"❌ No HackRF controller available - cannot transmit")
                return
            
            # Configure HackRF 
            self.hackrf.set_sample_rate(int(sample_rate))
            self.hackrf.set_gain(power_level)
            self.hackrf.set_frequency(int(frequency))
            
            print(f"🎯 Starting INSTANT WIDEBAND transmission:")
            print(f"   Frequency: {frequency/1e6:.1f} MHz")
            print(f"   Bandwidth: {bandwidth/1e6:.1f} MHz")
            print(f"   Sample Rate: {sample_rate/1e6:.1f} MHz")
            print(f"   Power: {power_level} dBm")
            print(f"   Duration: {duration}s")
            
            if duration > max_signal_duration:
                print(f"🔄 {max_signal_duration}s pattern will loop for full {duration}s duration")
            
            # Start transmission immediately with cached file
            start_time = time.time()
            success = self.hackrf.start_transmission(signal_bytes, int(frequency), int(sample_rate), power_level, duration)
            
            if success:
                print(f"🔴 INSTANT TRANSMISSION STARTED - HackRF LED should be RED NOW!")
                print(f"   Pre-cached file ready: {signal_size_mb:.1f}MB")
                print(f"   No generation delay - immediate transmission")
                print(f"   Transmitting {bandwidth/1e6:.1f} MHz noise on {frequency/1e6:.1f} MHz")
                
                # Wait for full duration - continuous transmission
                while time.time() - start_time < duration and not self.stop_flag.is_set():
                    time.sleep(0.1)
                
                total_time = time.time() - start_time
                print(f"✅ INSTANT WIDEBAND jamming complete: {frequency/1e6:.1f} MHz for {total_time:.1f}s")
            else:
                print(f"❌ Failed to start transmission on {frequency/1e6:.1f} MHz")
                
        except Exception as e:
            print(f"❌ Cached wideband jamming error: {e}")
            import traceback
            traceback.print_exc()
            # Only stop transmission on error
            if self.hackrf:
                self.hackrf.stop_transmission()
    
    def stop_jamming(self) -> None:
        """Stop all active jamming operations"""
        self.stop_flag.set()
        if self.hackrf:
            self.hackrf.stop_transmission()
        print("🛑 Video jamming stopped")
    
    def get_band_info(self) -> Dict[str, Any]:
        """Get information about current video band configuration"""
        return {
            'band': self.band,
            'name': self.config['name'],
            'channels': self.channels,
            'num_channels': len(self.channels),
            'bandwidth': self.config['bandwidth'],
            'hop_rates': self.config['hop_rates'],
            'max_power': self.config['max_power'],
            'patterns': list(self.SWEEP_PATTERNS.keys()),
            'description': self.config['description']
        }
    
    def get_jamming_recommendations(self) -> Dict[str, Any]:
        """Get recommended jamming configurations for maximum video disruption"""
        return {
            '1200': {
                'pattern': 'adaptive',
                'hop_rate': 40,
                'power': 47,  # Maximum dBm
                'strategy': 'frequency_sweeping',
                'description': 'Long-range video disruption'
            },
            '5800': {
                'pattern': 'race_focus',
                'hop_rate': 200,
                'power': 47,  # Maximum dBm
                'strategy': 'barrage',
                'description': 'Comprehensive 5.7-5.9 GHz video disruption'
            }
        }
    
    def get_channel_list(self) -> List[Dict[str, Any]]:
        """Get formatted list of all channels with frequencies and descriptions"""
        channel_list = []
        
        for i, freq in enumerate(self.channels):
            channel_info = {
                'index': i,
                'frequency': freq,
                'frequency_mhz': freq / 1e6,
                'channel_name': self._get_channel_name(freq),
                'band_description': self._get_band_description(freq)
            }
            channel_list.append(channel_info)
        
        return channel_list
    
    def _get_channel_name(self, frequency: float) -> str:
        """Get descriptive name for a frequency channel"""
        freq_mhz = frequency / 1e6
        
        if self.band == '1200':
            return f"1.2G-{freq_mhz:.0f}"
        elif self.band == '5800':
            # Map to common FPV band names
            if 5658e6 <= frequency <= 5917e6:
                race_channels = [5658e6, 5695e6, 5732e6, 5769e6, 5806e6, 5843e6, 5880e6, 5917e6]
                if frequency in race_channels:
                    return f"R{race_channels.index(frequency) + 1}"
            
            if 5740e6 <= frequency <= 5880e6:
                fatshark_channels = [5740e6, 5760e6, 5780e6, 5800e6, 5820e6, 5840e6, 5860e6, 5880e6]
                if frequency in fatshark_channels:
                    return f"F{fatshark_channels.index(frequency) + 1}"
            
            if 5700e6 <= frequency <= 5735e6:
                return f"5.7G-{freq_mhz:.0f}"
            
            return f"5.8G-{freq_mhz:.0f}"
        
        return f"{freq_mhz:.0f}MHz"
    
    def _get_band_description(self, frequency: float) -> str:
        """Get band description for a frequency"""
        if self.band == '1200':
            return "Long-range FPV"
        elif self.band == '5800':
            freq_mhz = frequency / 1e6
            if 5658 <= freq_mhz <= 5917:
                return "Race Band"
            elif 5740 <= freq_mhz <= 5880:
                return "Fatshark Band"
            elif 5700 <= freq_mhz <= 5735:
                return "5.7 GHz Extended"
            else:
                return "5.8 GHz FPV"
        
        return "FPV Video"
    
    def find_channel_by_frequency(self, target_freq: float, tolerance: float = 1e6) -> Optional[Dict[str, Any]]:
        """Find channel by frequency with tolerance"""
        for i, freq in enumerate(self.channels):
            if abs(freq - target_freq) <= tolerance:
                return {
                    'index': i,
                    'frequency': freq,
                    'frequency_mhz': freq / 1e6,
                    'channel_name': self._get_channel_name(freq),
                    'band_description': self._get_band_description(freq)
                }
        return None
    
    def get_popular_channels(self) -> List[Dict[str, Any]]:
        """Get list of most popular FPV channels"""
        popular = []
        
        if self.band == '1200':
            # Most common 1.2 GHz channels
            popular_freqs = [1280e6, 1300e6, 1320e6, 1340e6, 1360e6]
        elif self.band == '5800':
            # Race band channels (most popular)
            popular_freqs = [5658e6, 5695e6, 5732e6, 5769e6, 5806e6, 5843e6, 5880e6, 5917e6]
        else:
            popular_freqs = self.channels[:8]  # First 8 channels
        
        for freq in popular_freqs:
            channel = self.find_channel_by_frequency(freq)
            if channel:
                popular.append(channel)
        
        return popular 