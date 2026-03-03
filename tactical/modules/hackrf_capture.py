#!/usr/bin/env python3
"""
HackRF Capture Module — receive raw IQ samples via hackrf_transfer.

Captures raw IQ samples from a HackRF One at a specified frequency and
sample rate, writing to a .iq8s file for offline analysis.
"""

import argparse
import os
from pathlib import Path

from base_module import TacticalModule


class HackrfCapture(TacticalModule):
    """Receive raw IQ samples from HackRF One via hackrf_transfer -r."""

    name = "hackrf_capture"
    description = "Capture raw IQ samples from HackRF One at a specified frequency."

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--frequency",
            type=int,
            required=True,
            help="Center frequency in Hz (e.g. 433920000 for 433.92 MHz).",
        )
        self.parser.add_argument(
            "--sample-rate",
            type=int,
            default=20_000_000,
            dest="sample_rate",
            help="Sample rate in samples/sec (default: 20000000).",
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            dest="output_file",
            help="Output file path. Defaults to capture_<freq>_<ts>.iq8s.",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=10,
            help="Capture duration in seconds (default: 10).",
        )
        self.parser.add_argument(
            "--lna-gain",
            type=int,
            default=16,
            dest="lna_gain",
            help="LNA gain in dB, 0-40 in 8 dB steps (default: 16).",
        )
        self.parser.add_argument(
            "--vga-gain",
            type=int,
            default=20,
            dest="vga_gain",
            help="VGA (baseband) gain in dB, 0-62 in 2 dB steps (default: 20).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate frequency and gain ranges."""
        if args.frequency < 1_000_000 or args.frequency > 6_000_000_000:
            self.output_error(
                "Frequency out of HackRF range.",
                {"frequency": args.frequency, "valid_range": "1 MHz – 6 GHz"},
            )
        if args.sample_rate < 2_000_000 or args.sample_rate > 20_000_000:
            self.output_error(
                "Sample rate out of HackRF range.",
                {"sample_rate": args.sample_rate, "valid_range": "2–20 MSPS"},
            )
        if args.lna_gain not in range(0, 41, 8):
            self.output_error(
                "LNA gain must be 0, 8, 16, 24, 32, or 40 dB.",
                {"lna_gain": args.lna_gain},
            )
        if args.vga_gain < 0 or args.vga_gain > 62 or args.vga_gain % 2 != 0:
            self.output_error(
                "VGA gain must be 0–62 dB in 2 dB steps.",
                {"vga_gain": args.vga_gain},
            )
        if args.duration < 1 or args.duration > 3600:
            self.output_error(
                "Duration must be 1–3600 seconds.",
                {"duration": args.duration},
            )

    def _resolve_output_path(self, args: argparse.Namespace) -> str:
        """Build output file path, creating parent directories as needed."""
        if args.output_file:
            path = Path(args.output_file)
        else:
            import time
            ts = int(time.time())
            path = Path(f"capture_{args.frequency}_{ts}.iq8s")

        path.parent.mkdir(parents=True, exist_ok=True)
        return str(path.resolve())

    def run(self, args: argparse.Namespace) -> None:
        """Execute hackrf_transfer receive capture."""
        self._validate_args(args)
        output_path = self._resolve_output_path(args)

        cmd_args = [
            "-r", output_path,
            "-f", str(args.frequency),
            "-s", str(args.sample_rate),
            "-l", str(args.lna_gain),
            "-g", str(args.vga_gain),
        ]

        self.logger.info(
            "Capturing %.3f MHz for %ds → %s",
            args.frequency / 1e6,
            args.duration,
            output_path,
        )

        stdout, stderr = self.run_tool_popen(
            "hackrf_transfer",
            cmd_args,
            duration=args.duration,
        )

        # hackrf_transfer writes stats to stderr
        samples_received = 0
        transfer_rate_mb = 0.0
        for line in stderr.splitlines():
            if "samples received" in line.lower():
                parts = line.split()
                for i, tok in enumerate(parts):
                    if tok.isdigit():
                        samples_received = int(tok)
                        break
            if "mib/sec" in line.lower() or "mb/s" in line.lower():
                parts = line.split()
                for tok in parts:
                    try:
                        transfer_rate_mb = float(tok)
                        break
                    except ValueError:
                        continue

        # Measure written file
        out_path_obj = Path(output_path)
        file_size_bytes = out_path_obj.stat().st_size if out_path_obj.exists() else 0
        file_size_mb = file_size_bytes / (1024 * 1024)

        if file_size_bytes == 0:
            self.output_error(
                "Capture produced no data. Check HackRF connection.",
                {"stderr": stderr[-500:] if stderr else ""},
            )

        self.output_success(
            {
                "output_file": output_path,
                "file_size_bytes": file_size_bytes,
                "file_size_mb": round(file_size_mb, 2),
                "frequency_hz": args.frequency,
                "frequency_mhz": round(args.frequency / 1e6, 3),
                "sample_rate": args.sample_rate,
                "duration_sec": args.duration,
                "lna_gain_db": args.lna_gain,
                "vga_gain_db": args.vga_gain,
                "samples_received": samples_received,
                "transfer_rate_mbs": transfer_rate_mb,
            }
        )


if __name__ == "__main__":
    HackrfCapture().execute()
