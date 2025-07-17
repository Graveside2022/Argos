#!/usr/bin/env python3
"""
Universal Signal Cache System
Pre-generates and caches ALL RF signals for instant transmission across all protocols
"""

import os
import pickle
import numpy as np
import time
import threading
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass
import hashlib
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class CachedSignal:
    """Universal cached signal metadata"""
    filename: str
    signal_type: str  # 'elrs', 'gps', 'adsb', 'jamming', 'raw_energy', 'modulation'
    protocol: str     # 'elrs_433', 'gps_l1', 'wideband_noise', etc.
    parameters: Dict[str, Any]  # All parameters used to generate the signal
    sample_rate: float
    duration: float
    file_size_mb: float
    created_time: float
    checksum: str


class UniversalSignalCache:
    """Universal signal cache for all RF protocols"""
    
    def __init__(self, cache_dir: str = "signal_cache"):
        self.cache_dir = cache_dir
        self.cache_metadata_file = os.path.join(cache_dir, "universal_cache_metadata.json")
        self.cached_signals: Dict[str, CachedSignal] = {}
        self.generation_lock = threading.Lock()
        
        # Create cache directory
        os.makedirs(cache_dir, exist_ok=True)
        
        # Load existing cache metadata
        self.load_cache_metadata()
        
        # Define all signal configurations to pre-generate
        self.signal_configs = self._define_all_signal_configs()
    
    def _define_all_signal_configs(self) -> List[Dict[str, Any]]:
        """Define OPTIMIZED signal configurations for pre-generation (reduced from 309 to ~109)"""
        configs = []
        
        # 1. Wideband Video Jamming Signals (9 signals)
        for bandwidth in [5e6, 10e6, 20e6]:
            for duration in [5.0, 10.0, 30.0]:
                configs.append({
                    'signal_type': 'jamming',
                    'protocol': 'drone_video',
                    'parameters': {
                        'bandwidth': bandwidth,
                        'duration': duration,
                        'jamming_type': 'video_noise'
                    }
                })
        
        # 2. ELRS Transmission Signals (48 signals - reduced from 72)
        # Only most common packet rates and durations
        for band in ['433', '868', '915', '2400']:
            for packet_rate in [100, 200, 333]:  # Most common rates only
                for duration in [10.0, 30.0]:    # Most common durations only
                    configs.append({
                        'signal_type': 'elrs',
                        'protocol': f'elrs_{band}',
                        'parameters': {
                            'band': band,
                            'packet_rate': packet_rate,
                            'duration': duration,
                            'flight_mode': 'manual'
                        }
                    })
        
        # 3. ELRS Jamming Signals (16 signals - reduced from 32)
        # Only most effective jamming types
        for band in ['433', '868', '915', '2400']:
            for jamming_type in ['broadband_noise', 'chirp_sweep']:  # Most effective types only
                for duration in [10.0, 30.0]:
                    configs.append({
                        'signal_type': 'jamming',
                        'protocol': f'elrs_{band}_jammer',
                        'parameters': {
                            'band': band,
                            'jamming_type': jamming_type,
                            'duration': duration,
                            'bandwidth': {'433': 250e3, '868': 250e3, '915': 500e3, '2400': 2e6}[band]
                        }
                    })
        
        # 4. GPS Signals (12 signals - reduced from 18)
        # Only most common configurations
        for band in ['L1', 'L2', 'L5']:
            for num_satellites in [8, 12]:  # Most common satellite counts
                for duration in [30.0, 60.0]:
                    configs.append({
                        'signal_type': 'gps',
                        'protocol': f'gps_{band.lower()}',
                        'parameters': {
                            'band': band,
                            'num_satellites': num_satellites,
                            'duration': duration
                        }
                    })
        
        # 5. ADS-B Signals (4 signals - reduced from 6)
        # Only most common aircraft counts
        for num_aircraft in [5, 10]:  # Most common scenarios
            for duration in [30.0, 60.0]:
                configs.append({
                    'signal_type': 'adsb',
                    'protocol': 'adsb_1090',
                    'parameters': {
                        'num_aircraft': num_aircraft,
                        'duration': duration
                    }
                })
        
        # 6. Raw Energy Signals (16 signals - reduced from 160!)
        # Only essential frequency/bandwidth combinations
        essential_frequencies = {
            'vhf_low': 100e6,      # Basic VHF
            'uhf_mid': 600e6,      # Mid UHF
            'gps_l1': 1575.42e6,   # GPS L1
            'adsb': 1090e6         # ADS-B
        }
        
        for freq_name, frequency in essential_frequencies.items():
            for bandwidth in [5e6, 10e6]:  # Most common bandwidths
                for noise_type in ['white', 'chirp']:  # Most effective noise types
                    for duration in [10.0, 30.0]:
                        configs.append({
                            'signal_type': 'raw_energy',
                            'protocol': f'raw_{freq_name}',
                            'parameters': {
                                'frequency': frequency,
                                'bandwidth': bandwidth,
                                'noise_type': noise_type,
                                'duration': duration
                            }
                        })
        
        # 7. Basic Modulation Signals (4 signals - reduced from 12)
        # Only most common configurations
        # Sine waves - only 2 most common frequencies
        for frequency in [100e6, 915e6]:  # VHF and UHF only
            for duration in [10.0, 30.0]:
                configs.append({
                    'signal_type': 'modulation',
                    'protocol': 'sine_wave',
                    'parameters': {
                        'frequency': frequency,
                        'amplitude': 0.8,
                        'duration': duration
                    }
                })
        
        return configs
    
    def _normalize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively normalize parameters for cache key consistency"""
        norm = {}
        for k, v in params.items():
            if isinstance(v, dict):
                norm[k] = self._normalize_params(v)
            elif isinstance(v, (int, float)):
                # For cache consistency, convert integers to floats if they represent durations
                # This matches the cached format where durations are stored as floats
                if k == 'duration':
                    norm[k] = float(v)
                elif k == 'num_satellites':
                    norm[k] = int(v)  # Keep as int for satellite counts
                else:
                    norm[k] = float(v)  # Convert other numeric values to float
            else:
                norm[k] = v
        return norm

    def get_cache_key(self, signal_type: str, protocol: str, parameters: Dict[str, Any]) -> str:
        """Generate unique cache key for signal configuration (normalize numeric types)"""
        norm_params = self._normalize_params(parameters)
        sorted_params = json.dumps(norm_params, sort_keys=True)
        key_string = f"{signal_type}_{protocol}_{sorted_params}"
        cache_key = hashlib.md5(key_string.encode()).hexdigest()
        
        # Debug logging removed for clean output
        
        return cache_key
    
    def load_cache_metadata(self) -> None:
        """Load cache metadata from disk"""
        if os.path.exists(self.cache_metadata_file):
            try:
                with open(self.cache_metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                for key, data in metadata.items():
                    self.cached_signals[key] = CachedSignal(**data)
                    
                logger.info(f"📁 Loaded {len(self.cached_signals)} cached signals from disk")
            except Exception as e:
                logger.error(f"❌ Error loading cache metadata: {e}")
                self.cached_signals = {}
    
    def save_cache_metadata(self) -> None:
        """Save cache metadata to disk"""
        try:
            metadata = {}
            for key, signal in self.cached_signals.items():
                metadata[key] = {
                    'filename': signal.filename,
                    'signal_type': signal.signal_type,
                    'protocol': signal.protocol,
                    'parameters': signal.parameters,
                    'sample_rate': signal.sample_rate,
                    'duration': signal.duration,
                    'file_size_mb': signal.file_size_mb,
                    'created_time': signal.created_time,
                    'checksum': signal.checksum
                }
            
            with open(self.cache_metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
                
        except Exception as e:
            logger.error(f"❌ Error saving cache metadata: {e}")
    
    def get_cached_signal(self, signal_type: str, protocol: str, parameters: Dict[str, Any]) -> Optional[str]:
        """Get cached signal file path if available"""
        cache_key = self.get_cache_key(signal_type, protocol, parameters)
        
        if cache_key in self.cached_signals:
            cached_signal = self.cached_signals[cache_key]
            file_path = os.path.join(self.cache_dir, cached_signal.filename)
            
            if os.path.exists(file_path):
                return file_path
            else:
                # File missing, remove from cache
                del self.cached_signals[cache_key]
                self.save_cache_metadata()
        
        return None
        
        return None
    
    def cache_signal(self, signal_type: str, protocol: str, parameters: Dict[str, Any],
                    signal_data: Union[np.ndarray, bytes], sample_rate: float) -> str:
        """Cache a generated signal"""
        cache_key = self.get_cache_key(signal_type, protocol, parameters)
        
        # Check if already cached
        cached_path = self.get_cached_signal(signal_type, protocol, parameters)
        if cached_path:
            return cached_path
        
        with self.generation_lock:
            # Convert to bytes if numpy array
            if isinstance(signal_data, np.ndarray):
                # Ensure proper 8-bit signed format for HackRF
                if signal_data.dtype != np.int8:
                    signal_8bit = (signal_data * 127).astype(np.int8)
                    signal_bytes = signal_8bit.tobytes()
                else:
                    signal_bytes = signal_data.tobytes()
            else:
                signal_bytes = signal_data
            
            # Generate filename
            duration = parameters.get('duration', 0)
            filename = f"{signal_type}_{protocol}_{cache_key[:12]}.bin"
            file_path = os.path.join(self.cache_dir, filename)
            
            # Save to file
            with open(file_path, 'wb') as f:
                f.write(signal_bytes)
            
            # Calculate file size and checksum
            file_size_mb = len(signal_bytes) / 1e6
            checksum = hashlib.md5(signal_bytes).hexdigest()
            
            # Store metadata
            cached_signal = CachedSignal(
                filename=filename,
                signal_type=signal_type,
                protocol=protocol,
                parameters=parameters,
                sample_rate=sample_rate,
                duration=duration,
                file_size_mb=file_size_mb,
                created_time=time.time(),
                checksum=checksum
            )
            
            self.cached_signals[cache_key] = cached_signal
            self.save_cache_metadata()
            
            logger.info(f"✅ Cached {signal_type}/{protocol} signal: {filename} ({file_size_mb:.1f} MB)")
            
            return file_path
    
    def get_or_generate_signal(self, signal_type: str, protocol: str, 
                             parameters: Dict[str, Any], 
                             generator_func: Any) -> Tuple[str, float]:
        """Get cached signal or generate and cache if not available"""
        # Check cache first
        cached_path = self.get_cached_signal(signal_type, protocol, parameters)
        if cached_path:
            # Get sample rate from metadata
            cache_key = self.get_cache_key(signal_type, protocol, parameters)
            sample_rate = self.cached_signals[cache_key].sample_rate
            return cached_path, sample_rate
        
        # Generate signal
        logger.info(f"🔧 Generating {signal_type}/{protocol} signal...")
        start_time = time.time()
        signal_data, sample_rate = generator_func(**parameters)
        generation_time = time.time() - start_time
        logger.info(f"⏱️  Generated in {generation_time:.2f}s")
        
        # Cache the signal
        cached_path = self.cache_signal(signal_type, protocol, parameters, signal_data, sample_rate)
        
        return cached_path, sample_rate
    
    def pregenerate_all_signals(self, progress_callback: Optional[Any] = None) -> None:
        """Pre-generate ALL signals for instant transmission"""
        total_configs = len(self.signal_configs)
        logger.info(f"🚀 Pre-generating {total_configs} signal configurations...")
        
        start_time = time.time()
        total_size_mb = 0
        generated_count = 0
        skipped_count = 0
        
        # Import all necessary protocol handlers
        from .drone_video_jamming_protocol import DroneVideoJammingProtocol
        from .elrs_protocol import ELRSProtocol
        from .elrs_jamming_protocol import ELRSJammingProtocol
        from .gps_protocol import GPSProtocol
        from .adsb_protocol import ADSBProtocol
        from .raw_energy_protocol import RawEnergyProtocol
        from .hackrf_controller import HackRFController
        
        # Initialize protocol instances
        protocols = {
            'drone_video': DroneVideoJammingProtocol('5800'),
            'elrs_433': ELRSProtocol('433'),
            'elrs_868': ELRSProtocol('868'),
            'elrs_915': ELRSProtocol('915'),
            'elrs_2400': ELRSProtocol('2400'),
            'elrs_jammer': ELRSJammingProtocol('915'),
            'gps': GPSProtocol('L1'),
            'adsb': ADSBProtocol(),
            'raw_energy': RawEnergyProtocol(),
            'hackrf': HackRFController()
        }
        
        for i, config in enumerate(self.signal_configs):
            signal_type = config['signal_type']
            protocol = config['protocol']
            parameters = config['parameters']
            
            # Check if already cached
            if self.get_cached_signal(signal_type, protocol, parameters):
                skipped_count += 1
                logger.info(f"⏭️  [{i+1}/{total_configs}] Already cached: {signal_type}/{protocol}")
                if progress_callback:
                    progress_callback(i + 1, total_configs, "Skipped (already cached)")
                continue
            
            logger.info(f"🔨 [{i+1}/{total_configs}] Generating {signal_type}/{protocol}...")
            
            try:
                # Generate signal based on type
                signal_data, sample_rate = self._generate_signal_for_config(config, protocols)
                
                # Cache it
                file_path = self.cache_signal(signal_type, protocol, parameters, signal_data, sample_rate)
                file_size_mb = os.path.getsize(file_path) / 1e6
                total_size_mb += file_size_mb
                generated_count += 1
                
                if progress_callback:
                    progress_callback(i + 1, total_configs, f"Generated {file_size_mb:.1f} MB")
                    
            except Exception as e:
                logger.error(f"❌ Failed to generate {signal_type}/{protocol}: {e}")
                if progress_callback:
                    progress_callback(i + 1, total_configs, f"Failed: {str(e)}")
        
        total_time = time.time() - start_time
        logger.info(f"\n✅ Pre-generation complete!")
        logger.info(f"   Generated: {generated_count} new signals")
        logger.info(f"   Skipped: {skipped_count} existing signals")
        logger.info(f"   Total cache: {len(self.cached_signals)} signals")
        logger.info(f"   New data: {total_size_mb:.1f} MB")
        logger.info(f"   Time: {total_time:.1f}s")
    
    def _generate_signal_for_config(self, config: Dict[str, Any], protocols: Dict[str, Any]) -> Tuple[np.ndarray, float]:
        """Generate signal for a specific configuration"""
        signal_type = config['signal_type']
        protocol = config['protocol']
        parameters = config['parameters']
        
        if signal_type == 'jamming' and protocol == 'drone_video':
            from .wideband_signal_cache import WidebandSignalCache
            cache = WidebandSignalCache()
            i_signal, q_signal, sample_rate = cache.generate_wideband_signal(
                parameters['bandwidth'], parameters['duration'], parameters['jamming_type']
            )
            iq_samples = np.zeros(len(i_signal) * 2)
            iq_samples[0::2] = i_signal
            iq_samples[1::2] = q_signal
            return iq_samples, sample_rate
        
        elif signal_type == 'elrs':
            band = parameters['band']
            elrs = protocols[f'elrs_{band}']
            signal_data = elrs.generate_elrs_transmission(
                duration=parameters['duration'],
                packet_rate=parameters['packet_rate'],
                power_level=10,
                flight_mode=parameters.get('flight_mode', 'manual')
            )
            return signal_data, 2000000
        
        elif signal_type == 'jamming' and 'elrs' in protocol:
            band = parameters['band']
            jammer = protocols['elrs_jammer']
            jammer.band = band
            signal_data = jammer.generate_jamming_signal(
                frequency=0,
                bandwidth=parameters['bandwidth'],
                duration=parameters['duration'],
                power_level=47,
                jamming_type=parameters['jamming_type']
            )
            return signal_data, 2000000
        
        elif signal_type == 'gps':
            band = parameters['band']
            gps = protocols['gps']
            gps.frequency_band = band
            # Use include_satellites instead of num_satellites
            include_satellites = None
            if 'num_satellites' in parameters:
                # Use the first N satellites
                all_sats = [sat.svid for sat in gps.satellites]
                include_satellites = all_sats[:parameters['num_satellites']]
            signal_data = gps.generate_gps_signal(
                duration=parameters['duration'],
                include_satellites=include_satellites
            )
            return signal_data, 2000000
        
        elif signal_type == 'adsb':
            adsb = protocols['adsb']
            from .adsb_protocol import Aircraft
            for i in range(parameters['num_aircraft']):
                aircraft = Aircraft(
                    icao=f"ABC{i:03d}",
                    callsign=f"TEST{i:03d}",
                    category=3,
                    latitude=40.0 + i * 0.1,
                    longitude=-74.0 + i * 0.1,
                    altitude=10000 + i * 1000,
                    velocity=250,
                    heading=i * 45,
                    vertical_rate=0,
                    squawk=1200,
                    on_ground=False,
                    aircraft_type="B737"
                )
                adsb.add_aircraft(aircraft)
            signal_data = adsb.generate_adsb_transmission(parameters['duration'])
            return signal_data, 2000000
        
        elif signal_type == 'raw_energy':
            raw = protocols['raw_energy']
            signal_data = raw.generate_raw_energy_signal(
                frequency=parameters['frequency'],
                bandwidth=parameters['bandwidth'],
                duration=parameters['duration'],
                noise_type=parameters['noise_type']
            )
            return signal_data, int(parameters['bandwidth'] * 2.5)
        
        elif signal_type == 'modulation':
            hackrf = protocols['hackrf']
            if protocol == 'sine_wave':
                signal_data = hackrf.generate_sine_wave(
                    parameters['frequency'],
                    parameters['amplitude'],
                    parameters['duration']
                )
                return np.frombuffer(signal_data, dtype=np.uint8), 2000000
            elif protocol == 'fm':
                signal_data = hackrf.generate_fm_signal(
                    parameters['carrier_freq'],
                    parameters['mod_freq'],
                    parameters['mod_depth'],
                    parameters['duration']
                )
                return np.frombuffer(signal_data, dtype=np.uint8), 2000000
            else:
                raise ValueError(f"Unknown modulation protocol: {protocol}")
        else:
            raise ValueError(f"Unknown signal type/protocol: {signal_type}/{protocol}")
    
    def get_cache_status(self) -> Dict[str, Any]:
        """Get comprehensive cache status"""
        total_files = len(self.cached_signals)
        total_size_mb = sum(signal.file_size_mb for signal in self.cached_signals.values())
        
        # Check which files actually exist
        existing_files = 0
        for signal in self.cached_signals.values():
            file_path = os.path.join(self.cache_dir, signal.filename)
            if os.path.exists(file_path):
                existing_files += 1
        
        # Count by signal type
        type_counts = {}
        for signal in self.cached_signals.values():
            signal_type = signal.signal_type
            type_counts[signal_type] = type_counts.get(signal_type, 0) + 1
        
        return {
            'total_files': total_files,
            'existing_files': existing_files,
            'total_size_mb': total_size_mb,
            'cache_dir': self.cache_dir,
            'total_configs': len(self.signal_configs),
            'type_counts': type_counts,
            'missing_files': total_files - existing_files
        }
    
    def clear_cache(self) -> None:
        """Clear all cached signals"""
        try:
            # Remove all cache files
            for signal in self.cached_signals.values():
                file_path = os.path.join(self.cache_dir, signal.filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            # Remove metadata
            if os.path.exists(self.cache_metadata_file):
                os.remove(self.cache_metadata_file)
            
            # Clear in-memory cache
            self.cached_signals.clear()
            
            logger.info("🗑️  Cache cleared successfully")
            
        except Exception as e:
            logger.error(f"❌ Error clearing cache: {e}")


# Global cache instance
_universal_cache = None

def get_universal_cache() -> UniversalSignalCache:
    """Get global universal signal cache instance"""
    global _universal_cache
    if _universal_cache is None:
        _universal_cache = UniversalSignalCache()
    return _universal_cache


def initialize_universal_cache(force_regenerate: bool = False) -> None:
    """Initialize universal signal cache with pre-generation"""
    cache = get_universal_cache()
    
    # Check if we need to pre-generate
    status = cache.get_cache_status()
    
    logger.info(f"📊 Cache status: {status['existing_files']}/{status['total_configs']} signals cached")
    
    if force_regenerate or status['existing_files'] < status['total_configs']:
        logger.info("🚀 Initializing universal signal cache...")
        cache.pregenerate_all_signals()
    else:
        logger.info(f"✅ Signal cache ready: {status['existing_files']} files, {status['total_size_mb']:.1f} MB")
        logger.info(f"   Signal types: {status['type_counts']}")


if __name__ == "__main__":
    # Test the universal cache system
    print("🎯 Testing Universal Signal Cache System")
    print("=" * 50)
    
    cache = UniversalSignalCache()
    
    # Show initial status
    status = cache.get_cache_status()
    print(f"Initial cache status:")
    print(f"  Files: {status['existing_files']}/{status['total_configs']}")
    print(f"  Total size: {status['total_size_mb']:.1f} MB")
    print(f"  Cache directory: {status['cache_dir']}")
    print(f"  Signal types: {status['type_counts']}")
    
    # Pre-generate all signals
    print("\nPre-generating all signals...")
    cache.pregenerate_all_signals()
    
    # Show final status
    final_status = cache.get_cache_status()
    print(f"\nFinal cache status:")
    print(f"  Files: {final_status['existing_files']}/{final_status['total_configs']}")
    print(f"  Total size: {final_status['total_size_mb']:.1f} MB")
    print(f"  Signal types: {final_status['type_counts']}") 