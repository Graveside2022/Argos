#!/usr/bin/env python3
"""
Traffic Analyzer Module — tshark wrapper.

Analyzes network traffic from a PCAP file or live capture using tshark.
Supports multiple analysis modes: conversations, protocols, endpoints,
HTTP dissection, DNS queries, and general statistics.
Outputs structured JSON by parsing tshark's -T json / -z stat flags.
"""

import argparse
import json
import re
from typing import Any

from base_module import TacticalModule


_VALID_MODES = ("conversations", "protocols", "endpoints", "http", "dns", "statistics")


class TrafficAnalyzer(TacticalModule):
    """Analyze network traffic from PCAP or live interface using tshark."""

    name: str = "traffic_analyzer"
    description: str = (
        "Analyze captured or live traffic with tshark. Modes: "
        "conversations, protocols, endpoints, http, dns, statistics."
    )

    def _add_module_args(self) -> None:
        """Register traffic analysis arguments."""
        source = self.parser.add_mutually_exclusive_group(required=True)
        source.add_argument(
            "--input-file",
            help="Path to PCAP/PCAPNG file to analyze",
        )
        source.add_argument(
            "--interface",
            help="Live capture interface (e.g. eth0). Requires --duration.",
        )
        self.parser.add_argument(
            "--mode",
            choices=list(_VALID_MODES),
            default="protocols",
            help="Analysis mode (default: protocols)",
        )
        self.parser.add_argument(
            "--filter",
            default="",
            help="Wireshark display filter (e.g. 'tcp.port == 80')",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=30,
            help="Live capture duration in seconds (default: 30, ignored for file input)",
        )
        self.parser.add_argument(
            "--top-n",
            type=int,
            default=20,
            help="Limit result rows returned (default: 20)",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate arguments before executing tshark."""
        if args.input_file:
            from pathlib import Path
            if not Path(args.input_file).exists():
                self.output_error(f"Input file not found: {args.input_file!r}")
            if not Path(args.input_file).is_file():
                self.output_error(f"Input path is not a file: {args.input_file!r}")

        if args.interface:
            if not self.validate_interface(args.interface):
                self.output_error(f"Invalid interface name: {args.interface!r}")
            if not self.check_interface_exists(args.interface):
                self.output_error(f"Interface {args.interface!r} not found on system.")
            if args.duration < 1 or args.duration > 3600:
                self.output_error(
                    f"Duration must be 1–3600 seconds, got {args.duration}."
                )

    # ── Command builders ─────────────────────────────────────────────

    def _build_base_args(self, args: argparse.Namespace) -> list[str]:
        """Build source-specific tshark arguments (file or interface)."""
        base: list[str] = []
        if args.input_file:
            base.extend(["-r", args.input_file])
        else:
            base.extend(["-i", args.interface, "-a", f"duration:{args.duration}"])

        if args.filter:
            base.extend(["-Y", args.filter])

        return base

    def _build_mode_args(self, mode: str) -> tuple[list[str], str]:
        """
        Return (tshark_args, output_format) for the requested analysis mode.
        output_format is either 'json' or 'text'.
        """
        mode_map: dict[str, tuple[list[str], str]] = {
            "conversations": (
                ["-z", "conv,tcp", "-q"],
                "text",
            ),
            "protocols": (
                ["-z", "io,phs", "-q"],
                "text",
            ),
            "endpoints": (
                ["-z", "endpoints,tcp", "-q"],
                "text",
            ),
            "http": (
                ["-T", "json", "-Y", "http"],
                "json",
            ),
            "dns": (
                ["-T", "json", "-Y", "dns"],
                "json",
            ),
            "statistics": (
                ["-z", "io,stat,0", "-q"],
                "text",
            ),
        }
        return mode_map[mode]

    # ── Output parsers ───────────────────────────────────────────────

    def _parse_text_output(self, stdout: str, mode: str, top_n: int) -> list[dict[str, Any]]:
        """Parse tshark text-format statistical output into structured rows."""
        lines = stdout.splitlines()
        results: list[dict[str, Any]] = []

        if mode == "protocols":
            # Parse protocol hierarchy: lines like "  tcp       frames:N bytes:N"
            for line in lines:
                match = re.search(
                    r"(\S+)\s+frames:(\d+)\s+bytes:(\d+)", line
                )
                if match:
                    results.append({
                        "protocol": match.group(1),
                        "frames": int(match.group(2)),
                        "bytes": int(match.group(3)),
                    })

        elif mode in ("conversations", "endpoints"):
            # Parse tabular output — extract data rows after the header separator
            in_data = False
            for line in lines:
                if re.match(r"^=+$", line.strip()):
                    in_data = True
                    continue
                if in_data and line.strip() and not line.startswith("Filter"):
                    parts = line.split()
                    if len(parts) >= 4:
                        results.append({"raw": line.strip(), "columns": parts})

        elif mode == "statistics":
            # Parse IO stat table
            for line in lines:
                match = re.search(
                    r"(\d+\.\d+)\s*<>\s*(\d+\.\d+)\s+(\d+)\s+(\d+)", line
                )
                if match:
                    results.append({
                        "interval_start": float(match.group(1)),
                        "interval_end": float(match.group(2)),
                        "frames": int(match.group(3)),
                        "bytes": int(match.group(4)),
                    })

        return results[:top_n]

    def _parse_json_output(
        self, stdout: str, mode: str, top_n: int
    ) -> tuple[list[dict[str, Any]], int]:
        """Parse tshark JSON output for http/dns modes. Returns (results, total_count)."""
        if not stdout.strip():
            return [], 0

        try:
            packets: list[dict] = json.loads(stdout)
        except json.JSONDecodeError as exc:
            self.logger.warning("JSON decode error: %s", exc)
            return [], 0

        results: list[dict[str, Any]] = []

        for pkt in packets[:top_n]:
            layers = pkt.get("_source", {}).get("layers", {})

            if mode == "http":
                http = layers.get("http", {})
                if http:
                    results.append({
                        "method": http.get("http.request.method", ""),
                        "uri": http.get("http.request.full_uri", ""),
                        "host": http.get("http.host", ""),
                        "user_agent": http.get("http.user_agent", ""),
                        "response_code": http.get("http.response.code", ""),
                        "content_type": http.get("http.content_type", ""),
                    })

            elif mode == "dns":
                dns = layers.get("dns", {})
                if dns:
                    results.append({
                        "query_name": dns.get("dns.qry.name", ""),
                        "query_type": dns.get("dns.qry.type", ""),
                        "response_code": dns.get("dns.flags.rcode", ""),
                        "answers": dns.get("dns.count.answers", "0"),
                    })

        return results, len(packets)

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute tshark analysis and return structured results."""
        self._validate_args(args)

        base_args = self._build_base_args(args)
        mode_args, output_fmt = self._build_mode_args(args.mode)

        # For http/dns JSON modes with --filter already applied in base, remove
        # the -Y from mode_args if base already carries it to avoid conflict.
        if args.filter and args.mode in ("http", "dns"):
            mode_args = [a for a in mode_args if a not in ("-Y",)]

        tshark_args = base_args + mode_args
        self.logger.info("tshark mode=%s source=%s", args.mode, args.input_file or args.interface)

        is_live = bool(args.interface)
        duration = args.duration if is_live else args.timeout

        if is_live:
            stdout, stderr = self.run_tool_popen("tshark", tshark_args, duration=duration)
        else:
            result = self.run_tool("tshark", tshark_args, timeout=duration)
            stdout, stderr = result.stdout, result.stderr

        # Parse output based on format
        if output_fmt == "json":
            entries, total_count = self._parse_json_output(stdout, args.mode, args.top_n)
            self.output_success({
                "mode": args.mode,
                "source": args.input_file or args.interface,
                "filter": args.filter or "(none)",
                "total_packets": total_count,
                "entries": entries,
                "entries_returned": len(entries),
            })
        else:
            entries = self._parse_text_output(stdout, args.mode, args.top_n)
            self.output_success({
                "mode": args.mode,
                "source": args.input_file or args.interface,
                "filter": args.filter or "(none)",
                "entries": entries,
                "entries_returned": len(entries),
                "raw_output_lines": len(stdout.splitlines()),
            })


if __name__ == "__main__":
    TrafficAnalyzer().execute()
