"""
Raw Energy Protocol
High-power wideband noise transmissions for testing, jamming simulation, and signal analysis.
Provides maximum gain, maximum power transmissions with configurable bandwidth.
"""

import numpy as np
import time
from typing import Dict, Any, List, Optional


class RawEnergyProtocol:
    """Raw energy transmission protocol for maximum power wideband signals"""
    
    # All frequencies used across our workflows
    SIGNAL_FREQUENCIES = {
        # Basic RF frequencies
        'VHF_LOW': 100e6,          # 100 MHz - basic test frequency
        'UHF_LOW': 300e6,          # 300 MHz - UHF low
        'UHF_MID': 600e6,          # 600 MHz - UHF mid
        'UHF_HIGH': 900e6,         # 900 MHz - UHF high
        
        # AIS frequencies
        'AIS_CH1': 161.975e6,      # AIS Channel 1
        'AIS_CH2': 162.025e6,      # AIS Channel 2
        
        # ADS-B frequency
        'ADSB': 1090e6,            # ADS-B 1090 MHz
        
        # GPS frequencies
        'GPS_L5': 1176.45e6,       # GPS L5
        'GPS_L2': 1227.60e6,       # GPS L2
        'GPS_L1': 1575.42e6,       # GPS L1
        
        # Additional test frequencies
        'S_BAND': 3e9,             # S-band (3 GHz)
        'C_BAND': 5e9,             # C-band (5 GHz)
        'X_BAND': 10e9,            # X-band (10 GHz) - if HackRF supports
    }
    
    # Bandwidth options
    BANDWIDTH_OPTIONS = {
        '5MHz': 5e6,
        '10MHz': 10e6
    }
    
    # Noise types
    NOISE_TYPES = {
        'white': 'White Gaussian noise (flat spectrum)',
        'pink': 'Pink noise (1/f spectrum)',
        'shaped': 'Spectrally shaped noise',
        'chirp': 'Linear frequency chirp',
        'multitone': 'Multiple sine wave tones'
    }
    
    def __init__(self):
        """Initialize raw energy protocol"""
        self.sample_rate = 2000000  # 2 MHz sample rate
        
    def get_available_frequencies(self) -> Dict[str, float]:
        """Get all available frequencies for raw energy transmission"""
        return self.SIGNAL_FREQUENCIES.copy()
    
    def get_bandwidth_options(self) -> Dict[str, float]:
        """Get available bandwidth options"""
        return self.BANDWIDTH_OPTIONS.copy()
    
    def get_noise_types(self) -> Dict[str, str]:
        """Get available noise types"""
        return self.NOISE_TYPES.copy()
    
    def generate_white_noise(self, duration: float, bandwidth: float, 
                           sample_rate: int = 2000000) -> np.ndarray:
        """Generate white Gaussian noise"""
        num_samples = int(duration * sample_rate)
        
        # Generate complex white noise
        noise_i = np.random.normal(0, 1, num_samples)
        noise_q = np.random.normal(0, 1, num_samples)
        noise = noise_i + 1j * noise_q
        
        # Apply bandwidth limiting filter
        if bandwidth < sample_rate:
            # Simple brick-wall filter in frequency domain
            fft_noise = np.fft.fft(noise)
            freqs = np.fft.fftfreq(num_samples, 1/sample_rate)
            
            # Zero out frequencies outside bandwidth
            mask = np.abs(freqs) > bandwidth / 2
            fft_noise[mask] = 0
            
            noise = np.fft.ifft(fft_noise)
        
        # Normalize to maximum amplitude
        noise = noise / np.max(np.abs(noise))
        
        return noise.real  # Return real part for HackRF
    
    def generate_pink_noise(self, duration: float, bandwidth: float,
                          sample_rate: int = 2000000) -> np.ndarray:
        """Generate pink noise (1/f spectrum)"""
        num_samples = int(duration * sample_rate)
        
        # Generate white noise
        white_noise = np.random.normal(0, 1, num_samples)
        
        # Apply 1/f shaping in frequency domain
        fft_noise = np.fft.fft(white_noise)
        freqs = np.fft.fftfreq(num_samples, 1/sample_rate)
        
        # Avoid division by zero at DC
        freqs[0] = 1e-10
        
        # Apply 1/sqrt(f) shaping for pink noise
        shaping = 1 / np.sqrt(np.abs(freqs))
        fft_noise *= shaping
        
        # Apply bandwidth limiting
        if bandwidth < sample_rate:
            mask = np.abs(freqs) > bandwidth / 2
            fft_noise[mask] = 0
        
        noise = np.fft.ifft(fft_noise).real
        
        # Normalize to maximum amplitude
        noise = noise / np.max(np.abs(noise))
        
        return noise
    
    def generate_shaped_noise(self, duration: float, bandwidth: float,
                            sample_rate: int = 2000000) -> np.ndarray:
        """Generate spectrally shaped noise with multiple peaks"""
        num_samples = int(duration * sample_rate)
        
        # Generate white noise base
        noise = np.random.normal(0, 1, num_samples)
        
        # Apply spectral shaping with multiple peaks
        fft_noise = np.fft.fft(noise)
        freqs = np.fft.fftfreq(num_samples, 1/sample_rate)
        
        # Create multiple spectral peaks
        shaping = np.ones_like(freqs)
        peak_freqs = [-bandwidth/3, -bandwidth/6, bandwidth/6, bandwidth/3]
        
        for peak_freq in peak_freqs:
            if abs(peak_freq) < sample_rate / 2:
                # Gaussian peak
                sigma = bandwidth / 20
                peak = np.exp(-((freqs - peak_freq) / sigma) ** 2)
                shaping += 2 * peak
        
        fft_noise *= shaping
        
        # Apply bandwidth limiting
        if bandwidth < sample_rate:
            mask = np.abs(freqs) > bandwidth / 2
            fft_noise[mask] = 0
        
        noise = np.fft.ifft(fft_noise).real
        
        # Normalize to maximum amplitude
        noise = noise / np.max(np.abs(noise))
        
        return noise
    
    def generate_chirp_signal(self, duration: float, bandwidth: float,
                            sample_rate: int = 2000000) -> np.ndarray:
        """Generate linear frequency chirp across the bandwidth"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # Linear chirp from -bandwidth/2 to +bandwidth/2
        f_start = -bandwidth / 2
        f_end = bandwidth / 2
        
        # Frequency sweep rate
        chirp_rate = (f_end - f_start) / duration
        
        # Generate chirp
        instantaneous_freq = f_start + chirp_rate * t
        phase = 2 * np.pi * (f_start * t + 0.5 * chirp_rate * t**2)
        chirp = np.cos(phase)
        
        return chirp
    
    def generate_multitone_signal(self, duration: float, bandwidth: float,
                                sample_rate: int = 2000000, num_tones: int = 20) -> np.ndarray:
        """Generate multiple sine wave tones across the bandwidth"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # Generate equally spaced tones
        tone_freqs = np.linspace(-bandwidth/2, bandwidth/2, num_tones)
        
        # Combine all tones
        signal = np.zeros(num_samples)
        for freq in tone_freqs:
            if freq != 0:  # Skip DC
                tone = np.cos(2 * np.pi * freq * t)
                signal += tone
        
        # Normalize to maximum amplitude
        signal = signal / np.max(np.abs(signal))
        
        return signal
    
    def _get_frequency_name(self, frequency: float) -> str:
        """Get frequency name from frequency value"""
        # Find the frequency in our list
        for name, freq in self.SIGNAL_FREQUENCIES.items():
            if abs(freq - frequency) < 1e3:  # 1 kHz tolerance
                return name.lower()
        return f"freq_{int(frequency/1e6)}"
    
    def generate_raw_energy_signal(self, frequency: float, bandwidth: float,
                                 duration: float, noise_type: str = 'white',
                                 sample_rate: int = 2000000) -> np.ndarray:
        """Generate raw energy signal with specified parameters using cache"""
        # Use cache for raw energy signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters = {
            'frequency': frequency,
            'bandwidth': bandwidth,
            'noise_type': noise_type,
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(frequency, bandwidth, noise_type, duration):
            return self._generate_raw_energy_signal_internal(frequency, bandwidth, duration, noise_type, sample_rate)
        
        # Get from cache or generate
        cached_path, actual_sample_rate = cache.get_or_generate_signal(
            signal_type='raw_energy',
            protocol=f'raw_{self._get_frequency_name(frequency)}',
            parameters=parameters,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        # Convert to numpy array
        signal_data = np.frombuffer(signal_bytes, dtype=np.int8).astype(np.float32) / 127.0
        
        return signal_data
    
    def _generate_raw_energy_signal_internal(self, frequency: float, bandwidth: float,
                                           duration: float, noise_type: str = 'white',
                                           sample_rate: int = 2000000) -> tuple:
        """Internal method to generate raw energy signal (called by cache)"""
        print(f"Generating raw energy signal:")
        print(f"- Frequency: {frequency/1e6:.2f} MHz")
        print(f"- Bandwidth: {bandwidth/1e6:.1f} MHz")
        print(f"- Duration: {duration:.1f} s")
        print(f"- Noise type: {noise_type}")
        print(f"- Sample rate: {sample_rate/1e6:.1f} MSps")
        print(f"- Maximum gain: 47 dB")
        print(f"- Maximum amplitude: 1.0")
        
        # Generate the specified noise type
        if noise_type == 'white':
            signal = self.generate_white_noise(duration, bandwidth, sample_rate)
        elif noise_type == 'pink':
            signal = self.generate_pink_noise(duration, bandwidth, sample_rate)
        elif noise_type == 'shaped':
            signal = self.generate_shaped_noise(duration, bandwidth, sample_rate)
        elif noise_type == 'chirp':
            signal = self.generate_chirp_signal(duration, bandwidth, sample_rate)
        elif noise_type == 'multitone':
            signal = self.generate_multitone_signal(duration, bandwidth, sample_rate)
        else:
            # Default to white noise
            signal = self.generate_white_noise(duration, bandwidth, sample_rate)
        
        # Ensure maximum amplitude (no power scaling reduction)
        signal = signal / np.max(np.abs(signal))  # Normalize to [-1, 1]
        
        return signal, sample_rate
    
    def get_frequency_info(self, frequency: float) -> Dict[str, Any]:
        """Get information about a specific frequency"""
        # Find the frequency in our list
        for name, freq in self.SIGNAL_FREQUENCIES.items():
            if abs(freq - frequency) < 1e3:  # 1 kHz tolerance
                return {
                    'name': name,
                    'frequency': freq,
                    'band': self._get_frequency_band(freq),
                    'wavelength': 3e8 / freq,  # meters
                    'description': self._get_frequency_description(name)
                }
        
        # Unknown frequency
        return {
            'name': 'CUSTOM',
            'frequency': frequency,
            'band': self._get_frequency_band(frequency),
            'wavelength': 3e8 / frequency,
            'description': 'Custom frequency'
        }
    
    def _get_frequency_band(self, frequency: float) -> str:
        """Get frequency band name"""
        if frequency < 30e6:
            return 'HF'
        elif frequency < 300e6:
            return 'VHF'
        elif frequency < 3e9:
            return 'UHF'
        elif frequency < 30e9:
            return 'SHF'
        else:
            return 'EHF'
    
    def _get_frequency_description(self, name: str) -> str:
        """Get description for a frequency"""
        descriptions = {
            'VHF_LOW': 'VHF test frequency',
            'UHF_LOW': 'UHF low test frequency',
            'UHF_MID': 'UHF mid test frequency',
            'UHF_HIGH': 'UHF high test frequency',
            'AIS_CH1': 'AIS Channel 1 (161.975 MHz)',
            'AIS_CH2': 'AIS Channel 2 (162.025 MHz)',
            'ADSB': 'ADS-B surveillance frequency',
            'GPS_L1': 'GPS L1 C/A civilian frequency',
            'GPS_L2': 'GPS L2 military/civilian frequency',
            'GPS_L5': 'GPS L5 civilian frequency',
            'S_BAND': 'S-band radar/communication',
            'C_BAND': 'C-band satellite communication',
            'X_BAND': 'X-band radar/satellite'
        }
        

        
        return descriptions.get(name, 'RF frequency') 