#!/usr/bin/env tsx
/**
 * Fetch W3C WebCodecs specification and convert to Markdown.
 *
 * Usage: npx tsx scripts/fetch-webcodecs-spec.ts
 *
 * This script fetches the W3C WebCodecs specification, parses the Table of
 * Contents, and generates a structured set of Markdown files mirroring the
 * spec's hierarchy.
 *
 * Output structure:
 *   docs/specs/
 *   ├── toc.md                              # Table of contents
 *   ├── images/                             # Downloaded images
 *   ├── 1-definitions.md
 *   ├── 2-codec-processing-model/
 *   │   ├── toc.md
 *   │   ├── 2.1-background.md
 *   │   └── ...
 *   └── ...
 */
import {existsSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const SPEC_URL = 'https://www.w3.org/TR/webcodecs/';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'docs', 'specs');
const IMAGES_DIR = join(OUTPUT_DIR, 'images');

/** Represents a section in the spec hierarchy. */
interface Section {
  /** Section number (e.g., "3.1") */
  number: string;
  /** Section title */
  title: string;
  /** Anchor ID in the spec (e.g., "audiodecoder-internal-slots") */
  anchorId: string;
  /** Child sections */
  children: Section[];
  /** Parent section, if any */
  parent?: Section;
}

/** Map from anchor ID to file path for link rewriting. */
type AnchorMap = Map<string, string>;

/**
 * Converts a section number and title to a filename slug.
 * Example: "3.1", "Internal Slots" -> "3.1-internal-slots"
 */
function toSlug(number: string, title: string): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!number) {
    return titleSlug;
  }
  return `${number}-${titleSlug}`;
}

/**
 * Checks if a section is a numbered section (not an appendix).
 */
function isNumberedSection(section: Section): boolean {
  return /^\d/.test(section.number);
}

/**
 * Builds the full parent path for a section by walking up the parent chain.
 */
function getParentPath(section: Section): string {
  const parts: string[] = [];
  let current = section.parent;

  while (current) {
    const parentHasChildren = current.children.length > 0;
    if (parentHasChildren) {
      parts.unshift(toSlug(current.number, current.title));
    }
    current = current.parent;
  }

  return parts.length > 0 ? join(...parts) : '';
}

/**
 * Determines the file path for a section.
 * Sections with children get a folder with index.md.
 * Leaf sections get a single .md file.
 */
function getSectionPath(section: Section, hasChildren: boolean): string {
  const slug = toSlug(section.number, section.title);
  const parentPath = getParentPath(section);

  if (hasChildren) {
    if (parentPath) {
      return join(parentPath, slug, 'toc.md');
    }
    return join(slug, 'toc.md');
  }

  if (parentPath) {
    return join(parentPath, `${slug}.md`);
  }
  return `${slug}.md`;
}

/**
 * Builds a map from anchor IDs to relative file paths.
 */
function buildAnchorMap(sections: Section[]): AnchorMap {
  const map: AnchorMap = new Map();

  function walk(sectionList: Section[]): void {
    for (const section of sectionList) {
      const hasChildren = section.children.length > 0;
      const path = getSectionPath(section, hasChildren);
      map.set(section.anchorId, path);
      walk(section.children);
    }
  }

  walk(sections);
  return map;
}

/**
 * Parses the Table of Contents from the spec HTML.
 */
function parseToc($: cheerio.CheerioAPI): Section[] {
  const sections: Section[] = [];

  // The TOC is in nav#toc, containing ol.toc
  const tocContainer = $('nav#toc');
  if (!tocContainer.length) {
    throw new Error('Could not find TOC in the spec');
  }

  function parseList(
    $list: cheerio.Cheerio<cheerio.Element>,
    parent?: Section
  ): Section[] {
    const result: Section[] = [];

    $list.children('li').each((_, li) => {
      const $li = $(li);
      const $link = $li.children('a').first();

      if (!$link.length) {
        return;
      }

      const href = $link.attr('href') ?? '';
      const anchorId = href.replace(/^#/, '');

      // W3C spec uses <span class="secno"> and <span class="content">
      const $secno = $link.find('.secno');
      const $content = $link.find('.content');

      let sectionNumber: string;
      let sectionTitle: string;

      if ($secno.length && $content.length) {
        // Modern W3C format with separate spans
        sectionNumber = $secno.text().trim();
        sectionTitle = $content.text().trim();
      } else {
        // Fallback: parse from combined text (e.g., "3.1 Internal Slots")
        const text = $link.text().trim();
        const match = text.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
        if (!match) {
          console.warn(`  Warning: Could not parse section from TOC: "${text}"`);
          return;
        }
        sectionNumber = match[1];
        sectionTitle = match[2];
      }

      const section: Section = {
        number: sectionNumber,
        title: sectionTitle,
        anchorId,
        children: [],
        parent,
      };

      // Parse nested list for children
      const $nestedList = $li.children('ol, ul').first();
      if ($nestedList.length) {
        section.children = parseList($nestedList, section);
      }

      result.push(section);
    });

    return result;
  }

  // Find the main ordered list in the TOC
  const $mainList = tocContainer.children('ol.toc').first();
  if ($mainList.length) {
    sections.push(...parseList($mainList));
  }

  return sections;
}

/**
 * Gets the heading level from a tag name (h1=1, h2=2, etc.)
 */
function getHeadingLevel(tagName: string): number {
  const match = tagName.match(/^h(\d)$/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extracts the HTML content for a specific section.
 * W3C specs use flat structure with headings, not nested sections.
 * We collect content from the heading until the next same-level or child heading.
 */
function extractSectionContent(
  $: cheerio.CheerioAPI,
  anchorId: string,
  childAnchorIds: string[]
): string {
  const $heading = $(`#${anchorId}`);
  if (!$heading.length) {
    console.warn(`  Warning: Could not find element #${anchorId}`);
    return '';
  }

  const headingElement = $heading.get(0);
  if (!headingElement?.tagName) {
    console.warn(`  Warning: Element #${anchorId} has no tagName`);
    return '';
  }

  const tagName = headingElement.tagName.toLowerCase();
  const headingLevel = getHeadingLevel(tagName);

  // If it's not a heading, try to get its content directly
  if (headingLevel === 0) {
    return $heading.html() ?? '';
  }

  // Create a set of child anchor IDs for quick lookup
  const childIds = new Set(childAnchorIds);

  // Collect content: everything after this heading until next same/higher level heading
  // or until a child section heading (which will be in its own file)
  const contentParts: string[] = [];

  let $current = $heading.next();
  while ($current.length) {
    const currentTag = $current.get(0)?.tagName?.toLowerCase() ?? '';
    const currentLevel = getHeadingLevel(currentTag);

    // Stop at same level or higher level heading
    if (currentLevel > 0 && currentLevel <= headingLevel) {
      break;
    }

    // Stop at child section heading (it will be in its own file)
    const currentId = $current.attr('id');
    if (currentId && childIds.has(currentId)) {
      break;
    }

    // Include this element's outer HTML
    contentParts.push($.html($current));

    $current = $current.next();
  }

  return contentParts.join('\n');
}

/**
 * Downloads an image and returns the local path.
 */
async function downloadImage(
  url: string,
  baseUrl: string
): Promise<string | null> {
  try {
    // Resolve relative URLs
    const absoluteUrl = new URL(url, baseUrl).href;
    const filename = absoluteUrl.split('/').pop() ?? 'image.png';
    const localPath = join(IMAGES_DIR, filename);

    // Skip if already downloaded
    if (existsSync(localPath)) {
      return `images/${filename}`;
    }

    console.log(`  Downloading image: ${filename}`);
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      console.warn(`  Warning: Failed to download ${absoluteUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(localPath, buffer);
    return `images/${filename}`;
  } catch (error) {
    console.warn(`  Warning: Error downloading image ${url}:`, error);
    return null;
  }
}

/**
 * Configures and returns a Turndown service for HTML to Markdown conversion.
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // Handle <code> elements containing links - keep link clickable with code-formatted text
  turndown.addRule('codeWithLink', {
    filter: (node) => {
      return (
        node.nodeName === 'CODE' &&
        node.querySelector('a') !== null
      );
    },
    replacement: (_content, node) => {
      const anchor = (node as Element).querySelector('a');
      if (!anchor) return `\`${_content}\``;

      const href = anchor.getAttribute('href') ?? '';
      const text = anchor.textContent ?? '';
      return `[\`${text}\`](${href})`;
    },
  });

  // Preserve code blocks with language hints
  turndown.addRule('codeBlocks', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild?.nodeName === 'CODE'
      );
    },
    replacement: (_, node) => {
      const code = (node as Element).querySelector('code');
      if (!code) return '';

      const className = code.getAttribute('class') ?? '';
      const langMatch = className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : 'webidl';
      const text = code.textContent ?? '';

      return `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;
    },
  });

  // Handle WebIDL blocks (often in <pre class="idl">)
  turndown.addRule('webidl', {
    filter: (node) => {
      return (
        node.nodeName === 'PRE' &&
        ((node as Element).classList?.contains('idl') ||
          (node as Element).classList?.contains('def'))
      );
    },
    replacement: (content, node) => {
      const text = (node as Element).textContent ?? '';
      return `\n\`\`\`webidl\n${text.trim()}\n\`\`\`\n`;
    },
  });

  // Handle definition lists
  turndown.addRule('definitionList', {
    filter: 'dl',
    replacement: (content, node) => {
      let result = '\n';
      const dl = node as Element;
      const children = Array.from(dl.children);

      for (const child of children) {
        if (child.nodeName === 'DT') {
          result += `**${child.textContent?.trim()}**\n`;
        } else if (child.nodeName === 'DD') {
          const ddContent = turndown.turndown(child.innerHTML);
          result += `: ${ddContent.trim()}\n\n`;
        }
      }

      return result;
    },
  });

  return turndown;
}

/**
 * Converts HTML content to Markdown, handling images and links.
 */
async function convertToMarkdown(
  html: string,
  anchorMap: AnchorMap,
  currentPath: string
): Promise<string> {
  const $ = cheerio.load(html);
  const turndown = createTurndownService();

  // Download images and update src attributes
  const images = $('img');
  for (let i = 0; i < images.length; i++) {
    const $img = $(images[i]);
    const src = $img.attr('src');
    if (src) {
      const localPath = await downloadImage(src, SPEC_URL);
      if (localPath) {
        // Calculate relative path from current file to images dir
        const depth = currentPath.split('/').length - 1;
        const prefix = depth > 0 ? '../'.repeat(depth) : './';
        $img.attr('src', prefix + localPath);
      }
    }
  }

  // Update internal links to point to generated markdown files
  $('a[href^="#"]').each((_, el) => {
    const $link = $(el);
    const href = $link.attr('href') ?? '';
    const anchorId = href.replace(/^#/, '');

    const targetPath = anchorMap.get(anchorId);
    if (targetPath) {
      // Calculate relative path from current file to target
      const currentDir = dirname(currentPath);
      let relativePath: string;

      if (currentDir === '.') {
        relativePath = `./${targetPath}`;
      } else {
        const depth = currentDir.split('/').length;
        const prefix = '../'.repeat(depth);
        relativePath = prefix + targetPath;
      }

      $link.attr('href', relativePath);
    }
  });

  // Convert to markdown
  let markdown = turndown.turndown($.html());

  // Clean up excessive newlines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  return markdown;
}

/**
 * Generates the table of contents markdown file.
 */
function generateTocMarkdown(sections: Section[]): string {
  let md = '# WebCodecs Specification\n\n';
  md += `Source: [W3C WebCodecs](${SPEC_URL})\n\n`;
  md += '## Table of Contents\n\n';

  function renderSection(section: Section, indent: number): void {
    const prefix = '  '.repeat(indent);
    const hasChildren = section.children.length > 0;
    const path = getSectionPath(section, hasChildren);
    md += `${prefix}- [${section.number}. ${section.title}](./${path})\n`;

    for (const child of section.children) {
      renderSection(child, indent + 1);
    }
  }

  for (const section of sections) {
    renderSection(section, 0);
  }

  return md;
}

/**
 * Generates the TODO markdown file with checkboxes for audit tracking.
 */
function generateTodoMarkdown(sections: Section[]): string {
  let md = '# WebCodecs Spec Audit Checklist\n\n';
  md += `Source: [W3C WebCodecs](${SPEC_URL})\n\n`;

  function renderSection(section: Section, indent: number): void {
    const prefix = '  '.repeat(indent);
    const hasChildren = section.children.length > 0;
    const path = getSectionPath(section, hasChildren);
    md += `${prefix}- [ ] [${section.number}. ${section.title}](./${path})\n`;

    for (const child of section.children) {
      renderSection(child, indent + 1);
    }
  }

  for (const section of sections) {
    renderSection(section, 0);
  }

  return md;
}

/**
 * Collects all anchor IDs for children of a section (for content extraction).
 */
function getChildAnchorIds(section: Section): string[] {
  const ids: string[] = [];

  function collect(s: Section): void {
    for (const child of s.children) {
      ids.push(child.anchorId);
      collect(child);
    }
  }

  collect(section);
  return ids;
}

/**
 * Filters sections to only include numbered sections (not appendix).
 */
function filterNumberedSections(sections: Section[]): Section[] {
  return sections
    .filter((s) => isNumberedSection(s))
    .map((s) => ({
      ...s,
      children: filterNumberedSections(s.children),
    }));
}

/**
 * Main function to fetch and convert the spec.
 */
async function main(): Promise<void> {
  console.log('Fetching WebCodecs specification...');
  console.log(`URL: ${SPEC_URL}`);

  // Fetch the spec
  const response = await fetch(SPEC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch spec: ${response.status}`);
  }
  const html = await response.text();
  console.log(`Fetched ${(html.length / 1024).toFixed(1)} KB`);

  // Parse HTML
  const $ = cheerio.load(html);

  // Parse TOC
  console.log('\nParsing Table of Contents...');
  const allSections = parseToc($);
  console.log(`Found ${allSections.length} top-level sections`);

  // Filter to only numbered sections (skip appendix like Conformance, Index, etc.)
  const sections = filterNumberedSections(allSections);
  console.log(`Numbered sections: ${sections.length} top-level`);

  // Count total sections
  let totalSections = 0;
  function countSections(list: Section[]): void {
    for (const s of list) {
      totalSections++;
      countSections(s.children);
    }
  }
  countSections(sections);
  console.log(`Total sections to process: ${totalSections}`);

  // Build anchor map for link rewriting
  const anchorMap = buildAnchorMap(sections);

  // Clean and create output directory
  console.log(`\nOutput directory: ${OUTPUT_DIR}`);
  if (existsSync(OUTPUT_DIR)) {
    console.log('Cleaning existing output directory...');
    rmSync(OUTPUT_DIR, {recursive: true});
  }
  mkdirSync(OUTPUT_DIR, {recursive: true});
  mkdirSync(IMAGES_DIR, {recursive: true});

  // Generate TOC markdown
  console.log('\nGenerating toc.md...');
  const tocMd = generateTocMarkdown(sections);
  writeFileSync(join(OUTPUT_DIR, 'toc.md'), tocMd);

  // Generate TODO markdown for audit tracking
  console.log('Generating TODO.md...');
  const todoMd = generateTodoMarkdown(sections);
  writeFileSync(join(OUTPUT_DIR, 'TODO.md'), todoMd);

  // Process each section
  console.log('\nProcessing sections...');

  async function processSection(section: Section): Promise<void> {
    const hasChildren = section.children.length > 0;
    const filePath = getSectionPath(section, hasChildren);
    const fullPath = join(OUTPUT_DIR, filePath);

    console.log(`  ${section.number}. ${section.title} -> ${filePath}`);

    // Ensure directory exists
    mkdirSync(dirname(fullPath), {recursive: true});

    // Extract content (excluding nested sections)
    const childAnchorIds = getChildAnchorIds(section);
    const contentHtml = extractSectionContent($, section.anchorId, childAnchorIds);

    // Convert to markdown
    let markdown = `# ${section.number}. ${section.title}\n\n`;

    if (contentHtml) {
      const contentMd = await convertToMarkdown(
        contentHtml,
        anchorMap,
        filePath
      );
      markdown += contentMd;
    }

    // Add subsections TOC for index.md files
    if (hasChildren) {
      markdown += '\n## Subsections\n\n';
      for (const child of section.children) {
        const childHasChildren = child.children.length > 0;
        const childPath = getSectionPath(child, childHasChildren);
        // Calculate relative path from current index.md to child
        const currentDir = dirname(filePath);
        const relativePath = childPath.startsWith(currentDir + '/')
          ? childPath.slice(currentDir.length + 1)
          : childPath;
        markdown += `- [${child.number}. ${child.title}](./${relativePath})\n`;
      }
    }

    // Add navigation links
    markdown += '\n\n---\n\n';
    if (section.parent) {
      const parentHasChildren = section.parent.children.length > 0;
      const parentPath = getSectionPath(section.parent, parentHasChildren);
      const depth = dirname(filePath).split('/').length;
      const prefix = '../'.repeat(depth);
      markdown += `[← Back to ${section.parent.number}. ${section.parent.title}](${prefix}${parentPath})\n`;
    } else {
      const depth = dirname(filePath).split('/').length;
      const prefix = depth > 0 ? '../'.repeat(depth) : './';
      markdown += `[← Back to Table of Contents](${prefix}toc.md)\n`;
    }

    writeFileSync(fullPath, markdown);

    // Process children
    for (const child of section.children) {
      await processSection(child);
    }
  }

  for (const section of sections) {
    await processSection(section);
  }

  console.log('\nDone!');
  console.log(`Generated ${totalSections} markdown files in ${OUTPUT_DIR}`);
}

// Run
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
