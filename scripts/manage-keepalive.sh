#!/bin/bash

# Dev Server Keep-Alive Management Script
# Provides easy commands to start, stop, and monitor the keep-alive service

set -euo pipefail

PROJECT_DIR="/home/pi/projects/Argos"
SERVICE_FILE="$PROJECT_DIR/scripts/simple-keepalive.service"
LOG_FILE="$PROJECT_DIR/logs/simple-keepalive.log"
SERVICE_NAME="simple-keepalive"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|install|uninstall}"
    echo ""
    echo "Commands:"
    echo "  start     - Start the keep-alive monitoring"
    echo "  stop      - Stop the keep-alive monitoring"
    echo "  restart   - Restart the keep-alive monitoring"
    echo "  status    - Show current status"
    echo "  logs      - Show recent logs"
    echo "  install   - Install as system service"
    echo "  uninstall - Remove system service"
}

install_service() {
    echo -e "${BLUE}Installing dev server keep-alive service...${NC}"
    
    # Copy service file to systemd
    sudo cp "$SERVICE_FILE" /etc/systemd/system/
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME.service"
    
    echo -e "${GREEN}Service installed successfully!${NC}"
    echo "Use 'sudo systemctl start $SERVICE_NAME' to start the service"
}

uninstall_service() {
    echo -e "${BLUE}Uninstalling dev server keep-alive service...${NC}"
    
    # Stop and disable service
    sudo systemctl stop "$SERVICE_NAME.service" 2>/dev/null || true
    sudo systemctl disable "$SERVICE_NAME.service" 2>/dev/null || true
    
    # Remove service file
    sudo rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    
    # Reload systemd
    sudo systemctl daemon-reload
    
    echo -e "${GREEN}Service uninstalled successfully!${NC}"
}

start_service() {
    echo -e "${BLUE}Starting dev server keep-alive...${NC}"
    
    if systemctl is-active --quiet "$SERVICE_NAME.service"; then
        echo -e "${YELLOW}Service is already running${NC}"
    else
        sudo systemctl start "$SERVICE_NAME.service"
        echo -e "${GREEN}Service started successfully!${NC}"
    fi
}

stop_service() {
    echo -e "${BLUE}Stopping dev server keep-alive...${NC}"
    
    sudo systemctl stop "$SERVICE_NAME.service"
    echo -e "${GREEN}Service stopped successfully!${NC}"
}

restart_service() {
    echo -e "${BLUE}Restarting dev server keep-alive...${NC}"
    
    sudo systemctl restart "$SERVICE_NAME.service"
    echo -e "${GREEN}Service restarted successfully!${NC}"
}

show_status() {
    echo -e "${BLUE}Dev Server Keep-Alive Status:${NC}"
    echo ""
    
    # Service status
    if systemctl is-active --quiet simple-keepalive.service; then
        echo -e "Service Status: ${GREEN}RUNNING${NC}"
    else
        echo -e "Service Status: ${RED}STOPPED${NC}"
    fi
    
    # Server health checks
    echo ""
    echo "Server Health Checks:"
    
    # Check localhost
    if curl -s --connect-timeout 2 --max-time 5 "http://localhost:5173" >/dev/null 2>&1; then
        echo -e "  Localhost:5173:  ${GREEN}✓ RESPONDING${NC}"
    else
        echo -e "  Localhost:5173:  ${RED}✗ NOT RESPONDING${NC}"
    fi
    
    # Check LAN
    if curl -s --connect-timeout 2 --max-time 5 "http://192.168.0.172:5173" >/dev/null 2>&1; then
        echo -e "  LAN (192.168.0.172):5173: ${GREEN}✓ RESPONDING${NC}"
    else
        echo -e "  LAN (192.168.0.172):5173: ${RED}✗ NOT RESPONDING${NC}"
    fi
    
    # Check Tailscale
    if curl -s --connect-timeout 2 --max-time 5 "http://100.68.185.86:5173" >/dev/null 2>&1; then
        echo -e "  Tailscale (100.68.185.86):5173: ${GREEN}✓ RESPONDING${NC}"
    else
        echo -e "  Tailscale (100.68.185.86):5173: ${RED}✗ NOT RESPONDING${NC}"
    fi
    
    # Tailscale status
    echo ""
    if tailscale status --json 2>/dev/null | jq -r '.BackendState' | grep -q "Running"; then
        echo -e "Tailscale Status: ${GREEN}CONNECTED${NC}"
    else
        echo -e "Tailscale Status: ${RED}DISCONNECTED${NC}"
    fi
    
    # Recent logs
    echo ""
    echo "Recent Activity:"
    if [[ -f "$LOG_FILE" ]]; then
        tail -n 5 "$LOG_FILE" | while read -r line; do
            echo "  $line"
        done
    else
        echo "  No log file found"
    fi
}

show_logs() {
    echo -e "${BLUE}Recent Keep-Alive Logs:${NC}"
    echo ""
    
    if [[ -f "$LOG_FILE" ]]; then
        tail -n 20 "$LOG_FILE"
    else
        echo "No log file found at $LOG_FILE"
    fi
    
    echo ""
    echo -e "${BLUE}Live Service Logs (press Ctrl+C to exit):${NC}"
    journalctl -u simple-keepalive.service -f
}

# Main command handling
case "${1:-}" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    install)
        install_service
        ;;
    uninstall)
        uninstall_service
        ;;
    *)
        print_usage
        exit 1
        ;;
esac