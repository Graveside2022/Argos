#!/usr/bin/env python3
"""
RF Replay Module — transmit a captured IQ file via hackrf_transfer -t.

REQUIRES ROOT. Replays a previously captured .iq8s/.cfile recording
through HackRF One at the specified frequency. Used for replay attacks
and signal verification during Army EW training exercises.

WARNING: Unauthorized RF transmission is illegal. Only use within
authorized frequency bands during cleared training exercises.
"""

import argparse
from pathlib import Path

from base_module import TacticalModule


class RfReplay(TacticalModule):
    """Transmit a captured IQ file via hackrf_transfer (requires root)."""

    name = "rf_replay"
    description = (
        "Replay a captured IQ file through HackRF One via hackrf_transfer -t. "
        "Requires root. WARNING: Only use in authorized training environments."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--input-file",
            required=True,
            dest="input_file",
            help="Path to IQ capture file (.iq8s, .cfile, .bin).",
        )
        self.parser.add_argument(
            "--frequency",
            type=int,
            required=True,
            help="Transmit center frequency in Hz (e.g. 433920000).",
        )
        self.parser.add_argument(
            "--sample-rate",
            type=int,
            default=20_000_000,
            dest="sample_rate",
            help="Sample rate in samples/sec (default: 20000000).",
        )
        self.parser.add_argument(
            "--tx-gain",
            type=int,
            default=30,
            dest="tx_gain",
            help="TX VGA gain in dB, 0–47 in 1 dB steps (default: 30).",
        )
        self.parser.add_argument(
            "--repeat",
            action="store_true",
            default=False,
            help="Repeat transmit until timeout (default: transmit once).",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=0,
            help="Duration in seconds for repeat mode (0 = use --timeout).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate file existence and HackRF parameter ranges."""
        if not Path(args.input_file).exists():
            self.output_error(
                f"Input file not found: {args.input_file}",
                {"path": args.input_file},
            )
        file_size = Path(args.input_file).stat().st_size
        if file_size == 0:
            self.output_error(
                "Input file is empty — nothing to transmit.",
                {"path": args.input_file},
            )
        if args.frequency < 1_000_000 or args.frequency > 6_000_000_000:
            self.output_error(
                "Frequency out of HackRF range (1 MHz – 6 GHz).",
                {"frequency": args.frequency},
            )
        if args.sample_rate < 2_000_000 or args.sample_rate > 20_000_000:
            self.output_error(
                "Sample rate out of HackRF range (2–20 MSPS).",
                {"sample_rate": args.sample_rate},
            )
        if not 0 <= args.tx_gain <= 47:
            self.output_error(
                "TX gain must be 0–47 dB.",
                {"tx_gain": args.tx_gain},
            )

    def _build_args(self, args: argparse.Namespace) -> list[str]:
        """Build hackrf_transfer argument list for transmit mode."""
        cmd: list[str] = [
            "-t", args.input_file,
            "-f", str(args.frequency),
            "-s", str(args.sample_rate),
            "-x", str(args.tx_gain),
        ]
        if args.repeat:
            cmd.append("-R")
        return cmd

    def run(self, args: argparse.Namespace) -> None:
        """Transmit IQ file via hackrf_transfer (root required)."""
        if not self.check_root():
            return

        self._validate_args(args)

        file_size = Path(args.input_file).stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        cmd_args = self._build_args(args)

        self.logger.info(
            "Transmitting %s (%.2f MB) at %.3f MHz, TX gain %d dB",
            args.input_file,
            file_size_mb,
            args.frequency / 1e6,
            args.tx_gain,
        )

        if args.repeat:
            duration = args.duration if args.duration > 0 else args.timeout
            self.logger.info("Repeat mode enabled, running for %ds", duration)
            stdout, stderr = self.run_tool_popen(
                "hackrf_transfer",
                cmd_args,
                duration=duration,
            )
            return_code = 0  # Popen terminated by timeout
        else:
            result = self.run_tool(
                "hackrf_transfer",
                cmd_args,
                timeout=args.timeout,
            )
            stdout = result.stdout
            stderr = result.stderr
            return_code = result.returncode

        # Parse transfer stats from stderr
        samples_transmitted = 0
        for line in stderr.splitlines():
            if "samples transmitted" in line.lower():
                for tok in line.split():
                    if tok.isdigit():
                        samples_transmitted = int(tok)
                        break

        if return_code not in (0,) and not args.repeat:
            self.output_error(
                "hackrf_transfer failed.",
                {
                    "return_code": return_code,
                    "stderr": stderr[-500:],
                },
            )

        self.output_success(
            {
                "input_file": args.input_file,
                "file_size_bytes": file_size,
                "file_size_mb": round(file_size_mb, 2),
                "frequency_hz": args.frequency,
                "frequency_mhz": round(args.frequency / 1e6, 3),
                "sample_rate": args.sample_rate,
                "tx_gain_db": args.tx_gain,
                "repeat": args.repeat,
                "samples_transmitted": samples_transmitted,
                "return_code": return_code,
            }
        )


if __name__ == "__main__":
    RfReplay().execute()
