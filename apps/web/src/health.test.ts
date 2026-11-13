/**
 * @file apps/web/src/health.test.ts
 * @description Integration tests for apps/web liveness and readiness health-check endpoints.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createWebApp } from './app.ts';

describe('apps/web Health Check Endpoints', () => {
  it('GET /health/live returns 200 without a database and omits environment and uptime', async () => {
    const app = createWebApp({
      health: { getDatabaseUrl: () => undefined },
    });

    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      status: 'ok',
      service: 'vitrine-web',
      timestamp: expect.any(String),
    });
    expect(new Date(res.body.timestamp as string).getTime()).not.toBeNaN();
    expect(res.body).not.toHaveProperty('environment');
    expect(res.body).not.toHaveProperty('uptimeSeconds');
    expect(res.body).not.toHaveProperty('uptime');
    expect(res.body).not.toHaveProperty('database');
  });

  it('GET /health and GET /api/health act as aliases of /health/live', async () => {
    const app = createWebApp({
      health: { getDatabaseUrl: () => undefined },
    });

    for (const path of ['/health', '/api/health']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'vitrine-web',
        timestamp: expect.any(String),
      });
      expect(res.body).not.toHaveProperty('environment');
      expect(res.body).not.toHaveProperty('uptimeSeconds');
    }
  });

  it('GET /health/ready returns 503 with database:"disconnected" when DATABASE_URL is unset', async () => {
    const app = createWebApp({
      health: { getDatabaseUrl: () => undefined },
    });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'error',
      service: 'vitrine-web',
      timestamp: expect.any(String),
      database: 'disconnected',
    });
    expect(res.body).not.toHaveProperty('environment');
    expect(res.body).not.toHaveProperty('uptimeSeconds');
  });

  it('GET /health/ready returns 503 with database:"disconnected" when DATABASE_URL is unreachable', async () => {
    const app = createWebApp({
      health: {
        getDatabaseUrl: () => 'postgresql://vitrine_app:invalid@127.0.0.1:59999/vitrine_unreachable',
        timeoutMs: 500,
      },
    });

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.database).toBe('disconnected');
    expect(res.body).not.toHaveProperty('environment');
    expect(res.body).not.toHaveProperty('uptimeSeconds');
  });

  const isCI = process.env.CI === 'true';
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const runRealDbTest = isCI || hasDatabaseUrl ? it : it.skip;

  // In CI (CI=true), this test MUST run and FAIL if PostgreSQL is unreachable or unconfigured.
  runRealDbTest(
    'GET /health/ready returns 200 with database:"connected" against PostgreSQL',
    async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL must be configured when CI=true');
      }

      const app = createWebApp();
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        service: 'vitrine-web',
        timestamp: expect.any(String),
        database: 'connected',
      });
      expect(res.body).not.toHaveProperty('environment');
      expect(res.body).not.toHaveProperty('uptimeSeconds');
    }
  );
});
