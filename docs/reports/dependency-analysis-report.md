# Dependency Analysis Report - ArgosFinal

Generated on: 2025-07-05

## Executive Summary

The ArgosFinal project has **94 total dependencies** (75 devDependencies + 19 production dependencies). The analysis reveals several security vulnerabilities and outdated packages that require attention.

## Security Vulnerabilities Found

### Critical (1)

- **babel-traverse** (6.26.0) - CVE-2023-45133
    - Risk: Arbitrary code execution when compiling malicious code
    - Path: npm-check-unused > depcheck > babel-traverse
    - Recommendation: This is an indirect dependency from npm-check-unused. Consider removing npm-check-unused or finding an alternative.

### High (2)

1. **trim-newlines** (2.0.0) - CVE-2021-33623
    - Risk: ReDoS vulnerability causing uncontrolled resource consumption
    - Path: npm-check-unused > meow > trim-newlines
2. **cross-spawn** (5.1.0) - CVE-2024-21538
    - Risk: ReDoS vulnerability that can crash the program
    - Path: npm-check-unused > depcheck > yargs > os-locale > execa > cross-spawn

### Moderate (5)

1. **mem** (<4.0.0) - Denial of Service vulnerability
2. **yargs-parser** (7.0.0, 10.1.0) - Prototype pollution vulnerability
3. **got** (6.7.1) - Allows redirect to UNIX socket
4. **esbuild** (0.21.5) - CORS misconfiguration in dev server
5. **cookie** (0.6.0) - Cookie name injection vulnerability

### Low (1)

- **cookie** (0.6.0) - Accepts out-of-bounds characters in cookie fields

## Dependency Categories

### Production Dependencies (19)

```
Core Framework:
- @sveltejs/kit (^2.0.0)
- svelte (^4.2.7)
- vite (^5.0.3)

Database:
- better-sqlite3 (^12.2.0)

Mapping & Visualization:
- leaflet (^1.9.4)
- leaflet.heat (^0.2.0)
- leaflet.markercluster (^1.5.3)
- @deck.gl/core (^9.1.12)
- @deck.gl/layers (^9.1.12)
- deck.gl (^9.1.12)
- maplibre-gl (^5.6.1)
- cytoscape (^3.32.0)
- cytoscape-cola (^2.5.1)
- cytoscape-dagre (^2.5.0)

WebSocket:
- ws (^8.18.3)

UI Utilities:
- @tailwindcss/forms (^0.5.7)

Build Tools:
- @eslint/js (^9.30.1)
- globals (^16.3.0)

Type Definitions:
- @types/better-sqlite3 (^7.6.13)
- @types/cytoscape (^3.21.9)
- @types/leaflet (^1.9.19)
- @types/leaflet.markercluster (^1.5.5)
```

### Development Dependencies (75)

```
Testing:
- @playwright/test (^1.40.1)
- @vitest/coverage-v8 (^1.1.0)
- @vitest/ui (^1.1.0)
- vitest (^1.1.0)
- @testing-library/jest-dom (^6.1.5)
- @testing-library/svelte (^4.0.5)
- jsdom (^23.0.1)

Build & Bundling:
- @sveltejs/adapter-auto (^3.0.0)
- @sveltejs/vite-plugin-svelte (^3.0.0)
- terser (^5.43.1)
- tsx (^4.7.0)
- typescript (^5.0.0)
- tslib (^2.4.1)

Linting & Formatting:
- eslint (^9.30.1)
- @typescript-eslint/eslint-plugin (^8.35.1)
- @typescript-eslint/parser (^8.35.1)
- eslint-config-prettier (^10.1.5)
- eslint-plugin-svelte (^3.10.1)
- prettier (^3.0.0)
- prettier-plugin-svelte (^3.0.0)

CSS Processing:
- tailwindcss (^3.3.0)
- postcss (^8.4.32)
- autoprefixer (^10.4.16)

Development Tools:
- @types/node (^20.0.0)
- @types/ws (^8.5.10)
- svelte-check (^3.6.0)
- husky (^8.0.3)
- lint-staged (^15.0.0)

Utility:
- npm-check-unused (^6.0.0)
- css-tree (^2.3.1)
- pixelmatch (^5.3.0)
- pngjs (^6.0.0)
- puppeteer (^24.11.2)
```

## Outdated Packages (Major Version Behind)

1. **svelte**: v4.2.20 → v5.35.2 (Major update available)
2. **@sveltejs/adapter-auto**: v3.3.1 → v6.0.1 (Major update available)
3. **@sveltejs/vite-plugin-svelte**: v3.1.2 → v5.1.0 (Major update available)
4. **vitest**: v1.6.1 → v3.2.4 (Major update available)
5. **vite**: v5.4.19 → v7.0.2 (Major update available)
6. **tailwindcss**: v3.4.17 → v4.1.11 (Major update available)

## Recommendations

### Immediate Actions (Security)

1. **Remove npm-check-unused** - This package brings in most of the security vulnerabilities
2. **Update cookie** dependency through @sveltejs/kit update
3. **Update esbuild** through vite update

### Short-term Actions

1. Consider upgrading to Svelte 5 (major update - requires migration)
2. Update build tools to latest versions (vitest, vite)
3. Update Tailwind CSS to v4 (check for breaking changes)

### Dependency Optimization

1. Review if all mapping libraries are needed:
    - deck.gl + @deck.gl packages
    - leaflet + extensions
    - maplibre-gl
    - cytoscape + extensions

2. Consider consolidating visualization libraries

### Alternative to npm-check-unused

Use built-in npm commands or lighter alternatives:

- `npm ls` for dependency tree
- `npm outdated` for version checking
- Manual review of imports vs package.json

## Package Manager

The project uses **pnpm** (pnpm-lock.yaml present). This is good for:

- Faster installations
- Disk space efficiency
- Stricter dependency resolution

## Conclusion

The main security concerns stem from the npm-check-unused package and its dependency tree. Removing this development dependency would eliminate most vulnerabilities. The project also has several major version updates available that should be evaluated for migration.
