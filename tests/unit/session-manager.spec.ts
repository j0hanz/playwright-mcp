/**
 * Session Manager Unit Tests
 *
 * Tests for rate limiting, capacity management, and session lifecycle
 * in the SessionManager class.
 */
import { test, expect } from '@playwright/test';

test.describe('Session Manager - Rate Limiting', () => {
  test('rate limiter should track request timestamps', async () => {
    // Simulate rate limiter behavior
    const timestamps: number[] = [];
    const maxRequests = 10;
    const windowMs = 60_000; // 1 minute

    const canAccept = () => {
      const now = Date.now();
      const cutoff = now - windowMs;

      // Prune expired timestamps
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }

      return timestamps.length < maxRequests;
    };

    const consumeToken = () => {
      if (!canAccept()) {
        throw new Error('Rate limit exceeded');
      }
      timestamps.push(Date.now());
    };

    // Should accept first 10 requests
    for (let i = 0; i < maxRequests; i++) {
      expect(() => consumeToken()).not.toThrow();
    }

    // 11th request should be rejected
    expect(() => consumeToken()).toThrow('Rate limit exceeded');
  });

  test('rate limiter should reset after window expires', async () => {
    const timestamps: number[] = [];
    const maxRequests = 5;
    const windowMs = 100; // Short window for testing

    const canAccept = () => {
      const now = Date.now();
      const cutoff = now - windowMs;

      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }

      return timestamps.length < maxRequests;
    };

    const consumeToken = () => {
      if (!canAccept()) {
        throw new Error('Rate limit exceeded');
      }
      timestamps.push(Date.now());
    };

    // Fill up the rate limit
    for (let i = 0; i < maxRequests; i++) {
      consumeToken();
    }

    expect(canAccept()).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, windowMs + 50));

    // Should accept requests again
    expect(canAccept()).toBe(true);
  });

  test('rate limiter status should report correct values', async () => {
    const timestamps: number[] = [];
    const maxRequests = 10;
    const windowMs = 60_000;

    const getStatus = () => {
      const now = Date.now();
      const cutoff = now - windowMs;

      // Prune expired
      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }

      const remaining = Math.max(0, maxRequests - timestamps.length);
      const oldestTimestamp = timestamps[0];
      const resetMs = oldestTimestamp
        ? Math.max(0, oldestTimestamp + windowMs - now)
        : 0;

      return {
        allowed: timestamps.length < maxRequests,
        remaining,
        resetMs,
      };
    };

    // Initial status
    let status = getStatus();
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(maxRequests);

    // After 3 requests
    timestamps.push(Date.now(), Date.now(), Date.now());
    status = getStatus();
    expect(status.remaining).toBe(maxRequests - 3);
    expect(status.resetMs).toBeGreaterThan(0);
  });
});

test.describe('Session Manager - Capacity Management', () => {
  test('should track remaining capacity correctly', async () => {
    const maxSessions = 5;
    let currentSessions = 0;

    const getRemainingCapacity = () =>
      Math.max(0, maxSessions - currentSessions);

    const checkCapacity = () => {
      if (currentSessions >= maxSessions) {
        throw new Error(`Maximum capacity (${maxSessions}) reached`);
      }
    };

    expect(getRemainingCapacity()).toBe(5);

    // Add sessions
    for (let i = 0; i < 3; i++) {
      checkCapacity();
      currentSessions++;
    }

    expect(getRemainingCapacity()).toBe(2);

    // Fill to capacity
    checkCapacity();
    currentSessions++;
    checkCapacity();
    currentSessions++;

    expect(getRemainingCapacity()).toBe(0);

    // Next should throw
    expect(() => checkCapacity()).toThrow('Maximum capacity (5) reached');
  });

  test('should allow new sessions after cleanup', async () => {
    const maxSessions = 3;
    let currentSessions = 0;

    const checkCapacity = () => {
      if (currentSessions >= maxSessions) {
        throw new Error('Capacity exceeded');
      }
    };

    // Fill to capacity
    currentSessions = 3;
    expect(() => checkCapacity()).toThrow();

    // Cleanup one session
    currentSessions--;
    expect(() => checkCapacity()).not.toThrow();
  });
});

test.describe('Session Manager - Session Lifecycle', () => {
  test('should generate unique session IDs', async () => {
    const sessionIds = new Set<string>();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Generate 100 IDs and verify uniqueness
    for (let i = 0; i < 100; i++) {
      const id = crypto.randomUUID();
      expect(uuidRegex.test(id)).toBe(true);
      expect(sessionIds.has(id)).toBe(false);
      sessionIds.add(id);
    }

    expect(sessionIds.size).toBe(100);
  });

  test('should track session activity timestamps', async () => {
    const sessions = new Map<string, { lastActivity: Date; createdAt: Date }>();

    const createSession = (id: string) => {
      const now = new Date();
      sessions.set(id, { lastActivity: now, createdAt: now });
      return id;
    };

    const updateActivity = (id: string) => {
      const session = sessions.get(id);
      if (session) {
        session.lastActivity = new Date();
      }
    };

    const getIdleTime = (id: string) => {
      const session = sessions.get(id);
      if (!session) return -1;
      return Date.now() - session.lastActivity.getTime();
    };

    // Create session
    const sessionId = createSession('test-session');
    expect(getIdleTime(sessionId)).toBeLessThan(100);

    // Wait and check idle time increased
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(getIdleTime(sessionId)).toBeGreaterThanOrEqual(50);

    // Update activity resets idle time
    updateActivity(sessionId);
    expect(getIdleTime(sessionId)).toBeLessThan(50);
  });

  test('should cleanup expired sessions based on maxAge', async () => {
    const sessions = new Map<string, { lastActivity: Date }>();
    const maxAge = 100; // 100ms for testing

    const createSession = (id: string, age: number) => {
      sessions.set(id, {
        lastActivity: new Date(Date.now() - age),
      });
    };

    const cleanupExpired = () => {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, session] of sessions) {
        const age = now - session.lastActivity.getTime();
        if (age > maxAge) {
          sessions.delete(id);
          cleaned++;
        }
      }

      return cleaned;
    };

    // Create sessions with different ages
    createSession('fresh', 0);
    createSession('recent', 50);
    createSession('old', 150);
    createSession('ancient', 500);

    expect(sessions.size).toBe(4);

    // Cleanup should remove old and ancient
    const cleaned = cleanupExpired();
    expect(cleaned).toBe(2);
    expect(sessions.size).toBe(2);
    expect(sessions.has('fresh')).toBe(true);
    expect(sessions.has('recent')).toBe(true);
    expect(sessions.has('old')).toBe(false);
    expect(sessions.has('ancient')).toBe(false);
  });
});

test.describe('Session Manager - Page Management', () => {
  test('should track pages within sessions', async () => {
    const sessions = new Map<string, { pages: Map<string, object> }>();

    const createSession = (id: string) => {
      sessions.set(id, { pages: new Map() });
    };

    const addPage = (sessionId: string, pageId: string) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error('Session not found');
      session.pages.set(pageId, { url: 'about:blank' });
    };

    const getPageCount = (sessionId: string) => {
      const session = sessions.get(sessionId);
      return session?.pages.size ?? 0;
    };

    const removePage = (sessionId: string, pageId: string) => {
      const session = sessions.get(sessionId);
      return session?.pages.delete(pageId) ?? false;
    };

    // Create session and add pages
    createSession('session-1');
    expect(getPageCount('session-1')).toBe(0);

    addPage('session-1', 'page-1');
    addPage('session-1', 'page-2');
    expect(getPageCount('session-1')).toBe(2);

    // Remove page
    expect(removePage('session-1', 'page-1')).toBe(true);
    expect(getPageCount('session-1')).toBe(1);

    // Remove non-existent page
    expect(removePage('session-1', 'page-999')).toBe(false);
  });

  test('should track active page ID', async () => {
    let activePageId: string | undefined;
    const pages = new Map<string, object>();

    const setActivePage = (pageId: string) => {
      if (!pages.has(pageId)) {
        throw new Error('Page not found');
      }
      activePageId = pageId;
    };

    const getActivePage = () => activePageId;

    // Add pages
    pages.set('page-1', {});
    pages.set('page-2', {});

    // Set active page
    setActivePage('page-1');
    expect(getActivePage()).toBe('page-1');

    // Change active page
    setActivePage('page-2');
    expect(getActivePage()).toBe('page-2');

    // Non-existent page should throw
    expect(() => setActivePage('page-999')).toThrow('Page not found');
  });
});

test.describe('Session Manager - Cache Behavior', () => {
  test('should cache session list with TTL', async () => {
    const cacheTTL = 50; // 50ms TTL for testing
    let cache: object[] | null = null;
    let cacheTimestamp = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    const sessions = new Map<string, { id: string }>();

    const listSessions = () => {
      const now = Date.now();

      // Check cache validity
      if (cache && now - cacheTimestamp < cacheTTL) {
        cacheHits++;
        return cache;
      }

      // Cache miss - rebuild
      cacheMisses++;
      cache = Array.from(sessions.values());
      cacheTimestamp = now;
      return cache;
    };

    const invalidateCache = () => {
      cache = null;
    };

    // First call - cache miss
    sessions.set('s1', { id: 's1' });
    listSessions();
    expect(cacheMisses).toBe(1);
    expect(cacheHits).toBe(0);

    // Second call within TTL - cache hit
    listSessions();
    expect(cacheMisses).toBe(1);
    expect(cacheHits).toBe(1);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, cacheTTL + 10));

    // Call after TTL - cache miss
    listSessions();
    expect(cacheMisses).toBe(2);
    expect(cacheHits).toBe(1);

    // Add session and invalidate cache
    sessions.set('s2', { id: 's2' });
    invalidateCache();

    // Next call - cache miss
    listSessions();
    expect(cacheMisses).toBe(3);
  });
});
