import subprocess
import json
import time
import threading
import numpy as np
import logging
import tempfile
import os
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger(__name__)

# Try python_hackrf (new library) first, then fall back to subprocess-only mode
HACKRF_API_AVAILABLE = False
try:
    from python_hackrf import pyhackrf
    from python_hackrf import pyhackrf_transfer as _pyhackrf_transfer_mod
    from python_hackrf import pyhackrf_info as _pyhackrf_info_mod
    HACKRF_API_AVAILABLE = True
    logger.info("python_hackrf library loaded successfully")
except ImportError:
    logger.warning("python-hackrf not available. Install with: pip install python-hackrf")
    logger.warning("Falling back to subprocess-based HackRF control")

# Check if hackrf CLI tools are available as fallback
HACKRF_CLI_AVAILABLE = False
try:
    result = subprocess.run(['hackrf_transfer', '-h'],
                          capture_output=True, timeout=5)
    HACKRF_CLI_AVAILABLE = result.returncode == 0
except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
    pass


class HackRFController:
    """Controller for HackRF device operations.

    Uses python_hackrf native API when available, falls back to
    subprocess calls to hackrf_transfer/hackrf_info binaries.
    """

    def __init__(self):
        self.device = None
        self.device_connected = False
        self.current_frequency = 0
        self.current_sample_rate = 0
        self.current_gain = 0
        self.transmission_active = False
        self._lock = threading.RLock()
        self._transmission_thread = None
        self._stop_transmission = threading.Event()
        self._hackrf_process = None  # For subprocess fallback
        self._api_initialized = False

        # Initialize the device connection
        self.initialize()

    def initialize(self) -> bool:
        """Initialize HackRF device connection"""
        try:
            # Try python_hackrf API first
            if HACKRF_API_AVAILABLE:
                try:
                    pyhackrf.pyhackrf_init()
                    self._api_initialized = True
                    device_list = pyhackrf.pyhackrf_device_list()
                    if device_list.device_count > 0:
                        logger.info(f"HackRF device found via python_hackrf API ({device_list.device_count} device(s))")
                        logger.info("Real RF transmission enabled via native API!")
                        self.device_connected = True
                        return True
                    else:
                        logger.info("python_hackrf initialized but no HackRF devices found")
                        logger.info("Running in simulation mode.")
                        self.device_connected = True
                        return True
                except Exception as e:
                    logger.warning(f"python_hackrf API initialization failed: {e}")
                    logger.info("Falling back to CLI tools...")

            # Fall back to CLI detection
            if HACKRF_CLI_AVAILABLE:
                try:
                    result = subprocess.run(['hackrf_info'],
                                          capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        logger.info("HackRF device found via hackrf_info CLI")
                        logger.info("Real RF transmission enabled via subprocess!")
                    else:
                        logger.info("HackRF CLI available but no device found, running in simulation mode.")
                except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
                    logger.warning(f"Could not check HackRF device status: {e}")
                    logger.info("Running in simulation mode.")

                self.device_connected = True
                return True

            # No HackRF tools available at all
            logger.info("No HackRF tools available (neither python_hackrf nor CLI).")
            logger.info("Running in simulation mode.")
            self.device_connected = True
            return True

        except Exception as e:
            logger.error(f"Error initializing HackRF: {e}")
            logger.info("Running in simulation mode.")
            self.device_connected = True
            return True

    def is_connected(self) -> bool:
        """Check if HackRF device is connected"""
        return self.device_connected

    def get_device_info(self) -> Dict[str, Any]:
        """Get HackRF device information"""
        if not self.device_connected:
            return {'error': 'Device not connected'}

        try:
            # If we're transmitting, don't query the device
            if self.transmission_active:
                return {
                    'status': 'connected',
                    'info': 'HackRF Device (Transmitting)',
                    'current_frequency': self.current_frequency,
                    'current_sample_rate': self.current_sample_rate,
                    'current_gain': self.current_gain,
                    'board_id': 'HackRF One',
                    'firmware_version': 'Transmitting...',
                    'transmission_active': True
                }

            # Try python_hackrf API first
            if HACKRF_API_AVAILABLE and self._api_initialized:
                try:
                    info_str = _pyhackrf_info_mod.pyhackrf_info(
                        print_to_console=False,
                        initialize=False  # Already initialized
                    )
                    if info_str:
                        return {
                            'status': 'connected',
                            'info': info_str.strip(),
                            'current_frequency': self.current_frequency,
                            'current_sample_rate': self.current_sample_rate,
                            'current_gain': self.current_gain,
                            'board_id': 'HackRF One',
                            'firmware_version': 'Hardware Connected (API)',
                            'transmission_active': False
                        }
                except Exception as e:
                    logger.warning(f"python_hackrf info failed, trying CLI: {e}")

            # Fall back to CLI
            try:
                result = subprocess.run(['hackrf_info'],
                                      capture_output=True, text=True, timeout=2)
                if result.returncode == 0:
                    return {
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
                return {
                    'status': 'connected',
                    'info': 'HackRF Device (Simulation Mode)',
                    'current_frequency': self.current_frequency,
                    'current_sample_rate': self.current_sample_rate,
                    'current_gain': self.current_gain,
                    'board_id': 'HackRF One (Simulated)',
                    'firmware_version': 'Simulation',
                    'transmission_active': False
                }

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
            # Configure device parameters
            self.set_frequency(frequency)
            self.set_sample_rate(sample_rate)
            self.set_gain(gain)

            with self._lock:
                self.transmission_active = True
                self._stop_transmission.clear()
                self.current_frequency = frequency
                self.current_sample_rate = sample_rate
                self.current_gain = gain

                # Calculate signal duration
                signal_duration = len(signal_data) / (sample_rate * 2)  # 2 bytes per sample (I/Q)

                if duration is None:
                    duration = signal_duration
                else:
                    duration = float(duration)

                needs_looping = duration > signal_duration

                # Determine if we can transmit (API or CLI)
                can_transmit = HACKRF_API_AVAILABLE or HACKRF_CLI_AVAILABLE

                if can_transmit:
                    # Convert bytes to complex samples
                    samples_uint8 = np.frombuffer(signal_data, dtype=np.uint8)
                    if len(samples_uint8) % 2 == 1:
                        samples_uint8 = samples_uint8[:-1]
                    i = samples_uint8[0::2].astype(np.float32)
                    q = samples_uint8[1::2].astype(np.float32)
                    samples = (i - 127) / 127.0 + 1j * ((q - 127) / 127.0)

                    if needs_looping:
                        logger.info("Starting looping transmission")
                        self._transmission_thread = threading.Thread(
                            target=self._transmit_with_hackrf_transfer_looping,
                            args=(samples, duration, signal_duration, needs_looping)
                        )
                    else:
                        logger.info("Starting single transmission")
                        self._transmission_thread = threading.Thread(
                            target=self._transmit_with_hackrf_transfer,
                            args=(samples, duration)
                        )

                    self._transmission_thread.daemon = True
                    self._transmission_thread.start()
                    logger.info(f"HackRF transmission started at {frequency} Hz")
                else:
                    logger.info(f"Simulation mode: would transmit {len(signal_data)} samples at {frequency} Hz")
                    def simulate_transmission():
                        start_time = time.time()
                        while (time.time() - start_time < duration and
                               not self._stop_transmission.is_set()):
                            time.sleep(0.1)
                        self.transmission_active = False

                    self._transmission_thread = threading.Thread(target=simulate_transmission)
                    self._transmission_thread.daemon = True
                    self._transmission_thread.start()

                return True
        except Exception as e:
            logger.error(f"Error starting transmission: {e}")
            self.transmission_active = False
            return False

    def _samples_to_complex64_file(self, samples: np.ndarray) -> str:
        """Convert complex samples to a complex64 temp file for python_hackrf API.

        python_hackrf expects complex64 format (numpy float32 complex: I + jQ),
        not the uint8 interleaved format used by hackrf_transfer CLI.
        """
        samples_c64 = samples.astype(np.complex64)
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.complex64')
        samples_c64.tofile(tmp_file)
        tmp_file.close()
        return tmp_file.name

    def _samples_to_uint8_file(self, samples: np.ndarray) -> str:
        """Convert complex samples to uint8 I/Q interleaved temp file for CLI fallback."""
        i_data = np.clip(np.real(samples) * 127 + 127, 0, 255).astype(np.uint8)
        q_data = np.clip(np.imag(samples) * 127 + 127, 0, 255).astype(np.uint8)
        iq_data = np.empty(len(samples) * 2, dtype=np.uint8)
        iq_data[0::2] = i_data
        iq_data[1::2] = q_data

        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.bin')
        tmp_file.write(iq_data.tobytes())
        tmp_file.close()
        return tmp_file.name

    def _transmit_via_api(self, tmp_filename: str, repeat: bool = False) -> None:
        """Transmit using python_hackrf native API.

        Args:
            tmp_filename: Path to complex64 signal file
            repeat: Whether to loop transmission
        """
        logger.info(f"Transmitting via python_hackrf API: freq={self.current_frequency}, "
                    f"sr={self.current_sample_rate}, gain={self.current_gain}, repeat={repeat}")

        _pyhackrf_transfer_mod.pyhackrf_transfer(
            tx_filename=tmp_filename,
            frequency=int(self.current_frequency),
            sample_rate=int(self.current_sample_rate),
            tx_vga_gain=int(self.current_gain),
            amp_enable=True,
            repeat_tx=repeat,
            print_to_console=False
        )

    def _transmit_via_subprocess(self, tmp_filename: str, duration: float,
                                  repeat: bool = False) -> None:
        """Transmit using hackrf_transfer subprocess (fallback).

        Args:
            tmp_filename: Path to uint8 I/Q interleaved signal file
            duration: How long to transmit
            repeat: Whether to loop transmission
        """
        cmd = [
            'hackrf_transfer',
            '-t', tmp_filename,
            '-f', str(int(self.current_frequency)),
            '-s', str(int(self.current_sample_rate)),
            '-x', str(int(self.current_gain)),
            '-a', '1',
        ]
        if repeat:
            cmd.append('-R')

        logger.info(f"Starting HackRF subprocess: {' '.join(cmd)}")
        logger.info(f"Signal file size: {os.path.getsize(tmp_filename)} bytes")

        self._hackrf_process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        logger.info(f"HackRF process started with PID: {self._hackrf_process.pid}")
        time.sleep(1.0)

        if self._hackrf_process.poll() is not None:
            logger.warning(f"HackRF process failed immediately - return code: {self._hackrf_process.returncode}")
            stdout, stderr = self._hackrf_process.communicate()
            if stderr:
                logger.error(f"Error: {stderr}")
            return

        logger.info("HackRF process running successfully")

        # Monitor for duration
        start_time = time.time()
        while (time.time() - start_time < duration and
               self._hackrf_process.poll() is None and
               not self._stop_transmission.is_set()):
            time.sleep(0.1)

        # Stop process
        if self._hackrf_process.poll() is None:
            if self._stop_transmission.is_set():
                logger.info("Stop requested, terminating HackRF process")
            self._hackrf_process.terminate()
            try:
                self._hackrf_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._hackrf_process.kill()

        stdout, stderr = self._hackrf_process.communicate()
        actual_duration = time.time() - start_time
        logger.info(f"HackRF transmission completed: {actual_duration:.1f}s, "
                    f"return code: {self._hackrf_process.returncode}")
        if stdout:
            logger.info(f"STDOUT: {stdout}")
        if stderr and self._hackrf_process.returncode != 0:
            logger.error(f"STDERR: {stderr}")

    def _transmit_with_hackrf_transfer(self, samples: np.ndarray, duration: float) -> None:
        """Transmit samples once (no looping). Tries API first, falls back to subprocess."""
        tmp_api = None
        tmp_cli = None
        try:
            # Try python_hackrf API first
            if HACKRF_API_AVAILABLE and self._api_initialized:
                try:
                    tmp_api = self._samples_to_complex64_file(samples)
                    logger.info(f"API transmission file: {os.path.getsize(tmp_api)} bytes")

                    # Run pyhackrf_transfer in a thread we can interrupt
                    api_done = threading.Event()
                    api_error = [None]

                    def run_api():
                        try:
                            self._transmit_via_api(tmp_api, repeat=False)
                        except Exception as e:
                            api_error[0] = e
                        finally:
                            api_done.set()

                    api_thread = threading.Thread(target=run_api, daemon=True)
                    api_thread.start()

                    # Wait for completion or stop signal
                    start_time = time.time()
                    while not api_done.is_set():
                        if self._stop_transmission.is_set():
                            logger.info("Stop requested during API transmission")
                            try:
                                _pyhackrf_transfer_mod.stop_all()
                            except Exception:
                                pass
                            break
                        if time.time() - start_time > duration + 5:
                            # Safety timeout
                            logger.warning("API transmission timeout, stopping")
                            try:
                                _pyhackrf_transfer_mod.stop_all()
                            except Exception:
                                pass
                            break
                        api_done.wait(timeout=0.1)

                    if api_error[0]:
                        raise api_error[0]

                    actual_duration = time.time() - start_time
                    logger.info(f"Single transmission completed via API: {actual_duration:.1f}s")
                    return

                except Exception as e:
                    logger.warning(f"python_hackrf API transmission failed, falling back to subprocess: {e}")

            # Fall back to subprocess
            if HACKRF_CLI_AVAILABLE:
                tmp_cli = self._samples_to_uint8_file(samples)
                self._transmit_via_subprocess(tmp_cli, duration, repeat=False)
            else:
                # Simulation mode
                logger.info(f"Simulating transmission for {duration:.2f} seconds...")
                start_time = time.time()
                while (time.time() - start_time < duration and
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"Error in transmission: {e}")
        finally:
            self.transmission_active = False
            # Clean up temp files
            for f in [tmp_api, tmp_cli]:
                if f:
                    try:
                        os.unlink(f)
                    except OSError:
                        pass

    def _transmit_with_hackrf_transfer_looping(self, samples: np.ndarray, total_duration: float,
                                             signal_duration: float, needs_looping: bool) -> None:
        """Transmit samples with looping. Tries API first, falls back to subprocess."""
        tmp_api = None
        tmp_cli = None
        try:
            # Try python_hackrf API first
            if HACKRF_API_AVAILABLE and self._api_initialized:
                try:
                    tmp_api = self._samples_to_complex64_file(samples)
                    logger.info(f"API looping transmission file: {os.path.getsize(tmp_api)} bytes")

                    api_done = threading.Event()
                    api_error = [None]

                    def run_api():
                        try:
                            self._transmit_via_api(tmp_api, repeat=True)
                        except Exception as e:
                            api_error[0] = e
                        finally:
                            api_done.set()

                    api_thread = threading.Thread(target=run_api, daemon=True)
                    api_thread.start()

                    # Wait for the total duration, then stop
                    start_time = time.time()
                    while not api_done.is_set():
                        elapsed = time.time() - start_time
                        if self._stop_transmission.is_set() or elapsed >= total_duration:
                            if self._stop_transmission.is_set():
                                logger.info("Stop requested during looping API transmission")
                            else:
                                logger.info(f"Looping duration reached ({total_duration:.1f}s), stopping")
                            try:
                                _pyhackrf_transfer_mod.stop_all()
                            except Exception:
                                pass
                            break
                        api_done.wait(timeout=0.1)

                    if api_error[0]:
                        raise api_error[0]

                    actual_duration = time.time() - start_time
                    logger.info(f"Looping transmission completed via API: {actual_duration:.1f}s")
                    return

                except Exception as e:
                    logger.warning(f"python_hackrf API looping failed, falling back to subprocess: {e}")

            # Fall back to subprocess with tiled data
            if HACKRF_CLI_AVAILABLE:
                # For subprocess, tile the data to cover the duration
                if total_duration > signal_duration:
                    copies_needed = max(1, int(total_duration / signal_duration))
                    tiled_samples = np.tile(samples, copies_needed)
                    logger.info(f"Creating loopable signal: {copies_needed} copies for {total_duration:.1f}s")
                else:
                    tiled_samples = samples

                tmp_cli = self._samples_to_uint8_file(tiled_samples)
                self._transmit_via_subprocess(tmp_cli, total_duration, repeat=True)
            else:
                # Simulation mode
                logger.info(f"Simulating looping transmission for {total_duration:.2f} seconds...")
                start_time = time.time()
                while (time.time() - start_time < total_duration and
                       not self._stop_transmission.is_set()):
                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"Error in looping transmission: {e}")
        finally:
            self.transmission_active = False
            for f in [tmp_api, tmp_cli]:
                if f:
                    try:
                        os.unlink(f)
                    except OSError:
                        pass

    def _transmit_samples(self, samples: np.ndarray) -> None:
        """Transmit samples using HackRF (runs in separate thread)"""
        try:
            duration = len(samples) / self.current_sample_rate
            self._transmit_with_hackrf_transfer(samples, duration)
        except Exception as e:
            logger.error(f"Error during transmission: {e}")
        finally:
            self.transmission_active = False

    def _transmit_samples_with_looping(self, samples: np.ndarray, total_duration: float,
                                     signal_duration: float, needs_looping: bool) -> None:
        """Transmit samples with looping support for longer durations"""
        try:
            self._transmit_with_hackrf_transfer_looping(
                samples, total_duration, signal_duration, needs_looping)
        except Exception as e:
            logger.error(f"Error during looping transmission: {e}")
        finally:
            self.transmission_active = False

    def stop_transmission(self) -> bool:
        """Stop signal transmission"""
        if not self.transmission_active:
            return True

        try:
            with self._lock:
                self._stop_transmission.set()

                # Stop via python_hackrf API if available
                if HACKRF_API_AVAILABLE:
                    try:
                        _pyhackrf_transfer_mod.stop_all()
                    except Exception as e:
                        logger.warning(f"python_hackrf stop_all failed: {e}")

                # Also terminate subprocess if running
                if self._hackrf_process and self._hackrf_process.poll() is None:
                    try:
                        self._hackrf_process.terminate()
                        self._hackrf_process.wait(timeout=5)
                    except Exception:
                        try:
                            self._hackrf_process.kill()
                        except Exception:
                            pass

                if self._transmission_thread and self._transmission_thread.is_alive():
                    self._transmission_thread.join(timeout=2)

                self.transmission_active = False
                self._hackrf_process = None
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
        if baseband_freq == 0:
            signal = np.ones(num_samples, dtype=np.complex64)
        else:
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

            # Terminate any running subprocess
            if self._hackrf_process and self._hackrf_process.poll() is None:
                try:
                    self._hackrf_process.terminate()
                    self._hackrf_process.wait(timeout=5)
                except Exception as e:
                    logger.warning(f"Error terminating HackRF process: {e}")

            # Clean up python_hackrf
            if HACKRF_API_AVAILABLE and self._api_initialized:
                try:
                    pyhackrf.pyhackrf_exit()
                    self._api_initialized = False
                    logger.info("python_hackrf library cleaned up")
                except Exception as e:
                    logger.warning(f"Error during pyhackrf_exit: {e}")

            logger.info("HackRF controller cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    def __del__(self):
        """Cleanup when object is destroyed"""
        try:
            self.cleanup()
        except Exception:
            pass
