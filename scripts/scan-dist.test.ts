import { afterEach, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scanDist } from './scan-dist.mjs';

const tempDirs: string[] = [];

function createTempFixture(): { rootDir: string; distDir: string; envExamplePath: string } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitrine-scan-dist-'));
  tempDirs.push(rootDir);

  const distDir = path.join(rootDir, 'dist');
  const nestedDir = path.join(distDir, 'assets', 'nested', 'chunk-dir');
  fs.mkdirSync(nestedDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>');
  fs.writeFileSync(path.join(nestedDir, 'clean.js'), 'console.log("Vitrine storefront bundle");');

  const envExamplePath = path.join(rootDir, '.env.example');
  fs.writeFileSync(
    envExamplePath,
    [
      'NODE_ENV="development"',
      'PORT=3000',
      'GEMINI_API_KEY="MY_GEMINI_API_KEY"',
      'TENANT_CONTEXT_SECRET="PLANTED_SUPER_SECRET_HEX_998877"',
    ].join('\n')
  );

  return { rootDir, distDir, envExamplePath };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('scripts/scan-dist.mjs', () => {
  it('passes on a clean nested fixture tree without crashing on directories', () => {
    const { distDir, envExamplePath } = createTempFixture();

    const result = scanDist({ distDir, envExamplePath });
    expect(result.ok).toBe(true);
    expect(result.filesScanned).toBe(2);
    expect(result.findings).toEqual([]);

    const cli = spawnSync(
      process.execPath,
      [
        path.resolve('scripts/scan-dist.mjs'),
        `--dist=${distDir}`,
        `--env-example=${envExamplePath}`,
      ],
      { encoding: 'utf8' }
    );
    expect(cli.status).toBe(0);
    expect(cli.stdout).toContain('Client bundle secret scan passed (2 files checked).');
  });

  it('fails when a nested bundle file contains a planted secret or forbidden key token', () => {
    const { distDir, envExamplePath } = createTempFixture();
    const plantedFile = path.join(distDir, 'assets', 'nested', 'chunk-dir', 'leaked.js');
    fs.writeFileSync(plantedFile, 'export const leaked = "PLANTED_SUPER_SECRET_HEX_998877";');

    const result = scanDist({ distDir, envExamplePath });
    expect(result.ok).toBe(false);
    expect(result.filesScanned).toBe(3);
    expect(result.findings).toEqual([
      `${plantedFile}: contains .env.example value for TENANT_CONTEXT_SECRET`,
    ]);

    const cli = spawnSync(
      process.execPath,
      [
        path.resolve('scripts/scan-dist.mjs'),
        `--dist=${distDir}`,
        `--env-example=${envExamplePath}`,
      ],
      { encoding: 'utf8' }
    );
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain('TENANT_CONTEXT_SECRET');
  });
});
