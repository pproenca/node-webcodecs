#!/usr/bin/env npx tsx
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Fetch WebCodecs API specs from MDN for compliance checking.
// Usage: ./scripts/fetch-webcodecs-specs.ts [--process]
//        npx tsx scripts/fetch-webcodecs-specs.ts --process
//
// Options:
//   --process  Strip MDN macros for cleaner markdown

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPECS_DIR = join(ROOT, 'docs', 'specs');

// ANSI colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// WebCodecs interfaces to fetch from MDN
const WEBCODECS_INTERFACES = [
  'webcodecs_api',
  'audiodata',
  'audiodecoder',
  'audioencoder',
  'encodedaudiochunk',
  'encodedvideochunk',
  'imagedecoder',
  'imagetrack',
  'imagetracklist',
  'videodecoder',
  'videoencoder',
  'videocolorspace',
  'videoframe',
];

function log(msg: string): void {
  console.log(msg);
}

function success(msg: string): void {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function info(msg: string): void {
  console.log(`${CYAN}→${RESET} ${msg}`);
}

function warn(msg: string): void {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

function exec(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Strip MDN macros from markdown content.
 * Converts {{domxref("X")}} → X, removes sidebar macros, etc.
 */
function stripMdnMacros(content: string): string {
  return content
    // {{domxref("VideoEncoder.state","state")}} → state (use display text if provided)
    .replace(/\{\{domxref\([^,)]+,\s*"([^"]+)"\)\}\}/g, '`$1`')
    // {{domxref("VideoFrame")}} → VideoFrame
    .replace(/\{\{domxref\("([^"]+)"\)\}\}/g, '`$1`')
    // {{jsxref("boolean")}} → boolean
    .replace(/\{\{jsxref\("([^"]+)"\)\}\}/g, '`$1`')
    // {{optional_inline}} → *(optional)*
    .replace(/\{\{optional_inline\}\}/g, '*(optional)*')
    // {{ReadOnlyInline}} → *(read-only)*
    .replace(/\{\{ReadOnlyInline\}\}/g, '*(read-only)*')
    // {{SecureContext_Header}} → note
    .replace(/\{\{SecureContext_Header\}\}/g, '**Secure context required.**')
    // {{AvailableInWorkers(...)}} → note
    .replace(/\{\{AvailableInWorkers\([^)]*\)\}\}/g, '')
    // {{APIRef(...)}} → remove (sidebar)
    .replace(/\{\{APIRef\([^)]*\)\}\}/g, '')
    // {{InheritanceDiagram}} → remove
    .replace(/\{\{InheritanceDiagram\}\}/g, '')
    // {{Specifications}} → note
    .replace(/\{\{Specifications\}\}/g, '*See W3C WebCodecs specification.*')
    // {{Compat}} → note
    .replace(/\{\{Compat\}\}/g, '*See MDN for browser compatibility.*')
    // {{Glossary("X")}} → X
    .replace(/\{\{Glossary\("([^"]+)"\)\}\}/g, '$1')
    // {{HTTPHeader("X")}} → X
    .replace(/\{\{HTTPHeader\("([^"]+)"\)\}\}/g, '`$1`')
    // Catch-all: {{SomeMacro}} or {{SomeMacro(...)}} → remove
    .replace(/\{\{[^}]+\}\}/g, '')
    // Clean up multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up lines that are just whitespace
    .replace(/^\s+$/gm, '');
}

/**
 * Process all markdown files in a directory, stripping MDN macros.
 */
function processDirectory(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.name.endsWith('.md')) {
      const content = readFileSync(fullPath, 'utf8');
      const processed = stripMdnMacros(content);
      writeFileSync(fullPath, processed);
    }
  }
}

function countMdFiles(dir: string): number {
  let count = 0;
  if (!existsSync(dir)) return 0;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countMdFiles(fullPath);
    } else if (entry.name.endsWith('.md')) {
      count++;
    }
  }
  return count;
}

function generateReadme(): string {
  const lines: string[] = [
    '# WebCodecs API Specifications',
    '',
    '> Auto-generated from [MDN Web Docs](https://github.com/mdn/content)',
    '>',
    `> Last updated: ${new Date().toISOString().split('T')[0]}`,
    '',
    'This directory contains the WebCodecs API documentation from MDN,',
    'used for compliance checking of the node-webcodecs implementation.',
    '',
    '## Interfaces',
    '',
  ];

  for (const iface of WEBCODECS_INTERFACES) {
    const displayName = iface === 'webcodecs_api'
      ? 'WebCodecs API (Overview)'
      : iface.charAt(0).toUpperCase() + iface.slice(1);
    lines.push(`- [${displayName}](./${iface}/index.md)`);
  }

  lines.push('');
  lines.push('## Regenerating');
  lines.push('');
  lines.push('```bash');
  lines.push('./scripts/fetch-webcodecs-specs.ts');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const shouldProcess = process.argv.includes('--process');

  log('\nFetching WebCodecs specs from MDN...\n');
  if (shouldProcess) {
    info('Will process files to strip MDN macros');
  }

  // Create temp directory
  const tmpDir = exec('mktemp -d').trim();
  info(`Created temp directory: ${tmpDir}`);

  try {
    // Initialize sparse checkout
    info('Initializing sparse checkout of mdn/content...');
    exec('git init', tmpDir);
    exec('git remote add origin https://github.com/mdn/content.git', tmpDir);
    exec('git config core.sparseCheckout true', tmpDir);

    // Configure sparse patterns for WebCodecs interfaces
    const sparsePatterns = WEBCODECS_INTERFACES
      .map(iface => `files/en-us/web/api/${iface}/`)
      .join('\n');

    const sparseCheckoutPath = join(tmpDir, '.git', 'info', 'sparse-checkout');
    writeFileSync(sparseCheckoutPath, `${sparsePatterns}\n`);
    success('Configured sparse checkout patterns');

    // Fetch and checkout (only main branch, depth 1 for speed)
    info('Fetching files (this may take a moment)...');
    exec('git fetch --depth 1 origin main', tmpDir);
    exec('git checkout main', tmpDir);
    success('Checked out WebCodecs documentation');

    // Ensure docs/specs exists
    if (existsSync(SPECS_DIR)) {
      info('Removing existing docs/specs...');
      rmSync(SPECS_DIR, { recursive: true });
    }
    mkdirSync(SPECS_DIR, { recursive: true });

    // Copy each interface directory
    const srcBase = join(tmpDir, 'files', 'en-us', 'web', 'api');
    for (const iface of WEBCODECS_INTERFACES) {
      const srcPath = join(srcBase, iface);
      const destPath = join(SPECS_DIR, iface);

      if (existsSync(srcPath)) {
        cpSync(srcPath, destPath, { recursive: true });
        const mdCount = countMdFiles(destPath);
        success(`${iface}/ (${mdCount} files)`);
      } else {
        warn(`${iface}/ not found in MDN repo`);
      }
    }

    // Process files if requested
    if (shouldProcess) {
      info('Processing files to strip MDN macros...');
      processDirectory(SPECS_DIR);
      success('Stripped MDN macros from all files');
    }

    // Generate README
    writeFileSync(join(SPECS_DIR, 'README.md'), generateReadme());
    success('Generated docs/specs/README.md');

  } finally {
    // Cleanup temp directory
    info('Cleaning up...');
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const totalFiles = countMdFiles(SPECS_DIR);
  log(`\n${GREEN}Done!${RESET} Fetched ${totalFiles} spec files to docs/specs/\n`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
