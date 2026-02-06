#!/bin/bash
# MCP Server launcher — works inside Docker (/app) and on host
# Claude Code spawns this via mcp.json; it finds the correct path automatically

if [ -f "/app/src/lib/server/mcp/dynamic-server.ts" ]; then
  cd /app
  exec npx tsx /app/src/lib/server/mcp/dynamic-server.ts
elif [ -f "/home/kali/Documents/Argos/Argos/src/lib/server/mcp/dynamic-server.ts" ]; then
  cd /home/kali/Documents/Argos/Argos
  exec npx tsx /home/kali/Documents/Argos/Argos/src/lib/server/mcp/dynamic-server.ts
else
  echo "Error: Cannot find Argos MCP server" >&2
  exit 1
fi
