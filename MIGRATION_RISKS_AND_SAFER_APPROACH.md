# Migration Risks and Safer Approach

## You're Right - This Could Break Everything!

Let's be honest about what could go wrong:

### What Will Likely Break

1. **UI/Frontend Breakages**
   - Component imports will fail when files move
   - CSS classes might not load properly
   - WebSocket connections could disconnect
   - API endpoints will return 404s
   - State management will lose data

2. **Button/Feature Failures**
   ```javascript
   // This WILL break when you move files:
   import { hackrfService } from '../../../lib/services/hackrf';
   
   // Button that stops working:
   <button onClick={() => hackrfService.startSweep()}>
     Start Sweep
   </button>
   // Error: Cannot find module '../../../lib/services/hackrf'
   ```

3. **Real-Time Features**
   - Spectrum displays going blank
   - Map updates stopping
   - Device status freezing
   - Data streams interrupting

4. **Hardware Integration**
   - USB devices not recognized
   - Scripts failing to execute
   - Permission errors
   - Driver conflicts

## The Safer, More Realistic Approach

### Option 1: Don't Migrate - Just Organize Better

**Keep the monorepo, but make it cleaner:**

```
argos/
├── src/
│   ├── frontend/          # Move all UI here
│   ├── backend/           # Move all services here
│   ├── shared/            # Shared code
│   └── scripts/           # Consolidated scripts
├── docs/                  # Keep docs
└── docker/               # Docker configs
```

**Benefits:**
- No breaking changes
- Gradual improvement
- Can be done file by file
- No service extraction needed

### Option 2: Strangler Fig Pattern

**Build new alongside old, slowly migrate:**

```
argos/
├── legacy/               # Current working code (untouched)
├── v2/                   # New structure
│   ├── services/
│   └── apps/
└── proxy/               # Routes between old and new
```

**Implementation:**
```javascript
// proxy/router.js
app.use('/api/*', (req, res) => {
  // Check if route exists in new system
  if (newRoutes.has(req.path)) {
    // Forward to new service
    proxy.web(req, res, { target: 'http://new-service:3000' });
  } else {
    // Fall back to legacy
    proxy.web(req, res, { target: 'http://legacy:5173' });
  }
});
```

### Option 3: Feature Flag Migration

**Use feature flags to switch between old and new:**

```typescript
// feature-flags.ts
export const features = {
  useNewHackRFService: process.env.USE_NEW_HACKRF === 'true',
  useNewMapView: process.env.USE_NEW_MAP === 'true',
};

// In component
import { features } from '@/feature-flags';
import { hackrfService as oldService } from '@/lib/services/hackrf';
import { hackrfService as newService } from '@argos/signal-processor';

const hackrfService = features.useNewHackRFService ? newService : oldService;
```

## Realistic Migration Plan

### Phase 1: In-Place Organization (Week 1)
**Zero breaking changes:**

```bash
# Just move files within the same repo
mkdir -p src/{frontend,backend,shared}

# Move with git to preserve history
git mv src/lib/components src/frontend/components
git mv src/lib/services src/backend/services
git mv src/lib/stores src/frontend/stores

# Update imports with a script
find src -name "*.ts" -o -name "*.svelte" | xargs sed -i 's|$lib/components|$lib/frontend/components|g'
```

### Phase 2: Add Service Wrappers (Week 2)
**Create service interfaces without changing implementation:**

```typescript
// src/backend/services/hackrf/index.ts
import { existingHackRFCode } from './legacy';

export class HackRFService {
  // Wrap existing code
  async startSweep(params) {
    return existingHackRFCode.doSweep(params);
  }
}

// Keep old imports working
export { existingHackRFCode };
```

### Phase 3: Gradual Extraction (Weeks 3-6)
**Extract one service at a time:**

```bash
# 1. Copy (don't move) the service
cp -r src/backend/services/hackrf services/hackrf-service

# 2. Run both in parallel
# 3. Add feature flag to switch between them
# 4. Test thoroughly
# 5. Only remove old one when 100% confident
```

## Critical Testing Strategy

### 1. Visual Regression Testing
```javascript
// tests/visual-regression.test.js
test('HackRF UI looks the same', async () => {
  // Screenshot before migration
  const before = await page.screenshot();
  
  // Switch to new service
  await page.evaluate(() => {
    window.USE_NEW_SERVICE = true;
  });
  
  // Screenshot after
  const after = await page.screenshot();
  
  // Compare
  expect(compareImages(before, after)).toBeLessThan(0.01);
});
```

### 2. End-to-End Testing
```typescript
// tests/e2e/critical-paths.test.ts
describe('Critical User Journeys', () => {
  test('Start HackRF sweep and see results', async () => {
    await page.goto('/hackrf');
    await page.click('[data-testid="start-sweep"]');
    await page.waitForSelector('[data-testid="spectrum-display"]');
    
    const hasData = await page.$eval(
      '[data-testid="spectrum-display"]',
      el => el.children.length > 0
    );
    expect(hasData).toBe(true);
  });
});
```

### 3. API Contract Testing
```javascript
// tests/api-contracts.test.js
test('API responses match exactly', async () => {
  const oldResponse = await fetch('http://old-api/sweep');
  const newResponse = await fetch('http://new-api/sweep');
  
  expect(oldResponse.status).toBe(newResponse.status);
  expect(await oldResponse.json()).toEqual(await newResponse.json());
});
```

## Rollback Strategy

### Instant Rollback Plan
```yaml
# docker-compose.rollback.yml
version: '3.8'
services:
  app:
    image: argos:last-known-good  # Tagged before migration
    ports:
      - "5173:5173"
    environment:
      - USE_LEGACY_MODE=true
```

### Git Strategy
```bash
# Tag before any changes
git tag pre-migration-backup

# If things go wrong
git checkout pre-migration-backup
docker-compose up
```

## What NOT to Do

1. **Don't do a "big bang" migration**
2. **Don't delete old code until new is proven**
3. **Don't change URLs or API contracts**
4. **Don't modify database schemas**
5. **Don't break existing integrations**

## Safer Alternative: Improve What You Have

Instead of a full reorganization, consider:

### 1. Better Documentation
```markdown
# src/ARCHITECTURE.md
## Where Things Are
- HackRF UI: src/routes/hackrf/+page.svelte
- HackRF Service: src/lib/services/hackrf/
- Signal Processing: src/lib/services/signal-processor/

## How Things Connect
[diagram here]
```

### 2. Code Organization Rules
```javascript
// src/lib/services/index.ts
// Central service registry
export * from './hackrf';
export * from './kismet';
export * from './signal-processor';

// Now everyone imports from one place
import { hackrfService } from '@/lib/services';
```

### 3. Gradual Improvements
- Add TypeScript types gradually
- Improve one service at a time
- Add tests for critical paths
- Document as you go

## The Reality Check

**Your current system works.** Users can:
- See spectrum displays
- Control hardware
- View maps
- Analyze signals

**Don't break what works** for the sake of "professional organization."

## My Recommendation

1. **Start with documentation** - Map what you have
2. **Add tests** - Protect against regressions
3. **Organize in place** - Move files within current structure
4. **Extract gradually** - One service at a time, with fallbacks
5. **Keep old code** - Until new code is battle-tested

## Questions to Ask Before Migrating

- [ ] Do we have comprehensive tests?
- [ ] Can we afford downtime?
- [ ] Do we have rollback procedures?
- [ ] Have we load-tested the new architecture?
- [ ] Are all team members trained?
- [ ] Do we have monitoring in place?

If you answered "no" to any of these, you're not ready for a full migration.

## The Bottom Line

**A messy codebase that works is better than a clean codebase that doesn't.**

Start small, test everything, and always have a way back.