export interface ParsedArgs {
  readonly positional: string[];
  readonly flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split('=');
    if (inline !== undefined) {
      flags[key] = inline;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = 'true';
    }
  }

  return {positional, flags};
}

export function requireFlag(flags: Record<string, string>, key: string): string {
  const value = flags[key];
  if (!value) {
    throw new Error(`Missing required argument: --${key}`);
  }
  return value;
}
