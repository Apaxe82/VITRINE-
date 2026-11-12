/**
 * @file apps/web/src/health.test.ts
 * @description Integration tests for apps/web health-check endpoint.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createWebApp } from './app.ts';

describe('apps/web Health Check Endpoint', () => {
  const app = createWebApp();

  it('GET /health returns 200 and valid JSON health status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'vitrine-web');
    expect(res.body).toHaveProperty('version', '0.1.0');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('system', 'ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('GET /api/health also returns 200 with identical schema', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('vitrine-web');
  });
});
