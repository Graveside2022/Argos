# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Argos is a professional SDR & Network Analysis Console built with SvelteKit. It provides real-time spectrum analysis, WiFi network intelligence, GPS tracking, and tactical awareness for defense and research applications.

## Development Commands

### Essential Commands
```bash
# Development
npm run dev                  # Start dev server with auto-validation (port 5173)
npm run dev:simple          # Start dev server without auto-start
npm run dev:auto-kismet     # Start dev with auto-kismet initialization
npm run dev:full            # Start all services (main app + supporting services)
npm run dev:clean           # Kill existing processes and start fresh

# Build & Production
npm run build               # Build production bundle
npm run preview             # Preview production build

# Code Quality
npm run lint                # Run ESLint with custom config
npm run lint:fix            # Fix ESLint errors automatically
npm run typecheck           # Run TypeScript type checking
npm run format              # Format code with Prettier
npm run format:check        # Check code formatting
npm run check               # Run svelte-check
npm run check:watch         # Run svelte-check in watch mode

# Testing
npm run test                # Run all tests with Vitest
npm run test:unit           # Run unit tests only
npm run test:integration    # Run integration tests
npm run test:visual         # Run visual regression tests
npm run test:performance    # Run performance benchmarks
npm run test:e2e            # Run Playwright E2E tests
npm run test:smoke          # Run smoke tests only
npm run test:coverage       # Generate test coverage report
npm run test:ui             # Open Vitest UI
npm run test:watch          # Run tests in watch mode
npm run test:all            # Run all test suites
```

### Service Management
```bash
# Process Management
npm run kill-dev            # Kill dev server on port 5173
npm run kill-all            # Kill all Node/Python processes

# Database Operations
npm run db:migrate          # Run database migrations
npm run db:rollback         # Rollback last migration

# Framework Validation (CI/CD)
npm run framework:check-css        # Validate CSS integrity
npm run framework:check-html       # Validate HTML structure
npm run framework:check-visual     # Run visual regression checks
npm run framework:validate-all     # Run all framework validations
npm run framework:full-check       # Complete framework validation suite
```

## Architecture Overview

### Technology Stack
- **Frontend**: SvelteKit 2.22.3, Svelte 5.35.5, TypeScript 5.8.3
- **Styling**: Tailwind CSS 3.4.15
- **Backend**: SvelteKit API routes, WebSocket server
- **Database**: SQLite with R-tree spatial indexing
- **Testing**: Vitest, Playwright
- **Build**: Vite 7.0.3

### Key Directories
- `src/routes/` - SvelteKit pages and API endpoints
  - `src/routes/api/` - REST API endpoints organized by feature
  - `src/routes/{feature}/` - Feature-specific pages (hackrf, kismet, gsm-evil, etc.)
- `src/lib/components/` - Reusable Svelte components organized by feature
  - `src/lib/components/hackrf/` - HackRF spectrum analysis components
  - `src/lib/components/kismet/` - WiFi scanning and device tracking
  - `src/lib/components/tactical-map/` - GPS and mapping components
  - `src/lib/components/fusion/` - Packet analysis and intelligence tools
- `src/lib/stores/` - Svelte stores for state management
- `src/lib/server/` - Server-side utilities and services
  - `src/lib/server/websocket-server.ts` - Main WebSocket server
  - `src/lib/server/db/` - Database layer with optimization
- `src/lib/services/` - Business logic and service layers
- `scripts/` - System management and deployment scripts
- `hackrf_emitter/` - Python backend for HackRF control
- `tests/` - Comprehensive test suites (unit, integration, e2e, visual, performance)
- `config/` - Configuration files (ESLint, Playwright, etc.)

### Core Services Integration
The application integrates with multiple hardware devices and external services:

1. **HackRF Integration** (Port 8092)
   - Real-time spectrum analysis
   - Signal detection and monitoring
   - WebSocket streaming of RF data

2. **Kismet Integration** (Port 2501)
   - WiFi network scanning
   - Device detection and tracking
   - GPS data integration

3. **GSM Evil Integration**
   - GSM signal monitoring
   - IMSI detection
   - Frequency scanning

4. **USRP Support**
   - Alternative SDR hardware
   - Wider frequency range support

### WebSocket Architecture
The application uses WebSocket connections for real-time data streaming:
- Main WebSocket server in `src/lib/server/websocket-server.ts`
- Store-based reactive updates in frontend
- Automatic reconnection handling

### Database Schema
SQLite database (`rf_signals.db`) with spatial indexing:
- Signal detection records with GPS coordinates
- R-tree indexing for efficient spatial queries
- Time-based filtering and aggregation

## Important Development Notes

1. **Environment Validation**: The app automatically validates required environment variables on startup using `npm run validate:env`. Check `src/lib/server/validate-env.js` for requirements.

2. **Port Configuration**: Main services use specific ports:
   - 5173: Main Argos web interface
   - 8092: HackRF spectrum analyzer API
   - 2501: Kismet API
   - 3002: HackRF control API
   - 8073: Spectrum analyzer web interface

3. **Hardware Dependencies**: Features gracefully handle missing hardware (HackRF, USRP, GPS modules, WiFi adapters). The app includes diagnostic scripts in `scripts/` for hardware troubleshooting.

4. **SystemD Services**: Production deployment uses SystemD services for process management. See `deployment/` directory for service files.

5. **Memory Management**: Node.js configured with `--max-old-space-size=2048` for handling large RF data streams and WebSocket connections.

6. **WebSocket Performance**: WebSocket server uses compression and connection pooling for optimal performance with real-time data streams.

7. **Database Optimization**: SQLite database includes R-tree spatial indexing and automated cleanup strategies for performance.

## Common Development Tasks

### Adding a New RF Signal Source
1. Create store in `src/lib/stores/`
2. Add WebSocket handler in `src/lib/server/websocket-server.ts`
3. Create UI component in `src/lib/components/`
4. Add route in `src/routes/`

### Modifying the Database Schema
1. Create migration file in `src/lib/database/migrations/`
2. Run `npm run db:migrate`
3. Update TypeScript types in `src/lib/types/`

### Testing Hardware Integration
1. Use scripts in `scripts/dev/` for isolated testing
2. Check `tests/integration/` for examples
3. Monitor WebSocket connections in browser DevTools

### Debugging Tips
- **SystemD logs**: `journalctl -u argos-dev -f`
- **WebSocket monitoring**: Use browser Network tab or DevTools
- **Hardware diagnostics**: Use `scripts/diagnose-*.sh` and `scripts/emergency-*.sh` scripts
- **Database location**: `/home/ubuntu/projects/Argos/rf_signals.db`
- **Process debugging**: Use `npm run kill-all` to clean stuck processes
- **Memory issues**: Monitor with `scripts/monitoring/monitor-memory.sh`
- **Test isolation**: Use `npm run test:unit` for specific test suites

## Code Architecture Patterns

### Store-Based State Management
- All reactive state managed through Svelte stores in `src/lib/stores/`
- WebSocket data automatically updates stores
- Components reactively update based on store changes

### Service Layer Architecture
- Business logic separated into services (`src/lib/services/`)
- Database access layer in `src/lib/server/db/`
- Hardware abstraction in device-specific services

### API Route Organization
- RESTful API endpoints in `src/routes/api/`
- Feature-based grouping (hackrf, kismet, gsm-evil)
- Consistent error handling and response formats

### Component Structure
- Feature-based component organization
- Reusable components in appropriate subdirectories
- TypeScript interfaces for all component props

## Git Workflow & Branching Strategy

### Branching Model
- **main**: Production-ready code, protected branch
- **branch1**: Current development branch 
- **feature/****: Feature development branches
- **agent/****: AI agent-generated changes (format: `agent/<agent-name>/<task-name>`)
- **hotfix/****: Critical bug fixes

### Commit Standards
- Use conventional commit format: `type: description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Include scope when applicable: `feat(gsm-evil): add health monitoring`
- AI agents must create atomic, logical commits with clear reasoning

### Pull Request Process
- All changes require PR review before merge to main
- AI agents create feature branches and open PRs
- Include verification steps and testing evidence
- Document architectural decisions and trade-offs

## AI Agent Ecosystem

### Agent Directory Structure
- `.claude/agents/` - Individual specialized agent definitions
- `.claude/README.md` - Agent ecosystem documentation
- `src/CLAUDE.md` - Source code context for agents
- `scripts/CLAUDE.md` - Scripts and automation context
- `tests/CLAUDE.md` - Testing infrastructure context

### Agent Quality Standards
Every AI agent embodies:
- Senior-level expertise (10+ years equivalent) in their domain
- Production-grade output quality and security practices
- Comprehensive error handling and defensive programming
- Git workflow compliance with branching and commit standards
- Context awareness through persistent documentation

### Agent Operational Principles
- **Context Isolation**: Each agent operates with focused, minimal context
- **Verification-First**: All outputs include verification plans
- **Human Oversight**: Critical decisions flagged for human review
- **Security Compliance**: No hardcoded secrets, OWASP guidelines followed
- **Documentation**: All agent actions documented with reasoning