#!/usr/bin/env python3
"""
hash_cracker — Offline password cracking via john (John the Ripper) or hashcat.

CLI deps: john, hashcat (installed on Kali)

Cracks password hashes offline. John is default (works without GPU).
Hashcat can leverage GPU when available.
"""

import json
import os
import re
import time

from base_module import TacticalModule


class HashCracker(TacticalModule):
    name = "hash_cracker"
    description = "Offline password cracking via john or hashcat"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--hash-file", required=True,
            help="File containing hashes to crack",
        )
        self.parser.add_argument(
            "--tool", choices=["john", "hashcat"], default="john",
            help="Cracking tool (default: john)",
        )
        self.parser.add_argument(
            "--format",
            help="Hash format (john: --format=NT, hashcat: -m 1000)",
        )
        self.parser.add_argument(
            "--wordlist",
            default="/usr/share/wordlists/rockyou.txt",
            help="Wordlist path (default: rockyou.txt)",
        )
        self.parser.add_argument(
            "--rules", action="store_true",
            help="Enable word mangling rules",
        )
        self.parser.add_argument(
            "--show", action="store_true",
            help="Show previously cracked passwords",
        )
        self.parser.add_argument(
            "--max-runtime", type=int,
            help="Maximum runtime in seconds",
        )

    def run(self, args) -> None:
        if not os.path.exists(args.hash_file):
            self.output_error(f"Hash file not found: {args.hash_file}")
            return

        start = time.monotonic()

        if args.tool == "john":
            result = self._run_john(args)
        else:
            result = self._run_hashcat(args)

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, json.dumps(result)[:5000], "", duration_ms,
        )
        result["duration_ms"] = duration_ms
        self.output_success(result)

    def _run_john(self, args) -> dict:
        """Run John the Ripper."""
        if args.show:
            result = self.run_tool(
                "john", ["--show", args.hash_file], timeout=30
            )
            cracked = self._parse_john_show(result.stdout)
            return {"tool": "john", "action": "show", "cracked": cracked}

        j_args = [args.hash_file, f"--wordlist={args.wordlist}"]
        if args.format:
            j_args.append(f"--format={args.format}")
        if args.rules:
            j_args.append("--rules=best64")

        timeout = args.max_runtime or args.timeout
        result = self.run_tool("john", j_args, timeout=timeout)

        # Get results with --show
        show_result = self.run_tool(
            "john", ["--show", args.hash_file], timeout=30
        )
        cracked = self._parse_john_show(show_result.stdout)

        return {
            "tool": "john",
            "action": "crack",
            "wordlist": args.wordlist,
            "cracked": cracked,
            "cracked_count": len(cracked),
        }

    def _run_hashcat(self, args) -> dict:
        """Run hashcat."""
        if args.show:
            result = self.run_tool(
                "hashcat", [args.hash_file, "--show"], timeout=30
            )
            cracked = self._parse_hashcat_show(result.stdout)
            return {"tool": "hashcat", "action": "show", "cracked": cracked}

        hc_args = [
            args.hash_file,
            args.wordlist,
            "--force",  # Allow CPU-only on RPi
            "-O",       # Optimized kernels
        ]

        if args.format:
            hc_args.extend(["-m", args.format])
        if args.rules:
            hc_args.extend(["-r", "/usr/share/hashcat/rules/best64.rule"])
        if args.max_runtime:
            hc_args.extend(["--runtime", str(args.max_runtime)])

        timeout = (args.max_runtime or args.timeout) + 10
        result = self.run_tool("hashcat", hc_args, timeout=timeout)

        # Get results
        show_result = self.run_tool(
            "hashcat", [args.hash_file, "--show"], timeout=30
        )
        cracked = self._parse_hashcat_show(show_result.stdout)

        return {
            "tool": "hashcat",
            "action": "crack",
            "wordlist": args.wordlist,
            "cracked": cracked,
            "cracked_count": len(cracked),
        }

    @staticmethod
    def _parse_john_show(output: str) -> list[dict]:
        """Parse john --show output (user:password format)."""
        cracked: list[dict] = []
        for line in output.strip().split("\n"):
            if ":" in line and "password hashes cracked" not in line:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    cracked.append({
                        "hash_or_user": parts[0],
                        "password": parts[1],
                    })
        return cracked

    @staticmethod
    def _parse_hashcat_show(output: str) -> list[dict]:
        """Parse hashcat --show output (hash:password format)."""
        cracked: list[dict] = []
        for line in output.strip().split("\n"):
            if ":" in line:
                parts = line.rsplit(":", 1)
                if len(parts) == 2:
                    cracked.append({
                        "hash": parts[0],
                        "password": parts[1],
                    })
        return cracked


if __name__ == "__main__":
    HashCracker().execute()
