#!/usr/bin/env python3
"""
impacket_exec — Remote execution via Impacket scripts.

CLI deps: impacket-psexec, impacket-smbexec, impacket-wmiexec,
          impacket-atexec, impacket-dcomexec
"""

import json
import time

from base_module import TacticalModule

SCRIPTS = {
    "psexec": {"binary": "impacket-psexec", "desc": "PsExec-style remote exec"},
    "smbexec": {"binary": "impacket-smbexec", "desc": "SMB-based remote exec"},
    "wmiexec": {"binary": "impacket-wmiexec", "desc": "WMI-based remote exec"},
    "atexec": {"binary": "impacket-atexec", "desc": "Task scheduler remote exec"},
    "dcomexec": {"binary": "impacket-dcomexec", "desc": "DCOM-based remote exec"},
}


class ImpacketExec(TacticalModule):
    name = "impacket_exec"
    description = "Remote execution via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="Execution method")
        self.parser.add_argument("--target", required=True, help="Target (DOMAIN/user:pass@IP)")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--command", required=True, help="Command to execute")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]
        tool_args = [args.target]

        if args.hash:
            tool_args.extend(["-hashes", args.hash])
        tool_args.append(args.command)

        start = time.monotonic()
        result = self.run_tool(script["binary"], tool_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target, "command": args.command,
            "output": result.stdout[:5000], "exit_code": result.returncode,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    ImpacketExec().execute()
