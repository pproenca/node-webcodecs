#!/usr/bin/env node
// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Interactive Demo Runner
//
// Guides developers through the video watermarker demo step by step.

const {execSync, spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const {
  AudioData,
  AudioEncoder,
  Demuxer,
  Muxer,
  TestVideoGenerator,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} = require('../dist/index.js');

const DEMO_DIR = path.join(__dirname, '.demo-assets');
const TEST_VIDEO = path.join(DEMO_DIR, 'test-input.mp4');
const OUTPUT_MP4 = path.join(DEMO_DIR, 'watermarked.mp4');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise(resolve => {
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
  print(`\n[${num}] ${title}`);
  print('-'.repeat(40));
}

function run(cmd, options = {}) {
  print(`> ${cmd}`);
  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return {success: true, output: result};
  } catch (e) {
    return {success: false, error: e.message};
  }
}

function checkDependency(_name, cmd) {
  try {
    execSync(cmd, {stdio: 'pipe'});
    return true;
  } catch {
    return false;
  }
}

// Watermark state
let boxX = 50;
let boxY = 50;
let boxDX = 3;
let boxDY = 2;
const boxWidth = 100;
const boxHeight = 60;

function drawWatermark(rgbaData, width, height, timestamp) {
  // Update bouncing box position.
  boxX += boxDX;
  boxY += boxDY;

  if (boxX <= 0 || boxX + boxWidth >= width) boxDX = -boxDX;
  if (boxY <= 0 || boxY + boxHeight >= height) boxDY = -boxDY;

  boxX = Math.max(0, Math.min(width - boxWidth, boxX));
  boxY = Math.max(0, Math.min(height - boxHeight, boxY));

  // Draw semi-transparent yellow box.
  for (let y = boxY; y < boxY + boxHeight && y < height; y++) {
    for (let x = boxX; x < boxX + boxWidth && x < width; x++) {
      const idx = (y * width + x) * 4;
      // Yellow with 50% alpha blend.
      rgbaData[idx] = Math.min(255, rgbaData[idx] + 127); // R
      rgbaData[idx + 1] = Math.min(255, rgbaData[idx + 1] + 127); // G
      rgbaData[idx + 2] = rgbaData[idx + 2]; // B unchanged
    }
  }

  // Draw timestamp indicator (progress bar at bottom of box).
  const lineY = boxY + boxHeight - 5;
  const lineWidth = Math.min(boxWidth, (timestamp / 1000000) % 100);
  for (let x = boxX; x < boxX + lineWidth && x < width; x++) {
    const idx = (lineY * width + x) * 4;
    rgbaData[idx] = 255; // R
    rgbaData[idx + 1] = 0; // G
    rgbaData[idx + 2] = 0; // B
  }
}

async function generateTestVideo(outputPath) {
  const width = 640;
  const height = 480;
  const frameRate = 30;
  const duration = 5;

  // Generate video frames using native TestVideoGenerator
  const generator = new TestVideoGenerator();
  generator.configure({width, height, frameRate, duration, pattern: 'testsrc'});

  const videoChunks = [];
  let codecDescription = null;

  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      videoChunks.push(chunk);
      if (metadata?.decoderConfig?.description && !codecDescription) {
        codecDescription = metadata.decoderConfig.description;
      }
    },
    error: err => console.error('Video encoder error:', err),
  });

  videoEncoder.configure({
    codec: 'avc1.42001e',
    width,
    height,
    bitrate: 1_000_000,
    framerate: frameRate,
    avc: {format: 'avc'},
  });

  let frameIndex = 0;
  await generator.generate(frame => {
    videoEncoder.encode(frame, {keyFrame: frameIndex === 0});
    frame.close();
    frameIndex++;
  });

  await videoEncoder.flush();
  videoEncoder.close();
  generator.close();

  // Generate audio (440Hz sine wave)
  const sampleRate = 48000;
  const numChannels = 2;
  const audioChunks = [];

  const audioEncoder = new AudioEncoder({
    output: chunk => audioChunks.push(chunk),
    error: err => console.error('Audio encoder error:', err),
  });

  audioEncoder.configure({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels: numChannels,
    bitrate: 128000,
  });

  // Generate 5 seconds of audio in chunks
  const samplesPerChunk = 1024;
  const totalSamples = sampleRate * duration;

  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const numSamples = Math.min(samplesPerChunk, totalSamples - offset);
    const audioData = new Float32Array(numSamples * numChannels);

    for (let i = 0; i < numSamples; i++) {
      const t = (offset + i) / sampleRate;
      const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
      audioData[i * numChannels] = sample;
      audioData[i * numChannels + 1] = sample;
    }

    const frame = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: numSamples,
      numberOfChannels: numChannels,
      timestamp: Math.floor((offset / sampleRate) * 1_000_000),
      data: audioData,
    });

    audioEncoder.encode(frame);
    frame.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();

  // Mux to MP4
  const muxer = new Muxer({filename: outputPath});
  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width,
    height,
    description: codecDescription,
  });
  muxer.addAudioTrack({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels: numChannels,
  });

  // Sort chunks by timestamp and write
  const sortedVideoChunks = [...videoChunks].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  const sortedAudioChunks = [...audioChunks].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  sortedVideoChunks.forEach(chunk => { muxer.writeVideoChunk(chunk); });
  sortedAudioChunks.forEach(chunk => { muxer.writeAudioChunk(chunk); });

  muxer.finalize();
  muxer.close();

  console.log(`Generated test video: ${outputPath}`);
}

async function processVideo(inputPath, outputPath) {
  console.log(`Processing: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  // Collect encoded chunks for sorting before muxing (to handle B-frame reordering)
  const encodedChunks = [];
  let codecDescription = null;
  let videoTrack = null;
  let framesProcessed = 0;
  let totalChunks = 0;
  let encoder = null;

  const decoder = new VideoDecoder({
    output: frame => {
      const size = frame.allocationSize({format: 'RGBA'});
      const rgbaData = new Uint8Array(size);
      frame.copyTo(rgbaData.buffer, {format: 'RGBA'});

      drawWatermark(
        rgbaData,
        frame.codedWidth,
        frame.codedHeight,
        frame.timestamp,
      );

      const modifiedFrame = new VideoFrame(Buffer.from(rgbaData), {
        format: 'RGBA',
        codedWidth: frame.codedWidth,
        codedHeight: frame.codedHeight,
        timestamp: frame.timestamp,
      });

      encoder.encode(modifiedFrame, {keyFrame: framesProcessed % 30 === 0});
      modifiedFrame.close();
      frame.close();

      framesProcessed++;
      if (framesProcessed % 10 === 0) {
        process.stdout.write(`\rProcessed ${framesProcessed} frames...`);
      }
    },
    error: e => console.error('Decoder error:', e),
  });

  const demuxer = new Demuxer({
    onTrack: track => {
      console.log(`Found track: ${track.type} (${track.codec})`);
      if (track.type === 'video') {
        videoTrack = track;
        console.log(`  Resolution: ${track.width}x${track.height}`);

        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: track.width,
          codedHeight: track.height,
          description: track.extradata,
        });

        encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            // Capture codec description (extradata) for MP4 container
            if (metadata?.decoderConfig?.description && !codecDescription) {
              codecDescription = metadata.decoderConfig.description;
            }
            // Store chunk data for later sorting and muxing
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            encodedChunks.push({
              type: chunk.type,
              timestamp: chunk.timestamp,
              duration: chunk.duration || 33333,
              data,
            });
          },
          error: e => console.error('Encoder error:', e),
        });

        // Use avc format to get proper extradata for MP4 container
        encoder.configure({
          codec: 'avc1.42001e',
          width: track.width,
          height: track.height,
          bitrate: 2_000_000,
          framerate: 30,
          avc: {format: 'avc'},
        });
      }
    },
    onChunk: (chunk, trackIndex) => {
      if (videoTrack && trackIndex === videoTrack.index) {
        totalChunks++;
        decoder.decode(chunk);
      }
    },
    onError: e => console.error('Demuxer error:', e),
  });

  console.log('Opening file...');
  await demuxer.open(inputPath);

  if (!videoTrack) {
    throw new Error('No video track found in file');
  }

  console.log('Demuxing and processing frames...');
  await demuxer.demux();

  console.log('\nFlushing decoder...');
  await decoder.flush();

  console.log('Flushing encoder...');
  await encoder.flush();

  demuxer.close();
  decoder.close();
  encoder.close();

  console.log(
    `\nProcessed ${framesProcessed} frames from ${totalChunks} chunks`,
  );

  // Sort chunks by timestamp to handle B-frame reordering
  const sortedChunks = [...encodedChunks].sort((a, b) => a.timestamp - b.timestamp);

  // Create MP4 using Muxer
  console.log('\nWriting MP4 with Muxer...');
  const muxer = new Muxer({filename: outputPath});

  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width: videoTrack.width,
    height: videoTrack.height,
    bitrate: 2_000_000,
    framerate: 30,
    description: codecDescription,
  });

  for (const chunk of sortedChunks) {
    muxer.writeVideoChunk(chunk);
  }

  muxer.finalize();
  muxer.close();

  const stats = fs.statSync(outputPath);
  console.log(
    `\nWritten: ${outputPath} (${(stats.size / 1024).toFixed(2)} KB)`,
  );
}

async function main() {
  printHeader('node-webcodecs Interactive Demo');

  print('Welcome! This demo will walk you through the video');
  print('processing capabilities of node-webcodecs.');
  print();
  print('What you will see:');
  print('  1. Create a test video using native bindings');
  print('  2. Demux the MP4 container');
  print('  3. Decode H.264 frames');
  print('  4. Add a bouncing watermark overlay');
  print('  5. Re-encode to H.264 and mux to MP4');
  print('  6. View the result');
  print();

  await ask('Press Enter to start...');

  // Check dependencies
  printStep(1, 'Checking Dependencies');

  // ffplay is optional for playback
  const hasFFplay = checkDependency('ffplay', 'ffplay -version');

  print(
    `  FFplay: ${hasFFplay ? 'OK' : 'Not found (playback will be skipped)'}`,
  );

  // Check if project is built
  const distExists = fs.existsSync(
    path.join(__dirname, '..', 'dist', 'index.js'),
  );
  const buildExists = fs.existsSync(
    path.join(__dirname, '..', 'build', 'Release', 'webcodecs.node'),
  );

  if (!distExists || !buildExists) {
    print('\n[WARNING] Project not built. Building now...');
    run('npm run build', {cwd: path.join(__dirname, '..')});
  }
  print('  Build: OK');

  await ask('\nPress Enter to continue...');

  // Create demo directory
  printStep(2, 'Creating Test Video');

  if (!fs.existsSync(DEMO_DIR)) {
    fs.mkdirSync(DEMO_DIR, {recursive: true});
  }

  print('Generating a 5-second test video using native bindings...');
  print('(Test pattern + 440Hz sine wave at 640x480, 30fps)\n');

  try {
    await generateTestVideo(TEST_VIDEO);
  } catch (err) {
    print('\n[ERROR] Failed to create test video');
    print(err.message);
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
  print('  - Re-encode frames to H.264 and mux directly to MP4');
  print();

  // Reset watermark position for fresh run
  boxX = 50;
  boxY = 50;
  boxDX = 3;
  boxDY = 2;

  await processVideo(TEST_VIDEO, OUTPUT_MP4);

  if (!fs.existsSync(OUTPUT_MP4)) {
    print('\n[ERROR] Watermarker failed to produce output');
    rl.close();
    process.exit(1);
  }

  // Play result
  if (hasFFplay) {
    printStep(4, 'Playing Result');

    print('Opening video in FFplay...');
    print('(Close the player window to continue)\n');

    const playChoice = await ask('Play the video? [Y/n] ');

    if (playChoice.toLowerCase() !== 'n') {
      await new Promise(resolve => {
        const player = spawn('ffplay', ['-autoexit', OUTPUT_MP4], {
          stdio: 'inherit',
        });
        player.on('close', resolve);
      });
    }
  }

  // Summary
  printHeader('Demo Complete!');

  print('What happened:');
  print();
  print('  1. TestVideoGenerator created frames, AudioEncoder added audio');
  print('  2. Demuxer parsed the MP4 container (libavformat)');
  print('  3. VideoDecoder decoded H.264 to RGBA frames');
  print('  4. JavaScript modified pixels (bouncing yellow box)');
  print('  5. VideoEncoder re-encoded to H.264');
  print('  6. Muxer wrapped the H.264 in an MP4 container');
  print();
  print('Files created:');
  print(`  Input:  ${TEST_VIDEO}`);
  print(`  Output: ${OUTPUT_MP4}`);
  print();

  // Web UI option
  const startWeb = await ask('Start web dashboard to view results? [Y/n] ');
  if (startWeb.toLowerCase() !== 'n') {
    print('\nStarting web dashboard...');
    print('Open http://localhost:3000 in your browser');
    print('Press Ctrl+C to exit\n');
    require('./web-ui/server.js');
    // Keep process running - server handles its own lifecycle
    return;
  }

  const cleanup = await ask('Delete demo files? [y/N] ');
  if (cleanup.toLowerCase() === 'y') {
    fs.rmSync(DEMO_DIR, {recursive: true, force: true});
    print('Cleaned up demo files.');
  }

  print('\nThanks for trying node-webcodecs!');
  rl.close();
}

main().catch(e => {
  console.error('Demo error:', e);
  rl.close();
  process.exit(1);
});
