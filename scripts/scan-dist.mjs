import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_SCALARS = new Set(['development', 'production', 'true', 'false']);

/**
 * Reads non-empty, non-generic scalar values from .env.example.
 */
export function loadEnvExampleValues(envExamplePath) {
  if (!fs.existsSync(envExamplePath)) {
    return [];
  }
  const envLines = fs.readFileSync(envExamplePath, 'utf8').split(/\r?\n/);
  const envValues = [];

  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!val || IGNORED_SCALARS.has(val) || /^\d+$/.test(val)) continue;
    envValues.push({ key, val });
  }

  return envValues;
}

/**
 * Recursively collects regular file paths inside a directory, skipping directories.
 */
export function collectFilesRecursively(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    return stat.isFile() ? [dirPath] : [];
  }

  const collected = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      collected.push(fullPath);
    }
  }
  return collected;
}

/**
 * Scans dist/index.html and dist/assets recursively for leaked secrets or .env.example values.
 */
export function scanDist({
  distDir = path.resolve(process.cwd(), 'dist'),
  envExamplePath = path.resolve(process.cwd(), '.env.example'),
} = {}) {
  const envValues = loadEnvExampleValues(envExamplePath);
  const clientFiles = [];

  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath) && fs.statSync(indexHtmlPath).isFile()) {
    clientFiles.push(indexHtmlPath);
  }

  const assetsDir = path.join(distDir, 'assets');
  clientFiles.push(...collectFilesRecursively(assetsDir));

  const findings = [];
  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('GEMINI')) {
      findings.push(`${file}: contains "GEMINI"`);
    }
    if (content.includes('API_KEY')) {
      findings.push(`${file}: contains "API_KEY"`);
    }
    for (const { key, val } of envValues) {
      if (content.includes(val)) {
        findings.push(`${file}: contains .env.example value for ${key}`);
      }
    }
  }

  return {
    ok: findings.length === 0,
    filesScanned: clientFiles.length,
    findings,
  };
}

function parseCliArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith('--dist=')) {
      opts.distDir = path.resolve(arg.slice('--dist='.length));
    } else if (arg.startsWith('--env-example=')) {
      opts.envExamplePath = path.resolve(arg.slice('--env-example='.length));
    }
  }
  return opts;
}

const isCliEntry =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  const result = scanDist(parseCliArgs(process.argv.slice(2)));
  if (!result.ok) {
    console.error('Client bundle leak check failed:\n' + result.findings.join('\n'));
    process.exit(1);
  }
  console.log(`Client bundle secret scan passed (${result.filesScanned} files checked).`);
}
