#!/usr/bin/env python3
"""
email_harvester — Email and subdomain harvesting via theHarvester.

CLI deps: theHarvester (installed on Kali)

Gathers emails, subdomains, hosts, and names from public sources
(search engines, PGP key servers, Shodan, etc.).
"""

import json
import re
import time

from base_module import TacticalModule


class EmailHarvester(TacticalModule):
    name = "email_harvester"
    description = "Email and subdomain harvesting via theHarvester"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="Target domain",
        )
        self.parser.add_argument(
            "--source",
            default="all",
            help="Data source (default: all). Options: anubis, baidu, bing, certspotter, crtsh, dnsdumpster, duckduckgo, hackertarget, otx, rapiddns, subdomaincenter, threatminer, urlscan, yahoo",
        )
        self.parser.add_argument(
            "--limit", type=int, default=200,
            help="Limit results per source (default: 200)",
        )

    def run(self, args) -> None:
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return

        th_args = [
            "-d", args.domain,
            "-b", args.source,
            "-l", str(args.limit),
        ]

        start = time.monotonic()
        result = self.run_tool("theHarvester", th_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        emails, hosts = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "source": args.source,
            "emails": emails,
            "hosts": hosts,
            "email_count": len(emails),
            "host_count": len(hosts),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> tuple[list[str], list[str]]:
        """Parse theHarvester output for emails and hosts."""
        emails: list[str] = []
        hosts: list[str] = []
        section = ""

        for line in output.split("\n"):
            line = line.strip()
            if "emails found" in line.lower():
                section = "emails"
                continue
            elif "hosts found" in line.lower():
                section = "hosts"
                continue
            elif line.startswith("---") or line.startswith("===") or not line:
                continue

            if section == "emails":
                if re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", line):
                    emails.append(line)
            elif section == "hosts":
                # Format: hostname:IP or just hostname
                if "." in line:
                    hosts.append(line)

        return emails, hosts


if __name__ == "__main__":
    EmailHarvester().execute()
