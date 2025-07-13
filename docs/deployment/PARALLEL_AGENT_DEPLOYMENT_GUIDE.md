# PARALLEL AGENT DEPLOYMENT GUIDE

## BINDING PROTOCOL COMPLIANCE

This guide implements the absolute and binding rules specified in CLAUDE.md configuration:

- **MANDATORY PARALLEL EXECUTION**: NEVER sequential execution
- **Simple Tasks**: 5 agents in parallel
- **Complex Tasks**: 10 agents in parallel
- **Boot Context**: 5 agents for initialization

## 1. 10-AGENT TASK DISTRIBUTION MATRIX

### Agent Assignment Framework

| Agent ID | Primary Domain | Secondary Domain | Conflict Zone                  | Priority Level |
| -------- | -------------- | ---------------- | ------------------------------ | -------------- |
| Agent-01 | Frontend UI    | Component Logic  | UI/Logic Boundary              | HIGH           |
| Agent-02 | Backend API    | Data Processing  | API/Data Boundary              | HIGH           |
| Agent-03 | Database Ops   | Data Migration   | DB/Migration Boundary          | MEDIUM         |
| Agent-04 | WebSocket/RT   | Event Handling   | WS/Event Boundary              | HIGH           |
| Agent-05 | Testing/QA     | Validation       | Test/Code Boundary             | MEDIUM         |
| Agent-06 | Config/Setup   | Environment      | Config/Env Boundary            | LOW            |
| Agent-07 | Documentation  | Knowledge Base   | Docs/Code Boundary             | LOW            |
| Agent-08 | DevOps/Deploy  | Infrastructure   | Deploy/Code Boundary           | MEDIUM         |
| Agent-09 | Security/Auth  | Access Control   | Security/Feature Boundary      | HIGH           |
| Agent-10 | Integration    | Cross-cutting    | Integration/Isolation Boundary | CRITICAL       |

### Task Complexity Classification

#### Simple Tasks (5 Agents)

- **Scope**: Single file modifications, basic configurations, simple bug fixes
- **Duration**: < 30 minutes expected completion
- **Agents**: 01, 02, 05, 06, 10 (UI, API, Test, Config, Integration)

#### Complex Tasks (10 Agents)

- **Scope**: Multi-file changes, new features, system integrations
- **Duration**: > 30 minutes expected completion
- **Agents**: All 10 agents deployed in parallel

## 2. AGENT COORDINATION PROTOCOLS

### Communication Channels

#### Primary Status Files

```bash
# Shared coordination directory
/tmp/argos-agents/
├── coordination/
│   ├── agent-status.json      # Real-time agent status
│   ├── task-assignments.json  # Current task distribution
│   ├── conflict-log.json      # Conflict detection/resolution
│   └── sync-checkpoints.json  # Synchronization points
├── work-areas/
│   ├── agent-01-workspace/    # Individual agent workspaces
│   ├── agent-02-workspace/
│   └── ...
└── handoffs/
    ├── pending/               # Tasks awaiting handoff
    ├── in-progress/          # Active handoffs
    └── completed/            # Completed transfers
```

#### Status Broadcasting Protocol

Each agent MUST update status every 2 minutes:

```json
{
	"agent_id": "agent-01",
	"timestamp": "2025-06-26T10:30:00Z",
	"status": "active|waiting|blocked|complete",
	"current_task": "task-id",
	"progress": 0.75,
	"dependencies": ["agent-02", "agent-10"],
	"conflicts": [],
	"next_checkpoint": "sync-point-alpha",
	"estimated_completion": "2025-06-26T11:00:00Z"
}
```

### Work Area Isolation

#### Git Worktree Strategy

```bash
# Each agent gets isolated branch
git worktree add /tmp/argos-agents/work-areas/agent-01-workspace agent-01-feature
git worktree add /tmp/argos-agents/work-areas/agent-02-workspace agent-02-feature
# ... continue for all 10 agents

# Status tracking
git worktree list > /tmp/argos-agents/coordination/worktree-status.txt
```

#### File Lock Protocol

```bash
# Before editing any file, agent must acquire lock
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) agent-01 LOCK /path/to/file.ts" >> /tmp/argos-agents/coordination/file-locks.log

# After completion, release lock
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) agent-01 UNLOCK /path/to/file.ts" >> /tmp/argos-agents/coordination/file-locks.log
```

## 3. CONFLICT RESOLUTION PROCEDURES

### Conflict Detection Matrix

| Conflict Type   | Detection Method     | Resolution Protocol  | Escalation Trigger  |
| --------------- | -------------------- | -------------------- | ------------------- |
| File Lock       | Lock timeout (5 min) | Priority override    | Critical path block |
| Merge Conflict  | Git merge failure    | Agent-10 arbitration | >2 failed attempts  |
| API Boundary    | Interface mismatch   | Contract negotiation | Breaking changes    |
| Resource Race   | Simultaneous access  | Timestamp priority   | Service disruption  |
| Dependency Loop | Circular waiting     | Dependency break     | Deadlock detection  |

### Resolution Hierarchy

#### Level 1: Automatic Resolution

- **File conflicts**: Git auto-merge where possible
- **Resource conflicts**: First-come-first-served with timeout
- **Minor API changes**: Backward compatibility maintained

#### Level 2: Agent-10 Arbitration

- **Scope conflicts**: Agent-10 reassigns boundaries
- **Integration conflicts**: Agent-10 coordinates interfaces
- **Priority conflicts**: Agent-10 applies matrix rules

#### Level 3: Human Escalation

- **Architecture conflicts**: Breaking changes requiring approval
- **Security conflicts**: Authentication/authorization changes
- **Data conflicts**: Schema or migration issues

### Conflict Resolution Commands

```bash
# Detect active conflicts
rg "CONFLICT" /tmp/argos-agents/coordination/ --json

# Auto-resolve where possible
/home/pi/projects/ArgosFinal/scripts/resolve-conflicts.sh --auto

# Escalate to Agent-10
echo "ESCALATE: $(date -u +%Y-%m-%dT%H:%M:%SZ) conflict-id reason" >> /tmp/argos-agents/coordination/escalations.log

# Emergency stop all agents
pkill -f "agent-" && echo "EMERGENCY_STOP $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/emergency.log
```

## 4. PROGRESS TRACKING MECHANISMS

### Real-Time Monitoring Dashboard

#### Status Aggregation Script

```bash
#!/bin/bash
# /tmp/argos-agents/scripts/status-monitor.sh

while true; do
    echo "=== AGENT STATUS $(date) ==="
    for i in {01..10}; do
        if [ -f "/tmp/argos-agents/coordination/agent-${i}-status.json" ]; then
            echo "Agent-${i}: $(jq -r '.status' /tmp/argos-agents/coordination/agent-${i}-status.json) - $(jq -r '.progress' /tmp/argos-agents/coordination/agent-${i}-status.json)%"
        fi
    done
    echo "=========================="
    sleep 30
done
```

#### Progress Metrics Collection

```json
{
	"deployment_id": "deploy-20250626-103000",
	"start_time": "2025-06-26T10:30:00Z",
	"agents": {
		"active": 8,
		"waiting": 1,
		"blocked": 1,
		"complete": 0
	},
	"overall_progress": 0.45,
	"estimated_completion": "2025-06-26T12:15:00Z",
	"critical_path": ["agent-01", "agent-02", "agent-10"],
	"bottlenecks": ["agent-03: database lock"],
	"next_milestone": "sync-point-beta"
}
```

### Milestone Tracking

#### Checkpoint Definitions

- **Alpha**: Initial setup and workspace preparation complete
- **Beta**: Core implementation 50% complete
- **Gamma**: Integration testing phase
- **Delta**: Final validation and cleanup
- **Release**: All agents complete, ready for merge

## 5. SYNCHRONIZATION CHECKPOINTS

### Checkpoint Protocol

#### Mandatory Sync Points

1. **Project Initialization** (All 10 agents)
2. **Mid-Implementation Review** (Agents 01, 02, 05, 10)
3. **Integration Testing** (Agents 02, 04, 05, 10)
4. **Final Validation** (All 10 agents)
5. **Deployment Readiness** (Agents 08, 09, 10)

#### Sync Implementation

```bash
# Agent reaches checkpoint
echo "CHECKPOINT_REACHED agent-01 sync-point-beta $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/checkpoints.log

# Wait for required agents
while ! check_sync_ready "sync-point-beta" "agent-01,agent-02,agent-10"; do
    sleep 10
done

# Proceed after sync
echo "CHECKPOINT_CLEARED agent-01 sync-point-beta $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/checkpoints.log
```

#### Sync Validation Script

```bash
#!/bin/bash
# /tmp/argos-agents/scripts/check-sync.sh

CHECKPOINT=$1
REQUIRED_AGENTS=$2

IFS=',' read -ra AGENTS <<< "$REQUIRED_AGENTS"
ALL_READY=true

for agent in "${AGENTS[@]}"; do
    if ! grep -q "CHECKPOINT_REACHED ${agent} ${CHECKPOINT}" /tmp/argos-agents/coordination/checkpoints.log; then
        ALL_READY=false
        echo "Waiting for ${agent} at ${CHECKPOINT}"
    fi
done

if [ "$ALL_READY" = true ]; then
    echo "SYNC_READY ${CHECKPOINT}"
    exit 0
else
    exit 1
fi
```

## 6. TASK HANDOFF PROCEDURES

### Handoff Types

#### Sequential Handoff

- **Trigger**: Dependency completion
- **Process**: Automated notification + workspace transfer
- **Validation**: Receiving agent confirms task receipt

#### Parallel Handoff

- **Trigger**: Work product ready for integration
- **Process**: Multiple agents receive same deliverable
- **Validation**: All receiving agents acknowledge

#### Emergency Handoff

- **Trigger**: Agent failure or blocking issue
- **Process**: Immediate reassignment to backup agent
- **Validation**: Critical path maintained

### Handoff Implementation

#### Standard Handoff Protocol

```bash
# Initiating agent
HANDOFF_ID="handoff-$(date +%s)"
cat > /tmp/argos-agents/handoffs/pending/${HANDOFF_ID}.json << EOF
{
  "handoff_id": "${HANDOFF_ID}",
  "from_agent": "agent-01",
  "to_agent": "agent-02",
  "task_id": "task-ui-component-complete",
  "deliverables": [
    "/src/lib/components/NewComponent.svelte",
    "/src/lib/types/component-types.ts"
  ],
  "dependencies": ["api-interface-defined"],
  "deadline": "2025-06-26T11:30:00Z",
  "validation_required": true
}
EOF

# Move to in-progress
mv /tmp/argos-agents/handoffs/pending/${HANDOFF_ID}.json /tmp/argos-agents/handoffs/in-progress/

# Receiving agent acknowledgment
echo "HANDOFF_RECEIVED agent-02 ${HANDOFF_ID} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/handoffs.log
```

#### Handoff Validation

```bash
# Validate deliverables exist and are accessible
for file in $(jq -r '.deliverables[]' /tmp/argos-agents/handoffs/in-progress/${HANDOFF_ID}.json); do
    if [ ! -f "$file" ]; then
        echo "HANDOFF_VALIDATION_FAILED ${HANDOFF_ID} missing_file:$file"
        exit 1
    fi
done

# Mark handoff complete
mv /tmp/argos-agents/handoffs/in-progress/${HANDOFF_ID}.json /tmp/argos-agents/handoffs/completed/
echo "HANDOFF_COMPLETE ${HANDOFF_ID} $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/handoffs.log
```

## DEPLOYMENT COMMANDS

### Initialize Parallel Agent Environment

```bash
# Create coordination structure
mkdir -p /tmp/argos-agents/{coordination,work-areas,handoffs/{pending,in-progress,completed},scripts}

# Initialize status files
echo '{"agents":{},"status":"initializing","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > /tmp/argos-agents/coordination/deployment-status.json

# Setup git worktrees
cd /home/pi/projects/ArgosFinal
for i in {01..10}; do
    git worktree add /tmp/argos-agents/work-areas/agent-${i}-workspace -b agent-${i}-branch-$(date +%s)
done
```

### Monitor Deployment

```bash
# Real-time status
watch -n 5 'cat /tmp/argos-agents/coordination/deployment-status.json | jq .'

# Check for conflicts
rg "CONFLICT|ERROR|BLOCKED" /tmp/argos-agents/coordination/ --color always

# View progress summary
/tmp/argos-agents/scripts/status-monitor.sh
```

### Emergency Procedures

```bash
# Emergency stop all agents
pkill -f "agent-"
echo "EMERGENCY_STOP $(date -u +%Y-%m-%dT%H:%M:%SZ) manual" >> /tmp/argos-agents/coordination/emergency.log

# Cleanup workspaces
git worktree list | grep agent- | awk '{print $1}' | xargs -I {} git worktree remove {}

# Archive deployment logs
tar -czf /tmp/deployment-$(date +%s).tar.gz /tmp/argos-agents/
```

## COMPLIANCE VERIFICATION

This guide ensures:

- ✅ **NEVER sequential execution** - All protocols enforce parallel operation
- ✅ **5 agents for simple tasks** - Clear complexity classification
- ✅ **10 agents for complex tasks** - Full deployment matrix defined
- ✅ **Parallel execution mandatory** - No sequential fallbacks permitted
- ✅ **Conflict prevention** - Comprehensive resolution procedures
- ✅ **Progress tracking** - Real-time monitoring and checkpoints
- ✅ **Efficient coordination** - Clear handoff and sync protocols

**BINDING CONFIRMATION**: This deployment guide implements Christian's absolute and binding rules for parallel agent execution without deviation or exception.
