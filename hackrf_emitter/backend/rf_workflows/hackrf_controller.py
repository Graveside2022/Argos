import subprocess
import json
import time
import threading
import numpy as np
import logging
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger(__name__)

try:
    import hackrf
    HACKRF_AVAILABLE = True
except ImportError:
    HACKRF_AVAILABLE = False
    logger.warning("pyhackrf not available. Install with: pip install pyhackrf")

class HackRFController:
    """Controller for HackRF device operations"""
    
    def __init__(self):
        self.device = None
        self.device_connected = False
        self.current_frequency = 0
        self.current_sample_rate = 0
        self.current_gain = 0
        self.transmission_active = False
        self._lock = threading.RLock()  # Use RLock for better thread safety
        self._transmission_thread = None
        self._stop_transmission = threading.Event()
        self._hackrf_process = None
        
        # Initialize the device connection
        self.initialize()
        
    def initialize(self) -> bool:
        """Initialize HackRF device connection"""
        try:
            # Check if hackrf_transfer command is available
            try:
                result = subprocess.run(['hackrf_transfer', '-h'], 
                                      capture_output=True, timeout=5)
                hackrf_cmd_available = result.returncode == 0
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
                logger.warning(f"hackrf_transfer command not found: {e}")
                hackrf_cmd_available = False
            
            if not hackrf_cmd_available:
                logger.info("hackrf_transfer command not found. Please install HackRF tools.")
                logger.info("Running in simulation mode.")
                self.device_connected = True  # Allow simulation mode
                return True
            
            # Check if device is actually connected
            try:
                result = subprocess.run(['hackrf_info'], 
                                      capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    logger.info("HackRF device found and initialized")
                    logger.info("Real RF transmission enabled!")
                else:
                    logger.info("HackRF device not found, running in simulation mode.")
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
                logger.warning(f"Could not check HackRF device status: {e}")
                logger.info("Running in simulation mode.")
            
            self.device_connected = True
            return True
                
        except Exception as e:
            logger.error(f"Error initializing HackRF: {e}")
            logger.info("Running in simulation mode.")
            self.device_connected = True  # Allow simulation mode
            return True
    
    def is_connected(self) -> bool:
        """Check if HackRF device is connected"""
        return self.device_connected
    
    def get_device_info(self) -> Dict[str, Any]:
        """Get HackRF device information"""
        if not self.device_connected:
            return {'error': 'Device not connected'}
        
        try:
            # If we're transmitting, don't call hackrf_info as it will conflict
            if self.transmission_active:
                info = {
                    'status': 'connected',
                    'info': 'HackRF Device (Transmitting)',
                    'current_frequency': self.current_frequency,
                    'current_sample_rate': self.current_sample_rate,
                    'current_gain': self.current_gain,
                    'board_id': 'HackRF One',
                    'firmware_version': 'Transmitting...',
                    'transmission_active': True
                }
            else:
                # Only call hackrf_info when not transmitting
                try:
                    result = subprocess.run(['hackrf_info'], 
                                          capture_output=True, text=True, timeout=2)
                    if result.returncode == 0:
                        # Parse device info from hackrf_info output
                        info = {
                            'status': 'connected',
                            'info': result.stdout.strip(),
                            'current_frequency': self.current_frequency,
                            'current_sample_rate': self.current_sample_rate,
                            'current_gain': self.current_gain,
                            'board_id': 'HackRF One',
                            'firmware_version': 'Hardware Connected',
                            'transmission_active': False
                        }
                    else:
                        raise Exception("Device not found")
                except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
                    logger.warning(f"Could not get device info: {e}")
                    # Simulation mode
                    info = {
                        'status': 'connected',
                        'info': 'HackRF Device (Simulation Mode)',
                        'current_frequency': self.current_frequency,
                        'current_sample_rate': self.current_sample_rate,
                        'current_gain': self.current_gain,
                        'board_id': 'HackRF One (Simulated)',
                        'firmware_version': 'Simulation',
                        'transmission_active': False
                    }
            return info
                
        except Exception as e:
            logger.error(f"Error getting device info: {e}")
            return {'error': f'Error getting device info: {e}'}
    
    def set_frequency(self, frequency_hz: int) -> bool:
        """Set transmission frequency"""
        if not self.device_connected:
            return False
        
        try:
            with self._lock:
                self.current_frequency = frequency_hz
                logger.info(f"Frequency set to {frequency_hz} Hz")
                return True
        except Exception as e:
            logger.error(f"Error setting frequency: {e}")
            return False
    
    def set_sample_rate(self, sample_rate: int) -> bool:
        """Set sample rate"""
        if not self.device_connected:
            return False
        
        try:
            with self._lock:
                self.current_sample_rate = sample_rate
                logger.info(f"Sample rate set to {sample_rate} Hz")
                return True
        except Exception as e:
            logger.error(f"Error setting sample rate: {e}")
            return False
    
    def set_gain(self, gain_db: int) -> bool:
        """Set transmission gain"""
        if not self.device_connected:
            return False
        
        try:
            with self._lock:
                self.current_gain = gain_db
                logger.info(f"Gain set to {gain_db} dB")
                return True
        except Exception as e:
            logger.error(f"Error setting gain: {e}")
            return False
    
    def start_transmission(self, signal_data: bytes, frequency: int, 
                          sample_rate: int, gain: int, duration: Optional[float] = None) -> bool:
        """Start signal transmission with support for incremental/looping transmission
        
        Args:
            signal_data: Signal data in bytes
            frequency: Transmission frequency in Hz
            sample_rate: Sample rate in Hz
            gain: TX gain in dB
            duration: Total transmission duration in seconds (None = use signal length)
        """
        if not self.device_connected:
            return False
        
        if self.transmission_active:
            return False
        
        try:
            # Configure device parameters without lock (they have their own locks)
            self.set_frequency(frequency)
            self.set_sample_rate(sample_rate)
            self.set_gain(gain)
            
            with self._lock:
                self.transmission_active = True
                self.current_frequency = frequency
                self.current_sample_rate = sample_rate
                self.current_gain = gain
                
                # Calculate signal duration
                signal_duration = len(signal_data) / (sample_rate * 2)  # 2 bytes per sample (I/Q)
                
                # If no duration specified, use signal duration
                if duration is None:
                    duration = signal_duration
                else:
                    duration = float(duration)
                
                # Check if we need looping (duration > signal duration)
                needs_looping = duration > signal_duration
                
                # Check if we can use real HackRF transmission
                try:
                    # Test if hackrf_transfer is available
                    result = subprocess.run(['hackrf_transfer', '-h'], 
                                 capture_output=True, timeout=2)
                    can_transmit = True
                    logger.info("HackRF transfer available - using real transmission")
                except Exception as e:
                    can_transmit = False
                    logger.warning(f"HackRF transfer not available: {e} - using simulation mode")
                
                if can_transmit:
                    # Convert bytes back to complex samples for HackRF
                    samples_uint8 = np.frombuffer(signal_data, dtype=np.uint8)
                    if len(samples_uint8) % 2 == 1:
                        samples_uint8 = samples_uint8[:-1]
                    # Convert to complex I/Q (assuming interleaved I,Q format)
                    i = samples_uint8[0::2].astype(np.float32)
                    q = samples_uint8[1::2].astype(np.float32)
                    samples = (i - 127) / 127.0 + 1j * ((q - 127) / 127.0)
                    
                    # Start transmission in separate thread
                    if needs_looping:
                        logger.info("HackRF transfer available for looping transmission")
                        self._transmission_thread = threading.Thread(
                            target=self._transmit_with_hackrf_transfer_looping,
                            args=(samples, duration, signal_duration, needs_looping)
                        )
                    else:
                        logger.info("HackRF transfer available for single transmission")
                        self._transmission_thread = threading.Thread(
                            target=self._transmit_with_hackrf_transfer,
                            args=(samples, duration)
                        )
                    
                    self._transmission_thread.daemon = True
                    self._transmission_thread.start()
                    logger.info(f"HackRF transmission started at {frequency} Hz")
                else:
                    logger.info(f"Simulation mode: would transmit {len(signal_data)} samples at {frequency} Hz")
                    # For simulation, just wait for the duration
                    def simulate_transmission():
                        time.sleep(duration)
                        self.transmission_active = False
                    
                    self._transmission_thread = threading.Thread(target=simulate_transmission)
                    self._transmission_thread.daemon = True
                    self._transmission_thread.start()
                
                return True
        except Exception as e:
            logger.error(f"Error starting transmission: {e}")
            self.transmission_active = False
            return False
    
    def _transmit_samples(self, samples: np.ndarray) -> None:
        """Transmit samples using HackRF (runs in separate thread)"""
        try:
            # Check if hackrf_transfer is available
            try:
                result = subprocess.run(['hackrf_transfer', '-h'], 
                             capture_output=True, timeout=2)
                can_transmit = True
                logger.info("HackRF transfer available for samples transmission")
            except Exception as e:
                can_transmit = False
                logger.warning(f"HackRF transfer not available for samples: {e}")
            
            if can_transmit:
                # For real transmission, we'll use hackrf_transfer command
                # Calculate duration from samples
                duration = len(samples) / self.current_sample_rate
                self._transmit_with_hackrf_transfer(samples, duration)
            else:
                # Simulation mode - just wait for the duration
                duration = len(samples) / self.current_sample_rate
                logger.info(f"Simulating transmission for {duration:.2f} seconds...")
                
                start_time = time.time()
                while (time.time() - start_time < duration and 
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)
                
        except Exception as e:
            logger.error(f"Error during transmission: {e}")
        finally:
            # Always clear transmission active flag
            self.transmission_active = False
    
    def _transmit_samples_with_looping(self, samples: np.ndarray, total_duration: float, 
                                     signal_duration: float, needs_looping: bool) -> None:
        """Transmit samples with looping support for longer durations"""
        try:
            # Check if hackrf_transfer is available
            try:
                result = subprocess.run(['hackrf_transfer', '-h'], 
                             capture_output=True, timeout=2)
                can_transmit = True
                logger.info("HackRF transfer available for looping transmission")
            except Exception as e:
                can_transmit = False
                logger.warning(f"HackRF transfer not available for looping: {e}")
            
            if can_transmit:
                # For real transmission with looping
                self._transmit_with_hackrf_transfer_looping(samples, total_duration, signal_duration, needs_looping)
            else:
                # Simulation mode with looping
                logger.info(f"Simulating looping transmission for {total_duration:.2f} seconds...")
                
                start_time = time.time()
                while (time.time() - start_time < total_duration and 
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)
                
        except Exception as e:
            logger.error(f"Error during looping transmission: {e}")
        finally:
            # Always clear transmission active flag
            self.transmission_active = False
    
    def _transmit_with_hackrf_transfer(self, samples: np.ndarray, duration: float) -> None:
        """Use hackrf_transfer command for actual RF transmission"""
        try:
            # Convert complex samples to HackRF format (8-bit I/Q)
            i_data = np.real(samples) * 127 + 127
            q_data = np.imag(samples) * 127 + 127
            
            # Clip to valid range
            i_data = np.clip(i_data, 0, 255).astype(np.uint8)
            q_data = np.clip(q_data, 0, 255).astype(np.uint8)
            
            # Interleave I and Q
            iq_data = np.empty(len(samples) * 2, dtype=np.uint8)
            iq_data[0::2] = i_data
            iq_data[1::2] = q_data
            
            # Save to temporary file
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmp_file:
                tmp_file.write(iq_data.tobytes())
                tmp_filename = tmp_file.name
            
            try:
                # Build hackrf_transfer command
                cmd = [
                    'hackrf_transfer',
                    '-t', tmp_filename,  # transmit from file
                    '-f', str(int(self.current_frequency)),  # frequency
                    '-s', str(int(self.current_sample_rate)),  # sample rate
                    '-x', str(int(self.current_gain)),  # TX VGA gain
                    '-a', '1',  # enable TX amplifier
                ]
                
                logger.info(f"Starting HackRF transmission: {' '.join(cmd)}")
                logger.info(f"Signal file size: {os.path.getsize(tmp_filename)} bytes")
                logger.info(f"Transmission duration: {duration:.1f} seconds")
                
                # Start hackrf_transfer process
                self._hackrf_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                logger.info(f"HackRF process started with PID: {self._hackrf_process.pid}")
                
                # Give process a moment to start properly
                time.sleep(1.0)
                
                # Check if process is still running (didn't immediately fail)
                if self._hackrf_process.poll() is None:
                    logger.info(f"✅ HackRF process running successfully - LED should be RED")
                else:
                    logger.warning(f"❌ HackRF process failed immediately - return code: {self._hackrf_process.returncode}")
                    stdout, stderr = self._hackrf_process.communicate()
                    if stderr:
                        logger.error(f"Error: {stderr}")
                
                # Monitor the process for the specified duration
                start_time = time.time()
                while (time.time() - start_time < duration and 
                       self._hackrf_process.poll() is None and
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)
                
                # If stop was requested, terminate the process
                if self._stop_transmission.is_set():
                    logger.info("Stop requested, terminating HackRF process")
                    self._hackrf_process.terminate()
                    self._hackrf_process.wait(timeout=5)
                
                # Get process output
                stdout, stderr = self._hackrf_process.communicate()
                actual_duration = time.time() - start_time
                logger.info(f"HackRF transmission completed with return code: {self._hackrf_process.returncode}")
                logger.info(f"✅ Single transmission completed: {actual_duration:.1f}s total")
                if stdout:
                    logger.info(f"STDOUT: {stdout}")
                if stderr:
                    logger.error(f"STDERR: {stderr}")
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(tmp_filename)
                except:
                    pass
                
        except Exception as e:
            logger.error(f"Error in hackrf_transfer transmission: {e}")
        finally:
            # Always clear transmission active flag
            self.transmission_active = False
    
    def _transmit_with_hackrf_transfer_looping(self, samples: np.ndarray, total_duration: float, 
                                             signal_duration: float, needs_looping: bool) -> None:
        """Use hackrf_transfer command for looping RF transmission"""
        try:
            # Convert complex samples to HackRF format (8-bit I/Q)
            i_data = np.real(samples) * 127 + 127
            q_data = np.imag(samples) * 127 + 127
            
            # Clip to valid range
            i_data = np.clip(i_data, 0, 255).astype(np.uint8)
            q_data = np.clip(q_data, 0, 255).astype(np.uint8)
            
            # Interleave I and Q
            iq_data = np.empty(len(samples) * 2, dtype=np.uint8)
            iq_data[0::2] = i_data
            iq_data[1::2] = q_data
            
            # For looping with hackrf_transfer -r flag, we need to calculate the right file size
            # The file will be looped continuously, so we need to ensure the loop duration matches our needs
            if total_duration > signal_duration:
                # Calculate how many copies we need so that when looped, we get the right total duration
                # Since hackrf_transfer -r loops continuously, we want the file to be exactly the right size
                copies_needed = max(1, int(total_duration / signal_duration))
                
                # Create a file with the right number of copies
                repeated_iq_data = np.tile(iq_data, copies_needed)
                logger.info(f"🔄 Creating loopable signal: {copies_needed} copies, will loop for {total_duration:.1f}s total")
            else:
                # Use the signal as-is (no looping needed)
                repeated_iq_data = iq_data
                logger.info(f"📡 Using signal as-is: {signal_duration:.1f}s duration")
            
            # Save to temporary file
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.bin') as tmp_file:
                tmp_file.write(repeated_iq_data.tobytes())
                tmp_filename = tmp_file.name
            
            try:
                # Build hackrf_transfer command for single long transmission
                cmd = [
                    'hackrf_transfer',
                    '-t', tmp_filename,  # transmit from file
                    '-f', str(int(self.current_frequency)),  # frequency
                    '-s', str(int(self.current_sample_rate)),  # sample rate
                    '-x', str(int(self.current_gain)),  # TX VGA gain
                    '-a', '1',  # enable TX amplifier
                    '-R',  # repeat/loop the file continuously
                ]
                
                logger.info(f"Starting HackRF transmission: {' '.join(cmd)}")
                logger.info(f"Signal file size: {os.path.getsize(tmp_filename)} bytes")
                if total_duration > signal_duration:
                    logger.info(f"Looping signal: {copies_needed} copies, continuous transmission for {total_duration:.1f}s")
                else:
                    logger.info(f"Single signal: {signal_duration:.1f}s duration")
                
                # Start hackrf_transfer process
                self._hackrf_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                
                logger.info(f"HackRF process started with PID: {self._hackrf_process.pid}")
                
                # Give process a moment to start properly
                time.sleep(1.0)
                
                # Check if process is still running (didn't immediately fail)
                if self._hackrf_process.poll() is None:
                    logger.info(f"✅ HackRF process running successfully - LED should be RED")
                else:
                    logger.warning(f"❌ HackRF process failed immediately - return code: {self._hackrf_process.returncode}")
                    stdout, stderr = self._hackrf_process.communicate()
                    if stderr:
                        logger.error(f"Error: {stderr}")
                    return
                
                # Monitor the process for the full duration
                # With -r flag, hackrf_transfer will loop continuously until stopped
                start_time = time.time()
                while (time.time() - start_time < total_duration and 
                       self._hackrf_process.poll() is None and
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)
                
                # If stop was requested, terminate the process
                if self._stop_transmission.is_set():
                    logger.info("Stop requested, terminating HackRF process")
                    self._hackrf_process.terminate()
                    self._hackrf_process.wait(timeout=5)
                
                # Get process output
                stdout, stderr = self._hackrf_process.communicate()
                logger.info(f"HackRF transmission completed with return code: {self._hackrf_process.returncode}")
                if stdout:
                    logger.info(f"STDOUT: {stdout}")
                if stderr:
                    logger.error(f"STDERR: {stderr}")
                
                actual_duration = time.time() - start_time
                logger.info(f"✅ Looping transmission completed: {actual_duration:.1f}s total")
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(tmp_filename)
                except:
                    pass
                
        except Exception as e:
            logger.error(f"Error in hackrf_transfer looping transmission: {e}")
        finally:
            # Always clear transmission active flag
            self.transmission_active = False
    
    def stop_transmission(self) -> bool:
        """Stop signal transmission"""
        if not self.transmission_active:
            return True
        
        try:
            with self._lock:
                self._stop_transmission.set()
                
                # If using hackrf_transfer, terminate the process
                if hasattr(self, '_hackrf_process') and self._hackrf_process:
                    try:
                        self._hackrf_process.terminate()
                        self._hackrf_process.wait(timeout=5)
                    except:
                        pass
                
                if self._transmission_thread and self._transmission_thread.is_alive():
                    self._transmission_thread.join(timeout=2)
                
                self.transmission_active = False
                logger.info("Transmission stopped")
                return True
        except Exception as e:
            logger.error(f"Error stopping transmission: {e}")
            return False
    
    def generate_sine_wave(self, baseband_freq: float, duration: float, 
                          sample_rate: int = 2000000) -> bytes:
        """Generate sine wave signal data with caching support
        
        Args:
            baseband_freq: Baseband frequency in Hz (e.g., 1000 for 1kHz tone)
            duration: Duration in seconds
            sample_rate: Sample rate in Hz
        """
        # Use cache for sine wave signals
        from .universal_signal_cache import get_universal_cache
        cache = get_universal_cache()
        
        # Define parameters for caching
        parameters = {
            'frequency': baseband_freq,
            'amplitude': 0.8,
            'duration': duration
        }
        
        # Define generator function
        def generate_signal(frequency, amplitude, duration):
            return self._generate_sine_wave_internal(frequency, duration, sample_rate)
        
        # Get from cache or generate
        cached_path, actual_sample_rate = cache.get_or_generate_signal(
            signal_type='modulation',
            protocol='sine_wave',
            parameters=parameters,
            generator_func=generate_signal
        )
        
        # Load cached signal
        with open(cached_path, 'rb') as f:
            signal_bytes = f.read()
        
        return signal_bytes
    
    def _generate_sine_wave_internal(self, baseband_freq: float, duration: float, 
                                   sample_rate: int = 2000000) -> tuple:
        """Internal method to generate sine wave (called by cache)"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # Generate complex sine wave (I/Q format) at baseband frequency
        # For a carrier signal, we typically want a baseband tone
        if baseband_freq == 0:
            # DC signal (carrier only)
            signal = np.ones(num_samples, dtype=np.complex64)
        else:
            # Generate baseband tone
            signal = np.exp(1j * 2 * np.pi * baseband_freq * t)
        
        # Convert to 8-bit I/Q format
        i_data = (np.real(signal) * 127 + 127).astype(np.uint8)
        q_data = (np.imag(signal) * 127 + 127).astype(np.uint8)
        
        # Interleave I and Q samples
        iq_data = np.empty(num_samples * 2, dtype=np.uint8)
        iq_data[0::2] = i_data
        iq_data[1::2] = q_data
        
        return iq_data.tobytes(), sample_rate
    
    def generate_fm_signal(self, carrier_freq: float, mod_freq: float, 
                          mod_depth: float, duration: float, 
                          sample_rate: int = 2000000) -> bytes:
        """Generate FM modulated signal"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # FM modulation
        mod_signal = mod_depth * np.sin(2 * np.pi * mod_freq * t)
        phase = 2 * np.pi * carrier_freq * t / sample_rate + mod_signal
        fm_signal = np.exp(1j * phase)
        
        # Convert to 8-bit I/Q format
        i_data = (np.real(fm_signal) * 127 + 127).astype(np.uint8)
        q_data = (np.imag(fm_signal) * 127 + 127).astype(np.uint8)
        
        # Interleave I and Q samples
        iq_data = np.empty(num_samples * 2, dtype=np.uint8)
        iq_data[0::2] = i_data
        iq_data[1::2] = q_data
        
        return iq_data.tobytes()
    
    def generate_am_signal(self, carrier_freq: float, mod_freq: float, 
                          mod_depth: float, duration: float, 
                          sample_rate: int = 2000000) -> bytes:
        """Generate AM modulated signal"""
        num_samples = int(duration * sample_rate)
        t = np.linspace(0, duration, num_samples, False)
        
        # AM modulation
        mod_signal = mod_depth * np.sin(2 * np.pi * mod_freq * t)
        am_signal = (1 + mod_signal) * np.exp(1j * 2 * np.pi * carrier_freq * t / sample_rate)
        
        # Convert to 8-bit I/Q format
        i_data = (np.real(am_signal) * 127 + 127).astype(np.uint8)
        q_data = (np.imag(am_signal) * 127 + 127).astype(np.uint8)
        
        # Interleave I and Q samples
        iq_data = np.empty(num_samples * 2, dtype=np.uint8)
        iq_data[0::2] = i_data
        iq_data[1::2] = q_data
        
        return iq_data.tobytes()
    
    def cleanup(self) -> None:
        """Clean up resources and stop any active transmission"""
        try:
            logger.info("Cleaning up HackRF controller...")
            self.stop_transmission()
            
            # Wait for transmission thread to finish
            if self._transmission_thread and self._transmission_thread.is_alive():
                self._transmission_thread.join(timeout=5)
            
            # Terminate any running HackRF process
            if hasattr(self, '_hackrf_process') and self._hackrf_process:
                try:
                    self._hackrf_process.terminate()
                    self._hackrf_process.wait(timeout=5)
                except Exception as e:
                    logger.warning(f"Error terminating HackRF process: {e}")
            
            logger.info("HackRF controller cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        try:
            self.cleanup()
        except Exception as e:
            # Don't log in destructor as logger might be gone
            pass 