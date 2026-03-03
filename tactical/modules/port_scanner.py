#!/usr/bin/env python3
"""
port_scanner — Port scanning and service fingerprinting via nmap.

Source: Adapted from Artemis port_scanner.py (nmap replaces naabu).
CLI deps: nmap (installed on Kali)

Scans a target for open ports and identifies running services.
"""

import json
import re
import time

from base_module import TacticalModule


class PortScanner(TacticalModule):
    name = "port_scanner"
    description = "Port scanning and service fingerprinting via nmap"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target",
            required=True,
            help="Target IP address or hostname",
        )
        self.parser.add_argument(
            "--ports",
            default="--top-ports 1000",
            help="Port specification (default: --top-ports 1000). Examples: '22,80,443', '1-1024', '--top-ports 100'",
        )
        self.parser.add_argument(
            "--scan-type",
            choices=["syn", "connect", "udp", "version"],
            default="syn",
            help="Scan type (default: syn). syn requires root.",
        )
        self.parser.add_argument(
            "--fast",
            action="store_true",
            help="Fast mode: skip version detection, use T4 timing",
        )

    def run(self, args) -> None:
        target = args.target

        # Validate IP or accept hostname
        if not self.validate_ip(target) and not re.match(r"^[a-zA-Z0-9._-]+$", target):
            self.output_error(f"Invalid target: {target}")
            return

        # Build nmap command
        nmap_args = ["-oX", "-"]  # XML output to stdout for parsing

        # Scan type
        scan_flags = {
            "syn": "-sS",
            "connect": "-sT",
            "udp": "-sU",
            "version": "-sV",
        }
        nmap_args.append(scan_flags[args.scan_type])

        # Version detection (unless fast mode)
        if not args.fast and args.scan_type != "version":
            nmap_args.append("-sV")

        # Timing
        if args.fast:
            nmap_args.append("-T4")
        else:
            nmap_args.append("-T3")

        # Port specification
        port_spec = args.ports.strip()
        if port_spec.startswith("--top-ports"):
            nmap_args.extend(port_spec.split())
        else:
            nmap_args.extend(["-p", port_spec])

        nmap_args.append(target)

        # Execute
        start = time.monotonic()
        result = self.run_tool("nmap", nmap_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Log to DB
        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout, result.stderr, duration_ms,
        )

        if result.returncode != 0:
            self.output_error(
                f"nmap failed (exit {result.returncode})",
                {"stderr": result.stderr[:2000]},
            )
            return

        # Parse XML output
        ports = self._parse_nmap_xml(result.stdout)

        self.output_success({
            "target": target,
            "ports": ports,
            "open_count": sum(1 for p in ports if p["state"] == "open"),
            "scan_type": args.scan_type,
            "scan_time_ms": duration_ms,
        })

    @staticmethod
    def _parse_nmap_xml(xml_output: str) -> list[dict]:
        """Parse nmap XML output for port information."""
        import xml.etree.ElementTree as ET

        ports = []
        try:
            root = ET.fromstring(xml_output)
        except ET.ParseError:
            return ports

        for host in root.findall(".//host"):
            for port_elem in host.findall(".//port"):
                port_id = port_elem.get("portid", "")
                protocol = port_elem.get("protocol", "tcp")

                state_elem = port_elem.find("state")
                state = state_elem.get("state", "unknown") if state_elem is not None else "unknown"

                service_elem = port_elem.find("service")
                service = ""
                version = ""
                if service_elem is not None:
                    service = service_elem.get("name", "")
                    product = service_elem.get("product", "")
                    ver = service_elem.get("version", "")
                    version = f"{product} {ver}".strip()

                ports.append({
                    "port": int(port_id) if port_id.isdigit() else port_id,
                    "protocol": protocol,
                    "state": state,
                    "service": service,
                    "version": version,
                })

        return ports


if __name__ == "__main__":
    PortScanner().execute()
