# Claude Agent Ecosystem - Argos Project

This directory contains the AI agent definition files for the Argos SDR & Network Analysis Console project.

## Agent Ecosystem Overview

**Total Agents: 27** (22 specialists + 5 workflow orchestrators)
- **Core Technical Architecture:** 4 agents
- **Hardware Integration & SDR Domain:** 5 agents  
- **Security & Network Intelligence:** 3 agents
- **Code Quality & Testing:** 3 agents
- **System Operations & DevOps:** 3 agents
- **Development Process & Quality:** 2 agents
- **Project Management & Coordination:** 2 agents
- **Workflow Orchestrators:** 5 agents

## Directory Structure

- `agents/` - Individual agent definition files (.md format)
  - **Specialist Agents**: Domain experts with 15+ years equivalent expertise
  - **Workflow Orchestrators**: Multi-agent process coordinators
  - Each agent has specific triggers, tools, and comprehensive SOPs
  - All agents follow defense-grade quality and security standards

## Core Technical Architecture Agents

- `sveltekit-architecture-expert` - SvelteKit 2.22.3 + Svelte 5 patterns
- `realtime-websocket-architect` - High-performance WebSocket streaming
- `spatial-database-expert` - SQLite R-tree spatial indexing optimization  
- `nodejs-performance-specialist` - Node.js memory and V8 optimization

## Hardware Integration & SDR Domain Agents

- `sdr-hardware-integration-expert` - HackRF/USRP device integration
- `hardware-diagnostics-specialist` - 200+ diagnostic script optimization
- `gsm-evil-architecture-fixer` - GSM Evil pipeline and IMSI collection
- `kismet-integration-expert` - WiFi scanning and service integration
- `gps-geospatial-specialist` - GPS positioning and coordinate accuracy

## Security & Network Intelligence Agents

- `network-security-analyst` - WiFi security and threat detection
- `defense-systems-consultant` - Tactical requirements and OPSEC
- `security-audit-specialist` - OWASP compliance and vulnerability assessment

## Workflow Orchestrators

- `workflow-new-feature-development` - End-to-end feature development
- `workflow-hardware-integration-debugging` - Systematic hardware troubleshooting
- `workflow-security-audit-process` - Comprehensive security review
- `workflow-performance-optimization` - System performance improvement  
- `workflow-production-deployment` - Safe deployment and validation

## Agent Invocation

Agents can be invoked in two ways:
1. **Automatic**: Claude detects trigger conditions and delegates appropriately
2. **Manual**: Explicitly call an agent using `/agents <agent-name>`
3. **Workflow**: Use workflow orchestrators for complex multi-agent processes

## Branching Strategy for AI Agents

All AI agents must follow these Git practices:

- **Never commit directly to `main`** - Always use feature branches
- **Branch naming**: Use `agent/<agent-name>/<task-description>` format
- **Commit messages**: Clear, descriptive messages explaining the why, not just the what
- **Pull Requests**: All agent changes go through PR review before merge
- **Atomic commits**: Each commit should be a logical, complete change

## Quality Standards

Every agent embodies:
- 15+ years equivalent expertise in their domain
- Defense-grade security and quality standards
- Production-ready output with comprehensive validation
- Systematic error handling and recovery procedures
- Context isolation with focused, minimal tool access

## Agent Coordination Matrix

**High-Frequency Collaborations:**
- SvelteKit ↔ WebSocket ↔ Node.js Performance specialists
- SDR Hardware ↔ Hardware Diagnostics ↔ Performance Testing
- GSM Evil ↔ Kismet ↔ Network Security specialists
- TypeScript ↔ Integration Testing ↔ Git Workflow

**Workflow Orchestration:**
- Complex tasks use workflow orchestrators for multi-agent coordination
- Each workflow maintains quality gates and validation procedures
- Systematic error handling and rollback capabilities

---
*Established by Astraeus Σ-9000 Orchestrator*
*Complete Agent Ecosystem Operational: 2025-08-07*