#!/usr/bin/env python3
"""
packet_crafter — Custom packet crafting and sending via hping3.

CLI deps: hping3 (installed on Kali)

Crafts and sends custom TCP/UDP/ICMP packets for firewall testing,
port scanning, and network diagnostics. Supports SYN floods,
FIN/XMAS/NULL scans, and traceroute mode.

REQUIRES: Root privileges.
"""

import json
import re
import time

from base_module import TacticalModule


class PacketCrafter(TacticalModule):
    name = "packet_crafter"
    description = "Custom packet crafting and sending via hping3"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP or hostname",
        )
        self.parser.add_argument(
            "--port", type=int, default=80,
            help="Target port (default: 80)",
        )
        self.parser.add_argument(
            "--mode",
            choices=["syn", "udp", "icmp", "fin", "xmas", "null", "traceroute"],
            default="syn",
            help="Packet mode (default: syn)",
        )
        self.parser.add_argument(
            "--count", type=int, default=5,
            help="Number of packets to send (default: 5)",
        )
        self.parser.add_argument(
            "--interval", type=int, default=1,
            help="Interval between packets in seconds (default: 1)",
        )
        self.parser.add_argument(
            "--data",
            help="Payload data string to include in packet",
        )

    def run(self, args) -> None:
        if not self.check_root():
            return

        hp_args = ["-c", str(args.count), "-i", str(args.interval)]

        mode_flags = {
            "syn": ["-S", "-p", str(args.port)],
            "udp": ["--udp", "-p", str(args.port)],
            "icmp": ["--icmp"],
            "fin": ["-F", "-p", str(args.port)],
            "xmas": ["-F", "-U", "-P", "-p", str(args.port)],  # FIN+URG+PSH
            "null": ["-p", str(args.port), "--fin", "--syn", "--rst",
                     "--push", "--ack", "--urg"],  # clear all flags
            "traceroute": ["-S", "-p", str(args.port), "--traceroute"],
        }

        # null scan: hping3 doesn't have a native "null" — use raw mode
        if args.mode == "null":
            hp_args.extend(["-p", str(args.port)])
            # No flags = null scan
        else:
            hp_args.extend(mode_flags[args.mode])

        if args.data:
            hp_args.extend(["-d", str(len(args.data)), "-E", "/dev/stdin"])

        hp_args.append(args.target)

        start = time.monotonic()
        result = self.run_tool("hping3", hp_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        responses = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "port": args.port,
            "mode": args.mode,
            "packets_sent": args.count,
            "responses": responses,
            "response_count": len(responses),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse hping3 output for responses."""
        responses: list[dict] = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            # Pattern: len=XX ip=X.X.X.X ttl=XX ... flags=SA ...
            if "ip=" in line or "len=" in line:
                entry: dict[str, str] = {}
                for kv in re.findall(r"(\w+)=(\S+)", line):
                    entry[kv[0]] = kv[1]
                if entry:
                    responses.append(entry)
            # RTT summary line
            elif "rtt" in line.lower():
                rtt_match = re.search(r"min/avg/max\s*=\s*([\d.]+)/([\d.]+)/([\d.]+)", line)
                if rtt_match:
                    responses.append({
                        "type": "rtt_summary",
                        "min_ms": rtt_match.group(1),
                        "avg_ms": rtt_match.group(2),
                        "max_ms": rtt_match.group(3),
                    })
        return responses


if __name__ == "__main__":
    PacketCrafter().execute()
