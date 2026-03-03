#!/usr/bin/env python3
"""
impacket_ldap — LDAP/AD queries via Impacket scripts.

CLI deps: impacket-GetADUsers, impacket-GetADComputers, impacket-findDelegation,
          impacket-dacledit, impacket-owneredit, impacket-rbcd
"""

import json
import time

from base_module import TacticalModule

SCRIPTS = {
    "GetADUsers": {"binary": "impacket-GetADUsers", "desc": "Enumerate AD users"},
    "GetADComputers": {"binary": "impacket-GetADComputers", "desc": "Enumerate AD computers"},
    "findDelegation": {"binary": "impacket-findDelegation", "desc": "Find delegation settings"},
    "dacledit": {"binary": "impacket-dacledit", "desc": "Edit DACLs"},
    "owneredit": {"binary": "impacket-owneredit", "desc": "Edit object owner"},
    "rbcd": {"binary": "impacket-rbcd", "desc": "Resource-based constrained delegation"},
}


class ImpacketLDAP(TacticalModule):
    name = "impacket_ldap"
    description = "LDAP/AD queries via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="LDAP script")
        self.parser.add_argument("--target", required=True, help="Target (DOMAIN/user:pass)")
        self.parser.add_argument("--dc-ip", help="Domain controller IP")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--all", action="store_true", help="Show all results")
        self.parser.add_argument("--extra-args", help="Additional args (space-separated)")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]
        tool_args = [args.target]

        if args.dc_ip:
            tool_args.extend(["-dc-ip", args.dc_ip])
        if args.hash:
            tool_args.extend(["-hashes", args.hash])
        if args.all:
            tool_args.append("-all")
        if args.extra_args:
            tool_args.extend(args.extra_args.split())

        start = time.monotonic()
        result = self.run_tool(script["binary"], tool_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        entries = [l.strip() for l in result.stdout.split("\n") if l.strip() and not l.startswith("Impacket")]

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target,
            "entries": entries[:200], "entry_count": len(entries),
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    ImpacketLDAP().execute()
