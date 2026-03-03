#!/usr/bin/env python3
"""
web_bruter — Web path/directory enumeration.

Source: Adapted from Artemis bruter.py (CERT-Polska/Artemis).
CLI deps: gobuster or ffuf (installed on Kali), fallback to pure Python requests.
Karton dependency removed, base_module.py used instead.

Brute-forces web paths to discover hidden directories and files.
"""

import json
import re
import time

from base_module import TacticalModule


class WebBruter(TacticalModule):
    name = "web_bruter"
    description = "Web path/directory enumeration (Artemis-adapted, gobuster/ffuf/python)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Base URL to scan (e.g., http://192.168.1.1)",
        )
        self.parser.add_argument(
            "--wordlist",
            default="/usr/share/wordlists/dirb/common.txt",
            help="Wordlist file path (default: /usr/share/wordlists/dirb/common.txt)",
        )
        self.parser.add_argument(
            "--extensions",
            default="",
            help="File extensions to try, comma-separated (e.g., php,html,txt)",
        )
        self.parser.add_argument(
            "--tool",
            choices=["gobuster", "ffuf", "python"],
            default="gobuster",
            help="Tool to use (default: gobuster)",
        )
        self.parser.add_argument(
            "--threads",
            type=int, default=10,
            help="Number of threads (default: 10)",
        )
        self.parser.add_argument(
            "--status-codes",
            default="200,204,301,302,307,401,403",
            help="Status codes to report (default: 200,204,301,302,307,401,403)",
        )

    def run(self, args) -> None:
        target = args.target.rstrip("/")
        if not target.startswith(("http://", "https://")):
            target = f"http://{target}"

        start = time.monotonic()

        if args.tool == "gobuster":
            found_paths = self._run_gobuster(target, args)
        elif args.tool == "ffuf":
            found_paths = self._run_ffuf(target, args)
        else:
            found_paths = self._run_python(target, args)

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )

        self.output_success({
            "target": target,
            "tool": args.tool,
            "wordlist": args.wordlist,
            "found_paths": found_paths,
            "total_found": len(found_paths),
            "duration_ms": duration_ms,
        })

    def _run_gobuster(self, target: str, args) -> list[dict]:
        """Run gobuster for directory enumeration."""
        gobuster_args = [
            "dir",
            "-u", target,
            "-w", args.wordlist,
            "-t", str(args.threads),
            "-s", args.status_codes,
            "--no-color",
            "-q",  # Quiet mode (no banner)
        ]

        if args.extensions:
            gobuster_args.extend(["-x", args.extensions])

        result = self.run_tool("gobuster", gobuster_args, timeout=args.timeout)

        if result.returncode != 0 and not result.stdout:
            self.logger.warning("gobuster error: %s", result.stderr[:500])
            return []

        return self._parse_gobuster_output(result.stdout)

    def _run_ffuf(self, target: str, args) -> list[dict]:
        """Run ffuf for web fuzzing."""
        ffuf_args = [
            "-u", f"{target}/FUZZ",
            "-w", args.wordlist,
            "-t", str(args.threads),
            "-mc", args.status_codes,
            "-o", "/dev/stdout",
            "-of", "json",
            "-s",  # Silent mode
        ]

        if args.extensions:
            ffuf_args.extend(["-e", f".{args.extensions.replace(',', ',.')}"])

        result = self.run_tool("ffuf", ffuf_args, timeout=args.timeout)

        if result.returncode != 0 and not result.stdout:
            self.logger.warning("ffuf error: %s", result.stderr[:500])
            return []

        return self._parse_ffuf_output(result.stdout)

    def _run_python(self, target: str, args) -> list[dict]:
        """Pure Python fallback using requests."""
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

        from pathlib import Path

        wordlist_path = Path(args.wordlist)
        if not wordlist_path.exists():
            self.logger.error("Wordlist not found: %s", args.wordlist)
            return []

        words = wordlist_path.read_text().strip().split("\n")
        words = [w.strip() for w in words if w.strip() and not w.startswith("#")]

        valid_codes = set(int(c) for c in args.status_codes.split(","))
        found: list[dict] = []

        extensions = [""] + [f".{e}" for e in args.extensions.split(",") if e]

        for word in words:
            for ext in extensions:
                url = f"{target}/{word}{ext}"
                try:
                    resp = requests.get(url, timeout=5, verify=False, allow_redirects=False)
                    if resp.status_code in valid_codes:
                        found.append({
                            "url": url,
                            "status_code": resp.status_code,
                            "size": len(resp.content),
                        })
                except requests.RequestException:
                    continue

        return found

    @staticmethod
    def _parse_gobuster_output(stdout: str) -> list[dict]:
        """Parse gobuster directory mode output."""
        found = []
        for line in stdout.split("\n"):
            # gobuster format: /path (Status: 200) [Size: 1234]
            match = re.match(
                r"(/\S*)\s+\(Status:\s*(\d+)\)\s*\[Size:\s*(\d+)\]",
                line.strip(),
            )
            if match:
                found.append({
                    "url": match.group(1),
                    "status_code": int(match.group(2)),
                    "size": int(match.group(3)),
                })
        return found

    @staticmethod
    def _parse_ffuf_output(stdout: str) -> list[dict]:
        """Parse ffuf JSON output."""
        found = []
        try:
            data = json.loads(stdout)
            for result in data.get("results", []):
                found.append({
                    "url": result.get("url", ""),
                    "status_code": result.get("status", 0),
                    "size": result.get("length", 0),
                })
        except json.JSONDecodeError:
            pass
        return found


if __name__ == "__main__":
    WebBruter().execute()
