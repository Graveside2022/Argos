#!/bin/bash
# Argos System Hardening Script
# Applies OS-level security controls per NIST SP 800-53
set -euo pipefail

echo "[security] Starting system hardening..."

# 1. Restrict /tmp with noexec (prevents code execution from /tmp)
echo "[security] Checking /tmp mount options..."
if ! mount | grep -q "/tmp.*noexec"; then
    echo "[security] Remounting /tmp with noexec,nosuid,nodev..."
    mount -o remount,noexec,nosuid,nodev /tmp 2>/dev/null || \
        echo "[security] WARNING: Could not remount /tmp (may be on root partition)"
fi

# 2. Disable core dumps (prevents sensitive data in crash files)
echo "[security] Disabling core dumps..."
echo "* hard core 0" > /etc/security/limits.d/argos-no-coredump.conf
echo "kernel.core_pattern=|/bin/false" > /etc/sysctl.d/99-argos-no-coredump.conf
sysctl -p /etc/sysctl.d/99-argos-no-coredump.conf 2>/dev/null || true

# 3. Restrict dmesg access (prevents kernel info leaks)
echo "[security] Restricting dmesg access..."
echo "kernel.dmesg_restrict=1" > /etc/sysctl.d/99-argos-dmesg.conf
sysctl -p /etc/sysctl.d/99-argos-dmesg.conf 2>/dev/null || true

# 4. Harden SSH configuration
echo "[security] Hardening SSH configuration..."
if [ -f /etc/ssh/sshd_config ]; then
    # Create backup
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)

    # Apply hardening (idempotent)
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
    sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
    sed -i 's/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
    sed -i 's/^#\?MaxAuthTries.*/MaxAuthTries 3/' /etc/ssh/sshd_config

    echo "[security] SSH hardened (PermitRootLogin=no, MaxAuthTries=3, X11Forwarding=no)"
fi

# 5. Set restrictive file permissions on sensitive files
echo "[security] Setting file permissions..."
chmod 600 /home/kali/Documents/Argos/Argos/.env 2>/dev/null || true
chmod 700 /home/kali/Documents/Argos/Argos/scripts/security/ 2>/dev/null || true

echo "[security] System hardening complete"
