#!/usr/bin/env python3
"""
web_app_scanner — Web application vulnerability scanner via wapiti.

CLI deps: wapiti (installed on Kali)

Performs black-box scanning for XSS, SQLi, SSRF, command injection,
file inclusion, and other web application vulnerabilities.
"""

import json
import os
import time

from base_module import TacticalModule


class WebAppScanner(TacticalModule):
    name = "web_app_scanner"
    description = "Web application vulnerability scanner via wapiti"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target base URL",
        )
        self.parser.add_argument(
            "--scope",
            choices=["page", "folder", "domain", "punk"],
            default="folder",
            help="Scan scope (default: folder)",
        )
        self.parser.add_argument(
            "--modules",
            help="Comma-separated modules (xss,sql,exec,file,ssrf,etc.)",
        )
        self.parser.add_argument(
            "--cookie",
            help="HTTP cookie for authenticated scanning",
        )
        self.parser.add_argument(
            "--max-links", type=int, default=100,
            help="Maximum links to crawl (default: 100)",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        output_file = f"/tmp/wapiti_{int(time.time())}.json"

        wp_args = [
            "--url", args.url,
            "--format", "json",
            "--output", output_file,
            "--scope", args.scope,
            "--max-links-per-page", str(args.max_links),
            "--flush-session",
            "--verbose", "0",
        ]

        if args.modules:
            wp_args.extend(["--module", args.modules])
        if args.cookie:
            wp_args.extend(["--cookie", args.cookie])

        start = time.monotonic()
        result = self.run_tool("wapiti", wp_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        vulns = self._parse_report(output_file)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "scope": args.scope,
            "vulnerabilities": vulns,
            "vuln_count": len(vulns),
            "report_file": output_file,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_report(report_path: str) -> list[dict]:
        """Parse wapiti JSON report."""
        if not os.path.exists(report_path):
            return []

        try:
            with open(report_path) as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

        vulns: list[dict] = []
        for category, entries in data.get("vulnerabilities", {}).items():
            for entry in entries:
                vulns.append({
                    "category": category,
                    "severity": entry.get("level", "unknown"),
                    "method": entry.get("method", ""),
                    "path": entry.get("path", ""),
                    "parameter": entry.get("parameter", ""),
                    "info": entry.get("info", "")[:300],
                    "curl_command": entry.get("curl_command", "")[:300],
                })
        return vulns


if __name__ == "__main__":
    WebAppScanner().execute()
