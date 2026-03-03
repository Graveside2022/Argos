#!/usr/bin/env python3
"""
mac_changer — MAC address spoofing via macchanger.

CLI deps: macchanger (installed on Kali)

Changes, randomizes, or restores MAC address on a network interface.
Interface must be down for MAC change (handled automatically).

REQUIRES: Root privileges.
"""

import json
import re
import time

from base_module import TacticalModule


class MACChanger(TacticalModule):
    name = "mac_changer"
    description = "MAC address spoofing via macchanger"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--interface", required=True,
            help="Network interface to change MAC on",
        )
        self.parser.add_argument(
            "--random", action="store_true",
            help="Set a fully random MAC address",
        )
        self.parser.add_argument(
            "--restore", action="store_true",
            help="Restore the original (permanent) MAC address",
        )
        self.parser.add_argument(
            "--mac",
            help="Set a specific MAC address (AA:BB:CC:DD:EE:FF)",
        )
        self.parser.add_argument(
            "--show", action="store_true",
            help="Show current MAC without changing",
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
        if args.mac and not self.validate_mac(args.mac):
            self.output_error(f"Invalid MAC address: {args.mac}")
            return

        start = time.monotonic()

        if args.show:
            result = self.run_tool("macchanger", ["-s", args.interface], timeout=10)
            current, permanent = self._parse_show(result.stdout)
            duration_ms = int((time.monotonic() - start) * 1000)
            self.output_success({
                "interface": args.interface,
                "action": "show",
                "current_mac": current,
                "permanent_mac": permanent,
                "duration_ms": duration_ms,
            })
            return

        # Bring interface down
        self.run_tool("ip", ["link", "set", args.interface, "down"], timeout=10)

        # Build macchanger command
        mc_args: list[str] = []
        action = "unknown"
        if args.restore:
            mc_args = ["-p", args.interface]
            action = "restore"
        elif args.mac:
            mc_args = ["-m", args.mac, args.interface]
            action = "set"
        elif args.random:
            mc_args = ["-r", args.interface]
            action = "random"
        else:
            mc_args = ["-r", args.interface]
            action = "random"

        result = self.run_tool("macchanger", mc_args, timeout=10)

        # Bring interface back up
        self.run_tool("ip", ["link", "set", args.interface, "up"], timeout=10)

        duration_ms = int((time.monotonic() - start) * 1000)

        old_mac, new_mac = self._parse_change(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:2000], result.stderr[:2000], duration_ms,
        )
        self.output_success({
            "interface": args.interface,
            "action": action,
            "old_mac": old_mac,
            "new_mac": new_mac,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_show(output: str) -> tuple[str, str]:
        """Parse macchanger -s output."""
        current = ""
        permanent = ""
        for line in output.split("\n"):
            mac_match = re.search(r"([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})", line)
            if mac_match:
                if "Current" in line:
                    current = mac_match.group(1)
                elif "Permanent" in line:
                    permanent = mac_match.group(1)
        return current, permanent

    @staticmethod
    def _parse_change(output: str) -> tuple[str, str]:
        """Parse macchanger change output for old and new MAC."""
        old_mac = ""
        new_mac = ""
        for line in output.split("\n"):
            mac_match = re.search(r"([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})", line)
            if mac_match:
                if "Current" in line or "Old" in line:
                    old_mac = mac_match.group(1)
                elif "New" in line:
                    new_mac = mac_match.group(1)
        return old_mac, new_mac


if __name__ == "__main__":
    MACChanger().execute()
