import {appendFileSync} from 'node:fs';

export type EnvWriter = (path: string, data: string) => void

export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function appendKeyValue(pathname: string, key: string, value: string, writer: EnvWriter): void {
  writer(pathname, `${key}=${value}\n`);
}

export function writeGithubOutput(
  env: NodeJS.ProcessEnv,
  key: string,
  value: string,
  writer: EnvWriter = appendFileSync,
): void {
  const outputFile = requireEnv(env, 'GITHUB_OUTPUT');
  appendKeyValue(outputFile, key, value, writer);
}

export function writeGithubEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  value: string,
  writer: EnvWriter = appendFileSync,
): void {
  const envFile = requireEnv(env, 'GITHUB_ENV');
  appendKeyValue(envFile, key, value, writer);
}
