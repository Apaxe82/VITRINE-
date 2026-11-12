/**
 * @file apps/web/src/health.ts
 * @description Health-check endpoint handler and router for Vitrine web service.
 */

import { Router, Request, Response } from 'express';
import { HealthStatusResponse } from '@vitrine/shared';

export const healthRouter = Router();

export function getHealthStatus(): HealthStatusResponse {
  return {
    status: 'ok',
    service: 'vitrine-web',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    checks: {
      system: 'ok',
      database: process.env.DATABASE_URL ? 'connected' : 'unconfigured',
    },
  };
}

export function handleHealthCheck(_req: Request, res: Response): void {
  const payload = getHealthStatus();
  res.status(200).json(payload);
}

healthRouter.get('/health', handleHealthCheck);
healthRouter.get('/api/health', handleHealthCheck);
