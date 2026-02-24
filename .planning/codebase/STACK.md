# Technology Stack

> Mapped: 2026-02-24 | Source: package.json, tsconfig.json, svelte.config.js, config/

## Runtime & Language

| Technology | Version   | Purpose                                                         |
| ---------- | --------- | --------------------------------------------------------------- |
| Node.js    | 22+ (LTS) | Server runtime                                                  |
| TypeScript | 5.8.3     | Language (strict mode, bundler moduleResolution)                |
| Svelte     | 5.35.5    | UI framework (runes: `$state`, `$derived`, `$effect`, `$props`) |
| SvelteKit  | 2.22.3    | Meta-framework (file-based routing, SSR, hooks)                 |

**TypeScript Configuration**: `tsconfig.json` extends `.svelte-kit/tsconfig.json` with `strict: true`, `checkJs: true`, `esModuleInterop: true`, `bundler` module resolution. No path aliases beyond SvelteKit's `$lib`.

## Build & Dev Tooling

| Tool         | Version | Config Location           | Purpose                           |
| ------------ | ------- | ------------------------- | --------------------------------- |
| Vite         | 7.0.3   | `config/vite.config.ts`   | Build system + dev server         |
| Tailwind CSS | 4.1.18  | `src/app.css` (@plugin)   | Utility-first CSS                 |
| ESLint       | 9.30.1  | `config/eslint.config.js` | Linting (flat config)             |
| Prettier     | 3.6.2   | root config               | Code formatting                   |
| Husky        | 9.1.7   | `.husky/`                 | Git hooks                         |
| lint-staged  | 16.1.2  | package.json              | Pre-commit file filtering         |
| svelte-check | 4.2.2   | N/A                       | Svelte type checking (~650MB RAM) |
| tsx          | 4.20.3  | N/A                       | TypeScript execution for scripts  |

## Testing

| Tool                 | Version | Purpose                                     |
| -------------------- | ------- | ------------------------------------------- |
| Vitest               | 3.2.4   | Unit, integration, performance, load tests  |
| @vitest/coverage-v8  | 3.2.4   | Code coverage                               |
| @vitest/ui           | 3.2.4   | Browser-based test UI                       |
| Playwright           | 1.53.2  | E2E testing (`config/playwright.config.ts`) |
| jsdom                | 26.1.0  | DOM simulation for unit tests               |
| fast-check           | 4.5.3   | Property-based testing (security suite)     |
| Puppeteer            | 24.12.1 | Visual regression testing                   |
| pixelmatch           | 7.1.0   | Pixel-level screenshot comparison           |
| @axe-core/playwright | 4.11.1  | Accessibility testing                       |

## Production Dependencies

### Core Framework

- `@sveltejs/adapter-auto` (6.0.1) — SvelteKit adapter
- `@sveltejs/vite-plugin-svelte` (6.0.0) — Vite integration

### Database

- `better-sqlite3` (12.2.0) — SQLite3 binding (direct SQL, no ORM)
- `zod` (3.25.76) — Runtime schema validation (env vars, API payloads, DB records)

### Real-time Communication

- `ws` (8.18.3) — WebSocket server (noServer mode, 256KB payload limit)
- `eventsource` (4.0.0) — SSE client polyfill

### Mapping & Geospatial

- `maplibre-gl` (5.6.1) — Map rendering engine
- `svelte-maplibre-gl` (1.0.3) — Svelte bindings for MapLibre
- `leaflet` (1.9.4) — Leaflet map library (legacy, used alongside MapLibre)
- `mgrs` (2.1.0) — MGRS coordinate conversion

### Military / TAK Integration

- `@armyc2.c5isr.renderer/mil-sym-ts-web` (2.6.7) — MIL-STD-2525C military symbology
- `@tak-ps/node-cot` (14.23.2) — Cursor-on-Target XML parsing
- `@tak-ps/node-tak` (12.0.0) — TAK server TLS communication
- `@xmldom/xmldom` (0.8.11) — XML DOM for CoT message handling

### UI Components

- `bits-ui` (2.15.5) — Headless UI primitives (shadcn-svelte base)
- `@lucide/svelte` (0.561.0) — Icon library (Lucide)
- `clsx` (2.1.1) — Conditional class names
- `tailwind-merge` (3.4.0) — Tailwind class deduplication
- `tailwind-variants` (3.2.2) — Variant-based component styling
- `tw-animate-css` (1.4.0) — Tailwind animation utilities
- `svelte-sonner` (1.0.7) — Toast notifications
- `mode-watcher` (1.1.0) — Theme mode detection

### Terminal

- `node-pty` (1.1.0) — Pseudo-terminal for embedded shell
- `@xterm/xterm` (6.0.0) — Terminal emulator UI
- `@xterm/addon-fit` (0.11.0) — Terminal auto-resize
- `@xterm/addon-web-links` (0.12.0) — Clickable links in terminal

### AI & MCP

- `@modelcontextprotocol/sdk` (1.26.0) — MCP server framework
- `dotenv` (17.2.1) — Environment variable loading

### CSS & Design

- `@tailwindcss/forms` (0.5.10) — Form element styling
- `@tailwindcss/typography` (0.5.19) — Prose typography

### Code Quality

- `madge` (8.0.0) — Circular dependency detection
- `jscpd` (4.0.8) — Copy-paste detection
- `css-tree` (3.1.0) — CSS AST analysis
- `eslint-plugin-sonarjs` (^4.0.0) — Cognitive/cyclomatic complexity rules
- `eslint-plugin-simple-import-sort` (12.1.1) — Import ordering

## Security Overrides

```json
"overrides": {
  "cookie": ">=0.7.0",
  "fast-xml-parser": ">=5.3.4"
}
```

## Platform Target

- **Hardware**: Raspberry Pi 5 Model B Rev 1.0, 4x Cortex-A76, 8GB RAM
- **OS**: Kali Linux 2025.4 (aarch64)
- **Storage**: 500GB NVMe SSD (Kingston SNV3S500G)
- **Node heap**: `--max-old-space-size=2048` (dev), 1024 (production)
- **Memory protection**: earlyoom, zram (4GB zstd), cgroup v2 limits (7680MB max)

## Key Constraints

- `svelte-check` uses ~650MB — never run multiple concurrent instances
- Total idle memory ~4.5GB — ~2.7GB headroom for tasks
- No Docker for main app — native execution only
- `better-sqlite3` requires native compilation (node-gyp)
- `node-pty` requires native compilation (postinstall rebuild)
