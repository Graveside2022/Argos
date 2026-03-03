#!/usr/bin/env python3
"""
device_identifier — Network device fingerprinting via HTTP response inspection.

Source: Extracted from Artemis device_identifier.py (CERT-Polska/Artemis).
CLI deps: none (pure requests)
Karton dependency removed, base_module.py used instead.

Identifies network devices (FortiOS, Palo Alto, generic) by inspecting
HTTP response headers, titles, and body content.
"""

import json
import re
import time

import requests
import urllib3

from base_module import TacticalModule

# Suppress InsecureRequestWarning for self-signed certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Device signatures: (pattern_in_body, pattern_in_headers, device_type, details_extractor)
DEVICE_SIGNATURES = [
    {
        "name": "FortiOS",
        "body_patterns": [r"FortiOS", r"fortinet", r"FortiGate"],
        "header_patterns": {"server": r"FortiOS"},
        "type": "firewall",
    },
    {
        "name": "Palo Alto GlobalProtect",
        "body_patterns": [r"GlobalProtect", r"PanOS", r"Palo Alto"],
        "header_patterns": {"server": r"PanWeb Server"},
        "type": "firewall",
    },
    {
        "name": "Cisco IOS",
        "body_patterns": [r"cisco", r"Cisco Systems"],
        "header_patterns": {"server": r"cisco-IOS"},
        "type": "router",
    },
    {
        "name": "MikroTik RouterOS",
        "body_patterns": [r"RouterOS", r"mikrotik", r"MikroTik"],
        "header_patterns": {},
        "type": "router",
    },
    {
        "name": "Ubiquiti UniFi",
        "body_patterns": [r"UniFi", r"ubnt", r"Ubiquiti"],
        "header_patterns": {},
        "type": "access_point",
    },
    {
        "name": "SonicWall",
        "body_patterns": [r"SonicWall", r"SonicOS"],
        "header_patterns": {"server": r"SonicWALL"},
        "type": "firewall",
    },
]


class DeviceIdentifier(TacticalModule):
    name = "device_identifier"
    description = "Network device fingerprinting via HTTP inspection (Artemis-extracted)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target URL (e.g., https://192.168.1.1 or http://10.0.0.1:8080)",
        )
        self.parser.add_argument(
            "--follow-redirects",
            action="store_true", default=True,
            help="Follow HTTP redirects (default: true)",
        )

    def run(self, args) -> None:
        target = args.target
        if not target.startswith(("http://", "https://")):
            target = f"https://{target}"

        start = time.monotonic()

        try:
            response = requests.get(
                target,
                timeout=args.timeout,
                verify=False,
                allow_redirects=args.follow_redirects,
                headers={"User-Agent": "Mozilla/5.0 (compatible; Argos/1.0)"},
            )
        except requests.RequestException as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            self.log_run(
                args.db_path, self.name,
                json.dumps(vars(args), default=str),
                1, "", str(e), duration_ms,
            )
            self.output_error(
                f"HTTP request failed: {e}",
                {"target": target},
            )
            return

        duration_ms = int((time.monotonic() - start) * 1000)
        body = response.text[:50000]
        headers = dict(response.headers)

        # Extract page title
        title_match = re.search(r"<title[^>]*>(.*?)</title>", body, re.IGNORECASE | re.DOTALL)
        page_title = title_match.group(1).strip() if title_match else ""

        # Identify device
        device_type = "unknown"
        device_name = ""
        matches: list[str] = []

        for sig in DEVICE_SIGNATURES:
            matched = False

            # Check body patterns
            for pattern in sig["body_patterns"]:
                if re.search(pattern, body, re.IGNORECASE):
                    matched = True
                    matches.append(f"body:{pattern}")
                    break

            # Check header patterns
            for header_key, pattern in sig.get("header_patterns", {}).items():
                header_val = headers.get(header_key, "")
                if re.search(pattern, header_val, re.IGNORECASE):
                    matched = True
                    matches.append(f"header:{header_key}={pattern}")

            if matched:
                device_type = sig["type"]
                device_name = sig["name"]
                break

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )

        self.output_success({
            "target": target,
            "device_type": device_type,
            "device_name": device_name,
            "page_title": page_title,
            "status_code": response.status_code,
            "server_header": headers.get("Server", ""),
            "matches": matches,
            "headers": {k: v for k, v in list(headers.items())[:20]},
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    DeviceIdentifier().execute()
