export interface EnvExampleEntry {
  key: string;
  val: string;
}

export interface ScanDistOptions {
  distDir?: string;
  envExamplePath?: string;
}

export interface ScanDistResult {
  ok: boolean;
  filesScanned: number;
  findings: string[];
}

export function loadEnvExampleValues(envExamplePath: string): EnvExampleEntry[];
export function collectFilesRecursively(dirPath: string): string[];
export function scanDist(options?: ScanDistOptions): ScanDistResult;
