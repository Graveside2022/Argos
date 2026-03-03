#!/usr/bin/env python3
"""
censys_search — Internet-wide scan data search via Censys.

Python lib: censys (pip install censys)

Queries Censys for host information, certificate data, and
internet-wide scan results. Requires API credentials.
"""

import json
import os
import time

from base_module import TacticalModule


class CensysSearch(TacticalModule):
    name = "censys_search"
    description = "Internet-wide scan data search via Censys"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--api-id",
            default=os.environ.get("CENSYS_API_ID", ""),
            help="Censys API ID (or set CENSYS_API_ID env var)",
        )
        self.parser.add_argument(
            "--api-secret",
            default=os.environ.get("CENSYS_API_SECRET", ""),
            help="Censys API Secret (or set CENSYS_API_SECRET env var)",
        )
        self.parser.add_argument(
            "--query",
            help="Censys search query",
        )
        self.parser.add_argument(
            "--host",
            help="Look up a specific IP address",
        )
        self.parser.add_argument(
            "--limit", type=int, default=20,
            help="Max results to return (default: 20)",
        )

    def run(self, args) -> None:
        if not args.api_id or not args.api_secret:
            self.output_error(
                "Censys credentials required. Set CENSYS_API_ID and CENSYS_API_SECRET env vars"
            )
            return

        try:
            from censys.search import CensysHosts
        except ImportError:
            self.output_error("censys library not installed. Run: pip install censys")
            return

        start = time.monotonic()

        try:
            h = CensysHosts(api_id=args.api_id, api_secret=args.api_secret)

            if args.host:
                result = self._lookup_host(h, args.host)
            elif args.query:
                result = self._search(h, args.query, args.limit)
            else:
                self.output_error("Provide --query or --host")
                return
        except Exception as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            self.output_error(f"Censys API error: {e}", {"duration_ms": duration_ms})
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
    def _lookup_host(h, ip: str) -> dict:
        """Look up a specific host on Censys."""
        data = h.view(ip)
        services = []
        for svc in data.get("services", []):
            services.append({
                "port": svc.get("port"),
                "service_name": svc.get("service_name", ""),
                "transport_protocol": svc.get("transport_protocol", ""),
                "software": svc.get("software", []),
                "banner": svc.get("banner", "")[:200],
            })
        return {
            "type": "host_lookup",
            "ip": ip,
            "autonomous_system": data.get("autonomous_system", {}),
            "location": data.get("location", {}),
            "operating_system": data.get("operating_system", {}),
            "services": services,
        }

    @staticmethod
    def _search(h, query: str, limit: int) -> dict:
        """Search Censys hosts."""
        results = []
        count = 0
        for host in h.search(query, per_page=min(limit, 100)):
            results.append({
                "ip": host.get("ip"),
                "services": [
                    {"port": s.get("port"), "service_name": s.get("service_name", "")}
                    for s in host.get("services", [])
                ],
                "location": host.get("location", {}),
                "autonomous_system": host.get("autonomous_system", {}),
            })
            count += 1
            if count >= limit:
                break
        return {
            "type": "search",
            "query": query,
            "results": results,
            "count": len(results),
        }


if __name__ == "__main__":
    CensysSearch().execute()
