#!/usr/bin/env python3
"""
subdomain_enum — Subdomain enumeration via amass.

CLI deps: amass (installed on Kali)

Discovers subdomains through passive DNS, certificate transparency,
web archives, and active brute-forcing.
"""

import json
import time

from base_module import TacticalModule


class SubdomainEnum(TacticalModule):
    name = "subdomain_enum"
    description = "Subdomain enumeration via amass"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="Target domain",
        )
        self.parser.add_argument(
            "--passive", action="store_true",
            help="Passive-only mode (no DNS brute-force)",
        )
        self.parser.add_argument(
            "--brute", action="store_true",
            help="Enable brute-force subdomain enumeration",
        )
        self.parser.add_argument(
            "--max-dns-queries", type=int, default=5000,
            help="Maximum DNS queries (default: 5000)",
        )

    def run(self, args) -> None:
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return

        am_args = ["enum", "-d", args.domain, "-json", "/dev/stdout"]

        if args.passive:
            am_args.append("-passive")
        if args.brute:
            am_args.append("-brute")
        am_args.extend(["-max-dns-queries", str(args.max_dns_queries)])

        start = time.monotonic()
        result = self.run_tool("amass", am_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        subdomains = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "subdomains": subdomains,
            "count": len(subdomains),
            "passive": args.passive,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse amass JSON output."""
        subdomains: list[dict] = []
        seen: set[str] = set()
        for line in output.strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                name = data.get("name", "")
                if name and name not in seen:
                    seen.add(name)
                    subdomains.append({
                        "name": name,
                        "addresses": data.get("addresses", []),
                        "sources": data.get("sources", []),
                        "tag": data.get("tag", ""),
                    })
            except json.JSONDecodeError:
                # Plain text subdomain per line
                name = line.strip()
                if name and name not in seen and "." in name:
                    seen.add(name)
                    subdomains.append({"name": name})
        return subdomains


if __name__ == "__main__":
    SubdomainEnum().execute()
