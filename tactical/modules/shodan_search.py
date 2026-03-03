#!/usr/bin/env python3
"""
shodan_search — Shodan search for exposed services and devices.

Python lib: shodan (pip install shodan)

Queries Shodan's database for exposed services, vulnerabilities,
and device information. Requires API key.
"""

import json
import os
import time

from base_module import TacticalModule


class ShodanSearch(TacticalModule):
    name = "shodan_search"
    description = "Shodan search for exposed services and devices"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--api-key",
            default=os.environ.get("SHODAN_API_KEY", ""),
            help="Shodan API key (or set SHODAN_API_KEY env var)",
        )
        self.parser.add_argument(
            "--query",
            help="Shodan search query (e.g., 'apache port:8080 country:US')",
        )
        self.parser.add_argument(
            "--host",
            help="Look up a specific IP address",
        )
        self.parser.add_argument(
            "--domain",
            help="Domain DNS lookup",
        )
        self.parser.add_argument(
            "--limit", type=int, default=20,
            help="Max results to return (default: 20)",
        )

    def run(self, args) -> None:
        if not args.api_key:
            self.output_error(
                "Shodan API key required. Set SHODAN_API_KEY env var or use --api-key"
            )
            return

        try:
            import shodan
        except ImportError:
            self.output_error("shodan library not installed. Run: pip install shodan")
            return

        api = shodan.Shodan(args.api_key)
        start = time.monotonic()

        try:
            if args.host:
                result = self._lookup_host(api, args.host)
            elif args.query:
                result = self._search(api, args.query, args.limit)
            elif args.domain:
                result = self._dns_lookup(api, args.domain)
            else:
                self.output_error("Provide --query, --host, or --domain")
                return
        except shodan.APIError as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            self.output_error(f"Shodan API error: {e}", {"duration_ms": duration_ms})
            return

        duration_ms = int((time.monotonic() - start) * 1000)
        result["duration_ms"] = duration_ms

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, json.dumps(result)[:5000], "", duration_ms,
        )
        self.output_success(result)

    @staticmethod
    def _lookup_host(api, ip: str) -> dict:
        """Look up information about a specific IP."""
        data = api.host(ip)
        return {
            "type": "host_lookup",
            "ip": data.get("ip_str", ip),
            "os": data.get("os"),
            "organization": data.get("org"),
            "isp": data.get("isp"),
            "country": data.get("country_name"),
            "city": data.get("city"),
            "ports": data.get("ports", []),
            "vulns": data.get("vulns", []),
            "services": [
                {
                    "port": s.get("port"),
                    "transport": s.get("transport"),
                    "product": s.get("product", ""),
                    "version": s.get("version", ""),
                    "banner": s.get("data", "")[:200],
                }
                for s in data.get("data", [])
            ],
        }

    @staticmethod
    def _search(api, query: str, limit: int) -> dict:
        """Search Shodan."""
        data = api.search(query, limit=limit)
        return {
            "type": "search",
            "query": query,
            "total": data.get("total", 0),
            "results": [
                {
                    "ip": r.get("ip_str"),
                    "port": r.get("port"),
                    "org": r.get("org"),
                    "product": r.get("product", ""),
                    "version": r.get("version", ""),
                    "os": r.get("os"),
                    "banner": r.get("data", "")[:200],
                }
                for r in data.get("matches", [])[:limit]
            ],
        }

    @staticmethod
    def _dns_lookup(api, domain: str) -> dict:
        """DNS lookup via Shodan."""
        data = api.dns.domain_info(domain)
        return {
            "type": "dns_lookup",
            "domain": domain,
            "subdomains": data.get("subdomains", []),
            "records": data.get("data", []),
        }


if __name__ == "__main__":
    ShodanSearch().execute()
