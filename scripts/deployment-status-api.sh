#!/bin/bash

# Argos Deployment Status API Server
# Tesla Orchestrator Prime Integration
# Provides real-time deployment status via HTTP API

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
STATUS_FILE="${PROJECT_ROOT}/deployment_status.json"
LOG_FILE="${PROJECT_ROOT}/deployment.log"
API_PORT=8099
PID_FILE="${PROJECT_ROOT}/deployment_status_api.pid"

# ============================================================================
# API ENDPOINTS
# ============================================================================

handle_request() {
    local method="$1"
    local path="$2"
    local query="$3"
    
    case "$path" in
        "/")
            if [[ "$method" == "POST" ]]; then
                trigger_deployment
            else
                serve_status
            fi
            ;;
        "/status")
            serve_status
            ;;
        "/logs")
            serve_logs
            ;;
        "/health")
            serve_health
            ;;
        *)
            serve_404
            ;;
    esac
}

trigger_deployment() {
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo "Access-Control-Allow-Origin: *"
    echo ""
    
    # Check if deployment is already running
    if pgrep -f "deploy-master.sh" > /dev/null; then
        echo '{"status":"running","message":"Deployment already in progress"}'
    else
        # Start deployment in background
        nohup "${SCRIPT_DIR}/deploy-master.sh" deploy > "${LOG_FILE}" 2>&1 &
        echo '{"status":"started","message":"Grade A+ deployment initiated","deployment_id":"'$(date +%s)'"}'
    fi
}

serve_status() {
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo "Access-Control-Allow-Origin: *"
    echo ""
    
    if [[ -f "$STATUS_FILE" ]]; then
        cat "$STATUS_FILE"
    else
        echo '{"status":"idle","message":"No deployment in progress","timestamp":"'$(date -Iseconds)'"}'
    fi
}

serve_logs() {
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: text/plain"
    echo "Access-Control-Allow-Origin: *"
    echo ""
    
    if [[ -f "$LOG_FILE" ]]; then
        tail -n 50 "$LOG_FILE"
    else
        echo "No deployment logs available"
    fi
}

serve_health() {
    echo "HTTP/1.1 200 OK"
    echo "Content-Type: application/json"
    echo "Access-Control-Allow-Origin: *"
    echo ""
    
    local services_status='[]'
    if command -v systemctl >/dev/null 2>&1; then
        services_status=$(systemctl is-active argos openwebrx kismet 2>/dev/null | jq -R . | jq -s .)
    fi
    
    echo '{"api_status":"healthy","timestamp":"'$(date -Iseconds)'","services":'$services_status'}'
}

serve_404() {
    echo "HTTP/1.1 404 Not Found"
    echo "Content-Type: application/json"
    echo "Access-Control-Allow-Origin: *"
    echo ""
    echo '{"error":"Not Found","message":"Invalid endpoint"}'
}

# ============================================================================
# HTTP SERVER
# ============================================================================

start_server() {
    echo "Starting deployment status API server on port $API_PORT"
    echo "API endpoints:"
    echo "  POST /     - Trigger deployment"
    echo "  GET /status - Get deployment status"
    echo "  GET /logs   - Get deployment logs"
    echo "  GET /health - Get service health"
    
    # Kill existing server if running
    if [[ -f "$PID_FILE" ]]; then
        local old_pid=$(cat "$PID_FILE")
        if kill -0 "$old_pid" 2>/dev/null; then
            kill "$old_pid"
            sleep 1
        fi
    fi
    
    # Save current PID
    echo $$ > "$PID_FILE"
    
    # Start HTTP server
    while true; do
        {
            read -r method path protocol
            
            # Read headers
            while read -r header; do
                [[ "$header" == $'\r' ]] && break
            done
            
            # Extract query string
            local query=""
            if [[ "$path" == *"?"* ]]; then
                query="${path#*?}"
                path="${path%%?*}"
            fi
            
            # Handle request
            handle_request "$method" "$path" "$query"
            
        } | nc -l -p "$API_PORT" -q 1
        
        sleep 0.1
    done
}

stop_server() {
    if [[ -f "$PID_FILE" ]]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo "API server stopped"
        fi
        rm -f "$PID_FILE"
    fi
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    case "${1:-start}" in
        "start")
            start_server
            ;;
        "stop")
            stop_server
            ;;
        "restart")
            stop_server
            sleep 1
            start_server
            ;;
        "status")
            if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
                echo "API server is running (PID: $(cat "$PID_FILE"))"
                echo "Listening on port $API_PORT"
            else
                echo "API server is not running"
            fi
            ;;
        *)
            echo "Usage: $0 {start|stop|restart|status}"
            exit 1
            ;;
    esac
}

# Handle cleanup on exit
trap 'stop_server' EXIT

main "$@"