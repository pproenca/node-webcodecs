import {spawnSync} from 'node:child_process';

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface CommandOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: 'inherit' | 'pipe';
}

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): CommandResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  return {
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    exitCode: result.status ?? 0,
  };
}

export function runCommandOrThrow(
  command: string,
  args: string[],
  options: CommandOptions = {},
): CommandResult {
  const result = runCommand(command, args, options);
  if (result.exitCode !== 0) {
    const message = `Command failed: ${command} ${args.join(' ')} (exit ${result.exitCode})`;
    throw new Error(message);
  }
  return result;
}
