#!/usr/bin/env python3
"""
impacket_kerberos — Kerberos operations via Impacket scripts.

CLI deps: impacket-getTGT, impacket-getST, impacket-GetNPUsers,
          impacket-GetUserSPNs, impacket-ticketer, impacket-ticketConverter
"""

import json
import time

from base_module import TacticalModule

SCRIPTS = {
    "getTGT": {"binary": "impacket-getTGT", "desc": "Request TGT"},
    "getST": {"binary": "impacket-getST", "desc": "Request service ticket"},
    "GetNPUsers": {"binary": "impacket-GetNPUsers", "desc": "AS-REP roasting"},
    "GetUserSPNs": {"binary": "impacket-GetUserSPNs", "desc": "Kerberoasting"},
    "ticketer": {"binary": "impacket-ticketer", "desc": "Create golden/silver ticket"},
    "ticketConverter": {"binary": "impacket-ticketConverter", "desc": "Convert ticket format"},
}


class ImpacketKerberos(TacticalModule):
    name = "impacket_kerberos"
    description = "Kerberos operations via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="Kerberos script")
        self.parser.add_argument("--target", required=True, help="Target (DOMAIN/user or DOMAIN/user:pass)")
        self.parser.add_argument("--dc-ip", help="Domain controller IP")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--no-pass", action="store_true", help="No password (AS-REP)")
        self.parser.add_argument("--request", action="store_true", help="Request hashes")
        self.parser.add_argument("--spn", help="Service Principal Name")
        self.parser.add_argument("--impersonate", help="User to impersonate")
        self.parser.add_argument("--domain-sid", help="Domain SID")
        self.parser.add_argument("--nthash", help="NT hash (ticketer)")
        self.parser.add_argument("--extra-args", help="Additional args (space-separated)")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]
        tool_args = [args.target]

        if args.dc_ip:
            tool_args.extend(["-dc-ip", args.dc_ip])
        if args.hash:
            tool_args.extend(["-hashes", args.hash])
        if args.no_pass:
            tool_args.append("-no-pass")
        if args.request:
            tool_args.append("-request")
        if args.spn:
            tool_args.extend(["-spn", args.spn])
        if args.impersonate:
            tool_args.extend(["-impersonate", args.impersonate])
        if args.domain_sid:
            tool_args.extend(["-domain-sid", args.domain_sid])
        if args.nthash:
            tool_args.extend(["-nthash", args.nthash])
        if args.extra_args:
            tool_args.extend(args.extra_args.split())

        start = time.monotonic()
        result = self.run_tool(script["binary"], tool_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        hashes = [l.strip() for l in result.stdout.split("\n") if l.strip().startswith("$krb5")]

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target,
            "hashes": hashes, "hash_count": len(hashes),
            "output": result.stdout[:5000], "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    ImpacketKerberos().execute()
