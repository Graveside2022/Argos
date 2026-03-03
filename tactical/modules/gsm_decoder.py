#!/usr/bin/env python3
"""
GSM Decoder Module — decode GSM bursts via grgsm_decode.

Wraps grgsm_decode to process captured .cfile IQ recordings and extract
GSM layer-2/layer-3 frames from the specified timeslot and channel mode.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule


# Frame type patterns emitted by grgsm_decode / wireshark-compatible output
_FRAME_RE = re.compile(
    r"(?P<timestamp>\d+\.\d+)\s+"
    r"(?P<arfcn>\d+)\s+"
    r"(?P<timeslot>\d+)\s+"
    r"(?P<frame_nr>\d+)\s+"
    r"(?P<msg_type>[A-Z_]+)\s+"
    r"(?P<data>[0-9a-fA-F ]+)",
    re.IGNORECASE,
)

# Simpler hex-line fallback (grgsm_decode -m dump output)
_HEX_FRAME_RE = re.compile(r"^([0-9a-fA-F]{2}(?:\s+[0-9a-fA-F]{2})+)", re.MULTILINE)

# GSMTAP message type names
_MSG_TYPE_MAP: dict[str, str] = {
    "BCCH": "Broadcast Control Channel",
    "SDCCH": "Standalone Dedicated Control Channel",
    "TCH_F": "Traffic Channel Full-rate",
    "TCH_H": "Traffic Channel Half-rate",
    "CCCH": "Common Control Channel",
    "SACCH": "Slow Associated Control Channel",
    "UNKNOWN": "Unknown",
}


class GsmDecoder(TacticalModule):
    """Decode GSM bursts from a captured .cfile using grgsm_decode."""

    name = "gsm_decoder"
    description = "Decode GSM layer-2/3 frames from a captured IQ cfile via grgsm_decode."

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--input-file",
            required=True,
            dest="input_file",
            help="Path to captured .cfile (complex float32 IQ samples).",
        )
        self.parser.add_argument(
            "--timeslot",
            type=int,
            default=0,
            help="GSM timeslot to decode (0–7, default: 0).",
        )
        self.parser.add_argument(
            "--subslot",
            type=int,
            default=None,
            help="SDCCH subslot (0–7, optional).",
        )
        self.parser.add_argument(
            "--burst-type",
            choices=["normal", "access"],
            default="normal",
            dest="burst_type",
            help="Burst type to decode (default: normal).",
        )
        self.parser.add_argument(
            "--mode",
            choices=["BCCH", "SDCCH", "TCH"],
            default="BCCH",
            help="Channel mode to decode (default: BCCH).",
        )
        self.parser.add_argument(
            "--sample-rate",
            type=float,
            default=2e6,
            dest="sample_rate",
            help="Sample rate of the cfile in Hz (default: 2000000).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate input file and argument ranges."""
        if not Path(args.input_file).exists():
            self.output_error(
                f"Input file not found: {args.input_file}",
                {"path": args.input_file},
            )
        if not args.input_file.endswith((".cfile", ".iq", ".bin", ".raw")):
            self.logger.warning(
                "Input file extension not .cfile — grgsm_decode may reject it."
            )
        if not 0 <= args.timeslot <= 7:
            self.output_error(
                "Timeslot must be 0–7.",
                {"timeslot": args.timeslot},
            )
        if args.subslot is not None and not 0 <= args.subslot <= 7:
            self.output_error(
                "Subslot must be 0–7.",
                {"subslot": args.subslot},
            )

    def _build_args(self, args: argparse.Namespace) -> list[str]:
        """Construct grgsm_decode argument list."""
        cmd: list[str] = [
            "-i", args.input_file,
            "-t", str(args.timeslot),
            "-m", args.mode,
            "-s", str(int(args.sample_rate)),
        ]
        if args.subslot is not None:
            cmd += ["--subslot", str(args.subslot)]
        if args.burst_type == "access":
            cmd.append("--ab")
        return cmd

    def _parse_frames(self, stdout: str, stderr: str) -> list[dict[str, Any]]:
        """Extract decoded frames from grgsm_decode output."""
        frames: list[dict[str, Any]] = []

        # Try structured match first
        for match in _FRAME_RE.finditer(stdout + "\n" + stderr):
            frames.append(
                {
                    "timestamp": float(match.group("timestamp")),
                    "arfcn": int(match.group("arfcn")),
                    "timeslot": int(match.group("timeslot")),
                    "frame_number": int(match.group("frame_nr")),
                    "message_type": match.group("msg_type"),
                    "channel_type": _MSG_TYPE_MAP.get(
                        match.group("msg_type"), "Unknown"
                    ),
                    "hex_data": match.group("data").strip(),
                }
            )

        # Fallback: collect raw hex lines
        if not frames:
            for match in _HEX_FRAME_RE.finditer(stdout + "\n" + stderr):
                hex_data = match.group(1).replace(" ", "")
                if len(hex_data) >= 4:
                    frames.append(
                        {
                            "timestamp": None,
                            "arfcn": None,
                            "timeslot": None,
                            "frame_number": None,
                            "message_type": "RAW",
                            "channel_type": "Raw burst",
                            "hex_data": hex_data,
                        }
                    )

        return frames

    def _count_message_types(
        self, frames: list[dict[str, Any]]
    ) -> dict[str, int]:
        """Tally frame counts by message_type."""
        counts: dict[str, int] = {}
        for frame in frames:
            msg_type = frame.get("message_type", "UNKNOWN")
            counts[msg_type] = counts.get(msg_type, 0) + 1
        return counts

    def run(self, args: argparse.Namespace) -> None:
        """Execute grgsm_decode and parse output frames."""
        self._validate_args(args)
        cmd_args = self._build_args(args)

        self.logger.info(
            "Decoding GSM %s timeslot %d from %s",
            args.mode,
            args.timeslot,
            args.input_file,
        )

        result = self.run_tool(
            "grgsm_decode",
            cmd_args,
            timeout=args.timeout,
        )

        frames = self._parse_frames(result.stdout, result.stderr)
        type_counts = self._count_message_types(frames)

        if result.returncode != 0 and not frames:
            self.output_error(
                "grgsm_decode failed with no output.",
                {
                    "return_code": result.returncode,
                    "stderr": result.stderr[-500:],
                },
            )

        self.output_success(
            {
                "input_file": args.input_file,
                "mode": args.mode,
                "timeslot": args.timeslot,
                "subslot": args.subslot,
                "burst_type": args.burst_type,
                "frames_decoded": len(frames),
                "message_type_counts": type_counts,
                "frames": frames[:200],  # cap output to 200 frames
                "truncated": len(frames) > 200,
                "return_code": result.returncode,
            }
        )


if __name__ == "__main__":
    GsmDecoder().execute()
