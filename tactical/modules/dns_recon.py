#!/usr/bin/env python3
"""
dns_recon — DNS reconnaissance via dnsrecon.

CLI deps: dnsrecon (installed on Kali)

Performs zone transfers, standard record enumeration, brute-force,
cache snooping, and zone walking. Outputs JSON.
"""

import json
import os
import time

from base_module import TacticalModule


class DNSRecon(TacticalModule):
    name = "dns_recon"
    description = "DNS reconnaissance via dnsrecon"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="Target domain",
        )
        self.parser.add_argument(
            "--type",
            choices=["std", "rvl", "brt", "axfr", "snoop", "zonewalk"],
            default="std",
            help="Enumeration type (default: std). std=standard, rvl=reverse, brt=brute-force, axfr=zone transfer",
        )
        self.parser.add_argument(
            "--nameserver",
            help="Specific nameserver to query",
        )
        self.parser.add_argument(
            "--wordlist",
            help="Wordlist for brute-force",
        )

    def run(self, args) -> None:
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return

        output_file = f"/tmp/dnsrecon_{int(time.time())}.json"
        dr_args = [
            "-d", args.domain,
            "-t", args.type,
            "-j", output_file,
        ]

        if args.nameserver:
            dr_args.extend(["-n", args.nameserver])
        if args.wordlist:
            dr_args.extend(["-D", args.wordlist])

        start = time.monotonic()
        result = self.run_tool("dnsrecon", dr_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        records = self._parse_json(output_file)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "type": args.type,
            "records": records,
            "record_count": len(records),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_json(filepath: str) -> list[dict]:
        """Parse dnsrecon JSON output."""
        if not os.path.exists(filepath):
            return []
        try:
            with open(filepath) as f:
                data = json.load(f)
            records: list[dict] = []
            for entry in data:
                records.append({
                    "name": entry.get("name", ""),
                    "type": entry.get("type", ""),
                    "address": entry.get("address", ""),
                    "target": entry.get("target", ""),
                    "port": entry.get("port", ""),
                    "zone_server": entry.get("zone_server", ""),
                })
            return records
        except (json.JSONDecodeError, OSError):
            return []


if __name__ == "__main__":
    DNSRecon().execute()
