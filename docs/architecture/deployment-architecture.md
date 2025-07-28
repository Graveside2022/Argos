# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**
- **Platform:** Static files served by SvelteKit Node.js server
- **Build Command:** `pnpm run build`
- **Output Directory:** `apps/web/build`
- **CDN/Edge:** Optional - Cloudflare for cloud deployment

**Backend Deployment:**
- **Platform:** Linux edge device with SystemD
- **Build Command:** `pnpm run build:api`
- **Deployment Method:** SystemD services with auto-restart

## CI/CD Pipeline

```yaml