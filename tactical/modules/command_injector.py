#!/usr/bin/env python3
"""
command_injector — OS command injection testing via commix.

CLI deps: commix (installed on Kali)

Automated detection and exploitation of command injection vulnerabilities.
Runs in --batch mode for non-interactive automation.
"""

import json
import re
import time

from base_module import TacticalModule


class CommandInjector(TacticalModule):
    name = "command_injector"
    description = "OS command injection testing via commix"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target URL with potential injection point",
        )
        self.parser.add_argument(
            "--data",
            help="POST data (e.g., 'cmd=whoami')",
        )
        self.parser.add_argument(
            "--cookie",
            help="HTTP cookie header value",
        )
        self.parser.add_argument(
            "--level", type=int, choices=[1, 2, 3], default=1,
            help="Test level 1-3 (default: 1)",
        )
        self.parser.add_argument(
            "--technique",
            help="Injection techniques: (C)lassic, (E)val, (T)ime, (F)ile",
        )
        self.parser.add_argument(
            "--os-cmd",
            help="Execute this OS command if injection is found",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        cx_args = [
            "--url", args.url,
            "--batch",
            "--level", str(args.level),
        ]

        if args.data:
            cx_args.extend(["--data", args.data])
        if args.cookie:
            cx_args.extend(["--cookie", args.cookie])
        if args.technique:
            cx_args.extend(["--technique", args.technique])
        if args.os_cmd:
            cx_args.extend(["--os-cmd", args.os_cmd])

        start = time.monotonic()
        result = self.run_tool("commix", cx_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        findings = self._parse_output(result.stdout + result.stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "vulnerable": len(findings) > 0,
            "findings": findings,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse commix output for injection findings."""
        findings: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            if "is injectable" in line.lower():
                findings.append({
                    "type": "command_injection",
                    "detail": line[:300],
                })
            elif "the following" in line.lower() and "technique" in line.lower():
                findings.append({
                    "type": "technique",
                    "detail": line[:300],
                })
            elif re.search(r"response.*output", line, re.IGNORECASE):
                findings.append({
                    "type": "output",
                    "detail": line[:300],
                })
        return findings


if __name__ == "__main__":
    CommandInjector().execute()
