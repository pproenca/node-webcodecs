#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Build native addon from source.

'use strict';

const { spawnSync } = require('child_process');

console.log('node-webcodecs: Building from source...');

// Verify node-addon-api is available
try {
  require.resolve('node-addon-api');
  console.log('✓ node-addon-api found');
} catch {
  console.error('✗ node-addon-api not found');
  console.error('  Run: npm install node-addon-api');
  process.exit(1);
}

// Verify node-gyp is available
try {
  require.resolve('node-gyp');
  console.log('✓ node-gyp found');
} catch {
  console.error('✗ node-gyp not found');
  console.error('  Run: npm install node-gyp');
  process.exit(1);
}

// Run node-gyp rebuild
console.log('\nRunning node-gyp rebuild...\n');

const result = spawnSync('npx', ['node-gyp', 'rebuild'], {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error('\n✗ Build failed');
  console.error('  Check the output above for errors.');
  console.error('  Common issues:');
  console.error('    - FFmpeg development libraries not installed');
  console.error('    - C++ compiler not found');
  console.error('    - pkg-config not found');
  process.exit(result.status || 1);
}

console.log('\n✓ Build successful');
