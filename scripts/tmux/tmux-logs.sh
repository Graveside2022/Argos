#!/bin/bash
# Dedicated script to spawn a terminal tab that immediately tails the system logs

echo -e "\033[1;36m[ARGOS]\033[0m Tailing /tmp/argos-dev.log..."
if [ -f /tmp/argos-dev.log ]; then
  tail -f /tmp/argos-dev.log | perl -pe '
    $|=1;
    # JSON keys (words followed by colons without quotes)
    s/(\b[a-zA-Z_][a-zA-Z0-9_]*\b)(?=\s*:)/\e[1;36m$1\e[0m/g;
    # Strings (single or double quoted), ignoring ANSI
    s/("[^"]*"|'"'"'[^'"'"']*'"'"')/\e[32m$1\e[0m/g;
    # Numbers
    s/\b([0-9]+(?:\.[0-9]+)?)\b/\e[33m$1\e[0m/g;
    # Booleans
    s/\b(true|false|null)\b/\e[35m$1\e[0m/g;
    # Timestamps
    s/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\b/\e[1;36m$&\e[0m/g;
    # Bracket tags
    s/\[([A-Z0-9_]+)\]/
      if ($1 eq "ERROR") { "\e[1;31m[ERROR]\e[0m" }
      elsif ($1 eq "WARN") { "\e[1;33m[WARN]\e[0m" }
      elsif ($1 eq "INFO") { "\e[1;32m[INFO]\e[0m" }
      elsif ($1 eq "DEBUG") { "\e[1;30m[DEBUG]\e[0m" }
      else { "\e[1;35m[$1]\e[0m" }
    /ge;
  '
else
  echo -e "\033[1;31m[ERROR]\033[0m Log file /tmp/argos-dev.log does not exist."
  # Keep window open so user can see the error
  sleep 86400
fi
