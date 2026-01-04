import {readdirSync} from 'node:fs';
import {join} from 'node:path';

export function findFirstFile(
  rootDir: string,
  matcher: (pathname: string) => boolean,
): string | null {
  const entries = readdirSync(rootDir, {withFileTypes: true});
  for (const entry of entries) {
    const pathname = join(rootDir, entry.name);
    if (entry.isFile() && matcher(pathname)) {
      return pathname;
    }
    if (entry.isDirectory()) {
      const found = findFirstFile(pathname, matcher);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function listDirectories(rootDir: string): string[] {
  const entries = readdirSync(rootDir, {withFileTypes: true});
  return entries.filter(entry => entry.isDirectory()).map(entry => join(rootDir, entry.name));
}
