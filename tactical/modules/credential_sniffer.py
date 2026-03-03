#!/usr/bin/env python3
"""
Credential Sniffer Module — dsniff wrapper.

Passively sniffs cleartext credentials from network traffic using dsniff.
Captures credentials from protocols including FTP, HTTP, IMAP, POP3, SMTP,
Telnet, rlogin, and others that transmit authentication in plaintext.

REQUIRES ROOT — raw socket access needed for packet capture.
"""

import argparse
import re
from typing import Any

from base_module import TacticalModule


# Known cleartext protocols dsniff can capture
_CLEARTEXT_PROTOCOLS = frozenset({
    "ftp", "http", "imap", "pop3", "smtp", "telnet",
    "rlogin", "rsh", "nntp", "irc", "aim", "icq",
    "napster", "postgresdb", "oracle", "sybase",
})


class CredentialSniffer(TacticalModule):
    """Sniff cleartext credentials from live network traffic using dsniff."""

    name: str = "credential_sniffer"
    description: str = (
        "Passive credential sniffing using dsniff. "
        "Captures FTP, HTTP, IMAP, POP3, Telnet, and other cleartext protocol creds. "
        "REQUIRES ROOT."
    )

    def _add_module_args(self) -> None:
        """Register credential sniffer arguments."""
        self.parser.add_argument(
            "--interface",
            required=True,
            help="Network interface to sniff on (e.g. eth0, wlan0)",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=60,
            help="Sniff duration in seconds (default: 60)",
        )
        self.parser.add_argument(
            "--pcap-filter",
            default="",
            help="BPF filter to limit captured traffic (e.g. 'port 21 or port 80')",
        )
        self.parser.add_argument(
            "--read-file",
            default="",
            help="Read from PCAP file instead of live interface",
        )
        self.parser.add_argument(
            "--no-resolve",
            action="store_true",
            default=False,
            help="Disable DNS resolution of captured hosts",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate arguments and root privileges."""
        if not self.check_root():
            return  # check_root calls output_error which exits

        if args.read_file:
            from pathlib import Path
            if not Path(args.read_file).exists():
                self.output_error(f"PCAP file not found: {args.read_file!r}")
        else:
            if not self.validate_interface(args.interface):
                self.output_error(f"Invalid interface name: {args.interface!r}")
            if not self.check_interface_exists(args.interface):
                self.output_error(
                    f"Interface {args.interface!r} not found on system."
                )
            if args.duration < 5 or args.duration > 3600:
                self.output_error(
                    f"Duration must be 5–3600 seconds, got {args.duration}."
                )

    # ── Command builder ──────────────────────────────────────────────

    def _build_dsniff_args(self, args: argparse.Namespace) -> list[str]:
        """Build dsniff argument list."""
        dsniff_args: list[str] = []

        if args.read_file:
            dsniff_args.extend(["-p", args.read_file])
        else:
            dsniff_args.extend(["-i", args.interface])

        if args.no_resolve:
            dsniff_args.append("-n")

        if args.pcap_filter:
            # dsniff accepts filter expression as trailing positional args
            dsniff_args.append(args.pcap_filter)

        return dsniff_args

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_dsniff_output(self, stdout: str, stderr: str) -> list[dict[str, Any]]:
        """
        Parse dsniff's credential output format.

        dsniff output blocks look like:
            -------------
            MM/DD/YY HH:MM:SS tcp SRC.IP.ADDR:SPORT -> DST.IP.ADDR:DPORT (PROTOCOL)
            CREDENTIAL_DATA
        """
        credentials: list[dict[str, Any]] = []
        combined = (stdout + "\n" + stderr).strip()

        # Split on dsniff's separator lines
        blocks = re.split(r"-{10,}", combined)

        for block in blocks:
            block = block.strip()
            if not block:
                continue

            # Parse the header line: timestamp tcp src -> dst (proto)
            header_match = re.search(
                r"(\d{2}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})\s+"
                r"tcp\s+([\d.]+):(\d+)\s+->\s+([\d.]+):(\d+)"
                r"(?:\s+\((\w+)\))?",
                block,
                re.IGNORECASE,
            )
            if not header_match:
                continue

            timestamp = header_match.group(1)
            src_ip = header_match.group(2)
            src_port = int(header_match.group(3))
            dst_ip = header_match.group(4)
            dst_port = int(header_match.group(5))
            protocol = (header_match.group(6) or self._guess_protocol(dst_port)).upper()

            # Remaining content after header is the credential payload
            payload = block[header_match.end():].strip()
            if not payload:
                continue

            credential = self._extract_credential(protocol, payload, dst_port)
            credentials.append({
                "timestamp": timestamp,
                "protocol": protocol,
                "src_ip": src_ip,
                "src_port": src_port,
                "dst_ip": dst_ip,
                "dst_port": dst_port,
                "username": credential.get("username", ""),
                "password": credential.get("password", ""),
                "raw_payload": payload[:500],
            })

        return credentials

    def _extract_credential(
        self, protocol: str, payload: str, port: int
    ) -> dict[str, str]:
        """Extract username/password from protocol-specific payload."""
        cred: dict[str, str] = {"username": "", "password": ""}

        proto_lower = protocol.lower()

        if proto_lower == "ftp":
            user_match = re.search(r"USER\s+(\S+)", payload, re.IGNORECASE)
            pass_match = re.search(r"PASS\s+(\S+)", payload, re.IGNORECASE)
            if user_match:
                cred["username"] = user_match.group(1)
            if pass_match:
                cred["password"] = pass_match.group(1)

        elif proto_lower == "http":
            # HTTP Basic Auth: "Authorization: Basic base64(user:pass)"
            basic_match = re.search(
                r"Authorization:\s*Basic\s+([A-Za-z0-9+/=]+)", payload, re.IGNORECASE
            )
            if basic_match:
                import base64
                try:
                    decoded = base64.b64decode(basic_match.group(1)).decode("utf-8", errors="replace")
                    if ":" in decoded:
                        parts = decoded.split(":", 1)
                        cred["username"] = parts[0]
                        cred["password"] = parts[1]
                except Exception:
                    pass
            # Form-based auth (POST body)
            form_user = re.search(r"(?:username|user|login)=([^&\s]+)", payload, re.IGNORECASE)
            form_pass = re.search(r"(?:password|pass|passwd)=([^&\s]+)", payload, re.IGNORECASE)
            if form_user and not cred["username"]:
                cred["username"] = form_user.group(1)
            if form_pass and not cred["password"]:
                cred["password"] = form_pass.group(1)

        elif proto_lower in ("imap", "pop3", "smtp"):
            user_match = re.search(r"(?:USER|LOGIN)\s+(\S+)", payload, re.IGNORECASE)
            pass_match = re.search(r"(?:PASS|AUTHENTICATE)\s+(\S+)", payload, re.IGNORECASE)
            if user_match:
                cred["username"] = user_match.group(1)
            if pass_match:
                cred["password"] = pass_match.group(1)

        elif proto_lower == "telnet":
            # Telnet creds are harder — look for login/password prompts
            login_match = re.search(r"login:\s*(\S+)", payload, re.IGNORECASE)
            pass_match = re.search(r"Password:\s*(\S+)", payload, re.IGNORECASE)
            if login_match:
                cred["username"] = login_match.group(1)
            if pass_match:
                cred["password"] = pass_match.group(1)

        return cred

    @staticmethod
    def _guess_protocol(port: int) -> str:
        """Guess protocol name from destination port number."""
        port_map = {
            21: "ftp", 23: "telnet", 25: "smtp", 80: "http",
            110: "pop3", 143: "imap", 513: "rlogin", 514: "rsh",
            119: "nntp", 194: "irc", 5190: "aim",
        }
        return port_map.get(port, "unknown")

    def _build_summary(self, credentials: list[dict[str, Any]]) -> dict[str, Any]:
        """Build protocol breakdown summary from credential list."""
        by_protocol: dict[str, int] = {}
        for cred in credentials:
            proto = cred["protocol"]
            by_protocol[proto] = by_protocol.get(proto, 0) + 1
        return by_protocol

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute dsniff credential capture and parse results."""
        self._validate_args(args)

        dsniff_args = self._build_dsniff_args(args)
        source = args.read_file or args.interface
        self.logger.info("Starting dsniff credential capture on %s", source)

        if args.read_file:
            result = self.run_tool("dsniff", dsniff_args, timeout=args.timeout)
            stdout, stderr = result.stdout, result.stderr
        else:
            stdout, stderr = self.run_tool_popen(
                "dsniff", dsniff_args, duration=args.duration
            )

        credentials = self._parse_dsniff_output(stdout, stderr)
        protocol_summary = self._build_summary(credentials)

        self.output_success({
            "source": source,
            "duration_seconds": args.duration if not args.read_file else 0,
            "credentials_found": credentials,
            "credential_count": len(credentials),
            "protocols_observed": protocol_summary,
            "cleartext_protocols_monitored": sorted(_CLEARTEXT_PROTOCOLS),
        })


if __name__ == "__main__":
    CredentialSniffer().execute()
