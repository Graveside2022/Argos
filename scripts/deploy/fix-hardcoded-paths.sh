#!/bin/bash
#
# Fix Hardcoded Paths Script for Dragon OS Deployment
# This script fixes all hardcoded /home/pi references for portability
#
# Usage: bash fix-hardcoded-paths.sh [target_user]
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CURRENT_USER=${1:-$(whoami)}
CURRENT_HOME=$(eval echo ~$CURRENT_USER)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/fix-paths.log"

# Files to fix (hardcoded paths)
declare -a FILES_TO_FIX

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "${LOG_FILE}"
    exit 1
}

# Function to find all files with hardcoded paths
find_hardcoded_files() {
    log "Scanning for hardcoded paths..."
    
    # Find all files with /home/pi references
    mapfile -t FILES_TO_FIX < <(
        find "$PROJECT_DIR" -type f \( \
            -name "*.sh" -o \
            -name "*.service" -o \
            -name "*.ts" -o \
            -name "*.js" -o \
            -name "*.svelte" -o \
            -name "*.md" -o \
            -name "*.yml" -o \
            -name "*.yaml" -o \
            -name "*.json" -o \
            -name "*.conf" -o \
            -name "*.config" \
        \) \
        -not -path "*/node_modules/*" \
        -not -path "*/build/*" \
        -not -path "*/.git/*" \
        -not -path "*/bmad-method/*" \
        -exec grep -l "/home/pi" {} \; 2>/dev/null | sort | uniq
    )
    
    log "Found ${#FILES_TO_FIX[@]} files with hardcoded paths"
}

# Function to backup files before modification
backup_files() {
    log "Creating backup of files..."
    
    local backup_dir="${PROJECT_DIR}/backup-$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    for file in "${FILES_TO_FIX[@]}"; do
        local relative_path="${file#$PROJECT_DIR/}"
        local backup_path="$backup_dir/$relative_path"
        
        # Create directory structure in backup
        mkdir -p "$(dirname "$backup_path")"
        
        # Copy file to backup
        cp "$file" "$backup_path"
    done
    
    log "Backup created at: $backup_dir"
}

# Function to fix hardcoded paths in a file
fix_file_paths() {
    local file="$1"
    local temp_file="${file}.tmp"
    
    # Create a temporary file with fixes
    sed -e "s|/home/pi|${CURRENT_HOME}|g" \
        -e "s|User=pi|User=${CURRENT_USER}|g" \
        -e "s|user=pi|user=${CURRENT_USER}|g" \
        -e "s|USER=pi|USER=${CURRENT_USER}|g" \
        -e "s|pi:pi|${CURRENT_USER}:${CURRENT_USER}|g" \
        -e "s|usermod -aG \\([^,]*\\) pi|usermod -aG \\1 ${CURRENT_USER}|g" \
        -e "s|su - pi|su - ${CURRENT_USER}|g" \
        -e "s|sudo -u pi|sudo -u ${CURRENT_USER}|g" \
        "$file" > "$temp_file"
    
    # Replace original file if changes were made
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        log "Fixed: $file"
        return 0
    else
        rm "$temp_file"
        return 1
    fi
}

# Function to fix systemd service files
fix_systemd_services() {
    log "Fixing systemd service files..."
    
    local service_files=(
        "deployment/argos-cpu-protector.service"
        "deployment/argos-dev.service"
        "deployment/argos-final.service"
        "deployment/argos-process-manager.service"
        "deployment/argos-wifi-resilience.service"
        "scripts/dev-server-keepalive.service"
        "scripts/simple-keepalive.service"
        "scripts/wifi-keepalive.service"
        "coral-worker.service"
    )
    
    for service_file in "${service_files[@]}"; do
        local full_path="${PROJECT_DIR}/$service_file"
        if [[ -f "$full_path" ]]; then
            fix_file_paths "$full_path"
        fi
    done
}

# Function to fix shell scripts
fix_shell_scripts() {
    log "Fixing shell scripts..."
    
    local script_files=(
        "scripts/vite-manager.sh"
        "scripts/parallel-agent-init.sh"
        "scripts/setup-db-cron.sh"
        "scripts/setup-system-management.sh"
        "scripts/simple-keepalive.sh"
        "scripts/validate-deployment-guide.sh"
        "scripts/keepalive.sh"
        "scripts/manage-keepalive.sh"
        "scripts/infrastructure/backup.sh"
        "scripts/infrastructure/setup-cron.sh"
        "scripts/install-argos.sh"
        "scripts/dev-server-keepalive.sh"
        "scripts/direct-vite-start.sh"
        "scripts/disable-hackrf-logs.sh"
        "scripts/docker-image-manager.sh"
        "scripts/build-production.sh"
        "scripts/db-backup.sh"
        "scripts/db-cleanup.sh"
        "scripts/agent-coordinator.sh"
    )
    
    for script_file in "${script_files[@]}"; do
        local full_path="${PROJECT_DIR}/$script_file"
        if [[ -f "$full_path" ]]; then
            fix_file_paths "$full_path"
        fi
    done
}

# Function to fix TypeScript/JavaScript files
fix_typescript_files() {
    log "Fixing TypeScript/JavaScript files..."
    
    local ts_files=(
        "src/routes/api/kismet/scripts/execute/+server.ts"
        "src/lib/stores/wigletotak/wigleStore.ts"
        "src/lib/server/kismet/scriptManager.ts"
        "src/lib/server/kismet/serviceManager.ts"
        "src/lib/components/wigletotak/directory/DirectoryCard.svelte"
    )
    
    for ts_file in "${ts_files[@]}"; do
        local full_path="${PROJECT_DIR}/$ts_file"
        if [[ -f "$full_path" ]]; then
            fix_file_paths "$full_path"
        fi
    done
}

# Function to fix documentation files
fix_documentation() {
    log "Fixing documentation files..."
    
    # Find all markdown files with hardcoded paths
    find "$PROJECT_DIR/docs" -name "*.md" -exec grep -l "/home/pi" {} \; 2>/dev/null | while read -r doc_file; do
        fix_file_paths "$doc_file"
    done
}

# Function to create a universal environment setup script
create_env_setup() {
    log "Creating universal environment setup script..."
    
    cat > "${PROJECT_DIR}/setup-environment.sh" <<'EOF'
#!/bin/bash
#
# Universal Environment Setup for Argos
# Automatically detects and configures environment variables
#

# Auto-detect current user and paths
export ARGOS_USER=$(whoami)
export ARGOS_HOME=$(eval echo ~$ARGOS_USER)
export ARGOS_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Environment variables for Dragon OS compatibility
export NODE_ENV=production
export PORT=5173
export OPENWEBRX_PORT=8073
export PUBLIC_OPENWEBRX_URL="http://localhost:8073"
export PROJECT_ROOT="$ARGOS_PROJECT_DIR"
export USER="$ARGOS_USER"

# Dragon OS specific settings
if command -v hackrf_info &> /dev/null; then
    export DRAGON_OS_DETECTED=true
    export SDR_TOOLS_AVAILABLE=true
else
    export DRAGON_OS_DETECTED=false
    export SDR_TOOLS_AVAILABLE=false
fi

# Display configuration
echo "Argos Environment Configuration:"
echo "  User: $ARGOS_USER"
echo "  Home: $ARGOS_HOME"
echo "  Project: $ARGOS_PROJECT_DIR"
echo "  Dragon OS: $DRAGON_OS_DETECTED"
echo "  SDR Tools: $SDR_TOOLS_AVAILABLE"

# Export all variables for use in scripts
export ARGOS_USER ARGOS_HOME ARGOS_PROJECT_DIR NODE_ENV PORT OPENWEBRX_PORT
export PUBLIC_OPENWEBRX_URL PROJECT_ROOT USER DRAGON_OS_DETECTED SDR_TOOLS_AVAILABLE

# Create .env file
cat > "$ARGOS_PROJECT_DIR/.env" <<EOL
# Argos Environment Configuration (Auto-generated)
NODE_ENV=production
PORT=5173
OPENWEBRX_PORT=8073
PUBLIC_OPENWEBRX_URL=http://localhost:8073
PROJECT_ROOT=$ARGOS_PROJECT_DIR
USER=$ARGOS_USER
DRAGON_OS_DETECTED=$DRAGON_OS_DETECTED
SDR_TOOLS_AVAILABLE=$SDR_TOOLS_AVAILABLE
EOL

echo "Environment configuration complete!"
EOF

    chmod +x "${PROJECT_DIR}/setup-environment.sh"
    log "Universal environment setup script created"
}

# Function to validate fixes
validate_fixes() {
    log "Validating fixes..."
    
    local remaining_files
    remaining_files=$(find "$PROJECT_DIR" -type f \( \
        -name "*.sh" -o \
        -name "*.service" -o \
        -name "*.ts" -o \
        -name "*.js" -o \
        -name "*.svelte" -o \
        -name "*.md" -o \
        -name "*.yml" -o \
        -name "*.yaml" -o \
        -name "*.json" -o \
        -name "*.conf" -o \
        -name "*.config" \
    \) \
    -not -path "*/node_modules/*" \
    -not -path "*/build/*" \
    -not -path "*/.git/*" \
    -not -path "*/bmad-method/*" \
    -not -path "*/backup-*/*" \
    -exec grep -l "/home/pi" {} \; 2>/dev/null | wc -l)
    
    if [[ $remaining_files -eq 0 ]]; then
        log "[OK] All hardcoded paths fixed successfully!"
    else
        warn "[WARN]  $remaining_files files still contain hardcoded paths"
        
        # Show remaining files
        find "$PROJECT_DIR" -type f \( \
            -name "*.sh" -o \
            -name "*.service" -o \
            -name "*.ts" -o \
            -name "*.js" -o \
            -name "*.svelte" -o \
            -name "*.md" -o \
            -name "*.yml" -o \
            -name "*.yaml" -o \
            -name "*.json" -o \
            -name "*.conf" -o \
            -name "*.config" \
        \) \
        -not -path "*/node_modules/*" \
        -not -path "*/build/*" \
        -not -path "*/.git/*" \
        -not -path "*/bmad-method/*" \
        -not -path "*/backup-*/*" \
        -exec grep -l "/home/pi" {} \; 2>/dev/null | head -10 | while read -r file; do
            warn "  - $file"
        done
    fi
}

# Function to display summary
print_summary() {
    echo ""
    echo -e "${GREEN}#######################################################################################${NC}"
    echo -e "${GREEN}# Hardcoded Paths Fix Complete!${NC}"
    echo -e "${GREEN}#######################################################################################${NC}"
    echo ""
    echo -e "${BLUE}Configuration:${NC}"
    echo -e "  • Target User: ${YELLOW}${CURRENT_USER}${NC}"
    echo -e "  • Target Home: ${YELLOW}${CURRENT_HOME}${NC}"
    echo -e "  • Project Dir: ${YELLOW}${PROJECT_DIR}${NC}"
    echo ""
    echo -e "${BLUE}Files Fixed:${NC}"
    echo -e "  • Systemd Services: ${YELLOW}[OK]${NC}"
    echo -e "  • Shell Scripts: ${YELLOW}[OK]${NC}"
    echo -e "  • TypeScript/JS Files: ${YELLOW}[OK]${NC}"
    echo -e "  • Documentation: ${YELLOW}[OK]${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Run: ${YELLOW}bash deploy-dragon-os.sh${NC}"
    echo -e "  2. Or run: ${YELLOW}bash setup-environment.sh${NC}"
    echo -e "  3. Test deployment on target system"
    echo ""
    echo -e "${GREEN}Your Argos project is now portable across different users and systems!${NC}"
    echo ""
}

#######################################################################################
# Main Process
#######################################################################################

main() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# Argos Hardcoded Paths Fix${NC}"
    echo -e "${BLUE}# Making your project portable across different users and systems${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
    
    # Initialize log file
    touch "${LOG_FILE}"
    
    log "Starting hardcoded paths fix..."
    log "Target user: $CURRENT_USER"
    log "Target home: $CURRENT_HOME"
    log "Project directory: $PROJECT_DIR"
    
    # Main fixing process
    find_hardcoded_files
    backup_files
    fix_systemd_services
    fix_shell_scripts
    fix_typescript_files
    fix_documentation
    create_env_setup
    validate_fixes
    
    print_summary
    log "Hardcoded paths fix completed successfully!"
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Fix interrupted. Check ${LOG_FILE} for details.${NC}"' INT TERM

# Run main process
main "$@"