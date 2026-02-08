#!/bin/bash
# Argos OS-Level Firewall Hardening
# Restricts inbound traffic to essential service ports only
set -euo pipefail

echo "[security] Configuring iptables firewall rules..."

# Flush existing rules
iptables -F
iptables -X

# Default policies: drop all inbound, allow outbound
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# SSH (port 22) — required for remote management
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Argos web interface (port 5173)
iptables -A INPUT -p tcp --dport 5173 -j ACCEPT

# Kismet (port 2501) — WiFi scanner
iptables -A INPUT -p tcp --dport 2501 -j ACCEPT

# HackRF API (port 8092) — spectrum analyzer
iptables -A INPUT -p tcp --dport 8092 -j ACCEPT

# OpenWebRX (port 8073) — SDR web interface
iptables -A INPUT -p tcp --dport 8073 -j ACCEPT

# Tailscale (UDP 41641) — VPN overlay
iptables -A INPUT -p udp --dport 41641 -j ACCEPT

# Allow ICMP ping (useful for network diagnostics)
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT

# Log and drop everything else
iptables -A INPUT -j LOG --log-prefix "[ARGOS_DROPPED] " --log-level 4
iptables -A INPUT -j DROP

echo "[security] iptables rules applied successfully"
echo "[security] Active rules:"
iptables -L -n --line-numbers
