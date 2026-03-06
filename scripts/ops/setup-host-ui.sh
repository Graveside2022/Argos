#!/usr/bin/env bash
# Argos Host Provisioning — Interactive Installer (gum edition)
# Powered by Charmbracelet's gum for a polished CLI experience.
# Launched by setup-host.sh after Node.js and gum are bootstrapped.
#
# Usage (called by setup-host.sh, not directly):
#   bash scripts/ops/setup-host-ui.sh [--yes] [--verbose]

set -euo pipefail

# =============================================
# CONFIG
# =============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FUNCTIONS_SH="$SCRIPT_DIR/setup-host-functions.sh"
COMPONENTS_JSON="$SCRIPT_DIR/components.json"

NON_INTERACTIVE=false
VERBOSE=false
for arg in "$@"; do
  case "$arg" in
    --yes|-y) NON_INTERACTIVE=true ;;
    --verbose|-v) VERBOSE=true ;;
  esac
done

# Env vars passed from bootstrap
: "${SETUP_USER:=unknown}"
: "${SETUP_HOME:=}"
: "${OS_ID:=unknown}"
: "${OS_NAME:=Unknown OS}"

# Brand colors
C_BRAND="#00BFFF"     # Argos cyan
C_ACCENT="#7C3AED"    # Purple accent
C_SUCCESS="#22C55E"   # Green
C_INFO="#3B82F6"      # Blue
C_WARN="#F59E0B"      # Yellow
C_ERROR="#EF4444"     # Red
C_DIM="#6B7280"       # Gray

# =============================================
# HELPERS
# =============================================

# Parse components.json using python3 (avoids jq dependency)
# Usage: parse_components <filter> → outputs JSON array
parse_components() {
  python3 -c "
import json, sys
with open('$COMPONENTS_JSON') as f:
    comps = json.load(f)
filter_type = sys.argv[1] if len(sys.argv) > 1 else 'all'
if filter_type == 'core':
    comps = [c for c in comps if c.get('core')]
elif filter_type == 'optional':
    comps = [c for c in comps if not c.get('core')]
elif filter_type == 'groups':
    seen = []
    for c in comps:
        g = c.get('group', 'Other')
        if g not in seen and not c.get('core'):
            seen.append(g)
    for g in seen:
        print(g)
    sys.exit(0)
elif filter_type == 'ids':
    for c in comps:
        print(c['id'])
    sys.exit(0)
for c in comps:
    print(f\"{c['id']}|{c['desc']}|{c.get('core', False)}|{c.get('func', '')}|{c.get('group', 'Other')}\")
" "$@"
}

# Get component count
comp_total() { parse_components ids | wc -l; }
comp_core_count() { parse_components core | wc -l; }

# =============================================
# GET VERSION
# =============================================

VERSION="dev"
if git -C "$PROJECT_DIR" describe --tags --always &>/dev/null; then
  VERSION="$(git -C "$PROJECT_DIR" describe --tags --always)"
else
  VERSION="$(python3 -c "import json; print(json.load(open('$PROJECT_DIR/package.json')).get('version','dev'))" 2>/dev/null || echo "dev")"
fi

# =============================================
# WELCOME BANNER
# =============================================

LOGO_TEXT=$(cat <<'ASCII'
 █████╗ ██████╗  ██████╗  ██████╗ ███████╗
██╔══██╗██╔══██╗██╔════╝ ██╔═══██╗██╔════╝
███████║██████╔╝██║  ███╗██║   ██║███████╗
██╔══██║██╔══██╗██║   ██║██║   ██║╚════██║
██║  ██║██║  ██║╚██████╔╝╚██████╔╝███████║
╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝
ASCII
)

BANNER=$(gum style \
  --border double \
  --border-foreground "$C_BRAND" \
  --foreground "$C_BRAND" \
  --padding "1 4" \
  --align center \
  --width 56 \
  "$LOGO_TEXT")

TAGLINE=$(gum style \
  --foreground "$C_DIM" \
  --italic \
  --align center \
  --width 56 \
  "SDR & Network Analysis Console for EW Training")

INFO_LINE=$(gum style \
  --align center \
  --width 56 \
  "$(gum style --foreground "$C_DIM" "Version:") $(gum style --foreground "$C_BRAND" "$VERSION")  $(gum style --foreground "$C_DIM" "OS:") $(gum style --foreground "$C_BRAND" "$OS_NAME")")

USER_LINE=$(gum style \
  --align center \
  --width 56 \
  "$(gum style --foreground "$C_DIM" "User:") $(gum style --foreground "$C_BRAND" "$SETUP_USER")  $(gum style --foreground "$C_DIM" "Project:") $(gum style --foreground "$C_DIM" "$PROJECT_DIR")")

echo ""
gum join --align center --vertical "$BANNER" "" "$TAGLINE" "" "$INFO_LINE" "$USER_LINE"
echo ""

# =============================================
# PRE-FLIGHT: Parrot OS Kismet check
# =============================================

if [[ "$OS_ID" == "parrot" ]] && ! command -v kismet &>/dev/null; then
  gum log --level info "Parrot OS detected — Kismet will be installed from kismetwireless.net repo."
fi

# =============================================
# COMPONENT SELECTION
# =============================================

TOTAL=$(comp_total)
CORE_COUNT=$(comp_core_count)
declare -a SELECTED_IDS=()

if [[ "$NON_INTERACTIVE" == "true" ]]; then
  # --yes mode: select everything
  mapfile -t SELECTED_IDS < <(parse_components ids)
  gum log --level info "Non-interactive mode: installing all ${#SELECTED_IDS[@]} components."
else
  # Express vs Customize
  MODE=$(gum choose --header "  Installation mode" \
    --header.foreground "$C_BRAND" \
    --cursor.foreground "$C_BRAND" \
    --selected.foreground "$C_BRAND" \
    "Express — install all $TOTAL components" \
    "Customize — choose individual components")

  if [[ "$MODE" == Express* ]]; then
    mapfile -t SELECTED_IDS < <(parse_components ids)
    gum log --level info "Express mode: installing all ${#SELECTED_IDS[@]} components."
  else
    # Always include core components
    mapfile -t SELECTED_IDS < <(parse_components core | cut -d'|' -f1)
    gum style --foreground "$C_DIM" "  $CORE_COUNT core components always installed. Select optional:"
    echo ""

    # Per-group selection
    mapfile -t GROUPS < <(parse_components groups)
    for group in "${GROUPS[@]}"; do
      # Get optional components in this group
      mapfile -t GROUP_ITEMS < <(parse_components optional | awk -F'|' -v g="$group" '$5 == g {print $2 " [" $1 "]"}')
      mapfile -t GROUP_IDS < <(parse_components optional | awk -F'|' -v g="$group" '$5 == g {print $1}')

      if [[ ${#GROUP_ITEMS[@]} -eq 0 ]]; then
        continue
      fi

      # Build --selected flags (one per item, all pre-selected)
      SELECTED_FLAGS=()
      for item in "${GROUP_ITEMS[@]}"; do
        SELECTED_FLAGS+=(--selected "$item")
      done

      CHOSEN=$(printf '%s\n' "${GROUP_ITEMS[@]}" | \
        gum choose --no-limit \
          --header "  $group" \
          --header.foreground "$C_ACCENT" \
          --cursor.foreground "$C_BRAND" \
          --selected.foreground "$C_SUCCESS" \
          "${SELECTED_FLAGS[@]}" \
        || true)

      # Extract IDs from chosen items (format: "Description [id]")
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        # Extract ID from between [ and ]
        local_id=$(echo "$line" | grep -oP '\[\K[^\]]+')
        if [[ -n "$local_id" ]]; then
          SELECTED_IDS+=("$local_id")
        fi
      done <<< "$CHOSEN"

      echo ""
    done
  fi
fi

# Enforce dependency: zsh_default requires zsh_dotfiles
if printf '%s\n' "${SELECTED_IDS[@]}" | grep -qx "zsh_default"; then
  if ! printf '%s\n' "${SELECTED_IDS[@]}" | grep -qx "zsh_dotfiles"; then
    SELECTED_IDS+=("zsh_dotfiles")
    gum log --level warn 'Added "Zsh + dotfiles" — required by "Set Zsh as default shell".'
  fi
fi

# Sort by registry order
mapfile -t ALL_IDS < <(parse_components ids)
declare -a ORDERED_IDS=()
for id in "${ALL_IDS[@]}"; do
  if printf '%s\n' "${SELECTED_IDS[@]}" | grep -qx "$id"; then
    ORDERED_IDS+=("$id")
  fi
done
SELECTED_IDS=("${ORDERED_IDS[@]}")

# =============================================
# API KEY PROMPT
# =============================================

STADIA_KEY=""
ENV_EXISTS=false
[[ -f "$PROJECT_DIR/.env" ]] && ENV_EXISTS=true

# Check if env_file is selected and .env doesn't exist
if printf '%s\n' "${SELECTED_IDS[@]}" | grep -qx "env_file" && [[ "$ENV_EXISTS" == "false" ]]; then
  if [[ "$NON_INTERACTIVE" == "true" ]]; then
    gum log --level info "Skipping API key prompt (--yes mode). Edit .env manually."
  else
    gum style --foreground "$C_DIM" "  Optional API key for vector map tiles."
    STADIA_KEY=$(gum input \
      --header "  Stadia Maps API key" \
      --header.foreground "$C_BRAND" \
      --placeholder "Press Enter to skip — falls back to Google satellite tiles" \
      --width 60 \
      || true)
    if [[ -n "$STADIA_KEY" ]]; then
      gum log --level info "Stadia Maps key saved."
    else
      gum log --level info "Skipped — map will use Google satellite fallback."
    fi
  fi
elif [[ "$ENV_EXISTS" == "true" ]]; then
  gum log --level info ".env already exists — skipping API key prompt."
fi

# =============================================
# PRE-FLIGHT: DETECT ALREADY-INSTALLED
# =============================================

source "$FUNCTIONS_SH"

declare -A ALREADY_INSTALLED
check_env_vars() {
  export SETUP_USER SETUP_HOME PROJECT_DIR SCRIPT_DIR="$SCRIPT_DIR" OS_ID
}
check_env_vars

_scan_existing() {
  for id in "${SELECTED_IDS[@]}"; do
    if check_component "$id" 2>/dev/null; then
      echo "$id"
    fi
  done
}

# Write selected IDs to temp file for subprocess access
_SCAN_SCRIPT=$(mktemp)
cat > "$_SCAN_SCRIPT" << SCANEOF
#!/usr/bin/env bash
source '$FUNCTIONS_SH'
export SETUP_USER='$SETUP_USER' SETUP_HOME='$SETUP_HOME'
export PROJECT_DIR='$PROJECT_DIR' SCRIPT_DIR='$SCRIPT_DIR' OS_ID='$OS_ID'
for id in $(printf '%q ' "${SELECTED_IDS[@]}"); do
  check_component "\$id" 2>/dev/null && echo "\$id"
done
true
SCANEOF
chmod +x "$_SCAN_SCRIPT"

if [[ "$VERBOSE" == "true" ]]; then
  gum log --level info "Scanning system for existing components..."
  mapfile -t PRESENT < <(bash "$_SCAN_SCRIPT")
else
  mapfile -t PRESENT < <(gum spin \
    --spinner dot \
    --spinner.foreground "$C_BRAND" \
    --title "Scanning system for existing components..." \
    --show-output \
    -- bash "$_SCAN_SCRIPT")
fi
rm -f "$_SCAN_SCRIPT"

for id in "${PRESENT[@]}"; do
  [[ -n "$id" ]] && ALREADY_INSTALLED["$id"]=1
done

FRESH_COUNT=$(( ${#SELECTED_IDS[@]} - ${#ALREADY_INSTALLED[@]} ))
if [[ ${#ALREADY_INSTALLED[@]} -gt 0 ]]; then
  gum log --level info "$(gum style --foreground "$C_INFO" "${#ALREADY_INSTALLED[@]} already present"), $FRESH_COUNT to install"
else
  gum log --level info "$FRESH_COUNT components to install (fresh system)"
fi

echo ""

# =============================================
# INSTALL COMPONENTS
# =============================================

INSTALLED=0
ALREADY_COUNT=0
FAILED=0
SKIPPED=0
declare -a FAILED_NAMES=()
SELECTED_TOTAL=${#SELECTED_IDS[@]}
SELECTED_CSV=$(IFS=,; echo "${SELECTED_IDS[*]}")

# Graceful Ctrl+C
trap 'echo ""; gum log --level error "Setup interrupted by user."; exit 130' INT

for i in "${!SELECTED_IDS[@]}"; do
  id="${SELECTED_IDS[$i]}"
  # Look up component info
  COMP_INFO=$(parse_components all | grep "^${id}|" || true)
  [[ -z "$COMP_INFO" ]] && continue

  DESC=$(echo "$COMP_INFO" | cut -d'|' -f2)
  FUNC=$(echo "$COMP_INFO" | cut -d'|' -f4)
  PROGRESS="[$(( i + 1 ))/$SELECTED_TOTAL]"
  WAS_PRESENT="${ALREADY_INSTALLED[$id]:-}"

  VERB="Installing"
  [[ -n "$WAS_PRESENT" ]] && VERB="Verifying"

  BASH_CMD="source '$FUNCTIONS_SH' && $FUNC"
  CHILD_ENV="SETUP_USER='$SETUP_USER' SETUP_HOME='$SETUP_HOME' PROJECT_DIR='$PROJECT_DIR' SCRIPT_DIR='$SCRIPT_DIR' OS_ID='$OS_ID' NON_INTERACTIVE='$NON_INTERACTIVE' STADIA_KEY='$STADIA_KEY' SELECTED_COMPONENTS='$SELECTED_CSV'"

  if [[ "$VERBOSE" == "true" ]] || [[ -z "$WAS_PRESENT" ]]; then
    # Verbose mode OR fresh installs: show raw output so user sees progress
    gum log --level info "$PROGRESS $VERB $DESC..."
    if eval "export $CHILD_ENV && $BASH_CMD" 2>&1; then
      if [[ -n "$WAS_PRESENT" ]]; then
        gum style --foreground "$C_INFO" "  ● $DESC $(gum style --foreground "$C_DIM" "(already installed)")"
        ALREADY_COUNT=$(( ALREADY_COUNT + 1 ))
      else
        gum style --foreground "$C_SUCCESS" "  ✓ $DESC"
        INSTALLED=$(( INSTALLED + 1 ))
      fi
    else
      gum style --foreground "$C_ERROR" "  ✗ $DESC — failed"
      FAILED_NAMES+=("$DESC")
      FAILED=$(( FAILED + 1 ))
    fi
  else
    # Already-installed: use spinner (quick verification, no output needed)
    if gum spin \
        --spinner dot \
        --spinner.foreground "$C_BRAND" \
        --title "$PROGRESS $VERB $DESC..." \
        -- bash -c "export $CHILD_ENV && $BASH_CMD" 2>&1; then
      gum style --foreground "$C_INFO" "  ● $DESC $(gum style --foreground "$C_DIM" "(already installed)")"
      ALREADY_COUNT=$(( ALREADY_COUNT + 1 ))
    else
      gum style --foreground "$C_ERROR" "  ✗ $DESC — failed"
      FAILED_NAMES+=("$DESC")
      FAILED=$(( FAILED + 1 ))
    fi
  fi
done

echo ""

echo ""

# =============================================
# SUMMARY
# =============================================

SUMMARY_LINES=()
[[ $INSTALLED -gt 0 ]] && SUMMARY_LINES+=("$(gum style --foreground "$C_SUCCESS" "  ✓ $INSTALLED freshly installed")")
[[ $ALREADY_COUNT -gt 0 ]] && SUMMARY_LINES+=("$(gum style --foreground "$C_INFO" "  ● $ALREADY_COUNT already present")")
if [[ $FAILED -gt 0 ]]; then
  SUMMARY_LINES+=("$(gum style --foreground "$C_ERROR" "  ✗ $FAILED failed")")
  SUMMARY_LINES+=("")
  SUMMARY_LINES+=("$(gum style --foreground "$C_DIM" "  Failed:")")
  for name in "${FAILED_NAMES[@]}"; do
    SUMMARY_LINES+=("$(gum style --foreground "$C_ERROR" "    ✗ $name")")
  done
fi
SKIPPED_COUNT=$(( TOTAL - SELECTED_TOTAL ))
[[ $SKIPPED_COUNT -gt 0 ]] && SUMMARY_LINES+=("$(gum style --foreground "$C_DIM" "  $SKIPPED_COUNT skipped")")

SUMMARY_TEXT=$(printf '%s\n' "${SUMMARY_LINES[@]}")

gum style \
  --border rounded \
  --border-foreground "$C_SUCCESS" \
  --padding "1 2" \
  --width 50 \
  "$(gum style --bold --foreground "$C_BRAND" "  Setup Complete")" \
  "" \
  "$SUMMARY_TEXT"

echo ""

# VNC reminder
if printf '%s\n' "${SELECTED_IDS[@]}" | grep -qx "vnc"; then
  if [[ ! -f "$SETUP_HOME/.vnc/passwd" ]]; then
    gum log --level warn "VNC password not set. Run: vncpasswd ~/.vnc/passwd"
  fi
fi

# Next steps
gum style \
  --foreground "$C_DIM" \
  "  Next steps:" \
  "    1. Edit .env to set service passwords" \
  "    2. $(gum style --foreground "$C_BRAND" "npm run dev") — start development server" \
  "    3. Open http://<pi-ip>:5173 in your browser" \
  "" \
  "  Optional API key (set later in .env):" \
  "    STADIA_MAPS_API_KEY — vector map tiles (stadiamaps.com)"

echo ""
gum style --bold --foreground "$C_SUCCESS" "  ✓ Provisioning complete."
echo ""
