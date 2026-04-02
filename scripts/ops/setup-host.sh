#!/usr/bin/env bash
# Argos Host Provisioning — Bootstrap
# Installs Node.js if missing, then launches the interactive Node.js installer.
#
# Usage: sudo bash scripts/ops/setup-host.sh [--yes] [--verbose]
#   --yes, -y       Install all components without interactive prompts
#   --verbose, -v   Show raw output from each install step
#   --version, -V   Show version
#   --help, -h      Show this help
set -euo pipefail

SETUP_VERSION="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && git describe --tags --always 2>/dev/null || echo "dev")"

# --- Parse arguments (pass through to Node.js UI) ---
PASSTHROUGH_ARGS=()
for arg in "$@"; do
  case "$arg" in
    --version|-V)
      echo "setup-host.sh $SETUP_VERSION"
      exit 0
      ;;
    --help|-h)
      echo "Usage: sudo bash scripts/ops/setup-host.sh [--yes] [--verbose]"
      echo ""
      echo "Options:"
      echo "  --yes, -y       Install all components without interactive prompts"
      echo "  --verbose, -v   Show raw output from each install step"
      echo "  --version, -V   Show version"
      echo "  --help, -h      Show this help"
      echo ""
      echo "Without --yes, shows an interactive component selector."
      echo "[CORE] items are required and always installed."
      exit 0
      ;;
    --yes|-y|--verbose|-v)
      PASSTHROUGH_ARGS+=("$arg")
      ;;
    *)
      echo "Error: Unknown option '$arg'" >&2
      echo "Usage: sudo bash scripts/ops/setup-host.sh [--yes] [--verbose]" >&2
      exit 1
      ;;
  esac
done

# --- Root check ---
if [[ $EUID -ne 0 ]]; then
  echo "Error: Must run as root (sudo)" >&2
  exit 1
fi

# --- Pre-flight: verify hard requirements ---
PREFLIGHT_FAIL=false

# Required commands and what package provides them
declare -A REQUIRED_CMDS=(
  [curl]="curl"
  [apt-get]="apt (Debian/Ubuntu/Kali/Parrot only)"
  [gpg]="gnupg"
  [python3]="python3"
  [getent]="libc-bin"
)

MISSING_CMDS=()
for cmd in "${!REQUIRED_CMDS[@]}"; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING_CMDS+=("  - $cmd (install: apt-get install -y ${REQUIRED_CMDS[$cmd]})")
  fi
done

if [[ ${#MISSING_CMDS[@]} -gt 0 ]]; then
  echo "Error: Missing required commands:" >&2
  printf '%s\n' "${MISSING_CMDS[@]}" >&2
  echo "" >&2
  echo "This installer requires a Debian-based OS (Kali, Parrot, Ubuntu, Debian)." >&2
  PREFLIGHT_FAIL=true
fi

# Internet connectivity (only check if curl exists)
if command -v curl &>/dev/null; then
  if ! curl -fsS --connect-timeout 5 https://deb.nodesource.com > /dev/null 2>&1; then
    echo "Error: No internet connectivity." >&2
    echo "Setup requires network access to download packages and signing keys." >&2
    echo "Verify your network connection and try again." >&2
    PREFLIGHT_FAIL=true
  fi
fi

if [[ "$PREFLIGHT_FAIL" == true ]]; then
  exit 1
fi

# --- Path setup ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# --- Detect OS ---
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_NAME="${PRETTY_NAME:-Unknown}"
  # Parrot OS sets ID=debian — detect via PRETTY_NAME so install functions
  # can branch correctly for Parrot-specific package handling
  if [[ "$OS_NAME" == *"Parrot"* ]]; then
    OS_ID="parrot"
  fi
else
  echo "Error: Cannot detect OS (no /etc/os-release)" >&2
  exit 1
fi

# --- Detect user (who invoked sudo) ---
SETUP_USER="${SUDO_USER:-$(whoami)}"
if [[ "$SETUP_USER" == "root" ]]; then
  echo "Warning: SUDO_USER not set — installing as root." >&2
  echo "For user-level services, run via: sudo bash $0" >&2
fi
SETUP_HOME="$(getent passwd "$SETUP_USER" | cut -d: -f6)"
if [[ -z "$SETUP_HOME" ]]; then
  echo "Error: Could not determine home directory for $SETUP_USER" >&2
  exit 1
fi

echo "=== Argos Host Provisioning ==="
echo "OS:      $OS_NAME"
echo "User:    $SETUP_USER"
echo "Project: $PROJECT_DIR"
echo ""

# =============================================
# Phase 1: Ensure Node.js is available
# =============================================
if ! command -v node &>/dev/null; then
  echo "[Bootstrap] Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
  echo "[Bootstrap] Node.js $(node --version) installed."
elif [[ "$(node --version | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  echo "[Bootstrap] Node.js $(node --version) is too old. Installing v22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
  echo "[Bootstrap] Upgraded to Node.js $(node --version)."
else
  echo "[Bootstrap] Node.js $(node --version) OK."
fi

# =============================================
# Phase 1b: Ensure build-essential for native npm modules
# =============================================
if ! dpkg -s build-essential &>/dev/null 2>&1; then
  echo "[Bootstrap] Installing build-essential..."
  apt-get update -q
  apt-get install -y -q build-essential python3
fi

# =============================================
# Phase 2: Ensure gum (Charmbracelet TUI toolkit)
# =============================================
if ! command -v gum &>/dev/null; then
  echo "[Bootstrap] Installing gum (CLI toolkit)..."
  # Add Charm's apt repository
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://repo.charm.sh/apt/gpg.key | gpg --dearmor -o /etc/apt/keyrings/charm.gpg 2>/dev/null
  echo "deb [signed-by=/etc/apt/keyrings/charm.gpg] https://repo.charm.sh/apt/ * *" \
    > /etc/apt/sources.list.d/charm.list
  apt-get update -q
  apt-get install -y -q gum
  echo "[Bootstrap] gum $(gum --version 2>/dev/null || echo '') installed."
else
  echo "[Bootstrap] gum OK."
fi

# =============================================
# Phase 3: Launch interactive installer
# =============================================
export SETUP_USER SETUP_HOME PROJECT_DIR SCRIPT_DIR OS_ID OS_NAME

exec bash "$PROJECT_DIR/scripts/ops/setup-host-ui.sh" "${PASSTHROUGH_ARGS[@]}"
