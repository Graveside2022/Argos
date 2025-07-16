#!/bin/bash
#
# OpenCellID API Setup Wizard
# Simple script to configure OpenCellID API key for Argos
#
# Usage: bash setup-opencellid.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${PROJECT_DIR}/config"
CONFIG_FILE="${CONFIG_DIR}/opencellid.json"

print_banner() {
    echo -e "${BLUE}#######################################################################################${NC}"
    echo -e "${BLUE}# OpenCellID API Setup Wizard${NC}"
    echo -e "${BLUE}# Configure your API key for cell tower lookup features${NC}"
    echo -e "${BLUE}#######################################################################################${NC}"
    echo ""
}

check_existing_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        echo -e "${YELLOW}Existing OpenCellID configuration found.${NC}"
        echo -e "Current configuration:"
        
        if command -v jq &> /dev/null; then
            echo -e "${BLUE}API Key:${NC} $(jq -r '.apiKey' "$CONFIG_FILE" | sed 's/./*/g')"
            echo -e "${BLUE}Enabled:${NC} $(jq -r '.enabled' "$CONFIG_FILE")"
        else
            echo -e "File: $CONFIG_FILE"
        fi
        
        echo ""
        read -p "Update existing configuration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Configuration update cancelled."
            exit 0
        fi
    fi
}

show_api_info() {
    echo -e "${BLUE}About OpenCellID API:${NC}"
    echo -e "OpenCellID provides cell tower location data for GSM, UMTS, and LTE networks."
    echo -e "This enables Argos to:"
    echo -e "  • Look up cell tower locations by Cell ID"
    echo -e "  • Display nearby cell towers on maps"
    echo -e "  • Convert Cell ID to GPS coordinates"
    echo -e "  • Enhance GSM analysis capabilities"
    echo ""
    echo -e "${BLUE}Getting an API Key:${NC}"
    echo -e "1. Visit: ${YELLOW}https://opencellid.org/register${NC}"
    echo -e "2. Create a free account"
    echo -e "3. Generate an API key"
    echo -e "4. Copy the API key for use below"
    echo ""
    echo -e "${BLUE}API Limits:${NC}"
    echo -e "• Free tier: 1,000 requests per day"
    echo -e "• Paid tiers available for higher usage"
    echo ""
}

get_api_key() {
    local api_key=""
    
    while true; do
        read -p "Enter your OpenCellID API key: " api_key
        
        if [[ -z "$api_key" ]]; then
            echo -e "${RED}Error: API key cannot be empty${NC}"
            continue
        fi
        
        if [[ ${#api_key} -lt 10 ]]; then
            echo -e "${RED}Error: API key seems too short (expected 20+ characters)${NC}"
            read -p "Are you sure this is correct? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                continue
            fi
        fi
        
        break
    done
    
    echo "$api_key"
}

test_api_key() {
    local api_key="$1"
    
    echo -e "${BLUE}Testing API key...${NC}"
    
    # Test with a known cell tower (example: T-Mobile tower)
    local test_response
    test_response=$(curl -s "https://opencellid.org/cell/get?key=${api_key}&mcc=310&mnc=260&lac=1&cellid=1" 2>/dev/null || echo "ERROR")
    
    if [[ "$test_response" == "ERROR" ]]; then
        echo -e "${RED}Error: Unable to connect to OpenCellID API${NC}"
        return 1
    fi
    
    # Check if response contains error
    if echo "$test_response" | grep -q "error"; then
        echo -e "${RED}Error: API key validation failed${NC}"
        echo -e "Response: $test_response"
        return 1
    fi
    
    # Check if response contains valid data or "not found" (both are valid responses)
    if echo "$test_response" | grep -q -E "(lat|lon|not found)"; then
        echo -e "${GREEN}Success: API key is valid${NC}"
        return 0
    else
        echo -e "${YELLOW}Warning: Unexpected response, but API key might be valid${NC}"
        echo -e "Response: $test_response"
        return 0
    fi
}

create_config() {
    local api_key="$1"
    
    # Create config directory if it doesn't exist
    mkdir -p "$CONFIG_DIR"
    
    # Create configuration file
    cat > "$CONFIG_FILE" <<EOF
{
  "apiKey": "$api_key",
  "apiUrl": "https://opencellid.org/cell/get",
  "enabled": true,
  "cacheTimeout": 3600,
  "rateLimit": {
    "requestsPerDay": 1000,
    "requestsPerMinute": 10
  },
  "features": {
    "cellTowerLookup": true,
    "nearbyTowers": true,
    "geoLocation": true
  },
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    # Set appropriate permissions
    chmod 600 "$CONFIG_FILE"
    
    echo -e "${GREEN}Configuration saved to: $CONFIG_FILE${NC}"
}

show_usage_examples() {
    echo -e "${BLUE}Usage Examples:${NC}"
    echo ""
    echo -e "${BLUE}Cell Tower Lookup:${NC}"
    echo -e "curl \"https://opencellid.org/cell/get?key=YOUR_KEY&mcc=310&mnc=260&lac=1&cellid=1\""
    echo ""
    echo -e "${BLUE}In Argos:${NC}"
    echo -e "• GSM Evil scan results will show cell tower locations"
    echo -e "• Cell tower maps will be populated with real locations"
    echo -e "• Enhanced analysis of GSM networks"
    echo ""
    echo -e "${BLUE}Configuration File:${NC}"
    echo -e "• Location: $CONFIG_FILE"
    echo -e "• Edit manually if needed"
    echo -e "• Run this script again to update"
    echo ""
}

main() {
    print_banner
    check_existing_config
    show_api_info
    
    # Get API key
    local api_key
    api_key=$(get_api_key)
    
    # Test API key
    if test_api_key "$api_key"; then
        # Create configuration
        create_config "$api_key"
        
        echo ""
        echo -e "${GREEN}#######################################################################################${NC}"
        echo -e "${GREEN}# OpenCellID Setup Complete!${NC}"
        echo -e "${GREEN}#######################################################################################${NC}"
        echo ""
        
        show_usage_examples
        
        echo -e "${GREEN}Your Argos system is now configured for cell tower lookup features!${NC}"
        echo ""
        
        # Restart Argos service if running
        if systemctl is-active --quiet argos.service 2>/dev/null; then
            echo -e "${BLUE}Restarting Argos service to apply new configuration...${NC}"
            sudo systemctl restart argos.service || echo -e "${YELLOW}Warning: Failed to restart Argos service${NC}"
        fi
        
    else
        echo -e "${RED}Setup failed. Please check your API key and try again.${NC}"
        exit 1
    fi
}

# Trap to ensure cleanup on exit
trap 'echo -e "\n${RED}Setup interrupted.${NC}"' INT TERM

# Run main setup
main "$@"