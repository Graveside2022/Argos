# Tech Stack

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.8.3 | Type-safe frontend development | Prevents runtime errors in critical field operations |
| Frontend Framework | SvelteKit | 2.22.3 | Fullstack framework with SSR | Unified frontend/backend, excellent performance |
| UI Component Library | Tailwind CSS | 3.4.15 | Utility-first styling | Rapid UI development, small bundle size |
| State Management | Svelte Stores | 5.35.5 | Reactive state management | Built-in reactivity, no external dependencies |
| Backend Language | TypeScript/Node.js | 5.8.3/20.x | Primary backend language | Code sharing with frontend, async performance |
| Backend Framework | SvelteKit | 2.22.3 | API routes and SSR | Unified stack reduces complexity |
| API Style | REST | - | HTTP API design | Simple, well-understood, tool support |
| Database | SQLite | 3.45.0 | Embedded database with R-tree | No server required, spatial indexing built-in |
| Cache | In-Memory | - | Application-level caching | Simple for edge deployment |
| File Storage | Local Filesystem | - | Signal data and captures | No external dependencies |
| Authentication | JWT | jsonwebtoken 9.0.0 | Token-based auth | Stateless, works offline |
| Frontend Testing | Vitest | 2.1.8 | Unit and integration tests | Fast, Vite-native testing |
| Backend Testing | Vitest | 2.1.8 | API and service tests | Consistent with frontend |
| E2E Testing | Playwright | 1.49.0 | End-to-end testing | Cross-browser support |
| Build Tool | Vite | 7.0.3 | Frontend bundling | Fast builds, HMR support |
| Bundler | Vite/Rollup | 7.0.3 | Module bundling | Tree shaking, code splitting |
| IaC Tool | Shell Scripts | - | Deployment automation | Matches existing infrastructure |
| CI/CD | GitHub Actions | - | Automated testing/deployment | Free for public repos |
| Monitoring | OpenTelemetry | 1.27.0 | Metrics and tracing | Vendor-agnostic observability |
| Logging | Local + Sentry | 8.44.0 | Error tracking and logs | Offline-capable with cloud backup |
| CSS Framework | Tailwind CSS | 3.4.15 | Utility CSS | Consistent styling, dark mode support |
