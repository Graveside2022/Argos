#!/usr/bin/env python3
"""Drop-in replacement for hackrf_sweep using python_hackrf library.

Accepts the same CLI arguments as hackrf_sweep and outputs data in the
same CSV format to stdout, so it can replace the binary in pipelines
like auto_sweep.sh -> ProcessManager.ts without changing the parser.

Output format (matching hackrf_sweep):
  date, time, hz_low, hz_high, hz_bin_width, num_samples, dB, dB, dB, ...

Usage:
  python3 sweep_bridge.py -f 2400:2500 -g 20 -l 32 -w 20000
"""
import sys
import argparse
import signal
import time
from datetime import datetime

try:
    from python_hackrf import pyhackrf
    from python_hackrf import pyhackrf_sweep as _pyhackrf_sweep_mod
    HACKRF_API_AVAILABLE = True
except ImportError:
    HACKRF_API_AVAILABLE = False
    print("ERROR: python-hackrf not installed. Install with: pip install python-hackrf",
          file=sys.stderr)
    sys.exit(1)

# Queue for receiving sweep data from the library
import multiprocessing
import queue


def parse_args():
    """Parse hackrf_sweep-compatible CLI arguments."""
    parser = argparse.ArgumentParser(description='HackRF sweep bridge (python_hackrf)')
    parser.add_argument('-f', '--freq-range', required=True,
                       help='Frequency range in MHz as min:max (e.g. 2400:2500)')
    parser.add_argument('-g', '--vga-gain', type=int, default=20,
                       help='VGA gain (0-62 dB, 2 dB steps)')
    parser.add_argument('-l', '--lna-gain', type=int, default=32,
                       help='LNA gain (0-40 dB, 8 dB steps)')
    parser.add_argument('-w', '--bin-width', type=int, default=100000,
                       help='FFT bin width in Hz (default: 100000)')
    parser.add_argument('-n', '--one-shot', action='store_true',
                       help='One-shot mode (exit after one sweep)')
    parser.add_argument('-N', '--num-sweeps', type=int, default=None,
                       help='Number of sweeps to perform')
    parser.add_argument('-a', '--amp-enable', action='store_true',
                       help='Enable antenna port power')
    parser.add_argument('-d', '--serial', type=str, default=None,
                       help='Serial number of HackRF device')
    return parser.parse_args()


def main():
    args = parse_args()

    # Parse frequency range (MHz -> Hz)
    try:
        freq_parts = args.freq_range.split(':')
        freq_min_mhz = int(freq_parts[0])
        freq_max_mhz = int(freq_parts[1])
    except (ValueError, IndexError):
        print(f"ERROR: Invalid frequency range: {args.freq_range}", file=sys.stderr)
        sys.exit(1)

    freq_min_hz = freq_min_mhz * 1_000_000
    freq_max_hz = freq_max_mhz * 1_000_000

    # Build frequency list for pyhackrf_sweep (pairs of start/stop in Hz)
    frequencies = [freq_min_hz, freq_max_hz]

    # Create a queue to receive sweep results
    data_queue = multiprocessing.Queue()

    # Handle SIGINT/SIGTERM gracefully
    stop_event = multiprocessing.Event()

    def signal_handler(signum, frame):
        stop_event.set()
        try:
            _pyhackrf_sweep_mod.stop_all()
        except Exception:
            pass

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run sweep in a separate thread so we can read the queue
    import threading

    sweep_error = [None]

    def run_sweep():
        try:
            _pyhackrf_sweep_mod.pyhackrf_sweep(
                frequencies=frequencies,
                lna_gain=args.lna_gain,
                vga_gain=args.vga_gain,
                bin_width=args.bin_width,
                amp_enable=args.amp_enable,
                one_shot=args.one_shot,
                num_sweeps=args.num_sweeps,
                serial_number=args.serial,
                queue=data_queue,
                print_to_console=False
            )
        except Exception as e:
            sweep_error[0] = e
        finally:
            # Signal that sweep is done by putting a sentinel
            data_queue.put(None)

    sweep_thread = threading.Thread(target=run_sweep, daemon=True)
    sweep_thread.start()

    # Read from queue and output in hackrf_sweep CSV format
    try:
        while not stop_event.is_set():
            try:
                result = data_queue.get(timeout=1.0)
            except queue.Empty:
                continue

            if result is None:
                break

            # result format from pyhackrf_sweep queue:
            # (timestamp, hz_low, hz_high, hz_bin_width, num_samples, [dB values...])
            try:
                if isinstance(result, tuple) and len(result) >= 5:
                    timestamp, hz_low, hz_high, hz_bin_width, num_samples = result[:5]
                    db_values = result[5] if len(result) > 5 else []

                    # Format timestamp
                    now = datetime.now()
                    date_str = now.strftime('%Y-%m-%d')
                    time_str = now.strftime('%H:%M:%S.%f')[:-3]

                    # Format dB values
                    db_str = ', '.join(f'{v:.2f}' for v in db_values)

                    # Output in hackrf_sweep format
                    line = (f"{date_str}, {time_str}, "
                           f"{int(hz_low)}, {int(hz_high)}, "
                           f"{int(hz_bin_width)}, {int(num_samples)}, "
                           f"{db_str}")
                    print(line, flush=True)
                else:
                    # Unknown format, try to pass through
                    print(str(result), flush=True)

            except Exception as e:
                print(f"ERROR: Failed to format sweep data: {e}", file=sys.stderr)

    except KeyboardInterrupt:
        pass
    finally:
        try:
            _pyhackrf_sweep_mod.stop_all()
        except Exception:
            pass

    if sweep_error[0]:
        print(f"ERROR: Sweep failed: {sweep_error[0]}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
