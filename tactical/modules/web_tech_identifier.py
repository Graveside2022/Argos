#!/usr/bin/env python3
"""
web_tech_identifier — Web technology identification via whatweb.

CLI deps: whatweb (installed on Kali)

Identifies web technologies including CMS, frameworks, JavaScript
libraries, web servers, and embedded devices.
"""

import json
import time

from base_module import TacticalModule


class WebTechIdentifier(TacticalModule):
    name = "web_tech_identifier"
    description = "Web technology identification via whatweb"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target URL",
        )
        self.parser.add_argument(
            "--aggression", type=int, choices=[1, 3, 4], default=1,
            help="Aggression level: 1=stealthy, 3=aggressive, 4=heavy (default: 1)",
        )
        self.parser.add_argument(
            "--follow-redirect", action="store_true", default=True,
            help="Follow HTTP redirects (default: True)",
        )
        self.parser.add_argument(
            "--max-redirects", type=int, default=5,
            help="Maximum redirects to follow (default: 5)",
        )

    def run(self, args) -> None:
        if not self.validate_url(args.url):
            self.output_error(f"Invalid URL: {args.url}")
            return

        ww_args = [
            args.url,
            "--log-json=/dev/stdout",
            f"-a={args.aggression}",
            f"--max-redirects={args.max_redirects}",
        ]

        if not args.follow_redirect:
            ww_args.append("--no-redirect")

        start = time.monotonic()
        result = self.run_tool("whatweb", ww_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        techs = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "technologies": techs,
            "tech_count": len(techs),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse whatweb JSON output."""
        techs: list[dict] = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                target = data.get("target", "")
                for plugin_name, plugin_data in data.get("plugins", {}).items():
                    tech: dict = {
                        "name": plugin_name,
                        "target": target,
                    }
                    if isinstance(plugin_data, dict):
                        if "version" in plugin_data:
                            tech["version"] = plugin_data["version"]
                        if "string" in plugin_data:
                            tech["string"] = plugin_data["string"]
                        if "os" in plugin_data:
                            tech["os"] = plugin_data["os"]
                        if "account" in plugin_data:
                            tech["account"] = plugin_data["account"]
                    techs.append(tech)
            except json.JSONDecodeError:
                continue
        return techs


if __name__ == "__main__":
    WebTechIdentifier().execute()
