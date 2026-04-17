#!/usr/bin/env bash
# Seed a placeholder trunk-recorder preset for smoke testing at Fort Irwin.
# Uses a made-up P25 control channel (851.0125 MHz) — decode will fail in the
# absence of a real signal, but exercises the full container + UI plumbing.
#
# Usage: ./scripts/seed-trunk-recorder-preset.sh

set -euo pipefail

: "${ARGOS_API_KEY:?ARGOS_API_KEY must be exported}"
: "${ARGOS_URL:=http://localhost:5173}"

curl -sS -X POST \
  -H "X-API-Key: ${ARGOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke test P25",
    "systemType": "p25",
    "systemLabel": "Smoke",
    "controlChannels": [851012500],
    "talkgroupsCsv": "Decimal,Mode,Description,Alpha Tag,Tag,Category,Priority\n1001,D,Smoke test TG 1001,TEST1,Test,Smoke,3\n1002,D,Smoke test TG 1002,TEST2,Test,Smoke,3\n",
    "sourceConfig": {
      "center": 856000000,
      "rate": 8000000,
      "gain": 40,
      "ifGain": 32,
      "bbGain": 16,
      "driver": "osmosdr",
      "device": "hackrf=0",
      "error": 0
    }
  }' \
  "${ARGOS_URL}/api/trunk-recorder/config" | jq .
