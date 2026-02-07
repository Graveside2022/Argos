#!/usr/bin/env python3
"""
Wideband Signal Cache System
Pre-generates common wideband jamming signals for instant transmission
"""

import os
import pickle
import numpy as np
import time
import threading
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import hashlib
import json


@dataclass
class CachedSignal:
    """Cached signal metadata"""
    filename: str
    bandwidth: float
    duration: float
    sample_rate: float
    file_size_mb: float
    signal_type: str
    created_time: float
    checksum: str


class WidebandSignalCache:
    """Pre-generates and caches wideband jamming signals"""
    
    def __init__(self, cache_dir: str = "signal_cache"):
        self.cache_dir = cache_dir
        self.cache_metadata_file = os.path.join(cache_dir, "cache_metadata.json")
        self.cached_signals: Dict[str, CachedSignal] = {}
        self.generation_lock = threading.Lock()
        
        # Common signal configurations to pre-generate
        self.COMMON_CONFIGS = [
            # 5 MHz bandwidth signals
            {'bandwidth': 5000000, 'duration': 5.0, 'type': 'video_noise'},
            {'bandwidth': 5000000, 'duration': 10.0, 'type': 'video_noise'},
            {'bandwidth': 5000000, 'duration': 30.0, 'type': 'video_noise'},
            
            # 10 MHz bandwidth signals
            {'bandwidth': 10000000, 'duration': 5.0, 'type': 'video_noise'},
            {'bandwidth': 10000000, 'duration': 10.0, 'type': 'video_noise'},
            {'bandwidth': 10000000, 'duration': 30.0, 'type': 'video_noise'},
            
            # 20 MHz bandwidth signals (ultra-wide)
            {'bandwidth': 20000000, 'duration': 5.0, 'type': 'video_noise'},
            {'bandwidth': 20000000, 'duration': 10.0, 'type': 'video_noise'},
        ]
        
        # Create cache directory
        os.makedirs(cache_dir, exist_ok=True)
        
        # Load existing cache metadata
        self.load_cache_metadata()
    
    def get_cache_key(self, bandwidth: float, duration: float, signal_type: str) -> str:
        """Generate cache key for signal configuration"""
        key_string = f"{bandwidth}_{duration}_{signal_type}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def load_cache_metadata(self) -> None:
        """Load cache metadata from disk"""
        if os.path.exists(self.cache_metadata_file):
            try:
                with open(self.cache_metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                for key, data in metadata.items():
                    self.cached_signals[key] = CachedSignal(**data)
                    
                print(f"[FILE] Loaded {len(self.cached_signals)} cached signals from disk")
            except Exception as e:
                print(f"[ERROR] Error loading cache metadata: {e}")
                self.cached_signals = {}
    
    def save_cache_metadata(self) -> None:
        """Save cache metadata to disk"""
        try:
            metadata = {}
            for key, signal in self.cached_signals.items():
                metadata[key] = {
                    'filename': signal.filename,
                    'bandwidth': signal.bandwidth,
                    'duration': signal.duration,
                    'sample_rate': signal.sample_rate,
                    'file_size_mb': signal.file_size_mb,
                    'signal_type': signal.signal_type,
                    'created_time': signal.created_time,
                    'checksum': signal.checksum
                }
            
            with open(self.cache_metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
                
        except Exception as e:
            print(f"[ERROR] Error saving cache metadata: {e}")
    
    def generate_wideband_signal(self, bandwidth: float, duration: float, 
                               signal_type: str = 'video_noise') -> Tuple[Any, Any, float]:
        """Generate wideband signal (same as drone video jamming protocol)"""
        # Use 2.5x bandwidth as sample rate for proper wideband coverage (Nyquist + margin)
        sample_rate = int(bandwidth * 2.5)
        num_samples = int(duration * sample_rate)
        
        print(f"[TARGET] Generating {bandwidth/1e6:.1f} MHz wideband signal ({duration}s)")
        print(f"   Sample rate: {sample_rate/1e6:.1f} MHz")
        print(f"   Total samples: {num_samples:,}")
        
        # Generate complex wideband white noise
        noise_amplitude = 0.8
        i_signal = np.random.normal(0, noise_amplitude, num_samples)
        q_signal = np.random.normal(0, noise_amplitude, num_samples)
        
        # Apply bandpass filtering for spectral shaping
        if len(i_signal) > 1000:
            try:
                from scipy import signal as scipy_signal
                
                nyquist = sample_rate / 2
                low_freq = max(100e3, bandwidth * 0.1)
                high_freq = min(nyquist - 100e3, bandwidth * 0.9)
                
                sos = scipy_signal.butter(4, [low_freq, high_freq], btype='bandpass', 
                                        fs=sample_rate, output='sos')
                
                i_signal = scipy_signal.sosfilt(sos, i_signal)
                q_signal = scipy_signal.sosfilt(sos, q_signal)
                
            except Exception as e:
                print(f"   Spectral shaping failed: {e}")
        
        # Normalize to prevent clipping
        max_i = np.max(np.abs(i_signal))
        max_q = np.max(np.abs(q_signal))
        max_amplitude = max(max_i, max_q)
        
        if max_amplitude > 0:
            scale_factor = 0.9 / max_amplitude
            i_signal = i_signal * scale_factor
            q_signal = q_signal * scale_factor
        
        return i_signal, q_signal, sample_rate
    
    def cache_signal(self, bandwidth: float, duration: float, 
                    signal_type: str = 'video_noise') -> str:
        """Generate and cache a wideband signal"""
        cache_key = self.get_cache_key(bandwidth, duration, signal_type)
        
        # Check if already cached and file exists
        if cache_key in self.cached_signals:
            cached_signal = self.cached_signals[cache_key]
            cache_file_path = os.path.join(self.cache_dir, cached_signal.filename)
            if os.path.exists(cache_file_path):
                print(f"[OK] Signal already cached: {cached_signal.filename}")
                return cache_file_path
        
        # Generate signal
        start_time = time.time()
        i_signal, q_signal, sample_rate = self.generate_wideband_signal(bandwidth, duration, signal_type)
        
        # Convert to HackRF format
        iq_samples = np.zeros(len(i_signal) * 2)
        iq_samples[0::2] = i_signal
        iq_samples[1::2] = q_signal
        
        # Convert to 8-bit signed format
        signal_8bit = (iq_samples * 127).astype(np.int8)
        signal_bytes = signal_8bit.tobytes()
        
        # Generate filename
        filename = f"wideband_{bandwidth/1e6:.0f}MHz_{duration:.0f}s_{signal_type}_{cache_key[:8]}.bin"
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
            bandwidth=bandwidth,
            duration=duration,
            sample_rate=sample_rate,
            file_size_mb=file_size_mb,
            signal_type=signal_type,
            created_time=time.time(),
            checksum=checksum
        )
        
        self.cached_signals[cache_key] = cached_signal
        self.save_cache_metadata()
        
        generation_time = time.time() - start_time
        print(f"[OK] Cached signal: {filename}")
        print(f"   File size: {file_size_mb:.1f} MB")
        print(f"   Generation time: {generation_time:.1f}s")
        
        return file_path
    
    def get_cached_signal(self, bandwidth: float, duration: float, 
                         signal_type: str = 'video_noise') -> Optional[str]:
        """Get cached signal file path if available"""
        cache_key = self.get_cache_key(bandwidth, duration, signal_type)
        
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
    
    def get_or_cache_signal(self, bandwidth: float, duration: float, 
                           signal_type: str = 'video_noise') -> str:
        """Get cached signal or generate and cache if not available"""
        cached_path = self.get_cached_signal(bandwidth, duration, signal_type)
        
        if cached_path:
            return cached_path
        else:
            return self.cache_signal(bandwidth, duration, signal_type)
    
    def pregenerate_common_signals(self) -> None:
        """Pre-generate all common signal configurations"""
        print("[START] Pre-generating common wideband signals...")
        print(f"   Configurations to generate: {len(self.COMMON_CONFIGS)}")
        
        start_time = time.time()
        total_size_mb = 0
        
        for i, config in enumerate(self.COMMON_CONFIGS):
            print(f"\n--- Generating {i+1}/{len(self.COMMON_CONFIGS)} ---")
            
            file_path = self.cache_signal(
                bandwidth=config['bandwidth'],
                duration=config['duration'],
                signal_type=config['type']
            )
            
            # Get file size
            file_size_mb = os.path.getsize(file_path) / 1e6
            total_size_mb += file_size_mb
        
        total_time = time.time() - start_time
        print(f"\n[OK] Pre-generation complete!")
        print(f"   Total files: {len(self.COMMON_CONFIGS)}")
        print(f"   Total size: {total_size_mb:.1f} MB")
        print(f"   Generation time: {total_time:.1f}s")
        print(f"   Average: {total_time/len(self.COMMON_CONFIGS):.1f}s per file")
    
    def get_cache_status(self) -> Dict[str, Any]:
        """Get current cache status"""
        total_files = len(self.cached_signals)
        total_size_mb = sum(signal.file_size_mb for signal in self.cached_signals.values())
        
        # Check which files actually exist
        existing_files = 0
        for signal in self.cached_signals.values():
            file_path = os.path.join(self.cache_dir, signal.filename)
            if os.path.exists(file_path):
                existing_files += 1
        
        return {
            'total_files': total_files,
            'existing_files': existing_files,
            'total_size_mb': total_size_mb,
            'cache_dir': self.cache_dir,
            'common_configs': len(self.COMMON_CONFIGS)
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
            
            print("[DELETE]  Cache cleared successfully")
            
        except Exception as e:
            print(f"[ERROR] Error clearing cache: {e}")
    
    def cleanup_old_files(self, max_age_days: int = 7) -> None:
        """Remove cached files older than specified days"""
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 3600
        
        removed_count = 0
        for cache_key, signal in list(self.cached_signals.items()):
            if current_time - signal.created_time > max_age_seconds:
                file_path = os.path.join(self.cache_dir, signal.filename)
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    del self.cached_signals[cache_key]
                    removed_count += 1
                except Exception as e:
                    print(f"[ERROR] Error removing old file {signal.filename}: {e}")
        
        if removed_count > 0:
            self.save_cache_metadata()
            print(f"[DELETE]  Removed {removed_count} old cached files")


# Global cache instance
_signal_cache = None

def get_signal_cache() -> WidebandSignalCache:
    """Get global signal cache instance"""
    global _signal_cache
    if _signal_cache is None:
        _signal_cache = WidebandSignalCache()
    return _signal_cache


def initialize_signal_cache() -> None:
    """Initialize signal cache with pre-generation"""
    cache = get_signal_cache()
    
    # Check if we need to pre-generate
    status = cache.get_cache_status()
    
    if status['existing_files'] < status['common_configs']:
        print("[START] Initializing wideband signal cache...")
        cache.pregenerate_common_signals()
    else:
        print(f"[OK] Signal cache ready: {status['existing_files']} files, {status['total_size_mb']:.1f} MB")


if __name__ == "__main__":
    # Test the cache system
    print("[TARGET] Testing Wideband Signal Cache System")
    print("=" * 50)
    
    cache = WidebandSignalCache()
    
    # Test caching a signal
    file_path = cache.cache_signal(10000000, 5.0, 'video_noise')
    print(f"Cached signal at: {file_path}")
    
    # Test retrieving cached signal
    cached_path = cache.get_cached_signal(10000000, 5.0, 'video_noise')
    print(f"Retrieved cached signal: {cached_path}")
    
    # Show cache status
    status = cache.get_cache_status()
    print(f"Cache status: {status}") 