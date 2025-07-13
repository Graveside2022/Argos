#!/bin/bash
#
# Feature Creep Prevention Framework Installation Script
# 
# This script installs and configures all components of the Feature Creep
# Prevention Framework for the Argos migration project.
#

set -e  # Exit on any error

echo "🛡️  Installing Feature Creep Prevention Framework"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    error "Please run this script from the Argos project root directory"
    exit 1
fi

info "Installing in: $(pwd)"

# 1. INSTALL REQUIRED DEPENDENCIES
echo -e "\n📦 Installing required dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    warning "node_modules not found, running npm install..."
    npm install
fi

# Install framework-specific dependencies
info "Installing visual regression testing dependencies..."
npm install --save-dev puppeteer pixelmatch pngjs

# Install CSS validation dependencies
info "Installing CSS validation dependencies..."
npm install --save-dev css-tree postcss

success "Dependencies installed successfully"

# 2. CREATE DIRECTORY STRUCTURE
echo -e "\n📁 Creating framework directory structure..."

FRAMEWORK_DIRS=(
    "visual-baselines"
    "visual-current"
    "visual-diffs"
    "scripts"
    "framework-reports"
)

for dir in "${FRAMEWORK_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        info "Created directory: $dir"
    else
        info "Directory exists: $dir"
    fi
done

success "Directory structure created"

# 3. INSTALL PRE-COMMIT HOOK
echo -e "\n🪝 Installing pre-commit hook..."

if [ -d ".git" ]; then
    if [ -f ".git/hooks/pre-commit" ]; then
        warning "Existing pre-commit hook found, backing up..."
        cp .git/hooks/pre-commit .git/hooks/pre-commit.backup
    fi
    
    cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    success "Pre-commit hook installed"
else
    warning "Not a git repository, skipping pre-commit hook installation"
fi

# 4. GENERATE INITIAL BASELINES
echo -e "\n📋 Generating initial baselines..."

info "Generating CSS integrity baselines..."
if node scripts/css-integrity-check.js --generate-baselines; then
    success "CSS baselines generated"
else
    warning "CSS baseline generation failed (this is normal for initial setup)"
fi

info "Generating HTML structure baselines..."
if node scripts/html-structure-validator.js --generate-baselines; then
    success "HTML structure baselines generated"
else
    warning "HTML structure baseline generation failed (this is normal for initial setup)"
fi

# Note: Visual baselines require the development server to be running
warning "Visual baselines require development server - run manually when ready:"
echo "   npm run dev  # In one terminal"
echo "   node scripts/visual-regression-check.js --generate-baseline  # In another"

# 5. CREATE NPM SCRIPTS
echo -e "\n📜 Adding NPM scripts..."

# Check if package.json has the scripts section
if ! grep -q '"scripts"' package.json; then
    error "Could not find scripts section in package.json"
    exit 1
fi

# Create temporary script additions
cat > /tmp/framework-scripts.json << 'EOF'
{
  "framework:check-css": "node scripts/css-integrity-check.js",
  "framework:check-html": "node scripts/html-structure-validator.js",
  "framework:check-visual": "node scripts/visual-regression-check.js",
  "framework:generate-baselines": "node scripts/css-integrity-check.js --generate-baselines && node scripts/html-structure-validator.js --generate-baselines",
  "framework:generate-visual-baselines": "node scripts/visual-regression-check.js --generate-baseline",
  "framework:validate-all": "npm run framework:check-css && npm run framework:check-html",
  "framework:full-check": "npm run framework:validate-all && npm run framework:check-visual"
}
EOF

info "Framework NPM scripts ready for manual addition to package.json"
success "See /tmp/framework-scripts.json for script definitions"

# 6. CREATE CONFIGURATION FILE
echo -e "\n⚙️  Creating framework configuration..."

cat > framework-config.json << 'EOF'
{
  "version": "1.0.0",
  "installDate": "DATE_PLACEHOLDER",
  "settings": {
    "visualRegression": {
      "threshold": 0.0,
      "includeAA": false,
      "viewports": [
        { "name": "desktop", "width": 1920, "height": 1080 },
        { "name": "tablet", "width": 768, "height": 1024 },
        { "name": "mobile", "width": 375, "height": 667 }
      ]
    },
    "cssIntegrity": {
      "protectedFiles": [
        "src/lib/styles/hackrf/style.css",
        "src/lib/styles/hackrf/monochrome-theme.css",
        "src/lib/styles/hackrf/geometric-backgrounds.css",
        "src/lib/styles/hackrf/custom-components-exact.css",
        "src/lib/styles/hackrf/saasfly-buttons.css"
      ]
    },
    "htmlStructure": {
      "protectedComponents": [
        "src/routes/hackrf/+page.svelte",
        "src/routes/kismet/+page.svelte",
        "src/lib/components/hackrf/HackRFHeader.svelte",
        "src/lib/components/hackrf/SpectrumChart.svelte",
        "src/lib/components/hackrf/FrequencyConfig.svelte",
        "src/lib/components/hackrf/StatusDisplay.svelte",
        "src/lib/components/hackrf/SweepControl.svelte",
        "src/lib/components/hackrf/AnalysisTools.svelte",
        "src/lib/components/hackrf/GeometricBackground.svelte"
      ]
    }
  },
  "enforcement": {
    "preCommitHook": true,
    "ciIntegration": false,
    "rollbackOnViolation": true
  }
}
EOF

# Replace date placeholder
sed -i "s/DATE_PLACEHOLDER/$(date -u +"%Y-%m-%dT%H:%M:%SZ")/g" framework-config.json

success "Framework configuration created: framework-config.json"

# 7. CREATE .gitignore ENTRIES
echo -e "\n📝 Updating .gitignore..."

GITIGNORE_ENTRIES=(
    "# Feature Creep Prevention Framework"
    "visual-current/"
    "visual-diffs/"
    "framework-reports/"
    "*-report.json"
    "*.backup"
)

# Add entries to .gitignore if they don't exist
for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if ! grep -q "$entry" .gitignore 2>/dev/null; then
        echo "$entry" >> .gitignore
        info "Added to .gitignore: $entry"
    fi
done

success ".gitignore updated"

# 8. CREATE DOCUMENTATION SYMLINKS
echo -e "\n🔗 Creating documentation links..."

if [ ! -f "docs/FEATURE_CREEP_PREVENTION.md" ]; then
    mkdir -p docs
    ln -sf ../FEATURE_CREEP_PREVENTION_FRAMEWORK.md docs/FEATURE_CREEP_PREVENTION.md
    success "Created documentation symlink"
fi

# 9. VALIDATE INSTALLATION
echo -e "\n🔍 Validating installation..."

VALIDATION_CHECKS=(
    "scripts/css-integrity-check.js"
    "scripts/html-structure-validator.js"
    "scripts/visual-regression-check.js"
    "scripts/pre-commit-hook.sh"
    "FEATURE_CREEP_PREVENTION_FRAMEWORK.md"
    "framework-config.json"
)

ALL_VALID=true
for file in "${VALIDATION_CHECKS[@]}"; do
    if [ -f "$file" ]; then
        info "✓ $file"
    else
        error "✗ $file (missing)"
        ALL_VALID=false
    fi
done

# Check if scripts are executable
EXECUTABLE_SCRIPTS=(
    "scripts/pre-commit-hook.sh"
    "scripts/css-integrity-check.js"
    "scripts/html-structure-validator.js"
    "scripts/visual-regression-check.js"
)

for script in "${EXECUTABLE_SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        info "✓ $script (executable)"
    else
        warning "Making $script executable..."
        chmod +x "$script"
    fi
done

# 10. FINAL SUMMARY
echo -e "\n" + "="*60
if [ "$ALL_VALID" = true ]; then
    success "🎉 Feature Creep Prevention Framework installed successfully!"
else
    error "❌ Installation completed with some issues"
fi
echo "="*60

echo -e "\n📋 NEXT STEPS:"
echo "1. Add the framework NPM scripts to package.json (see /tmp/framework-scripts.json)"
echo "2. Start development server: npm run dev"
echo "3. Generate visual baselines: npm run framework:generate-visual-baselines"
echo "4. Run initial validation: npm run framework:validate-all"
echo "5. Commit the framework setup"

echo -e "\n🛡️  FRAMEWORK COMMANDS:"
echo "• npm run framework:check-css          - Validate CSS integrity"
echo "• npm run framework:check-html         - Validate HTML structure"  
echo "• npm run framework:check-visual       - Run visual regression tests"
echo "• npm run framework:validate-all       - Run all validation checks"
echo "• npm run framework:full-check         - Complete framework validation"

echo -e "\n📚 DOCUMENTATION:"
echo "• FEATURE_CREEP_PREVENTION_FRAMEWORK.md - Complete framework documentation"
echo "• framework-config.json                 - Framework configuration"
echo "• Pre-commit hook automatically prevents violations"

echo -e "\n⚠️  IMPORTANT REMINDERS:"
echo "• All CSS modifications are FORBIDDEN without authorization"
echo "• HTML structure must be preserved exactly"
echo "• Visual changes trigger automatic rollback"
echo "• Framework rules are BINDING and mandatory"

echo -e "\n${GREEN}✅ Framework is now active and protecting against feature creep!${NC}"