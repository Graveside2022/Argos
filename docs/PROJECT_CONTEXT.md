# ArgosFinal Project Context

## Quick Reference

This file helps Claude Code understand the project without parsing thousands of files.

## Project Structure

```
src/
├── lib/
│   ├── server/         # Server-side code
│   │   ├── hackrf/     # HackRF sweep functionality
│   │   └── kismet/     # Kismet integration
│   ├── services/       # Client services
│   │   └── websocket/  # WebSocket clients
│   ├── config/         # Configuration
│   └── utils/          # Utilities
├── routes/             # SvelteKit routes
│   ├── api/           # API endpoints
│   └── hackrfsweep/   # HackRF UI
└── hooks.server.ts    # Server hooks
```

## Key Technologies

- **Framework**: SvelteKit 2.x with TypeScript
- **Styling**: Tailwind CSS
- **WebSocket**: ws library (not socket.io)
- **Testing**: Vitest + Playwright
- **Package Manager**: pnpm

## Common Tasks

- Run dev server: `pnpm dev`
- Type check: `pnpm check`
- Run tests: `pnpm test`
- Build: `pnpm build`

## Active Features

1. HackRF spectrum sweep visualization
2. Real-time WebSocket data streaming
3. Frequency analysis and display

## Known Issues

- TypeScript errors in WebSocket base classes (non-blocking)
- node_modules has 17,535 files (use .clignore)

## Memory Note

Always run with: `NODE_OPTIONS="--max-old-space-size=3072" claude`
