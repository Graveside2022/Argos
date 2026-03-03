#!/usr/bin/env python3
"""
wifi_decrypt — Decrypt captured WiFi traffic via airdecap-ng.

CLI deps: airdecap-ng (aircrack-ng suite on Kali)

Decrypts WEP/WPA/WPA2 encrypted pcap files using known credentials.
Outputs decrypted pcap for further analysis.
"""

import json
import os
import re
import time

from base_module import TacticalModule


class WiFiDecrypt(TacticalModule):
    name = "wifi_decrypt"
    description = "Decrypt captured WiFi traffic via airdecap-ng"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--pcap-file", required=True,
            help="Path to encrypted pcap/pcapng file",
        )
        self.parser.add_argument(
            "--bssid",
            help="Target AP BSSID (recommended for WPA)",
        )
        self.parser.add_argument(
            "--passphrase",
            help="WPA/WPA2 passphrase",
        )
        self.parser.add_argument(
            "--wep-key",
            help="WEP key (hex format)",
        )
        self.parser.add_argument(
            "--essid",
            help="Network ESSID (required for WPA without BSSID)",
        )

    def run(self, args) -> None:
        if not os.path.exists(args.pcap_file):
            self.output_error(f"Pcap file not found: {args.pcap_file}")
            return

        if not args.passphrase and not args.wep_key:
            self.output_error("Either --passphrase (WPA) or --wep-key (WEP) is required")
            return

        # Build airdecap-ng command
        dec_args = []

        if args.passphrase:
            dec_args.extend(["-p", args.passphrase])
            if args.essid:
                dec_args.extend(["-e", args.essid])
        elif args.wep_key:
            dec_args.extend(["-w", args.wep_key])

        if args.bssid:
            if not self.validate_mac(args.bssid):
                self.output_error(f"Invalid BSSID: {args.bssid}")
                return
            dec_args.extend(["-b", args.bssid])

        dec_args.append(args.pcap_file)

        start = time.monotonic()
        result = self.run_tool("airdecap-ng", dec_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse output for decrypted packet count
        decrypted, total = self._parse_output(result.stdout + result.stderr)

        # Find the decrypted output file
        base = os.path.splitext(args.pcap_file)[0]
        dec_file = f"{base}-dec.cap"
        if not os.path.exists(dec_file):
            dec_file = f"{base}-dec.pcap"

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "pcap_file": args.pcap_file,
            "decrypted_file": dec_file if os.path.exists(dec_file) else None,
            "decrypted_packets": decrypted,
            "total_packets": total,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> tuple[int, int]:
        """Parse airdecap-ng output for packet counts."""
        decrypted = 0
        total = 0
        dec_match = re.search(r"(\d+)\s+decrypted", output, re.IGNORECASE)
        if dec_match:
            decrypted = int(dec_match.group(1))
        total_match = re.search(r"Total\s+number\s+of\s+packets.*?(\d+)", output, re.IGNORECASE)
        if total_match:
            total = int(total_match.group(1))
        return decrypted, total


if __name__ == "__main__":
    WiFiDecrypt().execute()
