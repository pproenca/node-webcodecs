#!/usr/bin/env npx tsx
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Generate TypeScript types from W3C WebCodecs WebIDL specification.
// Usage: npx tsx scripts/generate-types-from-idl.ts
//
// This script:
// 1. Fetches the WebIDL from the W3C WebCodecs spec
// 2. Parses it using webidl2
// 3. Generates TypeScript type definitions
// 4. Post-processes to replace DOM types with Node.js equivalents

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as webidl2 from 'webidl2';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT, 'docs', 'specs');
const OUTPUT_FILE = join(OUTPUT_DIR, 'webcodecs-generated.d.ts');

// ANSI colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

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

function error(msg: string): void {
  console.log(`${RED}✗${RESET} ${msg}`);
}

// W3C WebCodecs spec URL (Editor's Draft has the latest IDL)
const W3C_SPEC_URL = 'https://w3c.github.io/webcodecs/';

// DOM types to replace with Node.js equivalents
const DOM_TYPE_REPLACEMENTS: Record<string, string> = {
  'CanvasImageSource': 'CanvasImageSourceNode',
  'ImageBitmap': 'ImageBitmapNode',
  'OffscreenCanvas': 'OffscreenCanvasNode',
  'HTMLCanvasElement': 'never',
  'HTMLVideoElement': 'never',
  'HTMLImageElement': 'never',
  'HTMLOrSVGImageElement': 'never',
  'DOMException': 'Error',
  'DOMHighResTimeStamp': 'number',
  'EventTarget': 'EventTarget',
  'Event': 'Event',
};

/**
 * Fetch the WebCodecs spec and extract IDL blocks
 */
async function fetchWebIDL(): Promise<string[]> {
  info('Fetching W3C WebCodecs spec...');

  const response = await fetch(W3C_SPEC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${response.status}`);
  }

  const html = await response.text();
  success(`Fetched spec (${(html.length / 1024).toFixed(1)} KB)`);

  // Extract IDL blocks from <pre class="idl"> tags
  const idlBlocks: string[] = [];
  const idlRegex = /<pre[^>]*class="[^"]*idl[^"]*"[^>]*>([\s\S]*?)<\/pre>/gi;

  let match: RegExpExecArray | null = idlRegex.exec(html);
  while (match !== null) {
    // First, remove all HTML tags (including hyperlinks) but preserve text content
    // This handles cases like <a href="...">Promise</a>&lt;<a href="...">undefined</a>&gt;
    const idl = match[1]
      // Remove opening tags but keep their text content
      .replace(/<a[^>]*>/gi, '')
      .replace(/<\/a>/gi, '')
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .replace(/<dfn[^>]*>/gi, '')
      .replace(/<\/dfn>/gi, '')
      .replace(/<code[^>]*>/gi, '')
      .replace(/<\/code>/gi, '')
      // Remove data-* attributes in remaining tags
      .replace(/<([a-z]+)[^>]*>/gi, '<$1>')
      // Remove any remaining HTML tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      // Remove broken HTML attribute fragments (leftover from imperfect tag stripping)
      // Pattern: sequence<Type> " id="..." attr="...">name  →  sequence<Type> name
      .replace(/" (?:id|href|class|data-[a-z-]+)="[^"]*"(?: [a-z-]+="[^"]*")*>/gi, '')
      // Pattern: <Type> " attr="...">  →  <Type>
      .replace(/> " [a-z-]+="[^"]*">/gi, '>')
      // Clean up whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (idl.length > 0) {
      idlBlocks.push(idl);
    }
    match = idlRegex.exec(html);
  }

  success(`Extracted ${idlBlocks.length} IDL blocks`);
  return idlBlocks;
}

/**
 * Convert WebIDL type to TypeScript type
 */
function idlTypeToTS(idlType: webidl2.IDLTypeDescription | null): string {
  if (!idlType) return 'any';

  // Handle union types
  if (idlType.union) {
    const types = idlType.idlType as webidl2.IDLTypeDescription[];
    return types.map(t => idlTypeToTS(t)).join(' | ');
  }

  // Handle generic types (sequence, Promise, etc.)
  if (idlType.generic) {
    const innerTypes = Array.isArray(idlType.idlType)
      ? idlType.idlType.map(t => idlTypeToTS(t)).join(', ')
      : idlTypeToTS(idlType.idlType as webidl2.IDLTypeDescription);

    switch (idlType.generic) {
      case 'sequence':
        return `${innerTypes}[]`;
      case 'FrozenArray':
        return `readonly ${innerTypes}[]`;
      case 'Promise':
        return `Promise<${innerTypes}>`;
      case 'record':
        return `Record<${innerTypes}>`;
      default:
        return `${idlType.generic}<${innerTypes}>`;
    }
  }

  // Handle simple types
  const typeName = idlType.idlType as string;

  // Check for DOM type replacements
  if (DOM_TYPE_REPLACEMENTS[typeName]) {
    return DOM_TYPE_REPLACEMENTS[typeName];
  }

  // Map WebIDL types to TypeScript
  switch (typeName) {
    case 'void':
      return 'void';
    case 'boolean':
      return 'boolean';
    case 'byte':
    case 'octet':
    case 'short':
    case 'unsigned short':
    case 'long':
    case 'unsigned long':
    case 'long long':
    case 'unsigned long long':
    case 'float':
    case 'unrestricted float':
    case 'double':
    case 'unrestricted double':
      return 'number';
    case 'bigint':
      return 'bigint';
    case 'DOMString':
    case 'ByteString':
    case 'USVString':
      return 'string';
    case 'object':
      return 'object';
    case 'symbol':
      return 'symbol';
    case 'any':
      return 'any';
    case 'undefined':
      return 'undefined';
    case 'ArrayBuffer':
      return 'ArrayBuffer';
    case 'SharedArrayBuffer':
      return 'SharedArrayBuffer';
    case 'DataView':
      return 'DataView';
    case 'Int8Array':
    case 'Int16Array':
    case 'Int32Array':
    case 'Uint8Array':
    case 'Uint16Array':
    case 'Uint32Array':
    case 'Uint8ClampedArray':
    case 'BigInt64Array':
    case 'BigUint64Array':
    case 'Float32Array':
    case 'Float64Array':
      return typeName;
    case 'ArrayBufferView':
      return 'ArrayBufferView';
    case 'BufferSource':
      return 'BufferSource';
    case 'AllowSharedBufferSource':
      return 'AllowSharedBufferSource';
    default:
      return typeName;
  }
}

/**
 * Generate TypeScript for an attribute
 */
function generateAttribute(attr: webidl2.AttributeMemberType): string {
  const readonly = attr.readonly ? 'readonly ' : '';
  const optional = attr.idlType.nullable ? '?' : '';
  const type = idlTypeToTS(attr.idlType);
  return `  ${readonly}${attr.name}${optional}: ${type};`;
}

/**
 * Generate TypeScript for an operation/method
 * @param op The operation to generate
 * @param skipStatic If true, skip static methods (they go in Constructor interface)
 */
function generateOperation(op: webidl2.OperationMemberType, skipStatic = true): string {
  if (!op.name) return ''; // Skip unnamed operations (like constructors in some cases)

  // Skip static methods in instance interface - they go in Constructor interface
  if (skipStatic && op.special === 'static') return '';

  const params = op.arguments.map(arg => {
    const optional = arg.optional ? '?' : '';
    const type = idlTypeToTS(arg.idlType);
    return `${arg.name}${optional}: ${type}`;
  }).join(', ');

  const returnType = idlTypeToTS(op.idlType);

  return `  ${op.name}(${params}): ${returnType};`;
}

/**
 * Generate TypeScript for a dictionary
 */
function generateDictionary(dict: webidl2.DictionaryType): string {
  const inheritance = dict.inheritance ? ` extends ${dict.inheritance}` : '';

  // Generate member fields
  const memberLines: string[] = [];
  for (const member of dict.members) {
    if (member.type === 'field') {
      const optional = member.required ? '' : '?';
      const type = idlTypeToTS(member.idlType);
      memberLines.push(`  ${member.name}${optional}: ${type};`);
    }
  }

  // Use type alias for empty interfaces without inheritance
  if (memberLines.length === 0 && !dict.inheritance) {
    return `export type ${dict.name} = Record<string, never>;`;
  }

  const lines: string[] = [];
  lines.push(`export interface ${dict.name}${inheritance} {`);
  lines.push(...memberLines);
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate TypeScript for an enum
 */
function generateEnum(enumDef: webidl2.EnumType): string {
  const values = enumDef.values.map(v => `'${v.value}'`).join(' | ');
  return `export type ${enumDef.name} = ${values};`;
}

/**
 * Generate TypeScript for a typedef
 */
function generateTypedef(typedef: webidl2.TypedefType): string {
  const type = idlTypeToTS(typedef.idlType);
  return `export type ${typedef.name} = ${type};`;
}

/**
 * Generate TypeScript for a callback
 */
function generateCallback(callback: webidl2.CallbackType): string {
  const params = callback.arguments.map(arg => {
    const type = idlTypeToTS(arg.idlType);
    return `${arg.name}: ${type}`;
  }).join(', ');

  const returnType = idlTypeToTS(callback.idlType);
  return `export type ${callback.name} = (${params}) => ${returnType};`;
}

/**
 * Generate TypeScript for an interface
 */
function generateInterface(iface: webidl2.InterfaceType): string {
  const lines: string[] = [];
  const inheritance = iface.inheritance ? ` extends ${iface.inheritance}` : '';

  lines.push(`export interface ${iface.name}${inheritance} {`);

  for (const member of iface.members) {
    switch (member.type) {
      case 'attribute':
        lines.push(generateAttribute(member));
        break;
      case 'operation': {
        const op = generateOperation(member);
        if (op) lines.push(op);
        break;
      }
      case 'const':
        lines.push(`  readonly ${member.name}: ${idlTypeToTS(member.idlType)};`);
        break;
    }
  }

  lines.push('}');

  // Generate constructor interface if there are constructors or static methods
  const constructors = iface.members.filter(m => m.type === 'constructor') as webidl2.ConstructorMemberType[];
  const staticMethods = iface.members.filter(
    m => m.type === 'operation' && (m as webidl2.OperationMemberType).special === 'static'
  ) as webidl2.OperationMemberType[];

  if (constructors.length > 0 || staticMethods.length > 0) {
    lines.push('');
    lines.push(`export interface ${iface.name}Constructor {`);

    // Add constructors
    for (const ctor of constructors) {
      const params = ctor.arguments.map(arg => {
        const optional = arg.optional ? '?' : '';
        const type = idlTypeToTS(arg.idlType);
        return `${arg.name}${optional}: ${type}`;
      }).join(', ');
      lines.push(`  new(${params}): ${iface.name};`);
    }

    // Add static methods
    for (const method of staticMethods) {
      if (!method.name) continue;
      const params = method.arguments.map(arg => {
        const optional = arg.optional ? '?' : '';
        const type = idlTypeToTS(arg.idlType);
        return `${arg.name}${optional}: ${type}`;
      }).join(', ');
      const returnType = idlTypeToTS(method.idlType);
      lines.push(`  ${method.name}(${params}): ${returnType};`);
    }

    lines.push('}');
  }

  return lines.join('\n');
}

/**
 * Generate TypeScript from parsed WebIDL AST
 */
function generateTypeScript(ast: webidl2.IDLRootType[]): string {
  const lines: string[] = [
    '// Auto-generated from W3C WebCodecs WebIDL specification',
    '// https://www.w3.org/TR/webcodecs/',
    `// Generated: ${new Date().toISOString()}`,
    '// DO NOT EDIT - regenerate with: npx tsx scripts/generate-types-from-idl.ts',
    '',
    '// =============================================================================',
    '// NODE.JS TYPE SUBSTITUTIONS',
    '// =============================================================================',
    '',
    '// These types replace browser-specific DOM types for Node.js compatibility',
    'type CanvasImageSourceNode = BufferSource | ImageDataLike;',
    '// biome-ignore lint/correctness/noUnusedVariables: placeholder for DOM compatibility',
    'type ImageBitmapNode = never; // Not available in Node.js',
    '// biome-ignore lint/correctness/noUnusedVariables: placeholder for DOM compatibility',
    'type OffscreenCanvasNode = never; // Not available in Node.js',
    '',
    'interface ImageDataLike {',
    '  readonly width: number;',
    '  readonly height: number;',
    '  readonly data: Uint8ClampedArray;',
    '}',
    '',
    'type BufferSource = ArrayBuffer | ArrayBufferView;',
    'type AllowSharedBufferSource = ArrayBuffer | SharedArrayBuffer | ArrayBufferView;',
    '',
    '// =============================================================================',
    '// WEBCODECS TYPES (from W3C WebIDL)',
    '// =============================================================================',
    '',
  ];

  for (const node of ast) {
    try {
      switch (node.type) {
        case 'dictionary':
          lines.push(generateDictionary(node));
          lines.push('');
          break;
        case 'enum':
          lines.push(generateEnum(node));
          lines.push('');
          break;
        case 'typedef':
          lines.push(generateTypedef(node));
          lines.push('');
          break;
        case 'callback':
          lines.push(generateCallback(node));
          lines.push('');
          break;
        case 'interface':
          lines.push(generateInterface(node));
          lines.push('');
          break;
        case 'interface mixin':
          // Handle mixins as interfaces
          lines.push(`// Mixin: ${node.name}`);
          lines.push(generateInterface(node as unknown as webidl2.InterfaceType));
          lines.push('');
          break;
      }
    } catch (err) {
      const nodeName = 'name' in node ? (node as { name?: string }).name : 'unknown';
      warn(`Failed to generate type for ${node.type} ${nodeName}: ${err}`);
    }
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  log('\nGenerating TypeScript types from W3C WebCodecs WebIDL...\n');

  try {
    // Fetch IDL blocks
    const idlBlocks = await fetchWebIDL();

    if (idlBlocks.length === 0) {
      error('No IDL blocks found in spec');
      process.exit(1);
    }

    // Save raw IDL for reference
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const rawIdlPath = join(OUTPUT_DIR, 'webcodecs.idl');
    writeFileSync(rawIdlPath, idlBlocks.join('\n\n'));
    success(`Saved raw IDL to ${rawIdlPath}`);

    // Parse all IDL blocks
    info('Parsing WebIDL...');
    const allAst: webidl2.IDLRootType[] = [];

    for (let i = 0; i < idlBlocks.length; i++) {
      try {
        const ast = webidl2.parse(idlBlocks[i]);
        allAst.push(...ast);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message.slice(0, 100) : String(err);
        warn(`Failed to parse IDL block ${i + 1}: ${msg}`);
      }
    }

    success(`Parsed ${allAst.length} type definitions`);

    // Deduplicate types by name (spec has duplicate definitions in different sections)
    info('Deduplicating types...');
    const seen = new Set<string>();
    const dedupedAst = allAst.filter(node => {
      const name = 'name' in node ? (node as { name?: string }).name : undefined;
      if (!name) return true; // Keep nodes without names
      if (seen.has(name)) {
        return false; // Skip duplicate
      }
      seen.add(name);
      return true;
    });
    success(`Deduplicated to ${dedupedAst.length} unique types`);

    // Generate TypeScript
    info('Generating TypeScript types...');
    const tsOutput = generateTypeScript(dedupedAst);

    // Write output
    writeFileSync(OUTPUT_FILE, tsOutput);
    success(`Generated ${OUTPUT_FILE}`);

    // Summary
    const stats = {
      interfaces: dedupedAst.filter(n => n.type === 'interface').length,
      dictionaries: dedupedAst.filter(n => n.type === 'dictionary').length,
      enums: dedupedAst.filter(n => n.type === 'enum').length,
      typedefs: dedupedAst.filter(n => n.type === 'typedef').length,
      callbacks: dedupedAst.filter(n => n.type === 'callback').length,
    };

    log('\nSummary:');
    log(`  Interfaces:   ${stats.interfaces}`);
    log(`  Dictionaries: ${stats.dictionaries}`);
    log(`  Enums:        ${stats.enums}`);
    log(`  Typedefs:     ${stats.typedefs}`);
    log(`  Callbacks:    ${stats.callbacks}`);

    log(`\n${GREEN}Done!${RESET} Generated types saved to docs/specs/\n`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed: ${msg}`);
    process.exit(1);
  }
}

main();
