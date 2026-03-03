#!/usr/bin/env python3
"""
Proxy Chain Module — route a command through proxychains4.

Wraps an arbitrary command in proxychains4 to force its TCP connections
through the configured SOCKS4/SOCKS5/HTTP proxy chain. Useful for
anonymizing reconnaissance tools or routing traffic through pivot hosts
during Army EW training exercises.

Returns the wrapped command's stdout, stderr, and exit code.
"""

import argparse
import shlex
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# Default proxychains4 config locations (searched in order)
_DEFAULT_CONFIG_PATHS = [
    "/etc/proxychains4.conf",
    "/etc/proxychains.conf",
    str(Path.home() / ".proxychains" / "proxychains.conf"),
]


class ProxyChain(TacticalModule):
    """Wrap any command through proxychains4 for proxy-routed execution."""

    name = "proxy_chain"
    description = (
        "Route an arbitrary command through proxychains4. "
        "Supports custom proxychains config files."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--command",
            required=True,
            help=(
                "Command to run through proxychains (e.g. 'nmap -sT 10.0.0.1'). "
                "Quote the entire command as a single string."
            ),
        )
        self.parser.add_argument(
            "--config-file",
            default="",
            dest="config_file",
            help=(
                "Path to a proxychains4 configuration file. "
                "Auto-detects from standard locations if not provided."
            ),
        )

    def _resolve_config(self, args: argparse.Namespace) -> str:
        """Find a valid proxychains config file."""
        if args.config_file:
            if not Path(args.config_file).exists():
                self.output_error(
                    f"Proxychains config not found: {args.config_file}",
                    {"path": args.config_file},
                )
            return args.config_file

        for path in _DEFAULT_CONFIG_PATHS:
            if Path(path).exists():
                self.logger.info("Using proxychains config: %s", path)
                return path

        self.output_error(
            "No proxychains4 config file found. "
            "Provide --config-file or create /etc/proxychains4.conf.",
            {"searched": _DEFAULT_CONFIG_PATHS},
        )
        return ""  # unreachable

    def _parse_proxy_chain(self, config_path: str) -> list[dict[str, Any]]:
        """Extract configured proxy entries from the config file."""
        proxies: list[dict[str, Any]] = []
        in_proxy_list = False

        try:
            lines = Path(config_path).read_text().splitlines()
        except OSError:
            return proxies

        for line in lines:
            stripped = line.strip()
            if stripped == "[ProxyList]":
                in_proxy_list = True
                continue
            if stripped.startswith("[") and in_proxy_list:
                break
            if not in_proxy_list or not stripped or stripped.startswith("#"):
                continue
            parts = stripped.split()
            if len(parts) >= 3:
                proxy: dict[str, Any] = {
                    "type": parts[0],
                    "host": parts[1],
                    "port": int(parts[2]) if parts[2].isdigit() else parts[2],
                }
                if len(parts) >= 5:
                    proxy["username"] = parts[3]
                    # Mask password in output
                    proxy["password"] = "***"
                proxies.append(proxy)

        return proxies

    def _parse_chain_mode(self, config_path: str) -> str:
        """Extract chain mode (strict/dynamic/random/round_robin) from config."""
        try:
            text = Path(config_path).read_text()
        except OSError:
            return "unknown"
        for line in text.splitlines():
            stripped = line.strip()
            if "strict_chain" in stripped and not stripped.startswith("#"):
                return "strict"
            if "dynamic_chain" in stripped and not stripped.startswith("#"):
                return "dynamic"
            if "random_chain" in stripped and not stripped.startswith("#"):
                return "random"
            if "round_robin_chain" in stripped and not stripped.startswith("#"):
                return "round_robin"
        return "unknown"

    def run(self, args: argparse.Namespace) -> None:
        """Execute the wrapped command through proxychains4."""
        config_path = self._resolve_config(args)
        proxies = self._parse_proxy_chain(config_path)
        chain_mode = self._parse_chain_mode(config_path)

        # Build proxychains4 + user command
        try:
            user_cmd_tokens = shlex.split(args.command)
        except ValueError as exc:
            self.output_error(
                f"Failed to parse command: {exc}",
                {"command": args.command},
            )
            return

        proxychains_args = ["-f", config_path, "-q"] + user_cmd_tokens

        self.logger.info(
            "Routing [%s] through proxychains4 (%s mode, %d proxies)",
            args.command,
            chain_mode,
            len(proxies),
        )

        result = self.run_tool(
            "proxychains4",
            proxychains_args,
            timeout=args.timeout,
        )

        # Detect proxychains-specific errors
        proxy_error = False
        proxy_error_msg = ""
        if result.stderr:
            lower_err = result.stderr.lower()
            if "can't assign requested address" in lower_err:
                proxy_error = True
                proxy_error_msg = "Proxy connection refused or unreachable."
            elif "connection refused" in lower_err:
                proxy_error = True
                proxy_error_msg = "Proxy server refused connection."

        self.output_success(
            {
                "command": args.command,
                "config_file": config_path,
                "chain_mode": chain_mode,
                "proxy_count": len(proxies),
                "proxies": proxies,
                "proxy_error": proxy_error,
                "proxy_error_message": proxy_error_msg,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode,
            }
        )


if __name__ == "__main__":
    ProxyChain().execute()
