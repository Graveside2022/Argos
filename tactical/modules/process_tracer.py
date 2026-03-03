#!/usr/bin/env python3
"""
Process Tracer Module — system call tracing via strace.

Attaches to a running process (by PID) or spawns a new command under
strace to capture syscall activity. Parses the strace output into a
structured syscall summary, optionally filtered by category.

Syscall filter categories:
  network  — connect, accept, bind, socket, send, recv, ...
  file     — open, openat, read, write, unlink, mkdir, stat, ...
  process  — fork, clone, execve, exit, wait, kill, ...
"""

import argparse
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# strace summary line: "%  calls  errors  total_us  avg_us  max_us  syscall"
_SUMMARY_RE = re.compile(
    r"^\s*(?P<pct>[\d.]+)\s+"
    r"(?P<calls>\d+)\s+"
    r"(?P<errors>\d+)\s+"
    r"(?P<total_us>\d+)\s+"
    r"(?P<avg_us>\d+)\s+"
    r"(?P<max_us>\d+)\s+"
    r"(?P<syscall>\w+)\s*$"
)

# strace call line (for counting outside summary): "syscall(args) = retval"
_CALL_RE = re.compile(r"^(\w+)\(")

_FILTER_CATEGORIES: dict[str, list[str]] = {
    "network": [
        "socket", "connect", "bind", "listen", "accept", "accept4",
        "send", "sendto", "sendmsg", "recv", "recvfrom", "recvmsg",
        "getsockname", "getpeername", "setsockopt", "getsockopt",
        "shutdown", "socketpair",
    ],
    "file": [
        "open", "openat", "creat", "read", "write", "pread64", "pwrite64",
        "close", "stat", "fstat", "lstat", "lseek", "mmap", "munmap",
        "unlink", "unlinkat", "mkdir", "mkdirat", "rmdir", "rename",
        "renameat", "link", "symlink", "readlink", "access", "faccessat",
        "chmod", "chown", "fchmod", "fchown", "getcwd", "chdir",
    ],
    "process": [
        "fork", "vfork", "clone", "execve", "execveat", "exit", "exit_group",
        "wait4", "waitpid", "kill", "tkill", "tgkill", "getpid", "getppid",
        "getuid", "geteuid", "getgid", "getegid", "setuid", "setgid",
        "prctl", "ptrace", "sigaction", "sigprocmask",
    ],
}


class ProcessTracer(TacticalModule):
    """System call tracer using strace with category filtering and summary parsing."""

    name = "process_tracer"
    description = (
        "Trace system calls of a running process (PID) or command via strace. "
        "Returns a structured syscall summary filtered by category."
    )

    def _add_module_args(self) -> None:
        group = self.parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            "--pid",
            type=int,
            help="Attach strace to an already-running process by PID.",
        )
        group.add_argument(
            "--command",
            help="Spawn this command under strace (e.g. 'ls -la /tmp').",
        )
        self.parser.add_argument(
            "--duration",
            type=int,
            default=10,
            help="Capture duration in seconds (default: 10).",
        )
        self.parser.add_argument(
            "--filter",
            default="",
            help=(
                "Comma-separated filter categories: network, file, process. "
                "Empty = capture all."
            ),
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            dest="output_file",
            help="Save raw strace output to this file (optional).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate PID range and filter category names."""
        if args.pid is not None and not (1 <= args.pid <= 4_194_304):
            self.output_error(
                "PID out of valid range [1, 4194304].",
                {"pid": args.pid},
            )
        if args.filter:
            categories = [c.strip() for c in args.filter.split(",") if c.strip()]
            unknown = [c for c in categories if c not in _FILTER_CATEGORIES]
            if unknown:
                self.output_error(
                    f"Unknown filter categories: {unknown}. "
                    f"Valid: {list(_FILTER_CATEGORIES.keys())}",
                    {"unknown_categories": unknown},
                )

    def _build_strace_args(self, args: argparse.Namespace) -> list[str]:
        """Construct strace argument list."""
        strace_args = [
            "-c",          # count calls and print summary on exit
            "-f",          # follow child processes
            "-T",          # show time spent in each syscall
        ]

        # Apply syscall filter if categories specified
        if args.filter:
            categories = [c.strip() for c in args.filter.split(",") if c.strip()]
            syscalls: list[str] = []
            for cat in categories:
                syscalls.extend(_FILTER_CATEGORIES.get(cat, []))
            if syscalls:
                strace_args += ["-e", "trace=" + ",".join(sorted(set(syscalls)))]

        if args.pid:
            strace_args += ["-p", str(args.pid)]
        else:
            # Command mode: split shell command into tokens
            import shlex
            strace_args += shlex.split(args.command)

        return strace_args

    def _parse_summary(self, stderr: str) -> list[dict[str, Any]]:
        """Parse strace -c summary table from stderr."""
        syscalls: list[dict[str, Any]] = []
        in_table = False

        for line in stderr.splitlines():
            if "% time" in line or "syscall" in line.lower():
                in_table = True
                continue
            if in_table and line.startswith("---"):
                continue
            if not in_table:
                continue
            match = _SUMMARY_RE.match(line)
            if match:
                syscalls.append(
                    {
                        "syscall": match.group("syscall"),
                        "calls": int(match.group("calls")),
                        "errors": int(match.group("errors")),
                        "total_us": int(match.group("total_us")),
                        "avg_us": int(match.group("avg_us")),
                        "max_us": int(match.group("max_us")),
                        "pct_time": float(match.group("pct")),
                    }
                )
        return sorted(syscalls, key=lambda s: s["calls"], reverse=True)

    def _categorize(
        self, syscalls: list[dict[str, Any]]
    ) -> dict[str, list[str]]:
        """Group observed syscall names by filter category."""
        observed = {s["syscall"] for s in syscalls}
        result: dict[str, list[str]] = {}
        for cat, names in _FILTER_CATEGORIES.items():
            matched = sorted(observed & set(names))
            if matched:
                result[cat] = matched
        return result

    def run(self, args: argparse.Namespace) -> None:
        """Execute strace and return structured syscall summary."""
        self._validate_args(args)
        strace_args = self._build_strace_args(args)

        target = f"PID {args.pid}" if args.pid else f"command: {args.command}"
        self.logger.info(
            "Tracing %s for %ds (filter: %s)",
            target,
            args.duration,
            args.filter or "all",
        )

        stdout, stderr = self.run_tool_popen(
            "strace",
            strace_args,
            duration=args.duration,
        )

        combined = stdout + "\n" + stderr

        if args.output_file:
            out_path = Path(args.output_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(combined)
            self.logger.info("Raw trace saved to %s", args.output_file)

        syscall_summary = self._parse_summary(stderr)
        category_map = self._categorize(syscall_summary)

        total_calls = sum(s["calls"] for s in syscall_summary)
        total_errors = sum(s["errors"] for s in syscall_summary)

        self.output_success(
            {
                "target": target,
                "duration_sec": args.duration,
                "filter": args.filter or "all",
                "total_calls": total_calls,
                "total_errors": total_errors,
                "unique_syscalls": len(syscall_summary),
                "syscall_summary": syscall_summary,
                "categories_observed": category_map,
                "output_file": args.output_file or None,
            }
        )


if __name__ == "__main__":
    ProcessTracer().execute()
