#!/bin/bash
# AGENT COORDINATION CONTROLLER
# Manages parallel agent execution and enforces binding protocols

set -euo pipefail

AGENTS_DIR="/tmp/argos-agents"
PROJECT_DIR="/home/pi/projects/Argos"

# Load configuration
if [ ! -f "${AGENTS_DIR}/coordination/deployment-status.json" ]; then
    echo "[ERROR] ERROR: Agent environment not initialized. Run parallel-agent-init.sh first"
    exit 1
fi

DEPLOYMENT_ID=$(jq -r '.deployment_id' "${AGENTS_DIR}/coordination/deployment-status.json")

# Command functions
cmd_status() {
    echo "[STATUS] PARALLEL AGENT STATUS - Deployment: ${DEPLOYMENT_ID}"
    echo "======================================================="
    
    # Overall deployment status
    jq -r '"[INFO] Overall Status: " + .status' "${AGENTS_DIR}/coordination/deployment-status.json"
    jq -r '"[TIMER]  Started: " + .start_time' "${AGENTS_DIR}/coordination/deployment-status.json"
    echo ""
    
    # Agent summary
    ACTIVE=$(jq -r '.agents.active' "${AGENTS_DIR}/coordination/deployment-status.json")
    WAITING=$(jq -r '.agents.waiting' "${AGENTS_DIR}/coordination/deployment-status.json")
    BLOCKED=$(jq -r '.agents.blocked' "${AGENTS_DIR}/coordination/deployment-status.json")
    COMPLETE=$(jq -r '.agents.complete' "${AGENTS_DIR}/coordination/deployment-status.json")
    
    echo "[AUTO] Agent Summary: Active($ACTIVE) Waiting($WAITING) Blocked($BLOCKED) Complete($COMPLETE)"
    echo ""
    
    # Individual agent status
    for i in {01..10}; do
        STATUS_FILE="${AGENTS_DIR}/coordination/agent-${i}-status.json"
        if [ -f "$STATUS_FILE" ]; then
            local status=$(jq -r '.status' "$STATUS_FILE")
            local progress=$(jq -r '.progress' "$STATUS_FILE")
            local task=$(jq -r '.current_task // "idle"' "$STATUS_FILE")
            local conflicts=$(jq -r '.conflicts | length' "$STATUS_FILE")
            
            local icon="[ACTIVE]"
            case $status in
                "blocked") icon="[CRIT]" ;;
                "waiting") icon="[WARN]" ;;
                "complete") icon="[OK]" ;;
            esac
            
            echo "${icon} Agent-${i}: ${status} (${progress}%) - ${task}"
            if [ "$conflicts" -gt 0 ]; then
                echo "   [WARN]  Conflicts: $conflicts"
            fi
        fi
    done
}

cmd_deploy() {
    local task_type=$1
    local task_description=$2
    
    if [ -z "$task_type" ] || [ -z "$task_description" ]; then
        echo "Usage: $0 deploy <simple|complex> <task-description>"
        exit 1
    fi
    
    # Determine agent count based on binding protocol
    local agent_count=5
    if [ "$task_type" = "complex" ]; then
        agent_count=10
    fi
    
    echo "[START] DEPLOYING PARALLEL AGENTS - Type: $task_type ($agent_count agents)"
    echo "[INFO] Task: $task_description"
    echo "[LOCK] BINDING PROTOCOL: Mandatory parallel execution enforced"
    echo ""
    
    # Update deployment status
    jq --arg task_type "$task_type" --arg desc "$task_description" \
       --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       '.status = "deploying" | .task_complexity = $task_type | .current_task = $desc | .deploy_time = $timestamp' \
       "${AGENTS_DIR}/coordination/deployment-status.json" > /tmp/deploy-status.tmp
    mv /tmp/deploy-status.tmp "${AGENTS_DIR}/coordination/deployment-status.json"
    
    # Assign agents based on task type
    if [ "$task_type" = "simple" ]; then
        # Simple tasks: agents 01, 02, 05, 06, 10
        local agents=(01 02 05 06 10)
    else
        # Complex tasks: all 10 agents
        local agents=(01 02 03 04 05 06 07 08 09 10)
    fi
    
    # Deploy agents in parallel
    echo "[ACTIVE] Deploying ${#agents[@]} agents in parallel..."
    for agent_id in "${agents[@]}"; do
        echo "[AUTO] Activating Agent-${agent_id}..."
        
        # Update agent status to active
        jq --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
           --arg task "$task_description" \
           '.status = "active" | .current_task = $task | .last_update = $timestamp' \
           "${AGENTS_DIR}/coordination/agent-${agent_id}-status.json" > /tmp/agent-status.tmp
        mv /tmp/agent-status.tmp "${AGENTS_DIR}/coordination/agent-${agent_id}-status.json"
    done
    
    echo "[OK] All agents deployed in parallel"
    echo "[STATUS] Monitor with: $0 status"
    echo "[STOP] Emergency stop: $0 emergency-stop"
}

cmd_sync() {
    local checkpoint=$1
    local required_agents=$2
    
    if [ -z "$checkpoint" ]; then
        echo "Usage: $0 sync <checkpoint> [required-agents]"
        echo "Available checkpoints: alpha, beta, gamma, delta, release"
        exit 1
    fi
    
    # Default to all agents if not specified
    if [ -z "$required_agents" ]; then
        required_agents="01,02,03,04,05,06,07,08,09,10"
    fi
    
    echo "[RETRY] SYNCHRONIZATION CHECKPOINT: $checkpoint"
    echo "[AGENTS] Required agents: $required_agents"
    
    # Check sync status
    if "${AGENTS_DIR}/scripts/check-sync.sh" "$checkpoint" "$required_agents"; then
        echo "[OK] Synchronization complete for checkpoint: $checkpoint"
        
        # Log sync completion
        echo "SYNC_COMPLETE $checkpoint $(date -u +%Y-%m-%dT%H:%M:%SZ) agents:$required_agents" >> \
             "${AGENTS_DIR}/coordination/checkpoints.log"
    else
        echo "[WAIT] Waiting for agents to reach checkpoint: $checkpoint"
        echo "[TIP] Agents can signal readiness with: echo 'CHECKPOINT_REACHED agent-XX $checkpoint \$(date -u +%Y-%m-%dT%H:%M:%SZ)' >> ${AGENTS_DIR}/coordination/checkpoints.log"
    fi
}

cmd_conflicts() {
    echo "[SEARCH] CONFLICT DETECTION AND RESOLUTION"
    echo "===================================="
    
    # Run conflict detection
    "${AGENTS_DIR}/scripts/resolve-conflicts.sh"
    
    # Check for escalations
    if [ -f "${AGENTS_DIR}/coordination/escalations.log" ] && [ -s "${AGENTS_DIR}/coordination/escalations.log" ]; then
        echo ""
        echo "[ALERT] ESCALATIONS DETECTED:"
        tail -5 "${AGENTS_DIR}/coordination/escalations.log"
    fi
    
    # Check for emergency stops
    if [ -f "${AGENTS_DIR}/coordination/emergency.log" ] && [ -s "${AGENTS_DIR}/coordination/emergency.log" ]; then
        echo ""
        echo "[STOP] EMERGENCY EVENTS:"
        tail -3 "${AGENTS_DIR}/coordination/emergency.log"
    fi
}

cmd_handoff() {
    local from_agent=$1
    local to_agent=$2
    local task_id=$3
    
    if [ -z "$from_agent" ] || [ -z "$to_agent" ] || [ -z "$task_id" ]; then
        echo "Usage: $0 handoff <from-agent> <to-agent> <task-id>"
        exit 1
    fi
    
    local handoff_id="handoff-$(date +%s)"
    echo "[RETRY] TASK HANDOFF: $from_agent → $to_agent"
    echo "[INFO] Task ID: $task_id"
    echo "🆔 Handoff ID: $handoff_id"
    
    # Create handoff record
    cat > "${AGENTS_DIR}/handoffs/pending/${handoff_id}.json" << EOF
{
  "handoff_id": "$handoff_id",
  "from_agent": "$from_agent",
  "to_agent": "$to_agent",
  "task_id": "$task_id",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "pending",
  "deliverables": [],
  "validation_required": true
}
EOF
    
    # Log handoff initiation
    echo "HANDOFF_INITIATED $from_agent $to_agent $handoff_id $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> \
         "${AGENTS_DIR}/coordination/handoffs.log"
    
    echo "[OK] Handoff initiated. Waiting for agent acknowledgment."
}

cmd_emergency_stop() {
    echo "[STOP] EMERGENCY STOP - TERMINATING ALL AGENTS"
    echo "=========================================="
    
    # Log emergency stop
    echo "EMERGENCY_STOP manual $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> \
         "${AGENTS_DIR}/coordination/emergency.log"
    
    # Update all agent statuses to stopped
    for i in {01..10}; do
        if [ -f "${AGENTS_DIR}/coordination/agent-${i}-status.json" ]; then
            jq '.status = "emergency_stopped" | .last_update = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' \
               "${AGENTS_DIR}/coordination/agent-${i}-status.json" > /tmp/agent-emergency.tmp
            mv /tmp/agent-emergency.tmp "${AGENTS_DIR}/coordination/agent-${i}-status.json"
        fi
    done
    
    # Update deployment status
    jq '.status = "emergency_stopped" | .agents.active = 0 | .agents.blocked = 0 | .agents.waiting = 0' \
       "${AGENTS_DIR}/coordination/deployment-status.json" > /tmp/emergency-status.tmp
    mv /tmp/emergency-status.tmp "${AGENTS_DIR}/coordination/deployment-status.json"
    
    echo "[CRIT] All agents stopped"
    echo "[STATUS] Final status saved to coordination files"
}

cmd_cleanup() {
    echo "[CLEANUP] CLEANING UP PARALLEL AGENT ENVIRONMENT"
    echo "========================================="
    
    # Archive logs first
    local archive_name="deployment-${DEPLOYMENT_ID}-$(date +%s).tar.gz"
    echo "[PKG] Archiving logs to: /tmp/${archive_name}"
    tar -czf "/tmp/${archive_name}" -C /tmp argos-agents/
    
    # Remove git worktrees
    echo "[TREE] Removing git worktrees..."
    cd "$PROJECT_DIR"
    git worktree list | grep "agent-" | awk '{print $1}' | while read workspace; do
        echo "  [DELETE]  Removing: $workspace"
        git worktree remove "$workspace" --force
    done
    
    # Clean up temporary files
    echo "[DELETE]  Removing temporary files..."
    rm -rf "$AGENTS_DIR"
    
    echo "[OK] Cleanup complete"
    echo "[PKG] Logs archived to: /tmp/${archive_name}"
}

# Main command dispatcher
case "${1:-help}" in
    "status")
        cmd_status
        ;;
    "deploy")
        cmd_deploy "$2" "$3"
        ;;
    "sync")
        cmd_sync "$2" "$3"
        ;;
    "conflicts")
        cmd_conflicts
        ;;
    "handoff")
        cmd_handoff "$2" "$3" "$4"
        ;;
    "emergency-stop")
        cmd_emergency_stop
        ;;
    "cleanup")
        cmd_cleanup
        ;;
    "help"|*)
        cat << 'EOF'
[AUTO] PARALLEL AGENT COORDINATOR

BINDING PROTOCOL ENFORCEMENT:
- Mandatory parallel execution (NEVER sequential)
- Simple tasks: 5 agents
- Complex tasks: 10 agents

COMMANDS:
  status                           - Show agent deployment status
  deploy <simple|complex> <desc>   - Deploy agents for task
  sync <checkpoint> [agents]       - Wait for synchronization
  conflicts                        - Check and resolve conflicts
  handoff <from> <to> <task>      - Initiate task handoff
  emergency-stop                   - Emergency shutdown all agents
  cleanup                         - Clean up environment
  help                            - Show this help

EXAMPLES:
  ./agent-coordinator.sh deploy simple "Fix button styling"
  ./agent-coordinator.sh deploy complex "Implement new feature"
  ./agent-coordinator.sh sync beta "01,02,10"
  ./agent-coordinator.sh handoff agent-01 agent-02 ui-component

MONITORING:
  Watch status: watch -n 5 './agent-coordinator.sh status'
  Live monitor: /tmp/argos-agents/scripts/status-monitor.sh
EOF
        ;;
esac