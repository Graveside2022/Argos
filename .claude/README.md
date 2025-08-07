# Claude Agent Ecosystem - Argos Project

This directory contains the AI agent definition files for the Argos SDR & Network Analysis Console project.

## Directory Structure

- `agents/` - Individual agent definition files (.md format)
  - Each agent has a specific expertise and set of tools
  - Agents are invoked automatically based on triggers or manually by name
  - All agents follow strict SOPs and quality standards

## Branching Strategy for AI Agents

All AI agents must follow these Git practices:

- **Never commit directly to `main`** - Always use feature branches
- **Branch naming**: Use `agent/<agent-name>/<task-description>` format
- **Commit messages**: Clear, descriptive messages explaining the why, not just the what
- **Pull Requests**: All agent changes go through PR review before merge
- **Atomic commits**: Each commit should be a logical, complete change

## Agent Invocation

Agents can be invoked in two ways:
1. **Automatic**: Claude detects trigger conditions and delegates appropriately
2. **Manual**: Explicitly call an agent using `/agents <agent-name>`

## Quality Standards

Every agent embodies:
- 10+ years equivalent expertise in their domain
- Production-grade output quality
- Defensive programming practices
- Security-first approach
- Comprehensive error handling

---
*Established by Astraeus Σ-9000 Orchestrator*
*Last Updated: 2025-08-07*