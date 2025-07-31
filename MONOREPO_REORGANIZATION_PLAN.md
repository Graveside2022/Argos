# Monorepo Reorganization Plan

## Current Issues
- Multiple applications mixed in single repository without proper workspace management
- No clear separation between frontend, backend, and services
- Duplicate dependencies and configurations
- Scripts scattered throughout the repository
- Mixed technology stacks without clear boundaries

## Proposed Structure

### Option 1: True Monorepo with Workspace Management
```
argos-monorepo/
├── apps/
│   ├── web-frontend/           # Main SvelteKit app
│   │   ├── src/
│   │   ├── package.json
│   │   └── svelte.config.js
│   ├── hackrf-frontend/        # HackRF React app
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api-gateway/            # Unified API gateway
│       ├── src/
│       └── package.json
├── services/
│   ├── hackrf-service/         # Python HackRF backend
│   │   ├── src/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── signal-processor/       # Signal processing service
│   │   ├── src/
│   │   └── requirements.txt
│   ├── kismet-proxy/          # Kismet integration service
│   │   ├── src/
│   │   └── package.json
│   └── database-service/       # Centralized DB service
│       ├── migrations/
│       └── package.json
├── packages/                   # Shared packages
│   ├── shared-types/          # TypeScript types
│   ├── ui-components/         # Shared UI components
│   ├── api-client/            # Shared API client
│   └── utils/                 # Shared utilities
├── infrastructure/
│   ├── docker/
│   ├── k8s/                   # Kubernetes configs
│   └── terraform/             # Infrastructure as code
├── tools/                     # Development tools
│   ├── scripts/              # Build/deploy scripts
│   └── cli/                  # Custom CLI tools
├── docs/
├── pnpm-workspace.yaml       # Workspace configuration
├── turbo.json               # Turborepo config
└── package.json             # Root package.json
```

### Option 2: Multi-Repository Architecture (Recommended)
Break the monorepo into separate, focused repositories:

#### Repository Structure:
```
argos-org/
├── argos-frontend/          # Main web application
├── argos-api/              # Core API services
├── hackrf-emitter/         # HackRF service
├── signal-processor/       # Signal processing service
├── kismet-integration/     # Kismet proxy service
├── argos-cli/             # Command line tools
├── argos-deployment/      # Deployment configs
└── argos-shared/          # Shared libraries
```

## Migration Steps

### Phase 1: Prepare Current Repository
1. Create comprehensive documentation of all components
2. Identify and document all inter-service dependencies
3. Standardize configuration management
4. Create integration tests for critical paths

### Phase 2: Establish Repository Structure
1. Create new repositories or workspace structure
2. Set up CI/CD pipelines for each component
3. Configure dependency management (npm/pnpm workspaces or separate repos)
4. Set up shared package publishing

### Phase 3: Migrate Components
1. **Frontend Applications**
   - Extract SvelteKit app to `apps/web-frontend`
   - Extract React HackRF UI to `apps/hackrf-frontend`
   - Share common UI components via `packages/ui-components`

2. **Backend Services**
   - Extract Python services to individual service directories
   - Create unified API gateway for frontend communication
   - Implement service discovery/communication

3. **Database Layer**
   - Centralize database migrations
   - Create database service with proper API
   - Implement proper connection pooling

4. **Scripts and Tools**
   - Organize scripts by purpose in `tools/` directory
   - Convert critical scripts to proper CLI tools
   - Document all script dependencies

### Phase 4: Integration and Testing
1. Set up end-to-end testing across services
2. Implement health checks and monitoring
3. Create development environment setup scripts
4. Document deployment procedures

## Benefits of Reorganization

1. **Clear Separation of Concerns**
   - Each service has its own directory and dependencies
   - Frontend and backend are properly separated
   - Shared code is explicitly managed

2. **Improved Developer Experience**
   - Easy to understand project structure
   - Clear dependency management
   - Faster build times with proper caching

3. **Better Scalability**
   - Services can be deployed independently
   - Teams can work on different parts without conflicts
   - Easier to add new services

4. **Professional Standards**
   - Follows industry best practices
   - Easier onboarding for new developers
   - Better tooling support

## Recommended Tools

- **Monorepo Management**: pnpm workspaces or Nx
- **Build System**: Turborepo or Nx
- **Package Manager**: pnpm (better for monorepos)
- **CI/CD**: GitHub Actions with proper caching
- **Documentation**: Docusaurus or similar

## Next Steps

1. Choose between true monorepo or multi-repo approach
2. Create detailed migration plan with timelines
3. Set up new repository structure
4. Begin incremental migration
5. Update documentation and deployment procedures