#!/usr/bin/env python3
"""
vuln_scanner — Vulnerability scanning via nmap scripts and nuclei.

Source: PentAGI CLI tool wrapper (vxcontrol/kali-linux bundle).
CLI deps: nmap (installed), nuclei (optional — install via `go install`)

Scans targets for known vulnerabilities using nmap's --script vuln
and optionally nuclei templates. Gracefully degrades if nuclei isn't installed.
"""

import json
import re
import time
import xml.etree.ElementTree as ET

from base_module import TacticalModule


class VulnScanner(TacticalModule):
    name = "vuln_scanner"
    description = "Vulnerability scanning via nmap scripts + nuclei"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP, hostname, or CIDR range",
        )
        self.parser.add_argument(
            "--scan-type",
            choices=["nmap-scripts", "nuclei", "both"],
            default="nmap-scripts",
            help="Scan type (default: nmap-scripts)",
        )
        self.parser.add_argument(
            "--severity",
            choices=["info", "low", "medium", "high", "critical"],
            default="medium",
            help="Minimum severity to report (default: medium)",
        )
        self.parser.add_argument(
            "--ports",
            default="--top-ports 100",
            help="Port specification for nmap (default: --top-ports 100)",
        )

    def run(self, args) -> None:
        start = time.monotonic()
        vulnerabilities: list[dict] = []

        if args.scan_type in ("nmap-scripts", "both"):
            nmap_vulns = self._run_nmap_vuln(args)
            vulnerabilities.extend(nmap_vulns)

        if args.scan_type in ("nuclei", "both"):
            nuclei_vulns = self._run_nuclei(args)
            vulnerabilities.extend(nuclei_vulns)

        # Filter by severity
        severity_order = {"info": 0, "low": 1, "medium": 2, "high": 3, "critical": 4}
        min_severity = severity_order.get(args.severity, 2)
        filtered = [
            v for v in vulnerabilities
            if severity_order.get(v.get("severity", "info"), 0) >= min_severity
        ]

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )

        self.output_success({
            "target": args.target,
            "scan_type": args.scan_type,
            "vulnerabilities": filtered,
            "total_found": len(vulnerabilities),
            "reported": len(filtered),
            "min_severity": args.severity,
            "duration_ms": duration_ms,
        })

    def _run_nmap_vuln(self, args) -> list[dict]:
        """Run nmap with --script vuln for vulnerability detection."""
        nmap_args = [
            "-sV",
            "--script", "vuln",
            "-oX", "-",  # XML to stdout
        ]

        port_spec = args.ports.strip()
        if port_spec.startswith("--top-ports"):
            nmap_args.extend(port_spec.split())
        else:
            nmap_args.extend(["-p", port_spec])

        nmap_args.append(args.target)

        result = self.run_tool("nmap", nmap_args, timeout=args.timeout)
        if result.returncode != 0 and not result.stdout:
            self.logger.warning("nmap vuln scan failed: %s", result.stderr[:500])
            return []

        return self._parse_nmap_vulns(result.stdout)

    def _run_nuclei(self, args) -> list[dict]:
        """Run nuclei for template-based vulnerability detection."""
        import shutil

        if not shutil.which("nuclei"):
            self.logger.info("nuclei not installed, skipping. Install: go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest")
            return []

        nuclei_args = [
            "-target", args.target,
            "-severity", args.severity,
            "-json",
            "-silent",
        ]

        result = self.run_tool("nuclei", nuclei_args, timeout=args.timeout)

        vulnerabilities: list[dict] = []
        for line in result.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
                vulnerabilities.append({
                    "id": data.get("template-id", ""),
                    "severity": data.get("info", {}).get("severity", "info"),
                    "name": data.get("info", {}).get("name", ""),
                    "description": data.get("info", {}).get("description", ""),
                    "matched_at": data.get("matched-at", ""),
                    "evidence": data.get("extracted-results", []),
                    "source": "nuclei",
                })
            except json.JSONDecodeError:
                continue

        return vulnerabilities

    @staticmethod
    def _parse_nmap_vulns(xml_output: str) -> list[dict]:
        """Parse nmap XML output for vulnerability script results."""
        vulns: list[dict] = []

        try:
            root = ET.fromstring(xml_output)
        except ET.ParseError:
            return vulns

        for host in root.findall(".//host"):
            host_addr = ""
            addr_elem = host.find("address")
            if addr_elem is not None:
                host_addr = addr_elem.get("addr", "")

            for script in host.findall(".//script"):
                script_id = script.get("id", "")
                output = script.get("output", "")

                # Skip scripts that report "NOT VULNERABLE"
                if "NOT VULNERABLE" in output or "not vulnerable" in output:
                    continue

                # Determine severity from script name patterns
                severity = "info"
                if any(kw in script_id.lower() for kw in ["vuln", "exploit", "rce"]):
                    severity = "high"
                elif any(kw in script_id.lower() for kw in ["ssl", "tls", "weak"]):
                    severity = "medium"
                elif "VULNERABLE" in output:
                    severity = "high"

                # Extract CVE references
                cves = re.findall(r"CVE-\d{4}-\d+", output)

                vulns.append({
                    "id": script_id,
                    "severity": severity,
                    "description": output[:500],
                    "host": host_addr,
                    "cves": cves,
                    "evidence": output[:1000],
                    "source": "nmap",
                })

        return vulns


if __name__ == "__main__":
    VulnScanner().execute()
