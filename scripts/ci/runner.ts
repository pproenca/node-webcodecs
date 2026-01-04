import {
  runCommand,
  runCommandOrThrow,
  type CommandOptions,
  type CommandResult,
} from '../shared/exec';

export interface CommandRunner {
  readonly run: (command: string, args: string[], options?: CommandOptions) => CommandResult;
  readonly runOrThrow: (command: string, args: string[], options?: CommandOptions) => CommandResult;
}

export const DEFAULT_RUNNER: CommandRunner = {
  run: runCommand,
  runOrThrow: runCommandOrThrow,
};

export function runShellScript(
  runner: CommandRunner,
  script: string,
  options: CommandOptions = {},
): void {
  runner.runOrThrow('bash', ['-lc', script], options);
}
