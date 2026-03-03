#!/usr/bin/env python3
"""
mass_scanner — High-speed port scanning via masscan.

CLI deps: masscan (installed on Kali)

Performs rapid SYN scanning at configurable rates. Designed for
large network ranges where nmap would be too slow. Outputs
discovered open ports in structured JSON.

REQUIRES: Root privileges (raw socket access for SYN scanning).
"""

import json
import re
import time

from base_module import TacticalModule


class MassScanner(TacticalModule):
    name = "mass_scanner"
    description = "High-speed port scanning via masscan"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP, range (10.0.0.0/24), or comma-separated IPs",
        )
        self.parser.add_argument(
            "--ports", default="1-1000",
            help="Port range to scan (default: 1-1000). Examples: '80,443', '1-65535'",
        )
        self.parser.add_argument(
            "--rate", type=int, default=1000,
            help="Packets per second (default: 1000). Max safe on RPi: ~5000",
        )
        self.parser.add_argument(
            "--banners", action="store_true",
            help="Grab service banners (slower)",
        )

    def run(self, args) -> None:
        if not self.check_root():
            return

        # Validate rate is reasonable for RPi
        rate = min(args.rate, 10000)

        mass_args = [
            "-p", args.ports,
            "--rate", str(rate),
            "-oJ", "-",  # JSON output to stdout
        ]

        if args.banners:
            mass_args.append("--banners")

        # Handle multiple targets
        for target in args.target.split(","):
            mass_args.append(target.strip())

        start = time.monotonic()
        result = self.run_tool("masscan", mass_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        hosts = self._parse_json(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "ports_scanned": args.ports,
            "rate": rate,
            "hosts": hosts,
            "open_count": sum(len(h.get("ports", [])) for h in hosts),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_json(output: str) -> list[dict]:
        """Parse masscan JSON output."""
        hosts: dict[str, dict] = {}

        # masscan JSON is array of objects — sometimes with trailing comma
        clean = output.strip().rstrip(",")
        if clean.startswith("["):
            clean = clean
        elif clean.startswith("{"):
            clean = f"[{clean}]"
        else:
            return []

        # Fix trailing comma before ]
        clean = re.sub(r",\s*\]", "]", clean)

        try:
            records = json.loads(clean)
        except json.JSONDecodeError:
            return []

        for rec in records:
            ip = rec.get("ip", "")
            if not ip:
                continue
            if ip not in hosts:
                hosts[ip] = {"ip": ip, "ports": []}
            for port_info in rec.get("ports", []):
                hosts[ip]["ports"].append({
                    "port": port_info.get("port"),
                    "protocol": port_info.get("proto", "tcp"),
                    "state": port_info.get("status", "open"),
                    "service": port_info.get("service", {}).get("name", ""),
                    "banner": port_info.get("service", {}).get("banner", ""),
                })

        return list(hosts.values())


if __name__ == "__main__":
    MassScanner().execute()
