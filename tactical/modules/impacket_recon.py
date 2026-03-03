#!/usr/bin/env python3
"""
impacket_recon — Network/host reconnaissance via Impacket scripts.

CLI deps: impacket-rpcdump, impacket-rpcmap, impacket-samrdump,
          impacket-lookupsid, impacket-DumpNTLMInfo, impacket-getArch

Dispatches Impacket recon scripts via --script selector.
"""

import json
import re
import time

from base_module import TacticalModule

SCRIPTS = {
    "rpcdump": {"binary": "impacket-rpcdump", "desc": "Dump RPC endpoints"},
    "rpcmap": {"binary": "impacket-rpcmap", "desc": "Map RPC interfaces"},
    "samrdump": {"binary": "impacket-samrdump", "desc": "Dump SAM via SAMR"},
    "lookupsid": {"binary": "impacket-lookupsid", "desc": "SID brute-force enumeration"},
    "ntlminfo": {"binary": "impacket-DumpNTLMInfo", "desc": "Dump NTLM info from target"},
    "getarch": {"binary": "impacket-getArch", "desc": "Detect target architecture"},
}


class ImpacketRecon(TacticalModule):
    name = "impacket_recon"
    description = "Network/host reconnaissance via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="Impacket recon script to run")
        self.parser.add_argument("--target", required=True, help="Target (IP, DOMAIN/user:pass@IP)")
        self.parser.add_argument("--port", type=int, help="Target port override")
        self.parser.add_argument("--username", help="Username")
        self.parser.add_argument("--password", help="Password")
        self.parser.add_argument("--domain", help="Domain")
        self.parser.add_argument("--hash", help="NTLM hash")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]
        binary = script["binary"]

        tool_args = self._build_args(args)

        start = time.monotonic()
        result = self.run_tool(binary, tool_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        parsed = self._parse_generic(result.stdout)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target,
            "results": parsed, "result_count": len(parsed),
            "duration_ms": duration_ms,
        })

    def _build_args(self, args) -> list[str]:
        tool_args: list[str] = []
        if args.username and args.password:
            target_str = f"{args.domain or '.'}/{args.username}:{args.password}@{args.target}"
        elif args.username and args.hash:
            target_str = f"{args.domain or '.'}/{args.username}@{args.target}"
            tool_args.extend(["-hashes", args.hash])
        else:
            target_str = args.target

        tool_args.append(target_str)
        if args.port:
            tool_args.extend(["-port", str(args.port)])
        return tool_args

    @staticmethod
    def _parse_generic(output: str) -> list[dict]:
        results: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            if line and not line.startswith("Impacket"):
                results.append({"info": line[:300]})
        return results[:200]


if __name__ == "__main__":
    ImpacketRecon().execute()
