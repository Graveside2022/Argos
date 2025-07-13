#!/bin/bash

# Argos Project Backup Script
# This script creates timestamped backups of the entire project

# Configuration
PROJECT_DIR="/home/pi/projects/Argos"
BACKUP_ROOT="/home/pi/backups/Argos"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="Argos_backup_${TIMESTAMP}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"
LOG_FILE="${PROJECT_DIR}/BACKUP_LOG.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directories if they don't exist
echo -e "${YELLOW}Creating backup directories...${NC}"
mkdir -p "${BACKUP_ROOT}"
mkdir -p "${BACKUP_DIR}"

# Function to log messages
log_message() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to log errors
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start backup process
log_message "Starting backup of Argos project..."
log_message "Source: ${PROJECT_DIR}"
log_message "Destination: ${BACKUP_DIR}"

# Create subdirectories for organized backup
mkdir -p "${BACKUP_DIR}/source"
mkdir -p "${BACKUP_DIR}/git"
mkdir -p "${BACKUP_DIR}/config"
mkdir -p "${BACKUP_DIR}/docs"

# Backup source code (excluding node_modules and .svelte-kit)
log_message "Backing up source code..."
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='.svelte-kit' \
    --exclude='*.log' \
    --exclude='tmp/' \
    --exclude='*.tmp' \
    "${PROJECT_DIR}/" "${BACKUP_DIR}/source/" || log_error "Failed to backup source code"

# Backup git repository
log_message "Backing up git repository..."
if [ -d "${PROJECT_DIR}/.git" ]; then
    cp -r "${PROJECT_DIR}/.git" "${BACKUP_DIR}/git/" || log_error "Failed to backup git repository"
    
    # Also create a git bundle for easy restoration
    cd "${PROJECT_DIR}" || exit 1
    git bundle create "${BACKUP_DIR}/git/Argos.bundle" --all || log_error "Failed to create git bundle"
    
    # Save current branch and commit info
    git branch > "${BACKUP_DIR}/git/branches.txt"
    git log --oneline -n 20 > "${BACKUP_DIR}/git/recent_commits.txt"
    git status > "${BACKUP_DIR}/git/status.txt"
else
    log_message "No git repository found, skipping git backup"
fi

# Backup specific important files
log_message "Backing up critical configuration and documentation..."
cp "${PROJECT_DIR}/package.json" "${BACKUP_DIR}/config/" 2>/dev/null
cp "${PROJECT_DIR}/package-lock.json" "${BACKUP_DIR}/config/" 2>/dev/null
cp "${PROJECT_DIR}/svelte.config.js" "${BACKUP_DIR}/config/" 2>/dev/null
cp "${PROJECT_DIR}/vite.config.js" "${BACKUP_DIR}/config/" 2>/dev/null
cp "${PROJECT_DIR}/.env" "${BACKUP_DIR}/config/" 2>/dev/null
cp "${PROJECT_DIR}/.env.local" "${BACKUP_DIR}/config/" 2>/dev/null

# Copy all documentation
cp -r "${PROJECT_DIR}/docs" "${BACKUP_DIR}/" 2>/dev/null
cp "${PROJECT_DIR}"/*.md "${BACKUP_DIR}/docs/" 2>/dev/null
cp "${PROJECT_DIR}"/*.txt "${BACKUP_DIR}/docs/" 2>/dev/null

# Create backup metadata
log_message "Creating backup metadata..."
cat > "${BACKUP_DIR}/backup_info.txt" << EOF
Argos Project Backup
========================
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Source Directory: ${PROJECT_DIR}
Backup Location: ${BACKUP_DIR}

Contents:
- source/: Complete source code (excluding node_modules and .svelte-kit)
- git/: Git repository and bundle
- config/: Configuration files
- docs/: All documentation

File Count: $(find "${BACKUP_DIR}/source" -type f | wc -l) files
Total Size: $(du -sh "${BACKUP_DIR}" | cut -f1)

To restore from git bundle:
git clone ${BACKUP_DIR}/git/Argos.bundle restored_project
EOF

# Create compressed archive
log_message "Creating compressed archive..."
cd "${BACKUP_ROOT}" || exit 1
tar czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/" || log_error "Failed to create compressed archive"

# Calculate checksums
log_message "Calculating checksums..."
sha256sum "${BACKUP_NAME}.tar.gz" > "${BACKUP_NAME}.tar.gz.sha256"

# Update backup log
log_message "Updating backup log..."
if [ ! -f "${LOG_FILE}" ]; then
    cat > "${LOG_FILE}" << 'EOF'
# Argos Backup Log

This log tracks all backups created for the Argos project.

## Backup Format

Each backup contains:
- **source/**: Complete source code (excluding node_modules and build artifacts)
- **git/**: Git repository data and bundle for easy restoration
- **config/**: Configuration files (package.json, svelte.config.js, etc.)
- **docs/**: All documentation files

## Backup History

EOF
fi

# Append to backup log
cat >> "${LOG_FILE}" << EOF

### ${BACKUP_NAME}
- **Date**: $(date)
- **Location**: ${BACKUP_DIR}
- **Archive**: ${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz
- **Size**: $(du -sh "${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz" | cut -f1)
- **SHA256**: $(cat "${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz.sha256" | cut -d' ' -f1)
- **Files**: $(find "${BACKUP_DIR}/source" -type f | wc -l) files backed up

EOF

# Display summary
echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
echo "----------------------------------------"
echo "Backup Name: ${BACKUP_NAME}"
echo "Directory: ${BACKUP_DIR}"
echo "Archive: ${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz"
echo "Size: $(du -sh "${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz" | cut -f1)"
echo "Files: $(find "${BACKUP_DIR}/source" -type f | wc -l)"
echo "----------------------------------------"
echo ""
echo "To restore from this backup:"
echo "1. Extract: tar xzf ${BACKUP_ROOT}/${BACKUP_NAME}.tar.gz"
echo "2. Copy source: cp -r ${BACKUP_NAME}/source/* /path/to/restore/"
echo "3. Or restore from git: git clone ${BACKUP_NAME}/git/Argos.bundle"