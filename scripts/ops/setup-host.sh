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

# --- Path setup ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# --- Detect OS ---
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_NAME="${PRETTY_NAME:-Unknown}"
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
# Phase 2: Install @clack/prompts to temp cache
# =============================================
SETUP_CACHE="$PROJECT_DIR/.setup-cache"
if [[ ! -d "$SETUP_CACHE/node_modules/@clack" ]]; then
  echo "[Bootstrap] Preparing installer UI..."
  if ! sudo -u "$SETUP_USER" npm install --prefix "$SETUP_CACHE" @clack/prompts picocolors 2>&1 | tail -5; then
    echo "Error: Failed to install installer UI dependencies" >&2
    exit 1
  fi
fi

# =============================================
# Phase 3: Launch Node.js interactive installer
# =============================================
export SETUP_USER SETUP_HOME PROJECT_DIR SCRIPT_DIR OS_ID OS_NAME
export NODE_PATH="$SETUP_CACHE/node_modules"

exec node "$PROJECT_DIR/scripts/ops/setup-host-ui.mjs" "${PASSTHROUGH_ARGS[@]}"
