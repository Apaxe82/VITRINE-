/**
 * @file apps/web/src/app.ts
 * @description Express application setup for apps/web with health-check and middleware.
 */

import express, { Express } from 'express';
import { createHealthRouter, type HealthRouterOptions } from './health.ts';

export interface WebAppOptions {
  health?: HealthRouterOptions;
}

export function createWebApp(options: WebAppOptions = {}): Express {
  const app = express();

  app.use(express.json());

  // Mount liveness & readiness health checks
  app.use(createHealthRouter(options.health));

  return app;
}
