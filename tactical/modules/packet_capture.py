#!/usr/bin/env python3
"""
Packet Capture Module — tcpdump wrapper.

Captures raw network traffic on a specified interface with optional BPF filter.
Supports duration-limited capture with optional PCAP file output.
Parses packet count from tcpdump summary output.
"""

import argparse
import re
from pathlib import Path

from base_module import TacticalModule


class PacketCapture(TacticalModule):
    """Capture live network traffic using tcpdump."""

    name: str = "packet_capture"
    description: str = "Capture network packets using tcpdump with optional BPF filter."

    def _add_module_args(self) -> None:
        """Register packet capture arguments."""
        self.parser.add_argument(
            "--interface",
            required=True,
            help="Network interface to capture on (e.g. eth0, wlan0)",
        )
        self.parser.add_argument(
            "--filter",
            default="",
            help="BPF filter expression (e.g. 'tcp port 80', 'host 192.168.1.1')",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=30,
            help="Capture duration in seconds (default: 30)",
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            help="Path to write PCAP file (optional; omit for summary only)",
        )
        self.parser.add_argument(
            "--count",
            type=int,
            default=0,
            help="Stop after capturing this many packets (0 = unlimited)",
        )
        self.parser.add_argument(
            "--snaplen",
            type=int,
            default=65535,
            help="Snapshot length in bytes (default: 65535)",
        )

    # ── Validation ──────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate all arguments before executing."""
        if not self.validate_interface(args.interface):
            self.output_error(
                f"Invalid interface name: {args.interface!r}. "
                "Must match [a-zA-Z0-9_-]{1,15}."
            )

        if not self.check_interface_exists(args.interface):
            self.output_error(
                f"Interface {args.interface!r} not found on this system.",
                {"available": self._list_interfaces()},
            )

        if args.duration < 1 or args.duration > 3600:
            self.output_error(
                f"Duration must be between 1 and 3600 seconds, got {args.duration}."
            )

        if args.count < 0:
            self.output_error(f"Packet count must be >= 0, got {args.count}.")

        if args.output_file:
            output_path = Path(args.output_file)
            if not output_path.parent.exists():
                self.output_error(
                    f"Output directory does not exist: {output_path.parent}"
                )

    @staticmethod
    def _list_interfaces() -> list[str]:
        """Return list of available network interfaces."""
        net_path = Path("/sys/class/net")
        if net_path.exists():
            return [p.name for p in net_path.iterdir()]
        return []

    # ── Command construction ─────────────────────────────────────────

    def _build_tcpdump_args(self, args: argparse.Namespace) -> list[str]:
        """Build tcpdump argument list from parsed args."""
        tcpdump_args: list[str] = [
            "-i", args.interface,
            "-s", str(args.snaplen),
            "-n",           # no DNS resolution
            "-l",           # line-buffered stdout
            "--immediate-mode",
        ]

        if args.output_file:
            tcpdump_args.extend(["-w", args.output_file])
        else:
            tcpdump_args.extend(["-v"])  # verbose summary when no file

        if args.count > 0:
            tcpdump_args.extend(["-c", str(args.count)])

        if args.filter:
            tcpdump_args.append(args.filter)

        return tcpdump_args

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_packet_count(self, stderr: str) -> dict[str, int]:
        """
        Extract packet statistics from tcpdump summary.

        tcpdump prints on exit:
            N packets captured
            N packets received by filter
            N packets dropped by kernel
        """
        stats: dict[str, int] = {
            "captured": 0,
            "received_by_filter": 0,
            "dropped_by_kernel": 0,
        }

        captured_match = re.search(r"(\d+)\s+packets? captured", stderr)
        if captured_match:
            stats["captured"] = int(captured_match.group(1))

        received_match = re.search(r"(\d+)\s+packets? received by filter", stderr)
        if received_match:
            stats["received_by_filter"] = int(received_match.group(1))

        dropped_match = re.search(r"(\d+)\s+packets? dropped by kernel", stderr)
        if dropped_match:
            stats["dropped_by_kernel"] = int(dropped_match.group(1))

        return stats

    def _count_pcap_lines(self, stdout: str) -> int:
        """Count non-empty output lines as a proxy for packet count."""
        return sum(1 for line in stdout.splitlines() if line.strip())

    # ── Main run ────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute tcpdump capture and return packet statistics."""
        self._validate_args(args)

        tcpdump_args = self._build_tcpdump_args(args)
        self.logger.info(
            "Starting packet capture on %s for %ds", args.interface, args.duration
        )

        stdout, stderr = self.run_tool_popen(
            "tcpdump",
            tcpdump_args,
            duration=args.duration,
        )

        packet_stats = self._parse_packet_count(stderr)

        result: dict = {
            "interface": args.interface,
            "filter": args.filter or "(none)",
            "duration_seconds": args.duration,
            "packet_count_requested": args.count,
            "packet_stats": packet_stats,
        }

        if args.output_file:
            pcap_path = Path(args.output_file)
            result["output_file"] = args.output_file
            result["output_file_exists"] = pcap_path.exists()
            result["output_file_size_bytes"] = (
                pcap_path.stat().st_size if pcap_path.exists() else 0
            )
        else:
            # Provide a preview of captured output
            lines = [line for line in stdout.splitlines() if line.strip()]
            result["packet_preview"] = lines[:20]
            result["preview_lines"] = len(lines)

        self.output_success(result)


if __name__ == "__main__":
    PacketCapture().execute()
