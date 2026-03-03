#!/usr/bin/env python3
"""
waf_detector — Web Application Firewall detection via wafw00f.

CLI deps: wafw00f (installed on Kali)

Detects and identifies WAF/IPS products protecting a web application.
Uses fingerprinting techniques against known WAF signatures.
"""

import json
import re
import time

from base_module import TacticalModule


class WAFDetector(TacticalModule):
    name = "waf_detector"
    description = "Web Application Firewall detection via wafw00f"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target URL",
        )
        self.parser.add_argument(
            "--find-all", action="store_true",
            help="Find all WAFs (don't stop at first match)",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        waf_args = [args.url, "-o", "/dev/stdout", "-f", "json"]
        if args.find_all:
            waf_args.append("-a")

        start = time.monotonic()
        result = self.run_tool("wafw00f", waf_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        wafs = self._parse_output(result.stdout, result.stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "wafs_detected": wafs,
            "protected": len(wafs) > 0,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(stdout: str, stderr: str) -> list[dict]:
        """Parse wafw00f output for WAF detections."""
        wafs: list[dict] = []

        # Try JSON first
        try:
            data = json.loads(stdout)
            if isinstance(data, list):
                for entry in data:
                    if entry.get("firewall") and entry["firewall"] != "None":
                        wafs.append({
                            "name": entry.get("firewall", ""),
                            "manufacturer": entry.get("manufacturer", ""),
                        })
            return wafs
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback: parse text
        combined = stdout + stderr
        for line in combined.split("\n"):
            match = re.search(
                r"is behind\s+(.+?)(?:\s+\((.+?)\))?$",
                line, re.IGNORECASE,
            )
            if match:
                wafs.append({
                    "name": match.group(1).strip(),
                    "manufacturer": match.group(2).strip() if match.group(2) else "",
                })
            elif "no waf" in line.lower() or "not behind" in line.lower():
                continue  # explicitly no WAF
        return wafs


if __name__ == "__main__":
    WAFDetector().execute()
