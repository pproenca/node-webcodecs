import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function isMainModule(importMetaUrl: string): boolean {
  if (!process.argv[1]) {
    return false;
  }
  const entry = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(importMetaUrl));
  return entry === current;
}
