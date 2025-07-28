# Security and Performance

## Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`
- XSS Prevention: Svelte's automatic HTML escaping + input validation with Zod schemas
- Secure Storage: JWT tokens in httpOnly cookies, sensitive data encrypted in localStorage with Web Crypto API
- Security Monitoring: Real-time security event logging and anomaly detection

**Backend Security:**
- Input Validation: Zod schemas for all API endpoints with strict type checking
- Rate Limiting: 100 requests per minute per IP for general endpoints, 10 requests per minute for auth endpoints
- CORS Policy: Strict origin whitelist for production, credentials enabled for cookie-based auth
- Audit Logging: Comprehensive security event tracking for compliance and threat detection

**Authentication Security:**
- Token Storage: JWT in httpOnly, secure, sameSite cookies with 15-minute access tokens
- Session Management: Refresh tokens with 7-day expiry, automatic renewal on activity
- Password Policy: Minimum 8 characters, must include uppercase, lowercase, number, and special character
- Security Events: Failed login tracking, suspicious pattern detection, automated alerting

## Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 500KB initial load, < 50KB per lazy-loaded route
- Loading Strategy: Route-based code splitting, prefetch critical routes, lazy load heavy components
- Caching Strategy: Service worker with cache-first for assets, network-first for API calls, 24-hour cache for static resources

**Backend Performance:**
- Response Time Target: < 100ms for cached queries, < 500ms for complex operations
- Database Optimization: SQLite R-tree indexes for spatial queries, prepared statements, connection pooling
- Caching Strategy: In-memory cache for frequent queries, 5-minute TTL for signal data, invalidation on updates

## Security Monitoring Implementation

```typescript
// Security event logging
interface SecurityEvent {
  timestamp: Date;
  eventType: 'auth_failure' | 'rate_limit' | 'invalid_input' | 'suspicious_pattern';
  userId?: string;
  ip: string;
  details: Record<string, any>;
}

// Implement security monitoring service
class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private alertThresholds = {
    auth_failure: { count: 5, window: 300 }, // 5 failures in 5 minutes
    rate_limit: { count: 10, window: 60 },   // 10 rate limits in 1 minute
    invalid_input: { count: 20, window: 300 } // 20 invalid inputs in 5 minutes
  };

  logEvent(event: SecurityEvent): void {
    this.events.push(event);
    this.checkThresholds(event);
    this.persistEvent(event);
  }

  detectAnomalies(): void {
    // Check for suspicious patterns
    const recentEvents = this.getRecentEvents(300); // Last 5 minutes
    
    // Detect credential stuffing
    const uniqueIPs = new Set(recentEvents.map(e => e.ip));
    if (uniqueIPs.size > 50 && recentEvents.filter(e => e.eventType === 'auth_failure').length > 100) {
      this.alertOnThreat('Potential credential stuffing attack detected');
    }
    
    // Detect targeted attacks
    const failuresByUser = this.groupByUser(recentEvents.filter(e => e.eventType === 'auth_failure'));
    for (const [userId, failures] of failuresByUser) {
      if (failures.length > 10) {
        this.alertOnThreat(`Targeted attack on user ${userId}`);
      }
    }
  }

  private alertOnThreshold(eventType: string, count: number): void {
    // Send alerts via configured channels (email, Slack, PagerDuty)
    console.error(`Security threshold exceeded: ${eventType} occurred ${count} times`);
  }
}
```
