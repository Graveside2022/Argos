#!/usr/bin/env python3
"""
wifi_capture — PMKID and handshake capture via hcxdumptool + hcxpcapngtool.

CLI deps: hcxdumptool, hcxpcapngtool (hcxtools package on Kali)

Captures PMKID and EAPOL handshakes without active deauthentication.
hcxdumptool passively solicits PMKIDs via association requests.

REQUIRES: Root privileges, monitor-mode interface.
"""

import json
import os
import re
import tempfile
import time

from base_module import TacticalModule


class WiFiCapture(TacticalModule):
    name = "wifi_capture"
    description = "PMKID/handshake capture via hcxdumptool + hcxpcapngtool"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--interface", required=True,
            help="Monitor-mode wireless interface",
        )
        self.parser.add_argument(
            "--duration", type=int, default=60,
            help="Capture duration in seconds (default: 60)",
        )
        self.parser.add_argument(
            "--filter-bssid",
            help="Only capture from this BSSID",
        )
        self.parser.add_argument(
            "--output-dir", default="/tmp",
            help="Directory for capture files (default: /tmp)",
        )

    def run(self, args) -> None:
        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface: {args.interface}")
            return
        if not self.check_root():
            return
        if args.filter_bssid and not self.validate_mac(args.filter_bssid):
            self.output_error(f"Invalid BSSID: {args.filter_bssid}")
            return

        timestamp = int(time.time())
        pcap_file = os.path.join(args.output_dir, f"hcx_{timestamp}.pcapng")
        hash_file = os.path.join(args.output_dir, f"hcx_{timestamp}.22000")

        # Build hcxdumptool command
        hcx_args = [
            "-i", args.interface,
            "-o", pcap_file,
            "--active_beacon",
            "--enable_status=15",
        ]

        # Filter file for specific BSSID
        filter_file = None
        if args.filter_bssid:
            filter_file = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False
            )
            # hcxdumptool filter format: raw MAC without colons
            raw_mac = args.filter_bssid.replace(":", "").lower()
            filter_file.write(raw_mac + "\n")
            filter_file.close()
            hcx_args.extend(["--filterlist_ap", filter_file.name, "--filtermode=2"])

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen(
            "hcxdumptool", hcx_args, duration=args.duration
        )
        capture_ms = int((time.monotonic() - start) * 1000)

        # Clean up filter file
        if filter_file:
            try:
                os.unlink(filter_file.name)
            except OSError:
                pass

        # Convert pcapng to hashcat 22000 format
        pmkid_count = 0
        eapol_count = 0
        if os.path.exists(pcap_file) and os.path.getsize(pcap_file) > 0:
            convert_result = self.run_tool(
                "hcxpcapngtool",
                ["-o", hash_file, pcap_file],
                timeout=30,
            )
            pmkid_count, eapol_count = self._parse_hcxpcapngtool(
                convert_result.stdout + convert_result.stderr
            )

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, stdout[:5000], stderr[:5000], duration_ms,
        )
        self.output_success({
            "interface": args.interface,
            "filter_bssid": args.filter_bssid,
            "pcap_file": pcap_file,
            "hash_file": hash_file if os.path.exists(hash_file) else None,
            "pmkid_count": pmkid_count,
            "eapol_count": eapol_count,
            "capture_duration_ms": capture_ms,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_hcxpcapngtool(output: str) -> tuple[int, int]:
        """Parse hcxpcapngtool output for PMKID and EAPOL counts."""
        pmkid = 0
        eapol = 0
        pmkid_match = re.search(r"(\d+)\s+PMKID", output)
        if pmkid_match:
            pmkid = int(pmkid_match.group(1))
        eapol_match = re.search(r"(\d+)\s+EAPOL", output)
        if eapol_match:
            eapol = int(eapol_match.group(1))
        return pmkid, eapol


if __name__ == "__main__":
    WiFiCapture().execute()
