#!/usr/bin/env python3
"""
Socket Relay Module — TCP/UDP/SSL port forwarding via socat.

Wraps socat to create a bidirectional relay between a local listening
port and a remote target (host:port). Supports TCP, UDP, and SSL modes.
Useful for pivoting, port forwarding, and traffic tunneling during
Army EW training exercises.

Connection stats are parsed from socat's verbose stderr output.
"""

import argparse
import re
from typing import Any

from base_module import TacticalModule

# socat connection log patterns
_CONNECT_RE = re.compile(
    r"successfully connected",
    re.IGNORECASE,
)
_ACCEPT_RE = re.compile(
    r"accepting connection",
    re.IGNORECASE,
)
_BYTES_RE = re.compile(
    r"transferred\s+(\d+)\s+bytes",
    re.IGNORECASE,
)
_CLOSE_RE = re.compile(
    r"socket closed|connection closed|e=0",
    re.IGNORECASE,
)


class SocketRelay(TacticalModule):
    """Bidirectional socket relay using socat."""

    name = "socket_relay"
    description = (
        "Create a TCP/UDP/SSL port relay from a local listen port to a remote target "
        "using socat. Useful for port forwarding and pivoting."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--listen-port",
            type=int,
            required=True,
            dest="listen_port",
            help="Local port to listen on.",
        )
        self.parser.add_argument(
            "--target",
            required=True,
            help="Remote target as host:port (e.g. 192.168.1.10:8080).",
        )
        self.parser.add_argument(
            "--mode",
            choices=["tcp", "udp", "ssl"],
            default="tcp",
            help="Socket mode (default: tcp).",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=30,
            help="Relay duration in seconds (default: 30).",
        )
        self.parser.add_argument(
            "--fork",
            action="store_true",
            default=False,
            help="Accept multiple connections (socat fork option).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate port and target format."""
        if not self.validate_port(args.listen_port):
            self.output_error(
                f"Invalid listen port: {args.listen_port}. Must be 1–65535.",
                {"listen_port": args.listen_port},
            )

        parts = args.target.split(":")
        if len(parts) != 2:
            self.output_error(
                "Target must be host:port (e.g. 192.168.1.10:8080).",
                {"target": args.target},
            )
        host, port_str = parts
        if not port_str.isdigit() or not self.validate_port(int(port_str)):
            self.output_error(
                f"Invalid target port: {port_str}.",
                {"target": args.target},
            )
        if not host:
            self.output_error(
                "Target host cannot be empty.",
                {"target": args.target},
            )

    def _parse_target(self, target: str) -> tuple[str, int]:
        """Split host:port target string."""
        host, port_str = target.rsplit(":", 1)
        return host, int(port_str)

    def _build_socat_args(self, args: argparse.Namespace) -> list[str]:
        """Construct socat argument list for the requested relay mode."""
        target_host, target_port = self._parse_target(args.target)

        # Build local address spec
        if args.mode == "tcp":
            listen_spec = f"TCP-LISTEN:{args.listen_port},reuseaddr"
            if args.fork:
                listen_spec += ",fork"
            remote_spec = f"TCP:{target_host}:{target_port}"

        elif args.mode == "udp":
            listen_spec = f"UDP-LISTEN:{args.listen_port},reuseaddr"
            if args.fork:
                listen_spec += ",fork"
            remote_spec = f"UDP:{target_host}:{target_port}"

        else:  # ssl
            listen_spec = (
                f"OPENSSL-LISTEN:{args.listen_port},"
                "reuseaddr,"
                "verify=0"
            )
            if args.fork:
                listen_spec += ",fork"
            remote_spec = (
                f"OPENSSL:{target_host}:{target_port},"
                "verify=0"
            )

        return ["-d", "-d", listen_spec, remote_spec]

    def _parse_stats(self, stderr: str) -> dict[str, Any]:
        """Extract connection statistics from socat verbose output."""
        connections_accepted = len(_ACCEPT_RE.findall(stderr))
        connections_established = len(_CONNECT_RE.findall(stderr))
        connection_closes = len(_CLOSE_RE.findall(stderr))

        bytes_transferred = 0
        for match in _BYTES_RE.finditer(stderr):
            bytes_transferred += int(match.group(1))

        return {
            "connections_accepted": connections_accepted,
            "connections_established": connections_established,
            "connection_closes": connection_closes,
            "bytes_transferred": bytes_transferred,
            "bytes_transferred_kb": round(bytes_transferred / 1024, 2),
        }

    def run(self, args: argparse.Namespace) -> None:
        """Start the socat relay and return connection statistics."""
        self._validate_args(args)
        target_host, target_port = self._parse_target(args.target)
        socat_args = self._build_socat_args(args)

        self.logger.info(
            "Starting %s relay: 0.0.0.0:%d → %s:%d (for %ds)",
            args.mode.upper(),
            args.listen_port,
            target_host,
            target_port,
            args.duration,
        )

        stdout, stderr = self.run_tool_popen(
            "socat",
            socat_args,
            duration=args.duration,
        )

        stats = self._parse_stats(stderr)

        self.output_success(
            {
                "listen_port": args.listen_port,
                "target_host": target_host,
                "target_port": target_port,
                "mode": args.mode,
                "duration_sec": args.duration,
                "fork": args.fork,
                **stats,
            }
        )


if __name__ == "__main__":
    SocketRelay().execute()
