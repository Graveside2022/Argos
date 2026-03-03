#!/usr/bin/env python3
"""
wifi_handshake — WPA handshake capture via wifite2.

Source: Argos-native (not in PentAGI or Artemis).
CLI deps: wifite (wifite2, installed on Kali)

Captures WPA/WPA2 handshake files for offline cracking.
Wifite2 handles monitor mode management, deauth, and handshake verification.

REQUIRES: A wireless interface (wifite manages monitor mode internally).
"""

import os
import re
import time

from base_module import TacticalModule


class WiFiHandshake(TacticalModule):
    name = "wifi_handshake"
    description = "WPA handshake capture via wifite2"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--bssid",
            required=True,
            help="Target AP BSSID (MAC address)",
        )
        self.parser.add_argument(
            "--interface",
            default="wlan0",
            help="Wireless interface (wifite manages monitor mode, default: wlan0)",
        )
        self.parser.add_argument(
            "--output-dir",
            default="/tmp/argos-handshakes",
            help="Directory to save captured handshakes (default: /tmp/argos-handshakes)",
        )
        self.parser.add_argument(
            "--channel",
            type=int,
            help="Target AP channel (speeds up capture if known)",
        )

    def run(self, args) -> None:
        # Validate BSSID
        if not self.validate_mac(args.bssid):
            self.output_error(
                f"Invalid BSSID format: {args.bssid}. Expected AA:BB:CC:DD:EE:FF"
            )
            return

        # Validate interface
        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface name: {args.interface}")
            return

        if not self.check_interface_exists(args.interface):
            self.output_error(
                f"Interface {args.interface} does not exist. "
                f"Check available interfaces with 'iwconfig'."
            )
            return

        # Create output directory
        output_dir = args.output_dir
        os.makedirs(output_dir, exist_ok=True)

        # Build wifite command
        # wifite2 key flags:
        #   -b BSSID: target specific AP
        #   -i IFACE: interface to use
        #   --kill: kill conflicting processes
        #   --no-prompt: non-interactive mode
        #   --wpa: only target WPA networks
        #   --num-deauths N: deauth attempts
        wifite_args = [
            "-b", args.bssid,
            "-i", args.interface,
            "--kill",
            "--wpa",
            "--num-deauths", "5",
        ]

        if args.channel:
            wifite_args.extend(["-c", str(args.channel)])

        # Execute with extended timeout (handshake capture can take minutes)
        capture_timeout = max(args.timeout, 180)  # Minimum 3 minutes
        start = time.monotonic()

        result = self.run_tool("wifite", wifite_args, timeout=capture_timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse wifite output for handshake file location
        handshake_file = self._find_handshake_file(result.stdout, output_dir, args.bssid)
        method = self._parse_capture_method(result.stdout)

        # Log to DB
        import json
        self.log_run(
            args.db_path,
            self.name,
            json.dumps(vars(args), default=str),
            result.returncode,
            result.stdout,
            result.stderr,
            duration_ms,
        )

        if handshake_file and os.path.exists(handshake_file):
            file_size = os.path.getsize(handshake_file)
            self.output_success({
                "target_bssid": args.bssid,
                "handshake_file": handshake_file,
                "file_size_bytes": file_size,
                "method": method,
                "interface": args.interface,
                "duration_ms": duration_ms,
                "raw_output": result.stdout[:2000],
            })
        elif result.returncode == 0:
            # Wifite exited 0 but no handshake found — might be in default location
            default_file = self._search_default_locations(args.bssid)
            if default_file:
                self.output_success({
                    "target_bssid": args.bssid,
                    "handshake_file": default_file,
                    "file_size_bytes": os.path.getsize(default_file),
                    "method": method or "unknown",
                    "interface": args.interface,
                    "duration_ms": duration_ms,
                })
            else:
                self.output_error(
                    "Wifite completed but no handshake file found",
                    {
                        "target_bssid": args.bssid,
                        "stdout": result.stdout[:2000],
                    },
                )
        else:
            self.output_error(
                f"Handshake capture failed (exit {result.returncode})",
                {
                    "target_bssid": args.bssid,
                    "stderr": result.stderr[:2000],
                    "stdout": result.stdout[:2000],
                },
            )

    @staticmethod
    def _find_handshake_file(stdout: str, output_dir: str, bssid: str) -> str | None:
        """Parse wifite output for the saved handshake file path."""
        # wifite2 outputs: "Saved handshake to /path/to/file.cap"
        for pattern in [
            r"[Ss]aved\s+(?:handshake|.*\.cap)\s+(?:to\s+)?(\S+\.(?:cap|pcap|hccapx))",
            r"handshake\s+(?:captured|saved).*?(\S+\.(?:cap|pcap|hccapx))",
        ]:
            match = re.search(pattern, stdout)
            if match:
                return match.group(1)

        # Check output_dir for recently created files matching the BSSID
        bssid_clean = bssid.replace(":", "").lower()
        if os.path.isdir(output_dir):
            for fname in os.listdir(output_dir):
                if bssid_clean in fname.lower() and fname.endswith((".cap", ".pcap", ".hccapx")):
                    return os.path.join(output_dir, fname)

        return None

    @staticmethod
    def _parse_capture_method(stdout: str) -> str:
        """Determine how the handshake was captured."""
        if "PMKID" in stdout:
            return "pmkid"
        if "deauth" in stdout.lower():
            return "deauth"
        if "handshake" in stdout.lower():
            return "passive"
        return "unknown"

    @staticmethod
    def _search_default_locations(bssid: str) -> str | None:
        """Search common wifite output locations for handshake files."""
        bssid_clean = bssid.replace(":", "").lower()
        search_dirs = [
            "/root/hs",  # wifite2 default
            "/tmp/argos-handshakes",
            os.path.expanduser("~/hs"),
        ]

        for search_dir in search_dirs:
            if not os.path.isdir(search_dir):
                continue
            for fname in os.listdir(search_dir):
                if bssid_clean in fname.lower() and fname.endswith((".cap", ".pcap", ".hccapx")):
                    return os.path.join(search_dir, fname)

        return None


if __name__ == "__main__":
    WiFiHandshake().execute()
