# Argos Reference Documentation

This directory contains detailed documentation for specific topics, referenced from the main [CLAUDE.md](../CLAUDE.md) via progressive disclosure.

## How to Use These Docs

Claude Code can load these files on-demand using the `@import` syntax:

```markdown
For auth flow details: @docs/authentication.md
```

Each document is focused, actionable, and contains only information Claude cannot infer from the codebase itself.

## Available Guides

- **[security-architecture.md](security-architecture.md)** — Authentication, input sanitization, rate limiting, CORS, CSP
- **[hardware-patterns.md](hardware-patterns.md)** — HackRF, Kismet, GPS, USRP, USB passthrough, auto-detection
- **[websocket-guide.md](websocket-guide.md)** — Real-time data flow, authentication, backpressure, message batching
- **[database-guide.md](database-guide.md)** — R-tree spatial indexing, migrations, prepared statements, SQLite limitations
- **[testing-guide.md](testing-guide.md)** — Hardware mocking, test organization, TDD workflow
- **[deployment.md](deployment.md)** — Raspberry Pi 5 setup, Docker workflow, OOM protection, environment variables

## Why Separate Docs?

Based on research (Liu et al., "Lost in the Middle"; Chroma Research "Context Rot"), Claude Code performs best with:

1. **Brief root CLAUDE.md** (<100 lines) containing only critical, universally-applicable rules
2. **Detailed reference docs** loaded on-demand via `@import` when relevant to the task
3. **Progressive disclosure** that keeps the always-loaded context minimal

This structure exploits Claude's U-shaped attention curve (primacy/recency bias) while providing deep context when needed.

## Maintenance

These docs are **living documents** maintained through mistake-driven development:

- When Claude makes a mistake, add the rule to prevent recurrence
- Review every few weeks for outdated information
- Delete anything that describes what _was_ rather than what _is_
- Keep each doc under 200 lines
