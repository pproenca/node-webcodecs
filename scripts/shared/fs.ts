import {mkdirSync, rmSync} from 'node:fs';

export function ensureDir(pathname: string): void {
  mkdirSync(pathname, {recursive: true});
}

export function removeDir(pathname: string): void {
  rmSync(pathname, {recursive: true, force: true});
}
