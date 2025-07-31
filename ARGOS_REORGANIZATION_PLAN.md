# Argos Project Reorganization Plan

## Executive Summary

The Argos project needs to be reorganized from a chaotic monorepo into a professionally managed, service-oriented architecture. This plan provides concrete steps to achieve this transformation.

## Current State Analysis

### Major Issues
1. **200+ scripts** scattered throughout with unclear purposes
2. **Multiple frontends** (SvelteKit main, React HackRF) in same repo
3. **Mixed languages** without clear boundaries (Python, TypeScript, Bash)
4. **No service isolation** - everything can access everything
5. **Configuration nightmare** - configs everywhere, no central management

### What We Have
- **Signal Processing**: HackRF, USRP, RTL-433 integrations
- **Network Analysis**: Kismet, WiFi, GSM monitoring
- **Data Visualization**: Maps, spectrum analysis, real-time displays
- **Hardware Control**: Direct SDR hardware manipulation

## Proposed Architecture

### High-Level Design
```
┌─────────────────────────────────────────────────────────────┐
│                        Web Frontend                         │
│                    (Next.js/SvelteKit)                     │
└─────────────────┬─────────────────────────┬────────────────┘
                  │                         │
                  ▼                         ▼
┌─────────────────────────┐     ┌──────────────────────────┐
│      API Gateway        │     │    WebSocket Gateway     │
│     (REST APIs)         │     │   (Real-time data)       │
└───────────┬─────────────┘     └───────────┬──────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────────────────────────────────────┐
│                    Service Mesh                           │
├─────────────┬──────────────┬──────────────┬──────────────┤
│   Signal    │   Hardware   │    Data      │ Integration  │
│  Processor  │   Manager    │   Service    │  Service     │
└─────────────┴──────────────┴──────────────┴──────────────┘
```

### Service Breakdown

#### 1. **Core Services**
```
services/
├── api-gateway/           # All REST API endpoints
├── websocket-gateway/     # Real-time data streaming
├── signal-processor/      # Signal analysis and processing
├── hardware-manager/      # SDR device control
├── data-service/         # Database and caching
└── integration-service/  # External tool integration
```

#### 2. **Support Services**
```
services/
├── auth-service/         # Authentication/authorization
├── config-service/       # Centralized configuration
├── scheduler-service/    # Task scheduling
└── notification-service/ # Alerts and notifications
```

## Step-by-Step Reorganization

### Phase 1: Preparation (Week 1)
1. **Inventory Current System**
   ```bash
   # Create comprehensive inventory
   - Document all scripts and their purposes
   - Map service dependencies
   - Identify critical paths
   - List all external integrations
   ```

2. **Set Up New Repository Structure**
   ```bash
   mkdir -p argos-platform/{services,applications,packages,infrastructure,tools,docs}
   ```

3. **Establish Standards**
   - Code style guides
   - Git workflow (GitFlow)
   - API design standards
   - Documentation templates

### Phase 2: Extract Core Services (Weeks 2-4)

#### Signal Processor Service
```python
# services/signal-processor/src/main.py
from fastapi import FastAPI
from .processors import HackRFProcessor, USRPProcessor, RTL433Processor
from .analyzers import SpectrumAnalyzer, SignalAnalyzer

app = FastAPI(title="Signal Processor Service")

@app.post("/api/v1/process/hackrf")
async def process_hackrf_signal(data: SignalData):
    return await HackRFProcessor().process(data)
```

#### Hardware Manager Service
```typescript
// services/hardware-manager/src/index.ts
import { NestFactory } from '@nestjs/core';
import { HardwareModule } from './hardware.module';

async function bootstrap() {
  const app = await NestFactory.create(HardwareModule);
  await app.listen(3002);
}
```

### Phase 3: Consolidate Frontends (Weeks 5-6)

1. **Merge UI Applications**
   ```
   applications/web-dashboard/
   ├── src/
   │   ├── features/
   │   │   ├── spectrum/     # From HackRF UI
   │   │   ├── map/         # From main app
   │   │   ├── kismet/      # Kismet dashboard
   │   │   └── analysis/    # Signal analysis
   │   └── shared/
   │       ├── components/
   │       └── services/
   ```

2. **Create Shared Component Library**
   ```typescript
   // packages/ui-kit/src/index.ts
   export * from './components/SpectrumChart';
   export * from './components/SignalMap';
   export * from './components/DeviceStatus';
   ```

### Phase 4: Script Consolidation (Week 7)

1. **Convert Scripts to CLI Tool**
   ```typescript
   // tools/cli/src/commands/hardware.ts
   import { Command } from 'commander';
   
   export const hardwareCommand = new Command('hardware')
     .description('Hardware management commands')
     .command('reset-usb')
     .command('configure-hackrf')
     .command('scan-devices');
   ```

2. **Organize Remaining Scripts**
   ```
   tools/scripts/
   ├── setup/          # One-time setup scripts
   ├── maintenance/    # Regular maintenance
   └── emergency/      # Emergency procedures
   ```

### Phase 5: Configuration Management (Week 8)

1. **Centralized Configuration**
   ```yaml
   # infrastructure/config/base/services.yaml
   services:
     signal_processor:
       replicas: 2
       resources:
         memory: 2Gi
         cpu: 1000m
     
     hardware_manager:
       replicas: 1  # Only one instance for hardware access
       privileged: true
   ```

2. **Environment-Specific Overrides**
   ```yaml
   # infrastructure/config/overlays/production/services.yaml
   services:
     signal_processor:
       replicas: 4
       resources:
         memory: 4Gi
   ```

### Phase 6: Testing & Documentation (Week 9)

1. **Test Structure**
   ```
   tests/
   ├── unit/
   │   └── services/
   ├── integration/
   │   └── api/
   ├── e2e/
   │   └── workflows/
   └── performance/
       └── load-tests/
   ```

2. **Documentation**
   ```
   docs/
   ├── getting-started/
   ├── architecture/
   ├── api-reference/
   ├── deployment/
   └── troubleshooting/
   ```

## Migration Checklist

### Pre-Migration
- [ ] Full system backup
- [ ] Document current deployment
- [ ] Identify critical features
- [ ] Create rollback plan

### During Migration
- [ ] Set up new repository structure
- [ ] Extract services one by one
- [ ] Maintain backward compatibility
- [ ] Run parallel systems during transition

### Post-Migration
- [ ] Verify all functionality
- [ ] Update documentation
- [ ] Train team on new structure
- [ ] Decommission old system

## Expected Outcomes

### Benefits
1. **Scalability**: Services can scale independently
2. **Maintainability**: Clear code organization
3. **Reliability**: Isolated failures
4. **Development Speed**: Teams work independently
5. **Deployment**: Deploy services separately

### Metrics for Success
- Build time: <5 minutes (from 20+ minutes)
- Test coverage: >80%
- Deployment frequency: Daily (from weekly)
- Mean time to recovery: <30 minutes
- Developer onboarding: <1 day

## Risk Mitigation

### Technical Risks
1. **Data Loss**: Comprehensive backups, gradual migration
2. **Service Downtime**: Blue-green deployments
3. **Integration Issues**: Extensive integration testing

### Organizational Risks
1. **Team Resistance**: Training and documentation
2. **Skill Gaps**: Pair programming, knowledge sharing
3. **Timeline Slippage**: Phased approach with buffers

## Conclusion

This reorganization transforms Argos from a chaotic monorepo into a professional, scalable platform. The phased approach ensures minimal disruption while delivering immediate benefits at each stage.