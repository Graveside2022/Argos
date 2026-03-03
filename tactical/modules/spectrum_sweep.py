#!/usr/bin/env python3
"""
Spectrum Sweep Module — wideband power sweep via hackrf_sweep.

Drives hackrf_sweep to scan a frequency range and parse the resulting
CSV records (date, time, hz_low, hz_high, hz_bin_width, num_samples,
dB values...). Returns peak frequencies and a summary power table.
"""

import argparse
import csv
import io
from pathlib import Path
from typing import Any

from base_module import TacticalModule


class SpectrumSweep(TacticalModule):
    """Wideband RF spectrum sweep using hackrf_sweep."""

    name = "spectrum_sweep"
    description = (
        "Scan a frequency range with hackrf_sweep and report peak power levels."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--freq-start",
            type=int,
            required=True,
            dest="freq_start",
            help="Sweep start frequency in Hz (e.g. 80000000 for 80 MHz).",
        )
        self.parser.add_argument(
            "--freq-end",
            type=int,
            required=True,
            dest="freq_end",
            help="Sweep end frequency in Hz (e.g. 1000000000 for 1 GHz).",
        )
        self.parser.add_argument(
            "--bin-width",
            type=int,
            default=1_000_000,
            dest="bin_width",
            help="FFT bin width in Hz (default: 1000000 = 1 MHz).",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=15,
            help="Sweep duration in seconds (default: 15).",
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            dest="output_file",
            help="Save raw CSV to this path (optional).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate frequency range and bin width."""
        if args.freq_start < 1_000_000:
            self.output_error(
                "Start frequency must be >= 1 MHz.",
                {"freq_start": args.freq_start},
            )
        if args.freq_end > 6_000_000_000:
            self.output_error(
                "End frequency must be <= 6 GHz.",
                {"freq_end": args.freq_end},
            )
        if args.freq_start >= args.freq_end:
            self.output_error(
                "freq-start must be less than freq-end.",
                {"freq_start": args.freq_start, "freq_end": args.freq_end},
            )
        if args.bin_width < 100_000 or args.bin_width > 20_000_000:
            self.output_error(
                "Bin width must be between 100 kHz and 20 MHz.",
                {"bin_width": args.bin_width},
            )

    def _parse_csv(self, raw_csv: str) -> list[dict[str, Any]]:
        """
        Parse hackrf_sweep CSV output.

        Each row: date, time, hz_low, hz_high, hz_bin_width, num_samples,
                  dB[0], dB[1], ...
        Returns list of bin dicts with center_hz and power_db.
        """
        bins: list[dict[str, Any]] = []
        reader = csv.reader(io.StringIO(raw_csv))
        for row in reader:
            if len(row) < 7:
                continue
            try:
                hz_low = float(row[2].strip())
                hz_high = float(row[3].strip())
                hz_bin_width = float(row[4].strip())
                db_values = [float(v.strip()) for v in row[6:] if v.strip()]
                if not db_values:
                    continue
                for i, db in enumerate(db_values):
                    center_hz = hz_low + hz_bin_width * i + hz_bin_width / 2.0
                    bins.append(
                        {
                            "center_hz": int(center_hz),
                            "center_mhz": round(center_hz / 1e6, 3),
                            "power_db": round(db, 2),
                        }
                    )
            except (ValueError, IndexError):
                continue
        return bins

    def _find_peaks(
        self, bins: list[dict[str, Any]], top_n: int = 10
    ) -> list[dict[str, Any]]:
        """Return the top-N bins by power level."""
        if not bins:
            return []
        sorted_bins = sorted(bins, key=lambda b: b["power_db"], reverse=True)
        return sorted_bins[:top_n]

    def _aggregate_by_mhz(
        self, bins: list[dict[str, Any]]
    ) -> dict[float, float]:
        """Average power readings per integer MHz bucket."""
        buckets: dict[float, list[float]] = {}
        for b in bins:
            mhz_key = round(b["center_hz"] / 1e6, 1)
            buckets.setdefault(mhz_key, []).append(b["power_db"])
        return {
            mhz: round(sum(vals) / len(vals), 2)
            for mhz, vals in sorted(buckets.items())
        }

    def run(self, args: argparse.Namespace) -> None:
        """Execute hackrf_sweep and parse spectrum data."""
        self._validate_args(args)

        freq_mhz_start = args.freq_start // 1_000_000
        freq_mhz_end = args.freq_end // 1_000_000

        cmd_args = [
            "-f", f"{freq_mhz_start}:{freq_mhz_end}",
            "-B",  # binary mode off (default CSV)
            "-w", str(args.bin_width),
            "-1",  # one-shot mode (exit after first full sweep)
        ]

        self.logger.info(
            "Sweeping %d–%d MHz with %d Hz bins for %ds",
            freq_mhz_start,
            freq_mhz_end,
            args.bin_width,
            args.duration,
        )

        stdout, stderr = self.run_tool_popen(
            "hackrf_sweep",
            cmd_args,
            duration=args.duration,
        )

        if not stdout.strip():
            self.output_error(
                "hackrf_sweep produced no output. Check device connection.",
                {"stderr": stderr[-500:] if stderr else ""},
            )

        # Optionally save raw CSV
        if args.output_file:
            out_path = Path(args.output_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(stdout)
            self.logger.info("Raw CSV saved to %s", args.output_file)

        bins = self._parse_csv(stdout)
        if not bins:
            self.output_error(
                "Failed to parse any spectrum bins from hackrf_sweep output.",
                {"raw_output_preview": stdout[:300]},
            )

        peaks = self._find_peaks(bins, top_n=10)
        avg_by_mhz = self._aggregate_by_mhz(bins)

        overall_min = min(b["power_db"] for b in bins)
        overall_max = max(b["power_db"] for b in bins)
        overall_avg = round(sum(b["power_db"] for b in bins) / len(bins), 2)

        self.output_success(
            {
                "freq_start_hz": args.freq_start,
                "freq_end_hz": args.freq_end,
                "freq_start_mhz": round(args.freq_start / 1e6, 1),
                "freq_end_mhz": round(args.freq_end / 1e6, 1),
                "bin_width_hz": args.bin_width,
                "duration_sec": args.duration,
                "total_bins": len(bins),
                "power_min_db": overall_min,
                "power_max_db": overall_max,
                "power_avg_db": overall_avg,
                "peak_frequencies": peaks,
                "power_by_mhz": avg_by_mhz,
                "output_file": args.output_file or None,
            }
        )


if __name__ == "__main__":
    SpectrumSweep().execute()
