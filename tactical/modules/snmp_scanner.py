#!/usr/bin/env python3
"""
snmp_scanner — SNMP community string brute-force via onesixtyone.

CLI deps: onesixtyone (installed on Kali)

Discovers SNMP-enabled devices and brute-forces community strings.
Fast parallel scanning across subnets.
"""

import json
import os
import re
import tempfile
import time

from base_module import TacticalModule


class SNMPScanner(TacticalModule):
    name = "snmp_scanner"
    description = "SNMP community string brute-force via onesixtyone"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP, hostname, or file with IPs (one per line)",
        )
        self.parser.add_argument(
            "--community-file",
            help="File with community strings (default: built-in list)",
        )
        self.parser.add_argument(
            "--port", type=int, default=161,
            help="SNMP port (default: 161)",
        )

    def run(self, args) -> None:
        # Build community string file
        comm_file = args.community_file
        temp_comm = None

        if not comm_file or not os.path.exists(comm_file):
            # Default community strings
            defaults = [
                "public", "private", "community", "manager", "admin",
                "snmp", "default", "read", "write", "test",
                "monitor", "agent", "cisco", "network", "secret",
            ]
            temp_comm = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False
            )
            temp_comm.write("\n".join(defaults) + "\n")
            temp_comm.close()
            comm_file = temp_comm.name

        # Build onesixtyone command
        o161_args = ["-c", comm_file]

        # Check if target is a file
        if os.path.isfile(args.target):
            o161_args.extend(["-i", args.target])
        else:
            o161_args.append(args.target)

        if args.port != 161:
            o161_args.extend(["-p", str(args.port)])

        start = time.monotonic()
        result = self.run_tool("onesixtyone", o161_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Clean up temp file
        if temp_comm:
            try:
                os.unlink(temp_comm.name)
            except OSError:
                pass

        devices = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "devices": devices,
            "found_count": len(devices),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse onesixtyone output for discovered devices."""
        devices: list[dict] = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # Format: IP [community] description
            match = re.match(
                r"(\d+\.\d+\.\d+\.\d+)\s+\[([^\]]+)\]\s*(.*)",
                line,
            )
            if match:
                devices.append({
                    "ip": match.group(1),
                    "community": match.group(2),
                    "description": match.group(3).strip()[:300],
                })
        return devices


if __name__ == "__main__":
    SNMPScanner().execute()
