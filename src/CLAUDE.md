# Source Code Directory Context

This file documents key insights and context for AI agents working in the `/src` directory.

## Directory Purpose

Core application source code for Argos SDR & Network Analysis Console.

## Key Architecture Points

- **SvelteKit 2.22.3** framework with **Svelte 5.35.5**
- **TypeScript 5.8.3** for type safety
- **Tailwind CSS 3.4.15** for styling
- Store-based reactive state management

## Critical Files & Components

- `src/lib/server/websocket-server.ts` - Main WebSocket server for real-time data
- `src/lib/stores/` - Svelte stores for state management  
- `src/routes/api/` - REST API endpoints organized by feature
- `src/lib/components/` - Feature-organized reusable components

## Recent Development Focus

- GPS integration and positioning fixes
- Kismet authentication and iframe loading
- GSM Evil architecture improvements
- Hardware diagnostics and recovery systems

## AI Agent Guidelines

- Respect TypeScript strict mode
- Follow Svelte 5 composition patterns
- Maintain reactive store patterns
- Ensure WebSocket connection handling
- Test hardware integration gracefully