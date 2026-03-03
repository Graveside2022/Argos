#!/usr/bin/env python3
"""
web_fuzzer — Web application fuzzing via wfuzz.

CLI deps: wfuzz (installed on Kali)

Fuzzes URL parameters, headers, POST data, and paths to discover
hidden content, parameter manipulation, and anomalous responses.
"""

import json
import re
import time

from base_module import TacticalModule


class WebFuzzer(TacticalModule):
    name = "web_fuzzer"
    description = "Web application fuzzing via wfuzz"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--url", required=True,
            help="Target URL with FUZZ keyword (e.g., http://target/FUZZ)",
        )
        self.parser.add_argument(
            "--wordlist",
            default="/usr/share/wordlists/dirb/common.txt",
            help="Wordlist for fuzzing",
        )
        self.parser.add_argument(
            "--filter-code",
            help="Hide responses with these status codes (e.g., '404,403')",
        )
        self.parser.add_argument(
            "--filter-size",
            help="Hide responses with these sizes (e.g., '0,1234')",
        )
        self.parser.add_argument(
            "--header",
            action="append",
            help="Custom header (repeatable, e.g., 'Cookie: session=abc')",
        )
        self.parser.add_argument(
            "--method", default="GET",
            help="HTTP method (default: GET)",
        )
        self.parser.add_argument(
            "--post-data",
            help="POST data with FUZZ keyword",
        )

    def run(self, args) -> None:
        if "FUZZ" not in args.url and not args.post_data:
            self.output_error("URL or --post-data must contain FUZZ keyword")
            return

        wf_args = [
            "-u", args.url,
            "-w", args.wordlist,
            "-f", "/dev/stdout,json",  # JSON output
            "--no-cache",
        ]

        if args.filter_code:
            wf_args.extend(["--hc", args.filter_code])
        if args.filter_size:
            wf_args.extend(["--hs", args.filter_size])
        if args.header:
            for h in args.header:
                wf_args.extend(["-H", h])
        if args.method != "GET":
            wf_args.extend(["-X", args.method])
        if args.post_data:
            wf_args.extend(["-d", args.post_data])

        start = time.monotonic()
        result = self.run_tool("wfuzz", wf_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        results = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "url": args.url,
            "wordlist": args.wordlist,
            "results": results,
            "hit_count": len(results),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse wfuzz JSON output."""
        results: list[dict] = []
        for line in output.strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                results.append({
                    "payload": data.get("payload", ""),
                    "status_code": data.get("code", 0),
                    "content_length": data.get("chars", 0),
                    "words": data.get("words", 0),
                    "lines": data.get("lines", 0),
                    "url": data.get("url", ""),
                })
            except json.JSONDecodeError:
                continue
        return results


if __name__ == "__main__":
    WebFuzzer().execute()
