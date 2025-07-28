# Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Always define types in packages/shared and import from there - prevents type drift between frontend and backend
- **API Calls:** Never make direct HTTP calls - use the service layer for consistency and error handling
- **Environment Variables:** Access only through config objects, never process.env directly - ensures validation and type safety
- **Error Handling:** All API routes must use the standard error handler - maintains consistent error format
- **State Updates:** Never mutate state directly - use proper state management patterns (Svelte stores, immutable updates)
- **Hardware Integration:** All SDR commands must go through the hardware abstraction layer - ensures proper cleanup and error recovery
- **WebSocket Messages:** Use typed message contracts from shared package - prevents protocol mismatches
- **Database Queries:** Always use parameterized queries - prevents SQL injection
- **Async Operations:** Every async function must have proper error handling - no unhandled promise rejections
- **Signal Data Validation:** All signal data must pass Zod schema validation before storage - ensures data integrity
- **Database Type Generation:** Run type generation after every migration - ensures TypeScript types always match database schema

## Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `SignalMap.svelte` |
| Hooks | camelCase with 'use' | - | `useAuth.ts` |
| API Routes | - | kebab-case | `/api/signal-batch` |
| Database Tables | - | snake_case | `signal_detections` |
| Svelte Stores | camelCase with 'Store' suffix | - | `signalStore.ts` |
| Service Classes | - | PascalCase with 'Service' suffix | `SignalService.ts` |
| Event Names | SCREAMING_SNAKE_CASE | SCREAMING_SNAKE_CASE | `SIGNAL_DETECTED` |
| Config Constants | SCREAMING_SNAKE_CASE | SCREAMING_SNAKE_CASE | `MAX_SIGNAL_BATCH_SIZE` |

## Database Type Generation

```typescript
// scripts/generate-db-types.ts
import { generateTypes } from 'sql-ts';
import { config } from '../packages/shared/config';

// Rule: Run automatically after migrations
// npm run db:migrate && npm run db:generate-types

export async function generateDatabaseTypes() {
  const types = await generateTypes({
    client: 'sqlite3',
    connection: config.database.connection,
    output: 'packages/shared/src/types/database.generated.ts',
    interfacePrefix: 'DB',
    enumPrefix: 'DBEnum',
    // Transform snake_case to PascalCase
    interfaceNameFormat: 'pascal',
    // Exclude internal tables
    excludedTables: ['knex_migrations', 'knex_migrations_lock']
  });
  
  console.log('✅ Database types generated successfully');
}

// Add to package.json scripts:
// "db:generate-types": "tsx scripts/generate-db-types.ts"
// "db:migrate": "knex migrate:latest && npm run db:generate-types"
```
