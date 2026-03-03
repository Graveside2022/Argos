#!/usr/bin/env python3
"""
impacket_smb — SMB/service operations via Impacket scripts.

CLI deps: impacket-smbclient, impacket-smbserver, impacket-services, impacket-reg
"""

import json
import time

from base_module import TacticalModule

SCRIPTS = {
    "smbclient": {"binary": "impacket-smbclient", "desc": "Interactive SMB client"},
    "smbserver": {"binary": "impacket-smbserver", "desc": "SMB file share server"},
    "services": {"binary": "impacket-services", "desc": "Remote service management"},
    "reg": {"binary": "impacket-reg", "desc": "Remote registry access"},
}


class ImpacketSMB(TacticalModule):
    name = "impacket_smb"
    description = "SMB/service operations via Impacket scripts"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--script", required=True, choices=list(SCRIPTS.keys()),
                                 help="SMB script")
        self.parser.add_argument("--target", required=True, help="Target (DOMAIN/user:pass@IP or share config)")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--command", help="Command/action to execute")
        self.parser.add_argument("--share-name", help="Share name (for smbserver)")
        self.parser.add_argument("--share-path", help="Local path to share (for smbserver)")
        self.parser.add_argument("--extra-args", help="Additional args (space-separated)")

    def run(self, args) -> None:
        script = SCRIPTS[args.script]

        if args.script == "smbserver":
            tool_args = [args.share_name or "share", args.share_path or "/tmp"]
        else:
            tool_args = [args.target]

        if args.hash:
            tool_args.extend(["-hashes", args.hash])
        if args.command and args.script in ("services", "reg"):
            tool_args.append(args.command)
        if args.extra_args:
            tool_args.extend(args.extra_args.split())

        start = time.monotonic()

        if args.script == "smbserver":
            stdout, stderr = self.run_tool_popen(script["binary"], tool_args, duration=60)
            result_stdout = stdout
            result_stderr = stderr
            returncode = 0
        else:
            result = self.run_tool(script["binary"], tool_args, timeout=args.timeout)
            result_stdout = result.stdout
            result_stderr = result.stderr
            returncode = result.returncode

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     returncode, result_stdout[:5000], result_stderr[:5000], duration_ms)
        self.output_success({
            "script": args.script, "target": args.target,
            "output": result_stdout[:5000], "exit_code": returncode,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    ImpacketSMB().execute()
