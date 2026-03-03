#!/usr/bin/env python3
"""
wordpress_scanner — WordPress vulnerability scanning via wpscan.

CLI deps: wpscan (installed on Kali)

Scans WordPress installations for plugin/theme vulnerabilities,
user enumeration, and credential brute-forcing.
"""

import json
import os
import time

from base_module import TacticalModule


class WordPressScanner(TacticalModule):
    name = "wordpress_scanner"
    description = "WordPress vulnerability scanning via wpscan"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="WordPress site URL",
        )
        self.parser.add_argument(
            "--api-token",
            default=os.environ.get("WPSCAN_API_TOKEN", ""),
            help="WPScan API token for vulnerability data (or WPSCAN_API_TOKEN env var)",
        )
        self.parser.add_argument(
            "--enumerate",
            default="vp,vt,u",
            help="Enumeration options (default: vp,vt,u). vp=vulnerable plugins, vt=vulnerable themes, u=users, ap=all plugins, at=all themes",
        )
        self.parser.add_argument(
            "--password-file",
            help="Wordlist for brute-forcing enumerated users",
        )
        self.parser.add_argument(
            "--detection-mode",
            choices=["passive", "mixed", "aggressive"],
            default="mixed",
            help="Detection mode (default: mixed)",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        wp_args = [
            "--url", args.url,
            "--format", "json",
            "--enumerate", args.enumerate,
            "--detection-mode", args.detection_mode,
            "--no-banner",
        ]

        if args.api_token:
            wp_args.extend(["--api-token", args.api_token])
        if args.password_file:
            wp_args.extend(["--passwords", args.password_file])

        start = time.monotonic()
        result = self.run_tool("wpscan", wp_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        report = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            **report,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> dict:
        """Parse wpscan JSON output."""
        try:
            data = json.loads(output)
        except json.JSONDecodeError:
            return {"parse_error": True, "raw": output[:2000]}

        # Extract key information
        wp_version = data.get("version", {})
        plugins = data.get("plugins", {})
        themes = data.get("themes", {})
        users = data.get("users", {})

        vulns: list[dict] = []
        for plugin_name, plugin_data in plugins.items():
            for vuln in plugin_data.get("vulnerabilities", []):
                vulns.append({
                    "component": f"plugin/{plugin_name}",
                    "title": vuln.get("title", ""),
                    "references": vuln.get("references", {}),
                    "fixed_in": vuln.get("fixed_in"),
                })
        for theme_name, theme_data in themes.items():
            for vuln in theme_data.get("vulnerabilities", []):
                vulns.append({
                    "component": f"theme/{theme_name}",
                    "title": vuln.get("title", ""),
                    "fixed_in": vuln.get("fixed_in"),
                })

        return {
            "wordpress_version": wp_version.get("number", "unknown"),
            "wp_version_status": wp_version.get("status", "unknown"),
            "plugins_found": list(plugins.keys()),
            "themes_found": list(themes.keys()),
            "users_found": list(users.keys()),
            "vulnerabilities": vulns,
            "vuln_count": len(vulns),
        }


if __name__ == "__main__":
    WordPressScanner().execute()
