#!/bin/bash
# Dedicated script to spawn a terminal tab that immediately tails the system logs

echo -e "\033[1;36m[ARGOS]\033[0m Tailing /tmp/argos-dev.log..."
if [ -f /tmp/argos-dev.log ]; then
  tail -f /tmp/argos-dev.log
else
  echo -e "\033[1;31m[ERROR]\033[0m Log file /tmp/argos-dev.log does not exist."
  # Keep window open so user can see the error
  sleep 86400
fi
