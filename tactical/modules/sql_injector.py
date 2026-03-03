#!/usr/bin/env python3
"""
sql_injector — SQL injection testing via sqlmap.

CLI deps: sqlmap (installed on Kali)

Automated SQL injection detection and exploitation.
Runs in --batch mode for non-interactive automation.
"""

import json
import os
import re
import time

from base_module import TacticalModule


class SQLInjector(TacticalModule):
    name = "sql_injector"
    description = "SQL injection testing via sqlmap"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target URL with injection point (use * or parameter)",
        )
        self.parser.add_argument(
            "--method", choices=["GET", "POST"], default="GET",
            help="HTTP method (default: GET)",
        )
        self.parser.add_argument(
            "--data",
            help="POST data (e.g., 'user=admin&pass=test')",
        )
        self.parser.add_argument(
            "--cookie",
            help="HTTP cookie header value",
        )
        self.parser.add_argument(
            "--level", type=int, choices=[1, 2, 3, 4, 5], default=1,
            help="Test level 1-5 (default: 1). Higher = more tests, slower.",
        )
        self.parser.add_argument(
            "--risk", type=int, choices=[1, 2, 3], default=1,
            help="Risk level 1-3 (default: 1). Higher = more dangerous tests.",
        )
        self.parser.add_argument(
            "--technique",
            help="SQL injection techniques (B=boolean, E=error, U=union, S=stacked, T=time, Q=inline)",
        )
        self.parser.add_argument(
            "--dump", action="store_true",
            help="Dump database table entries",
        )
        self.parser.add_argument(
            "--dbs", action="store_true",
            help="Enumerate databases",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        output_dir = f"/tmp/sqlmap_{int(time.time())}"
        sql_args = [
            "-u", args.url,
            "--batch",
            "--output-dir", output_dir,
            "--level", str(args.level),
            "--risk", str(args.risk),
            "--threads", "1",
            "--timeout", str(min(args.timeout, 30)),
        ]

        if args.method == "POST" and args.data:
            sql_args.extend(["--data", args.data])
        if args.cookie:
            sql_args.extend(["--cookie", args.cookie])
        if args.technique:
            sql_args.extend(["--technique", args.technique])
        if args.dump:
            sql_args.append("--dump")
        if args.dbs:
            sql_args.append("--dbs")

        start = time.monotonic()
        result = self.run_tool("sqlmap", sql_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        injections = self._parse_output(result.stdout + result.stderr)
        databases = self._parse_dbs(result.stdout) if args.dbs else []

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "injection_points": injections,
            "vulnerable": len(injections) > 0,
            "databases": databases,
            "output_dir": output_dir,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse sqlmap output for injection points."""
        injections: list[dict] = []
        current: dict = {}

        for line in output.split("\n"):
            line = line.strip()
            # Parameter line
            param_match = re.search(r"Parameter:\s+(\S+)\s+\((\w+)\)", line)
            if param_match:
                if current:
                    injections.append(current)
                current = {
                    "parameter": param_match.group(1),
                    "place": param_match.group(2),
                    "types": [],
                }
            # Type line
            type_match = re.search(r"Type:\s+(.+)", line)
            if type_match and current:
                current["types"].append(type_match.group(1))
            # Payload line
            payload_match = re.search(r"Payload:\s+(.+)", line)
            if payload_match and current:
                current["payload"] = payload_match.group(1)[:200]

        if current:
            injections.append(current)
        return injections

    @staticmethod
    def _parse_dbs(output: str) -> list[str]:
        """Parse database enumeration results."""
        dbs: list[str] = []
        in_dbs = False
        for line in output.split("\n"):
            if "available databases" in line.lower():
                in_dbs = True
                continue
            if in_dbs:
                line = line.strip()
                if line.startswith("[*]"):
                    dbs.append(line[3:].strip())
                elif not line or line.startswith("["):
                    in_dbs = False
        return dbs


if __name__ == "__main__":
    SQLInjector().execute()
