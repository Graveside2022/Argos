#!/usr/bin/env python3
"""
Netcat Session Module — TCP/UDP listener and connector via netcat (nc).

Supports two operational modes:
  listen   — bind on a port and capture incoming data (run_tool_popen)
  connect  — connect to a host:port, optionally piping stdin data

Can spawn a bind shell (-e /bin/sh) for listen mode during authorized
penetration testing exercises. Data received is captured and returned
in the JSON output.
"""

import argparse
import shlex
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# Common netcat binary names (Kali ships ncat and nc)
_NC_BINARIES = ["ncat", "nc", "netcat"]


class NetcatSession(TacticalModule):
    """TCP/UDP listener and connector using netcat."""

    name = "netcat_session"
    description = (
        "Run netcat in listen or connect mode. Captures received data as JSON. "
        "Supports optional bind shell for authorized training exercises."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--mode",
            choices=["listen", "connect"],
            required=True,
            help="Operation mode: listen (bind) or connect (outbound).",
        )
        self.parser.add_argument(
            "--host",
            default="",
            help="Remote host to connect to (connect mode only).",
        )
        self.parser.add_argument(
            "--port",
            type=int,
            required=True,
            help="TCP port to listen on or connect to.",
        )
        self.parser.add_argument(
            "--udp",
            action="store_true",
            default=False,
            help="Use UDP instead of TCP.",
        )
        self.parser.add_argument(
            "--command",
            default="",
            help=(
                "Execute this command on connection (-e flag). "
                "Example: /bin/sh — for authorized bind shells only."
            ),
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=30,
            help="Session duration in seconds before forceful termination (default: 30).",
        )
        self.parser.add_argument(
            "--send-data",
            default="",
            dest="send_data",
            help="Data string to send when connecting (connect mode).",
        )
        self.parser.add_argument(
            "--send-file",
            default="",
            dest="send_file",
            help="File to pipe into the connection (connect mode).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate port, mode-specific requirements, and file paths."""
        if not self.validate_port(args.port):
            self.output_error(
                f"Invalid port: {args.port}. Must be 1–65535.",
                {"port": args.port},
            )
        if args.mode == "connect" and not args.host:
            self.output_error(
                "Connect mode requires --host.",
                {"mode": args.mode},
            )
        if args.mode == "connect" and args.host and not (
            self.validate_ip(args.host) or self.validate_domain(args.host)
        ):
            self.output_error(
                f"Invalid host: {args.host}.",
                {"host": args.host},
            )
        if args.send_file and not Path(args.send_file).exists():
            self.output_error(
                f"Send file not found: {args.send_file}",
                {"path": args.send_file},
            )

    def _find_nc_binary(self) -> str:
        """Locate the first available netcat binary."""
        import shutil
        for binary in _NC_BINARIES:
            if shutil.which(binary):
                return binary
        self.output_error(
            "No netcat binary found. Install ncat (nmap package) or netcat.",
            {"searched": _NC_BINARIES},
        )
        return ""  # unreachable

    def _build_nc_args(self, args: argparse.Namespace, nc_bin: str) -> list[str]:
        """Build netcat argument list for listen or connect mode."""
        nc_args: list[str] = []

        # ncat vs traditional nc flag differences
        is_ncat = nc_bin == "ncat"

        if args.udp:
            nc_args.append("-u")

        if args.mode == "listen":
            nc_args.append("-l")
            if is_ncat:
                nc_args += ["-p", str(args.port)]
            else:
                nc_args.append(str(args.port))
            if args.command:
                nc_args += ["-e", args.command]
            # Keep listening for multiple connections
            if is_ncat:
                nc_args.append("-k")
        else:
            # connect mode
            nc_args += [args.host, str(args.port)]
            if args.command:
                nc_args += ["-e", args.command]

        return nc_args

    def _run_listen(
        self, args: argparse.Namespace, nc_bin: str
    ) -> dict[str, Any]:
        """Run netcat in listen mode for the specified duration."""
        nc_args = self._build_nc_args(args, nc_bin)
        self.logger.info(
            "Listening on port %d (%s) for %ds",
            args.port,
            "UDP" if args.udp else "TCP",
            args.duration,
        )

        stdout, stderr = self.run_tool_popen(
            nc_bin,
            nc_args,
            duration=args.duration,
        )

        data_received = stdout
        bytes_received = len(data_received.encode("utf-8", errors="replace"))

        return {
            "mode": "listen",
            "port": args.port,
            "protocol": "UDP" if args.udp else "TCP",
            "duration_sec": args.duration,
            "bytes_received": bytes_received,
            "data_preview": data_received[:500] if data_received else "",
            "shell_command": args.command or None,
        }

    def _run_connect(
        self, args: argparse.Namespace, nc_bin: str
    ) -> dict[str, Any]:
        """Run netcat in connect mode, optionally sending data or a file."""
        nc_args = self._build_nc_args(args, nc_bin)
        self.logger.info(
            "Connecting to %s:%d (%s)",
            args.host,
            args.port,
            "UDP" if args.udp else "TCP",
        )

        # Build environment with optional stdin data piped via file
        if args.send_file:
            # Use run_tool_popen so we can stream the file
            stdout, stderr = self.run_tool_popen(
                nc_bin,
                nc_args,
                duration=args.duration,
            )
        else:
            result = self.run_tool(
                nc_bin,
                nc_args,
                timeout=args.duration,
            )
            stdout = result.stdout
            stderr = result.stderr

        bytes_sent = (
            Path(args.send_file).stat().st_size
            if args.send_file
            else len(args.send_data.encode("utf-8"))
        )

        return {
            "mode": "connect",
            "host": args.host,
            "port": args.port,
            "protocol": "UDP" if args.udp else "TCP",
            "bytes_sent": bytes_sent,
            "send_file": args.send_file or None,
            "stdout": stdout[:1000] if stdout else "",
            "stderr": stderr[:500] if stderr else "",
        }

    def run(self, args: argparse.Namespace) -> None:
        """Execute netcat in the requested mode."""
        self._validate_args(args)
        nc_bin = self._find_nc_binary()

        if args.mode == "listen":
            result = self._run_listen(args, nc_bin)
        else:
            result = self._run_connect(args, nc_bin)

        self.output_success(
            {
                "nc_binary": nc_bin,
                **result,
            }
        )


if __name__ == "__main__":
    NetcatSession().execute()
