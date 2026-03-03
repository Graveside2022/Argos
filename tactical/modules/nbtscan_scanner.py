#!/usr/bin/env python3
"""
nbtscan_scanner — NetBIOS name scanning via nbtscan.

CLI deps: nbtscan (installed on Kali)

Discovers Windows hosts and their NetBIOS names, workgroups,
and logged-in users on a network range. Useful for AD recon.
"""

import json
import re
import time

from base_module import TacticalModule


class NBTScanScanner(TacticalModule):
    name = "nbtscan_scanner"
    description = "NetBIOS name scanning via nbtscan"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--range", required=True,
            help="Target range (CIDR, e.g., 192.168.1.0/24) or single IP",
        )
        self.parser.add_argument(
            "--timeout-per-host", type=int, default=2,
            help="Timeout per host in seconds (default: 2)",
        )
        self.parser.add_argument(
            "--verbose", action="store_true",
            help="Show verbose service information",
        )

    def run(self, args) -> None:
        nbt_args = [
            "-r", args.range,
            "-t", str(args.timeout_per_host),
        ]

        if args.verbose:
            nbt_args.append("-v")

        # Use -s separator for easier parsing
        nbt_args.extend(["-s", "\t"])

        start = time.monotonic()
        result = self.run_tool("nbtscan", nbt_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        hosts = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "range": args.range,
            "hosts": hosts,
            "host_count": len(hosts),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse nbtscan tab-separated output."""
        hosts: list[dict] = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("Doing") or line.startswith("IP"):
                continue

            parts = line.split("\t")
            if len(parts) >= 2:
                ip = parts[0].strip()
                if not re.match(r"\d+\.\d+\.\d+\.\d+", ip):
                    continue
                host = {"ip": ip}
                if len(parts) >= 2:
                    host["netbios_name"] = parts[1].strip()
                if len(parts) >= 3:
                    host["server"] = parts[2].strip()
                if len(parts) >= 4:
                    host["user"] = parts[3].strip()
                if len(parts) >= 5:
                    host["mac"] = parts[4].strip()
                hosts.append(host)
        return hosts


if __name__ == "__main__":
    NBTScanScanner().execute()
