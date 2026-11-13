/**
 * @file apps/web/src/health.ts
 * @description Liveness and readiness health-check handlers for Vitrine web service.
 */

import { Router, Request, Response } from 'express';
import { Client } from 'pg';
import type { HealthLiveResponse, HealthReadyResponse } from '@vitrine/shared';

const DEFAULT_DB_TIMEOUT_MS = 2000;

export interface HealthRouterOptions {
  /** Override DATABASE_URL resolution (primarily for testing). */
  getDatabaseUrl?: () => string | undefined;
  /** Timeout in milliseconds for the readiness SELECT 1 probe. Defaults to 2000ms. */
  timeoutMs?: number;
}

export function getLiveHealthStatus(): HealthLiveResponse {
  return {
    status: 'ok',
    service: 'vitrine-web',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Executes `SELECT 1` against PostgreSQL using the `pg` driver with a strict timeout.
 * Returns true only if the query actually succeeded.
 */
export async function checkDatabaseReadiness(
  connectionString: string | undefined,
  timeoutMs: number = DEFAULT_DB_TIMEOUT_MS
): Promise<boolean> {
  if (!connectionString || connectionString.trim() === '') {
    return false;
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
    statement_timeout: timeoutMs,
  });

  // Prevent unhandled error events on sudden socket termination
  client.on('error', () => {});

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const queryPromise = (async () => {
      await client.connect();
      await client.query('SELECT 1');
      return true;
    })();

    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve(false);
      }, timeoutMs);
    });

    return await Promise.race([queryPromise, timeoutPromise]);
  } catch {
    return false;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    await client.end().catch(() => {});
  }
}

export function createHealthRouter(options: HealthRouterOptions = {}): Router {
  const router = Router();
  const getDatabaseUrl = options.getDatabaseUrl ?? (() => process.env.DATABASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_DB_TIMEOUT_MS;

  const handleLive = (_req: Request, res: Response): void => {
    const payload = getLiveHealthStatus();
    res.status(200).json(payload);
  };

  const handleReady = async (_req: Request, res: Response): Promise<void> => {
    const isConnected = await checkDatabaseReadiness(getDatabaseUrl(), timeoutMs);
    const payload: HealthReadyResponse = {
      status: isConnected ? 'ok' : 'error',
      service: 'vitrine-web',
      timestamp: new Date().toISOString(),
      database: isConnected ? 'connected' : 'disconnected',
    };

    res.status(isConnected ? 200 : 503).json(payload);
  };

  router.get('/health/live', handleLive);
  router.get('/health', handleLive);
  router.get('/api/health', handleLive);
  router.get('/health/ready', handleReady);

  return router;
}

export const healthRouter = createHealthRouter();
