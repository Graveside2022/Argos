#!/usr/bin/env python3
"""
dns_scanner — DNS zone transfer detection and record analysis.

Source: Extracted from Artemis dns_scanner.py (CERT-Polska/Artemis).
CLI deps: none (pure dnspython)
Karton dependency removed, base_module.py used instead.

Checks for zone transfer (AXFR) vulnerability, enumerates nameservers,
and collects DNS records.
"""

import json
import time

import dns.exception
import dns.query
import dns.rdatatype
import dns.resolver
import dns.zone

from base_module import TacticalModule


class DNSScanner(TacticalModule):
    name = "dns_scanner"
    description = "DNS zone transfer detection and record analysis (Artemis-extracted)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True, help="Target domain to scan"
        )
        self.parser.add_argument(
            "--nameserver",
            help="Specific nameserver to query (default: auto-detect)",
        )

    def run(self, args) -> None:
        domain = args.domain.strip().rstrip(".")

        if not domain or len(domain) > 253:
            self.output_error(f"Invalid domain: {domain}")
            return

        start = time.monotonic()
        issues: list[str] = []

        # Resolve nameservers
        nameservers = self._get_nameservers(domain, args.nameserver)

        # Test zone transfer against each NS
        zone_transfer_possible = False
        zone_records: list[dict] = []
        for ns in nameservers:
            try:
                ns_ip = self._resolve_host(ns)
                if not ns_ip:
                    continue

                zone = dns.zone.from_xfr(
                    dns.query.xfr(ns_ip, domain, timeout=10)
                )
                zone_transfer_possible = True
                issues.append(f"Zone transfer allowed on {ns} ({ns_ip})")

                for name, node in zone.nodes.items():
                    for rdataset in node.rdatasets:
                        for rdata in rdataset:
                            zone_records.append({
                                "name": str(name),
                                "type": dns.rdatatype.to_text(rdataset.rdtype),
                                "value": str(rdata),
                                "ttl": rdataset.ttl,
                            })
            except dns.exception.FormError:
                continue  # Zone transfer refused — expected
            except Exception as e:
                self.logger.debug("Zone transfer failed on %s: %s", ns, e)
                continue

        # Collect standard records
        records = self._collect_records(domain)

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )

        self.output_success({
            "domain": domain,
            "nameservers": nameservers,
            "zone_transfer_possible": zone_transfer_possible,
            "zone_records": zone_records[:200],
            "records": records,
            "issues": issues,
            "duration_ms": duration_ms,
        })

    def _get_nameservers(self, domain: str, explicit_ns: str | None) -> list[str]:
        """Get nameservers for the domain."""
        if explicit_ns:
            return [explicit_ns]

        try:
            answers = dns.resolver.resolve(domain, "NS")
            return [str(rdata.target).rstrip(".") for rdata in answers]
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException) as e:
            self.logger.warning("Failed to resolve NS for %s: %s", domain, e)
            return []

    def _resolve_host(self, hostname: str) -> str | None:
        """Resolve a hostname to an IP address."""
        try:
            answers = dns.resolver.resolve(hostname, "A")
            for rdata in answers:
                return str(rdata.address)
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
            pass
        return None

    def _collect_records(self, domain: str) -> list[dict]:
        """Collect common DNS record types for the domain."""
        records: list[dict] = []
        record_types = ["A", "AAAA", "MX", "TXT", "CNAME", "SOA", "SRV"]

        for rtype in record_types:
            try:
                answers = dns.resolver.resolve(domain, rtype)
                for rdata in answers:
                    records.append({
                        "type": rtype,
                        "value": str(rdata),
                        "ttl": answers.rrset.ttl if answers.rrset else 0,
                    })
            except (
                dns.resolver.NXDOMAIN,
                dns.resolver.NoAnswer,
                dns.resolver.NoNameservers,
                dns.exception.DNSException,
            ):
                continue

        return records


if __name__ == "__main__":
    DNSScanner().execute()
