#!/usr/bin/env python3
"""
smb_mapper — SMB share access mapping via smbmap.

CLI deps: smbmap (installed on Kali)

Maps out SMB shares with access levels (READ/WRITE/NO ACCESS).
Supports null session, authenticated, and pass-the-hash.
"""

import json
import re
import time

from base_module import TacticalModule


class SMBMapper(TacticalModule):
    name = "smb_mapper"
    description = "SMB share access mapping via smbmap"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True,
            help="Target SMB server IP",
        )
        self.parser.add_argument(
            "--username", default="",
            help="Username (empty for null session)",
        )
        self.parser.add_argument(
            "--password", default="",
            help="Password",
        )
        self.parser.add_argument(
            "--hash",
            help="NTLM hash (LM:NT format) for pass-the-hash",
        )
        self.parser.add_argument(
            "--domain",
            help="Domain name",
        )
        self.parser.add_argument(
            "--recurse", action="store_true",
            help="Recursively list share contents",
        )
        self.parser.add_argument(
            "--depth", type=int, default=2,
            help="Recursion depth (default: 2)",
        )

    def run(self, args) -> None:
        if args.hash and not self.validate_hash(args.hash):
            self.output_error(f"Invalid NTLM hash format: {args.hash}")
            return

        sm_args = ["-H", args.host]

        if args.username:
            sm_args.extend(["-u", args.username])
        if args.password:
            sm_args.extend(["-p", args.password])
        if args.hash:
            sm_args.extend(["-p", args.hash])  # smbmap uses -p for hash too
        if args.domain:
            sm_args.extend(["-d", args.domain])
        if args.recurse:
            sm_args.extend(["-r", "--depth", str(args.depth)])

        sm_args.append("--no-banner")

        start = time.monotonic()
        result = self.run_tool("smbmap", sm_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        shares = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "host": args.host,
            "shares": shares,
            "share_count": len(shares),
            "writable": [s for s in shares if s.get("access") == "READ, WRITE"],
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse smbmap output for share access levels."""
        shares: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            if not line or "----" in line or "Disk" not in line:
                continue
            # Format: SHARENAME    Disk    READ, WRITE    Comment
            match = re.match(r"(\S+)\s+Disk\s+(READ.*?|NO ACCESS)\s*(.*)", line)
            if match:
                shares.append({
                    "name": match.group(1),
                    "type": "Disk",
                    "access": match.group(2).strip(),
                    "comment": match.group(3).strip(),
                })
        return shares


if __name__ == "__main__":
    SMBMapper().execute()
