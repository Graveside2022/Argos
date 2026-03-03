#!/usr/bin/env python3
"""
dns_enum — DNS enumeration via dnsenum.

CLI deps: dnsenum (installed on Kali)

Performs DNS enumeration including zone transfers, brute-force,
reverse lookups, and Google scraping for additional domains.
"""

import json
import re
import time

from base_module import TacticalModule


class DNSEnum(TacticalModule):
    name = "dns_enum"
    description = "DNS enumeration via dnsenum"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="Target domain",
        )
        self.parser.add_argument(
            "--no-brute", action="store_true",
            help="Skip brute-force enumeration",
        )
        self.parser.add_argument(
            "--threads", type=int, default=5,
            help="Number of threads (default: 5)",
        )
        self.parser.add_argument(
            "--wordlist",
            help="Wordlist for brute-force (default: dnsenum built-in)",
        )

    def run(self, args) -> None:
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return

        de_args = [
            args.domain,
            "--threads", str(args.threads),
            "--noreverse",
        ]

        if args.no_brute:
            de_args.append("--nobrute")
        if args.wordlist:
            de_args.extend(["-f", args.wordlist])

        start = time.monotonic()
        result = self.run_tool("dnsenum", de_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        records = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "records": records,
            "record_count": len(records),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse dnsenum output for DNS records."""
        records: list[dict] = []
        section = ""

        for line in output.split("\n"):
            line = line.strip()
            if not line or line.startswith("dnsenum") or line.startswith("---"):
                continue

            # Section headers
            if "Name Servers" in line:
                section = "NS"
                continue
            elif "Mail" in line and "MX" in line:
                section = "MX"
                continue
            elif "zone transfer" in line.lower():
                section = "AXFR"
                continue
            elif "Brute force" in line:
                section = "brute"
                continue

            # Parse A/AAAA records: hostname  seconds  IN  A  IP
            record_match = re.match(
                r"(\S+)\s+\d+\s+IN\s+(\w+)\s+(.+)", line
            )
            if record_match:
                records.append({
                    "name": record_match.group(1),
                    "type": record_match.group(2),
                    "value": record_match.group(3).strip(),
                    "source": section or "query",
                })
                continue

            # Simple IP lines from brute-force
            ip_match = re.search(r"(\S+\.\S+)\s+(\d+\.\d+\.\d+\.\d+)", line)
            if ip_match:
                records.append({
                    "name": ip_match.group(1),
                    "type": "A",
                    "value": ip_match.group(2),
                    "source": section or "brute",
                })

        return records


if __name__ == "__main__":
    DNSEnum().execute()
