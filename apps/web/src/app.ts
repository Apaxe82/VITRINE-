/**
 * @file apps/web/src/app.ts
 * @description Express application setup for apps/web with health-check and middleware.
 */

import express, { Express } from 'express';
import { healthRouter } from './health.ts';

export function createWebApp(): Express {
  const app = express();

  app.use(express.json());

  // Mount health check router
  app.use(healthRouter);

  return app;
}
