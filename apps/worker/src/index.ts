/**
 * @file apps/worker/src/index.ts
 * @description Background worker entry point for Vitrine (BullMQ / Redis jobs).
 * Handles retries, media compression, AI listing drafting, and async WhatsApp notifications.
 */

export interface WorkerConfig {
  redisUrl: string;
  concurrency: number;
}

export function startWorker(config?: Partial<WorkerConfig>): void {
  const resolvedConfig: WorkerConfig = {
    redisUrl: config?.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    concurrency: config?.concurrency || 5,
  };

  // Phase 1 worker scaffold
  console.log(`[Vitrine Worker] Initialized with concurrency: ${resolvedConfig.concurrency}`);
  console.log(`[Vitrine Worker] Ready to process asynchronous queues.`);
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITRINE_EMBEDDED) {
  startWorker();
}
