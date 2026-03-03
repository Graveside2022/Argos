#!/usr/bin/env python3
"""
web_vuln_scanner — Web server vulnerability scanning via nikto.

CLI deps: nikto (installed on Kali)

Scans web servers for dangerous files, outdated versions, and
server-specific vulnerabilities. Uses OSVDB references.
"""

import json
import re
import time

from base_module import TacticalModule


class WebVulnScanner(TacticalModule):
    name = "web_vuln_scanner"
    description = "Web server vulnerability scanning via nikto"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True,
            help="Target host (IP or hostname)",
        )
        self.parser.add_argument(
            "--port", type=int, default=80,
            help="Target port (default: 80)",
        )
        self.parser.add_argument(
            "--ssl", action="store_true",
            help="Use SSL/TLS",
        )
        self.parser.add_argument(
            "--tuning",
            help="Scan tuning (1=files, 2=misconfig, 3=info, 4=injection, etc.)",
        )
        self.parser.add_argument(
            "--max-time", type=int,
            help="Max scan time in seconds",
        )

    def run(self, args) -> None:
        nk_args = [
            "-h", args.host,
            "-p", str(args.port),
            "-Format", "json",
            "-output", "/dev/stdout",
            "-nointeractive",
        ]

        if args.ssl:
            nk_args.append("-ssl")
        if args.tuning:
            nk_args.extend(["-Tuning", args.tuning])
        if args.max_time:
            nk_args.extend(["-maxtime", f"{args.max_time}s"])

        start = time.monotonic()
        result = self.run_tool("nikto", nk_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        vulns = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "host": args.host,
            "port": args.port,
            "ssl": args.ssl,
            "vulnerabilities": vulns,
            "vuln_count": len(vulns),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse nikto JSON output for vulnerabilities."""
        vulns: list[dict] = []

        # Try parsing as JSON
        try:
            data = json.loads(output)
            for item in data.get("vulnerabilities", []):
                vulns.append({
                    "id": item.get("id", ""),
                    "osvdb": item.get("OSVDB", ""),
                    "method": item.get("method", "GET"),
                    "url": item.get("url", ""),
                    "description": item.get("msg", "")[:500],
                })
            return vulns
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback: parse text output
        for line in output.split("\n"):
            line = line.strip()
            osvdb_match = re.search(r"OSVDB-(\d+):\s+(.*)", line)
            if osvdb_match:
                vulns.append({
                    "id": f"OSVDB-{osvdb_match.group(1)}",
                    "osvdb": osvdb_match.group(1),
                    "description": osvdb_match.group(2)[:500],
                })
            elif line.startswith("+") and ":" in line and "OSVDB" not in line:
                vulns.append({
                    "id": "",
                    "description": line[1:].strip()[:500],
                })
        return vulns


if __name__ == "__main__":
    WebVulnScanner().execute()
