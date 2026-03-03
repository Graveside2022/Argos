#!/usr/bin/env python3
"""
Packet Manipulator Module — Scapy-based packet crafting and sniffing.

Provides three operational modes:
  craft    — Build and transmit custom packets (TCP/UDP/ICMP) to a target
  sniff    — Capture and summarize live traffic on an interface
  arp-scan — Discover live hosts on the local network via ARP requests

Uses Scapy as a Python library (no subprocess required). Requires root for
raw socket operations (craft, arp-scan) and promiscuous capture (sniff).
"""

import argparse
import sys
from typing import Any

from base_module import TacticalModule


_VALID_MODES = ("craft", "sniff", "arp-scan")
_VALID_PROTOCOLS = ("tcp", "udp", "icmp", "raw")


class PacketManipulator(TacticalModule):
    """Craft, send, sniff, or ARP-scan using Scapy."""

    name: str = "packet_manipulator"
    description: str = (
        "Packet manipulation using Scapy. "
        "Modes: craft (send custom packets), sniff (capture live traffic), "
        "arp-scan (discover hosts via ARP). "
        "Root required for craft and arp-scan."
    )

    def _add_module_args(self) -> None:
        """Register packet manipulator arguments."""
        self.parser.add_argument(
            "--mode",
            choices=list(_VALID_MODES),
            required=True,
            help="Operation mode: craft, sniff, or arp-scan",
        )
        self.parser.add_argument(
            "--target",
            default="",
            help="Target IP or CIDR (required for craft and arp-scan)",
        )
        self.parser.add_argument(
            "--interface",
            default="",
            help="Network interface (required for sniff and arp-scan)",
        )
        self.parser.add_argument(
            "--protocol",
            choices=list(_VALID_PROTOCOLS),
            default="tcp",
            help="Packet protocol for craft mode (default: tcp)",
        )
        self.parser.add_argument(
            "--port",
            type=int,
            default=80,
            help="Destination port for TCP/UDP craft mode (default: 80)",
        )
        self.parser.add_argument(
            "--count",
            type=int,
            default=1,
            help="Packets to send (craft) or capture (sniff) (default: 1)",
        )
        self.parser.add_argument(
            "--payload",
            default="",
            help="Raw payload string to embed in crafted packet",
        )
        self.parser.add_argument(
            "--sniff-filter",
            default="",
            help="BPF filter for sniff mode (e.g. 'tcp port 443')",
        )
        self.parser.add_argument(
            "--sniff-timeout",
            type=int,
            default=15,
            help="Sniff capture timeout in seconds (default: 15)",
        )
        self.parser.add_argument(
            "--inter",
            type=float,
            default=0.0,
            help="Inter-packet delay in seconds for craft mode (default: 0)",
        )

    # ── Scapy import guard ───────────────────────────────────────────

    def _import_scapy(self) -> Any:
        """Import scapy and return the module. Exits with error if not installed."""
        try:
            import scapy.all as scapy  # type: ignore[import]
            return scapy
        except ImportError:
            self.output_error(
                "Scapy is not installed. Install with: pip install scapy",
                {"install_cmd": "pip install scapy"},
            )
            sys.exit(1)  # unreachable after output_error, satisfies type checker

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate mode-specific requirements."""
        if args.mode in ("craft", "arp-scan"):
            if not self.check_root():
                return

        if args.mode == "craft":
            if not args.target:
                self.output_error("--target is required for craft mode.")
            if not self.validate_ip(args.target):
                self.output_error(f"Invalid target IP: {args.target!r}")
            if not self.validate_port(args.port):
                self.output_error(f"Invalid port: {args.port}. Must be 1–65535.")
            if args.count < 1 or args.count > 10000:
                self.output_error(f"Count must be 1–10000, got {args.count}.")

        elif args.mode == "sniff":
            if not args.interface:
                self.output_error("--interface is required for sniff mode.")
            if not self.validate_interface(args.interface):
                self.output_error(f"Invalid interface name: {args.interface!r}")
            if not self.check_interface_exists(args.interface):
                self.output_error(f"Interface {args.interface!r} not found.")
            if args.count < 1 or args.count > 100000:
                self.output_error(f"Count must be 1–100000, got {args.count}.")

        elif args.mode == "arp-scan":
            if not args.target:
                self.output_error("--target (CIDR or IP) is required for arp-scan mode.")
            if not args.interface:
                self.output_error("--interface is required for arp-scan mode.")
            # Accept both IP and CIDR for arp-scan
            if not self.validate_ip(args.target) and not self.validate_cidr(args.target):
                self.output_error(
                    f"Invalid target: {args.target!r}. Must be IP or CIDR (e.g. 192.168.1.0/24)."
                )

    # ── Mode implementations ─────────────────────────────────────────

    def _craft_and_send(
        self, args: argparse.Namespace, scapy: Any
    ) -> dict[str, Any]:
        """Build a packet from args and send it. Returns transmission summary."""
        ip_layer = scapy.IP(dst=args.target)

        if args.protocol == "tcp":
            transport = scapy.TCP(dport=args.port, flags="S")
        elif args.protocol == "udp":
            transport = scapy.UDP(dport=args.port)
        elif args.protocol == "icmp":
            transport = scapy.ICMP()
        else:  # raw
            transport = scapy.Raw()

        payload_layer = scapy.Raw(load=args.payload) if args.payload else b""

        if args.payload:
            pkt = ip_layer / transport / payload_layer
        else:
            pkt = ip_layer / transport

        self.logger.info(
            "Crafting %s packet to %s:%d (count=%d)",
            args.protocol.upper(), args.target, args.port, args.count,
        )

        # Use sr1 for single packet (get response), sendp for multiple
        if args.count == 1:
            response = scapy.sr1(pkt, timeout=3, verbose=0)
            response_summary = str(response.summary()) if response else "No response"
            responses_received = 1 if response else 0
        else:
            scapy.send(pkt, count=args.count, inter=args.inter, verbose=0)
            response_summary = f"Sent {args.count} packets (no response collection)"
            responses_received = 0

        return {
            "target": args.target,
            "protocol": args.protocol.upper(),
            "port": args.port,
            "packets_sent": args.count,
            "responses_received": responses_received,
            "response_summary": response_summary,
            "payload_bytes": len(args.payload),
            "packet_size": len(bytes(pkt)),
        }

    def _sniff_packets(
        self, args: argparse.Namespace, scapy: Any
    ) -> dict[str, Any]:
        """Capture packets on interface and summarize. Returns capture summary."""
        self.logger.info(
            "Sniffing %d packets on %s (timeout=%ds, filter=%r)",
            args.count, args.interface, args.sniff_timeout, args.sniff_filter,
        )

        sniff_kwargs: dict[str, Any] = {
            "iface": args.interface,
            "count": args.count,
            "timeout": args.sniff_timeout,
            "store": True,
        }
        if args.sniff_filter:
            sniff_kwargs["filter"] = args.sniff_filter

        packets = scapy.sniff(**sniff_kwargs)

        protocol_counts: dict[str, int] = {}
        hosts: set[str] = set()
        summaries: list[str] = []

        for pkt in packets:
            summary = pkt.summary()
            summaries.append(summary)

            # Count protocols
            for proto in ("TCP", "UDP", "ICMP", "ARP", "DNS"):
                if proto in summary:
                    protocol_counts[proto] = protocol_counts.get(proto, 0) + 1
                    break

            # Collect source IPs
            if hasattr(pkt, "src"):
                hosts.add(pkt.src)

        return {
            "interface": args.interface,
            "filter": args.sniff_filter or "(none)",
            "packets_captured": len(packets),
            "packets_requested": args.count,
            "protocol_breakdown": protocol_counts,
            "unique_sources": sorted(hosts),
            "packet_summaries": summaries[:50],
        }

    def _arp_scan(
        self, args: argparse.Namespace, scapy: Any
    ) -> dict[str, Any]:
        """Discover live hosts via ARP requests. Returns list of host/MAC pairs."""
        self.logger.info(
            "ARP scanning %s on %s", args.target, args.interface
        )

        arp_request = scapy.ARP(pdst=args.target)
        broadcast = scapy.Ether(dst="ff:ff:ff:ff:ff:ff")
        arp_broadcast = broadcast / arp_request

        answered, unanswered = scapy.srp(
            arp_broadcast,
            timeout=3,
            iface=args.interface,
            verbose=0,
        )

        hosts: list[dict[str, str]] = []
        for sent, received in answered:
            hosts.append({
                "ip": received.psrc,
                "mac": received.hwsrc,
                "vendor": "",  # Vendor lookup would require OUI DB
            })

        # Sort by last octet for readability
        hosts.sort(key=lambda h: [int(o) for o in h["ip"].split(".")])

        return {
            "target_range": args.target,
            "interface": args.interface,
            "hosts_found": hosts,
            "host_count": len(hosts),
            "unanswered_count": len(unanswered),
        }

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute the requested packet manipulation mode."""
        self._validate_args(args)
        scapy = self._import_scapy()

        # Suppress Scapy's verbose warnings to stderr
        scapy.conf.verb = 0

        if args.mode == "craft":
            result = self._craft_and_send(args, scapy)
        elif args.mode == "sniff":
            result = self._sniff_packets(args, scapy)
        else:  # arp-scan
            result = self._arp_scan(args, scapy)

        self.output_success({"mode": args.mode, **result})


if __name__ == "__main__":
    PacketManipulator().execute()
