/**
 * @file apps/worker/src/index.test.ts
 * @description Unit tests for Vitrine background worker unit.
 */

import { describe, it, expect, vi } from 'vitest';
import { startWorker } from './index.ts';

describe('apps/worker Unit Tests', () => {
  it('initializes worker successfully with custom configuration', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    expect(() => {
      startWorker({ concurrency: 2, redisUrl: 'redis://localhost:6379' });
    }).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Vitrine Worker] Initialized with concurrency: 2')
    );

    consoleSpy.mockRestore();
  });
});
