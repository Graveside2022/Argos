# PARALLEL AGENT DEPLOYMENT - QUICK REFERENCE

## BINDING PROTOCOL RULES (MANDATORY)

- ✅ **NEVER sequential execution** - Always parallel
- ✅ **Simple tasks**: 5 agents (01, 02, 05, 06, 10)
- ✅ **Complex tasks**: 10 agents (all)
- ✅ **Boot context**: 5 agents minimum

## QUICK START COMMANDS

### 1. Initialize Environment

```bash
# One-time setup
./scripts/parallel-agent-init.sh
```

### 2. Deploy Agents

```bash
# Simple task (5 agents)
./scripts/agent-coordinator.sh deploy simple "Fix CSS styling issue"

# Complex task (10 agents)
./scripts/agent-coordinator.sh deploy complex "Implement new WebSocket feature"
```

### 3. Monitor Progress

```bash
# Quick status check
./scripts/agent-coordinator.sh status

# Live monitoring
watch -n 5 './scripts/agent-coordinator.sh status'

# Detailed monitoring
/tmp/argos-agents/scripts/status-monitor.sh
```

### 4. Synchronization

```bash
# Wait for checkpoint
./scripts/agent-coordinator.sh sync beta "01,02,10"

# Signal agent readiness
echo "CHECKPOINT_REACHED agent-01 beta $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> /tmp/argos-agents/coordination/checkpoints.log
```

### 5. Emergency Controls

```bash
# Emergency stop all agents
./scripts/agent-coordinator.sh emergency-stop

# Check for conflicts
./scripts/agent-coordinator.sh conflicts

# Clean up environment
./scripts/agent-coordinator.sh cleanup
```

## AGENT ROLES MATRIX

| Agent | Primary Domain | Use Case                             |
| ----- | -------------- | ------------------------------------ |
| 01    | Frontend UI    | React/Svelte components, styling     |
| 02    | Backend API    | Server endpoints, data processing    |
| 03    | Database       | Schema, migrations, queries          |
| 04    | WebSocket/RT   | Real-time features, event handling   |
| 05    | Testing/QA     | Unit tests, integration tests        |
| 06    | Config/Setup   | Environment, build configuration     |
| 07    | Documentation  | API docs, code comments              |
| 08    | DevOps/Deploy  | CI/CD, infrastructure                |
| 09    | Security/Auth  | Authentication, authorization        |
| 10    | Integration    | Cross-cutting concerns, coordination |

## COORDINATION FILES

### Status Tracking

- `/tmp/argos-agents/coordination/deployment-status.json` - Overall deployment
- `/tmp/argos-agents/coordination/agent-XX-status.json` - Individual agents
- `/tmp/argos-agents/coordination/checkpoints.log` - Sync points

### Conflict Management

- `/tmp/argos-agents/coordination/file-locks.log` - File access locks
- `/tmp/argos-agents/coordination/escalations.log` - Escalated conflicts
- `/tmp/argos-agents/coordination/emergency.log` - Emergency events

### Task Handoffs

- `/tmp/argos-agents/handoffs/pending/` - Waiting for acceptance
- `/tmp/argos-agents/handoffs/in-progress/` - Active transfers
- `/tmp/argos-agents/handoffs/completed/` - Finished handoffs

## SYNC CHECKPOINTS

1. **Alpha** - Initial setup complete
2. **Beta** - Core implementation 50% done
3. **Gamma** - Integration testing phase
4. **Delta** - Final validation
5. **Release** - Ready for deployment

## TROUBLESHOOTING

### Common Issues

```bash
# Stale file locks
grep "LOCK" /tmp/argos-agents/coordination/file-locks.log | tail -10

# Git conflicts
for i in {01..10}; do
    cd /tmp/argos-agents/work-areas/agent-${i}-workspace 2>/dev/null && git status --porcelain | grep "UU\|AA"
done

# Blocked agents
./scripts/agent-coordinator.sh status | grep "blocked"
```

### Recovery Commands

```bash
# Reset specific agent
jq '.status = "ready" | .current_task = null' /tmp/argos-agents/coordination/agent-01-status.json > /tmp/reset.json
mv /tmp/reset.json /tmp/argos-agents/coordination/agent-01-status.json

# Force sync completion
echo "SYNC_COMPLETE beta $(date -u +%Y-%m-%dT%H:%M:%SZ) manual-override" >> /tmp/argos-agents/coordination/checkpoints.log

# Manual conflict resolution
./scripts/agent-coordinator.sh conflicts
```

## BINDING PROTOCOL VERIFICATION

Before each deployment, verify:

- [ ] Task classified as simple (5 agents) or complex (10 agents)
- [ ] No sequential execution patterns
- [ ] All required agents deployed in parallel
- [ ] Coordination infrastructure initialized
- [ ] Conflict resolution protocols active

**Remember**: Christian's instructions are absolute and binding rules. Sequential execution is FORBIDDEN. Always use parallel agent deployment.
