#!/usr/bin/env python3
"""
net_discover — ARP-based network host discovery via netdiscover.

Source: PentAGI CLI tool wrapper (vxcontrol/kali-linux bundle).
CLI deps: netdiscover (installed on Kali at /usr/sbin/netdiscover)

Discovers live hosts on the local network via ARP requests.
Supports passive mode (listen-only) and active scanning of a CIDR range.
"""

import json
import re
import time

from base_module import TacticalModule


class NetDiscover(TacticalModule):
    name = "net_discover"
    description = "ARP-based network host discovery via netdiscover"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--interface",
            help="Network interface to use (default: auto-detect)",
        )
        self.parser.add_argument(
            "--range",
            help="CIDR range to scan (e.g., 192.168.1.0/24). Required for active mode.",
        )
        self.parser.add_argument(
            "--passive",
            action="store_true",
            help="Passive mode — listen for ARP packets without sending any",
        )
        self.parser.add_argument(
            "--count",
            type=int, default=3,
            help="Number of ARP requests per host in active mode (default: 3)",
        )

    def run(self, args) -> None:
        if args.interface:
            if not self.validate_interface(args.interface):
                self.output_error(f"Invalid interface name: {args.interface}")
                return
            if not self.check_interface_exists(args.interface):
                self.output_error(f"Interface {args.interface} does not exist")
                return

        if args.range and not self.validate_cidr(args.range):
            self.output_error(f"Invalid CIDR range: {args.range}")
            return

        if not args.passive and not args.range:
            self.output_error(
                "Active mode requires --range (CIDR). Use --passive for listen-only mode."
            )
            return

        # Build netdiscover command
        # netdiscover -P flag outputs in parseable format (one host per line)
        nd_args = ["-P"]  # Parseable output

        if args.interface:
            nd_args.extend(["-i", args.interface])

        if args.passive:
            nd_args.append("-p")
            # In passive mode, use timeout to limit capture
            timeout = min(args.timeout, 60)
        else:
            nd_args.extend(["-r", args.range])
            nd_args.extend(["-c", str(args.count)])
            timeout = args.timeout

        start = time.monotonic()
        result = self.run_tool("netdiscover", nd_args, timeout=timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse output
        hosts = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout, result.stderr, duration_ms,
        )

        self.output_success({
            "interface": args.interface or "auto",
            "range": args.range,
            "passive": args.passive,
            "hosts": hosts,
            "count": len(hosts),
            "scan_time_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(stdout: str) -> list[dict]:
        """Parse netdiscover -P output format."""
        hosts = []
        # Format: IP_ADDRESS  MAC_ADDRESS  COUNT  LEN  VENDOR
        for line in stdout.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("-") or line.startswith("IP"):
                continue

            parts = re.split(r"\s{2,}", line)
            if len(parts) >= 3:
                hosts.append({
                    "ip": parts[0].strip(),
                    "mac": parts[1].strip(),
                    "vendor": parts[-1].strip() if len(parts) >= 5 else "",
                })
            elif len(parts) == 2:
                hosts.append({
                    "ip": parts[0].strip(),
                    "mac": parts[1].strip(),
                    "vendor": "",
                })

        return hosts


if __name__ == "__main__":
    NetDiscover().execute()
