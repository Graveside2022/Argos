# Unified Project Structure

```
argos/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml            # Test and build
│       └── deploy.yaml        # Deploy to edge devices
├── apps/                       # Application packages
│   ├── web/                    # Frontend application
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/     # UI components
│   │   │   │   ├── stores/         # State management
│   │   │   │   ├── services/       # API clients
│   │   │   │   ├── utils/          # Frontend utilities
│   │   │   │   └── config/         # Frontend config
│   │   │   ├── routes/             # Pages and API routes
│   │   │   │   ├── (app)/          # Authenticated routes
│   │   │   │   ├── api/            # Backend API routes
│   │   │   │   └── +layout.svelte  # Root layout
│   │   │   └── app.html            # HTML template
│   │   ├── static/                 # Static assets
│   │   ├── tests/                  # Frontend tests
│   │   └── package.json
│   └── services/               # Standalone services
│       ├── signal-processor/   # Python signal processing
│       │   ├── src/
│       │   ├── requirements.txt
│       │   └── Dockerfile
│       └── hardware-bridge/    # Hardware integration
│           ├── src/
│           └── package.json
├── packages/                   # Shared packages
│   ├── shared/                 # Shared types/utilities
│   │   ├── src/
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   ├── schemas/        # Zod schemas
│   │   │   ├── constants/      # Shared constants
│   │   │   └── utils/          # Shared utilities
│   │   └── package.json
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── eslint/
│       ├── typescript/
│       └── vitest/
├── infrastructure/             # Deployment configs
│   ├── systemd/               # SystemD service files
│   ├── docker/                # Docker configs
│   └── scripts/               # Deployment scripts
├── scripts/                    # Development scripts
│   ├── hardware/              # Hardware control scripts
│   │   ├── hackrf/
│   │   └── usrp/
│   ├── setup/                 # Setup scripts
│   │   ├── install-deps.sh
│   │   └── configure-sdr.sh
│   ├── utils/                 # Utility scripts
│   │   ├── db-migrate.sh
│   │   └── generate-types.ts
│   └── monitoring/            # Monitoring scripts
│       └── health-check.sh
├── docs/                       # Documentation
│   ├── prd/                   # Product requirements
│   ├── frontend-specification.md
│   ├── brownfield-architecture.md
│   └── fullstack-architecture.md
├── .env.example                # Environment template
├── package.json                # Root package.json
├── pnpm-workspace.yaml         # Monorepo configuration
└── README.md                   # Project overview
```
