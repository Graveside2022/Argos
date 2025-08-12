# Argos Reorganization Implementation Guide

## Quick Start Commands

### 1. Create New Repository Structure
```bash
#!/bin/bash
# create-new-structure.sh

# Create base directories
mkdir -p argos-platform/{services,applications,packages,infrastructure,tools,docs}

# Create service directories
cd argos-platform/services
for service in api-gateway websocket-gateway signal-processor hardware-manager data-service integration-service; do
  mkdir -p $service/{src,tests,docs}
  touch $service/{README.md,Dockerfile,.env.example}
done

# Create application directories
cd ../applications
mkdir -p web-dashboard/{src/{features,shared},public,tests}

# Create package directories
cd ../packages
for pkg in common-types api-client ui-kit utils; do
  mkdir -p $pkg/{src,tests}
  touch $pkg/{package.json,tsconfig.json,README.md}
done
```

### 2. Initialize Package Management
```bash
# Initialize pnpm workspace
cd argos-platform
cat > pnpm-workspace.yaml << EOF
packages:
  - 'services/*'
  - 'applications/*'
  - 'packages/*'
  - 'tools/*'
EOF

# Create root package.json
cat > package.json << EOF
{
  "name": "argos-platform",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "services/*",
    "applications/*",
    "packages/*",
    "tools/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "latest",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
EOF
```

### 3. Set Up Service Templates

#### API Gateway Template
```typescript
// services/api-gateway/src/main.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Service routes
const services = {
  '/api/signals': 'http://signal-processor:3001',
  '/api/hardware': 'http://hardware-manager:3002',
  '/api/data': 'http://data-service:3003',
};

// Proxy setup
Object.entries(services).forEach(([path, target]) => {
  app.use(path, createProxyMiddleware({
    target,
    changeOrigin: true,
  }));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
```

#### Signal Processor Template
```python
# services/signal-processor/src/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
from typing import List, Dict, Any

app = FastAPI(
    title="Signal Processor Service",
    version="1.0.0",
    docs_url="/docs"
)

class SignalRequest(BaseModel):
    device_type: str
    frequency: float
    bandwidth: float
    duration: float
    parameters: Dict[str, Any]

class SignalResponse(BaseModel):
    id: str
    status: str
    data: Dict[str, Any]

@app.post("/process", response_model=SignalResponse)
async def process_signal(request: SignalRequest):
    """Process signal from specified device"""
    # Implementation here
    return SignalResponse(
        id="signal-123",
        status="processed",
        data={"samples": 1000}
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "signal-processor"}
```

### 4. Migration Scripts

#### Script to Migrate Components
```bash
#!/bin/bash
# migrate-components.sh

# Function to migrate a component
migrate_component() {
    local source=$1
    local destination=$2
    local component_name=$3
    
    echo "Migrating $component_name..."
    
    # Create destination if it doesn't exist
    mkdir -p "$destination"
    
    # Copy files
    cp -r "$source" "$destination/"
    
    # Update imports
    find "$destination" -type f -name "*.ts" -o -name "*.js" | while read file; do
        # Update import paths
        sed -i 's|@/lib/|@argos/common/|g' "$file"
        sed -i 's|$lib/|@argos/common/|g' "$file"
    done
    
    echo "✓ Migrated $component_name"
}

# Migrate main components
migrate_component "src/lib/services/hackrf" "argos-platform/services/signal-processor/src/hackrf" "HackRF Service"
migrate_component "src/lib/services/kismet" "argos-platform/services/integration-service/src/kismet" "Kismet Integration"
migrate_component "src/lib/components" "argos-platform/packages/ui-kit/src/components" "UI Components"
```

### 5. Docker Compose for Development
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    volumes:
      - ./services/api-gateway:/app
    depends_on:
      - signal-processor
      - hardware-manager

  signal-processor:
    build: ./services/signal-processor
    ports:
      - "3001:3001"
    environment:
      - PYTHONUNBUFFERED=1
    volumes:
      - ./services/signal-processor:/app
    privileged: true  # For hardware access

  hardware-manager:
    build: ./services/hardware-manager
    ports:
      - "3002:3002"
    volumes:
      - ./services/hardware-manager:/app
      - /dev/bus/usb:/dev/bus/usb  # USB access
    privileged: true

  web-dashboard:
    build: ./applications/web-dashboard
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    volumes:
      - ./applications/web-dashboard:/app

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=argos
      - POSTGRES_USER=argos
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### 6. CI/CD Pipeline Setup
```yaml
# .github/workflows/main.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        service: [api-gateway, signal-processor, hardware-manager]
    steps:
      - uses: actions/checkout@v3
      - name: Run tests for ${{ matrix.service }}
        run: |
          cd services/${{ matrix.service }}
          npm test

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: |
          docker-compose -f docker-compose.build.yml build
      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker-compose -f docker-compose.build.yml push
```

### 7. Makefile for Common Tasks
```makefile
# Makefile
.PHONY: help install dev build test deploy clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install
	cd services/signal-processor && pip install -r requirements.txt

dev: ## Start development environment
	docker-compose -f docker-compose.dev.yml up

build: ## Build all services
	pnpm build
	docker-compose -f docker-compose.build.yml build

test: ## Run all tests
	pnpm test

test-unit: ## Run unit tests
	pnpm test:unit

test-integration: ## Run integration tests
	pnpm test:integration

test-e2e: ## Run end-to-end tests
	pnpm test:e2e

lint: ## Run linters
	pnpm lint

format: ## Format code
	pnpm format

migrate: ## Run database migrations
	cd services/data-service && npm run migrate

deploy-staging: ## Deploy to staging
	./scripts/deploy.sh staging

deploy-production: ## Deploy to production
	./scripts/deploy.sh production

clean: ## Clean build artifacts
	pnpm clean
	docker-compose down -v
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name "__pycache__" -type d -prune -exec rm -rf {} +
```

## Gradual Migration Strategy

### Week 1: Foundation
```bash
# 1. Create new structure alongside existing
mkdir argos-platform
cd argos-platform
./create-new-structure.sh

# 2. Set up development environment
pnpm install
docker-compose -f docker-compose.dev.yml up -d

# 3. Create first service (API Gateway)
cd services/api-gateway
npm init -y
npm install express cors helmet http-proxy-middleware
```

### Week 2: Extract First Service
```bash
# Move HackRF functionality
cp -r ../../src/lib/services/hackrf services/signal-processor/src/
cd services/signal-processor
python -m venv venv
source venv/bin/activate
pip install fastapi uvicorn

# Test the service
python -m uvicorn src.main:app --reload
```

### Week 3: Frontend Consolidation
```bash
# Create unified frontend
cd applications/web-dashboard
pnpm create vite@latest . --template react-ts
pnpm install @tanstack/react-query axios

# Copy existing components
cp -r ../../src/lib/components/* src/components/
cp -r ../../hackrf_emitter/frontend/src/components/* src/features/hackrf/
```

## Monitoring Progress

### Progress Dashboard
```typescript
// tools/migration-tracker/src/index.ts
interface MigrationTask {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignee?: string;
  completedAt?: Date;
}

const tasks: MigrationTask[] = [
  { id: '1', name: 'Create repository structure', status: 'pending' },
  { id: '2', name: 'Extract API Gateway', status: 'pending' },
  { id: '3', name: 'Extract Signal Processor', status: 'pending' },
  // ... more tasks
];

// Generate progress report
function generateReport() {
  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const percentage = (completed / total) * 100;
  
  console.log(`Migration Progress: ${percentage.toFixed(1)}% (${completed}/${total})`);
}
```

## Success Criteria

- [ ] All services running independently
- [ ] Zero hardcoded configurations
- [ ] 100% API documentation coverage
- [ ] Automated deployment pipeline
- [ ] Monitoring and alerting configured
- [ ] Team trained on new architecture

## Support Resources

- Architecture decisions: `/docs/architecture/decisions/`
- API documentation: `http://localhost:3000/docs`
- Team chat: `#argos-migration`
- Weekly sync: Thursdays 2pm

Remember: This is a marathon, not a sprint. Take time to do it right!