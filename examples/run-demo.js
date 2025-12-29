#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Interactive Demo Runner
//
// Guides developers through the video watermarker demo step by step.

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DEMO_DIR = path.join(__dirname, '.demo-assets');
const TEST_VIDEO = path.join(DEMO_DIR, 'test-input.mp4');
const OUTPUT_H264 = path.join(DEMO_DIR, 'watermarked.h264');
const OUTPUT_MP4 = path.join(DEMO_DIR, 'watermarked.mp4');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function print(msg = '') {
  console.log(msg);
}

function printHeader(title) {
  const line = '='.repeat(60);
  print();
  print(line);
  print(`  ${title}`);
  print(line);
  print();
}

function printStep(num, title) {
  print(`\n[${ num }] ${title}`);
  print('-'.repeat(40));
}

function run(cmd, options = {}) {
  print(`> ${cmd}`);
  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function checkDependency(name, cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  printHeader('node-webcodecs Interactive Demo');

  print('Welcome! This demo will walk you through the video');
  print('processing capabilities of node-webcodecs.');
  print();
  print('What you will see:');
  print('  1. Create a test video using FFmpeg');
  print('  2. Demux the MP4 container');
  print('  3. Decode H.264 frames');
  print('  4. Add a bouncing watermark overlay');
  print('  5. Re-encode to H.264');
  print('  6. View the result');
  print();

  await ask('Press Enter to start...');

  // Check dependencies
  printStep(1, 'Checking Dependencies');

  const hasFFmpeg = checkDependency('ffmpeg', 'ffmpeg -version');
  const hasFFplay = checkDependency('ffplay', 'ffplay -version');

  if (!hasFFmpeg) {
    print('\n[ERROR] FFmpeg not found!');
    print('Install it with: brew install ffmpeg');
    rl.close();
    process.exit(1);
  }
  print('  FFmpeg: OK');
  print(`  FFplay: ${hasFFplay ? 'OK' : 'Not found (playback will be skipped)'}`);

  // Check if project is built
  const distExists = fs.existsSync(path.join(__dirname, '..', 'dist', 'index.js'));
  const buildExists = fs.existsSync(path.join(__dirname, '..', 'build', 'Release', 'webcodecs.node'));

  if (!distExists || !buildExists) {
    print('\n[WARNING] Project not built. Building now...');
    run('npm run build', { cwd: path.join(__dirname, '..') });
  }
  print('  Build: OK');

  await ask('\nPress Enter to continue...');

  // Create demo directory
  printStep(2, 'Creating Test Video');

  if (!fs.existsSync(DEMO_DIR)) {
    fs.mkdirSync(DEMO_DIR, { recursive: true });
  }

  print('Generating a 5-second test video with FFmpeg...');
  print('(Color bars + timer overlay at 640x480, 30fps)\n');

  const ffmpegCmd = [
    'ffmpeg -y',
    '-f lavfi -i "testsrc=duration=5:size=640x480:rate=30"',
    '-f lavfi -i "sine=frequency=440:duration=5"',
    '-c:v libx264 -preset fast -crf 23',
    '-c:a aac -b:a 128k',
    '-pix_fmt yuv420p',
    `"${TEST_VIDEO}"`
  ].join(' ');

  const result = run(ffmpegCmd);
  if (!result.success) {
    print('\n[ERROR] Failed to create test video');
    rl.close();
    process.exit(1);
  }

  const stats = fs.statSync(TEST_VIDEO);
  print(`\nCreated: ${TEST_VIDEO}`);
  print(`Size: ${(stats.size / 1024).toFixed(2)} KB`);

  await ask('\nPress Enter to run the watermarker...');

  // Run watermarker
  printStep(3, 'Running Video Watermarker');

  print('This will:');
  print('  - Open the MP4 and detect tracks');
  print('  - Decode each video frame to RGBA pixels');
  print('  - Draw a bouncing yellow box on each frame');
  print('  - Re-encode frames to H.264');
  print();

  const watermarkerPath = path.join(__dirname, 'watermarker.js');

  await new Promise((resolve) => {
    const child = spawn('node', [watermarkerPath, TEST_VIDEO, OUTPUT_H264], {
      stdio: 'inherit'
    });
    child.on('close', resolve);
  });

  if (!fs.existsSync(OUTPUT_H264)) {
    print('\n[ERROR] Watermarker failed to produce output');
    rl.close();
    process.exit(1);
  }

  await ask('\nPress Enter to wrap in MP4 container...');

  // Wrap in MP4
  printStep(4, 'Creating Playable MP4');

  print('The watermarker outputs raw H.264 NAL units.');
  print('Wrapping in MP4 container for playback...\n');

  run(`ffmpeg -y -i "${OUTPUT_H264}" -c copy "${OUTPUT_MP4}"`);

  const mp4Stats = fs.statSync(OUTPUT_MP4);
  print(`\nCreated: ${OUTPUT_MP4}`);
  print(`Size: ${(mp4Stats.size / 1024).toFixed(2)} KB`);

  // Play result
  if (hasFFplay) {
    printStep(5, 'Playing Result');

    print('Opening video in FFplay...');
    print('(Close the player window to continue)\n');

    const playChoice = await ask('Play the video? [Y/n] ');

    if (playChoice.toLowerCase() !== 'n') {
      await new Promise((resolve) => {
        const player = spawn('ffplay', ['-autoexit', OUTPUT_MP4], {
          stdio: 'inherit'
        });
        player.on('close', resolve);
      });
    }
  }

  // Summary
  printHeader('Demo Complete!');

  print('What happened:');
  print();
  print('  1. FFmpeg generated a test video with color bars');
  print('  2. Demuxer parsed the MP4 container (libavformat)');
  print('  3. VideoDecoder decoded H.264 to RGBA frames');
  print('  4. JavaScript modified pixels (bouncing yellow box)');
  print('  5. VideoEncoder re-encoded to H.264');
  print('  6. FFmpeg wrapped the H.264 in an MP4 container');
  print();
  print('Files created:');
  print(`  Input:  ${TEST_VIDEO}`);
  print(`  H.264:  ${OUTPUT_H264}`);
  print(`  Output: ${OUTPUT_MP4}`);
  print();
  print('Try it with your own video:');
  print(`  node examples/watermarker.js your-video.mp4 output.h264`);
  print();

  const cleanup = await ask('Delete demo files? [y/N] ');
  if (cleanup.toLowerCase() === 'y') {
    fs.rmSync(DEMO_DIR, { recursive: true, force: true });
    print('Cleaned up demo files.');
  }

  print('\nThanks for trying node-webcodecs!');
  rl.close();
}

main().catch((e) => {
  console.error('Demo error:', e);
  rl.close();
  process.exit(1);
});
