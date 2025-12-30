#!/usr/bin/env node
/**
 * Demo Runner
 *
 * Runs all demos sequentially and optionally starts the web server.
 *
 * Usage:
 *   node run-all.js              # Run all demos
 *   node run-all.js --with-server  # Run demos + start web server
 */

const {spawn, fork} = require('child_process');
const path = require('path');
const fs = require('fs');

const DEMOS = [
  {id: '01', name: 'Encode-Decode', dir: '01-encode-decode'},
  {id: '02', name: 'Video Pipeline', dir: '02-video-pipeline'},
  {id: '03', name: 'Content Moderation', dir: '03-content-moderation'},
  {id: '04', name: 'Codec Comparison', dir: '04-codec-comparison'},
];

const OUTPUT_DIR = path.join(__dirname, 'output');
const WITH_SERVER = process.argv.includes('--with-server');

function printHeader() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                   node-webcodecs Demos                   ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  WebCodecs API implementation for Node.js using FFmpeg   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
}

function printProgress(current, total, name) {
  const bar = '█'.repeat(current) + '░'.repeat(total - current);
  console.log(`\n[${bar}] Demo ${current}/${total}: ${name}\n`);
}

async function runDemo(demo) {
  return new Promise((resolve, reject) => {
    const demoPath = path.join(__dirname, demo.dir, 'index.js');

    if (!fs.existsSync(demoPath)) {
      console.log(`  ⚠ Demo ${demo.id} not found, skipping`);
      resolve({success: false, skipped: true});
      return;
    }

    const child = fork(demoPath, [], {
      stdio: 'inherit',
    });

    child.on('close', code => {
      if (code === 0) {
        console.log(`\n  ✓ Demo ${demo.id} completed successfully\n`);
        resolve({success: true});
      } else {
        console.log(`\n  ✗ Demo ${demo.id} failed with code ${code}\n`);
        resolve({success: false, code});
      }
    });

    child.on('error', err => {
      console.error(`  ✗ Demo ${demo.id} error:`, err.message);
      resolve({success: false, error: err.message});
    });
  });
}

async function startServer() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Starting Web UI server...\n');

  const serverPath = path.join(__dirname, 'web-ui', 'server.js');

  if (!fs.existsSync(serverPath)) {
    console.log('  ⚠ Web UI not found');
    return;
  }

  // Keep server running
  require(serverPath);
}

async function main() {
  printHeader();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  const startTime = Date.now();
  const results = [];

  // Run each demo
  for (let i = 0; i < DEMOS.length; i++) {
    const demo = DEMOS[i];
    printProgress(i + 1, DEMOS.length, demo.name);

    const result = await runDemo(demo);
    results.push({...demo, ...result});
  }

  // Summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(1);
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('                        SUMMARY                                ');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total time: ${duration}s`);
  console.log(`  Passed: ${passed}/${DEMOS.length}`);
  if (failed > 0) console.log(`  Failed: ${failed}`);
  if (skipped > 0) console.log(`  Skipped: ${skipped}`);
  console.log('');

  // List output files
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    if (files.length > 0) {
      console.log('Output files:');
      files.forEach(f => {
        const stat = fs.statSync(path.join(OUTPUT_DIR, f));
        console.log(`  - ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
      });
      console.log('');
    }
  }

  // Start server if requested
  if (WITH_SERVER) {
    await startServer();
  } else {
    console.log('To view results in browser, run:');
    console.log('  node web-ui/server.js');
    console.log('');
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
