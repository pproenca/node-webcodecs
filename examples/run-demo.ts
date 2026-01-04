#!/usr/bin/env tsx
/**
 * run-demo.ts - Interactive Demo Runner
 *
 * Guides developers through the video watermarker demo step by step.
 *
 * Usage:
 *   npm install
 *   npm run demo
 */

import {type ChildProcess, execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import {fileURLToPath} from 'node:url';

import {
  type AllowSharedBufferSource,
  AudioData,
  AudioEncoder,
  Demuxer,
  EncodedVideoChunk,
  type EncodedVideoChunkMetadata,
  Muxer,
  TestVideoGenerator,
  type TrackInfo,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
} from '@pproenca/node-webcodecs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI Color Utilities (no dependencies)
const colors: Record<string, string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function c(color: string, text: string): string {
  return `${colors[color]}${text}${colors.reset}`;
}

// UI Helper Functions
const TOTAL_STEPS = 4;

interface Spinner {
  succeed: (msg: string) => void;
  fail: (msg: string) => void;
  update: (newText: string) => void;
}

function createSpinner(text: string): Spinner {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let currentText = text;
  const interval = setInterval(() => {
    process.stdout.write(
      `\r${c('cyan', frames[i++ % frames.length])} ${currentText}`
    );
  }, 80);
  return {
    succeed: (msg: string) => {
      clearInterval(interval);
      process.stdout.write(`\r${c('green', '✓')} ${msg}${' '.repeat(20)}\n`);
    },
    fail: (msg: string) => {
      clearInterval(interval);
      process.stdout.write(`\r${c('red', '✗')} ${msg}${' '.repeat(20)}\n`);
    },
    update: (newText: string) => {
      currentText = newText;
    },
  };
}

function success(msg: string): void {
  console.log(`${c('green', '✓')} ${msg}`);
}

function warn(msg: string): void {
  console.log(`${c('yellow', '⚠')} ${c('yellow', msg)}`);
}

function error(msg: string): void {
  console.log(`${c('red', '✗')} ${c('red', msg)}`);
}

function info(msg: string): void {
  console.log(`${c('blue', 'ℹ')} ${msg}`);
}

const DEMO_DIR = path.join(__dirname, '.demo-assets');
const TEST_VIDEO = path.join(DEMO_DIR, 'test-input.mp4');
const OUTPUT_MP4 = path.join(DEMO_DIR, 'watermarked.mp4');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${c('green', '?')} ${question} `, resolve);
  });
}

function print(msg = ''): void {
  console.log(msg);
}

function printHeader(title: string): void {
  const width = 60;
  const innerWidth = width - 2;
  const padding = Math.floor((innerWidth - title.length) / 2);
  const rightPad = innerWidth - padding - title.length;
  print();
  print(c('cyan', `╔${'═'.repeat(innerWidth)}╗`));
  print(
    c('cyan', '║') +
      ' '.repeat(padding) +
      c('bold', title) +
      ' '.repeat(rightPad) +
      c('cyan', '║')
  );
  print(c('cyan', `╚${'═'.repeat(innerWidth)}╝`));
  print();
}

function printStep(num: number, title: string): void {
  const stepText = `Step ${num} of ${TOTAL_STEPS}: ${title}`;
  const lineLen = Math.max(0, 56 - stepText.length);
  print();
  print(
    c('blue', '┌─ ') + c('bold', stepText) + c('blue', ` ${'─'.repeat(lineLen)}┐`)
  );
}

interface RunResult {
  success: boolean;
  output?: string;
  error?: string;
}

function _run(cmd: string, options: {silent?: boolean; cwd?: string} = {}): RunResult {
  print(`> ${cmd}`);
  try {
    const result = execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return {success: true, output: result};
  } catch (e) {
    return {success: false, error: (e as Error).message};
  }
}

function checkDependency(cmd: string): boolean {
  try {
    execSync(cmd, {stdio: 'pipe'});
    return true;
  } catch (e) {
    const nodeErr = e as NodeJS.ErrnoException;
    // Only treat ENOENT as "not found", warn about other errors
    if (nodeErr.code !== 'ENOENT') {
      const cmdName = cmd.split(' ')[0];
      warn(`${cmdName} check failed: ${nodeErr.message || 'unknown error'}`);
    }
    return false;
  }
}

// Watermark state
let boxX = 50;
let boxY = 50;
let boxDx = 3;
let boxDy = 2;
const BOX_WIDTH = 100;
const BOX_HEIGHT = 60;

function drawWatermark(
  rgbaData: Uint8Array,
  width: number,
  height: number,
  timestamp: number
): void {
  // Update bouncing box position.
  boxX += boxDx;
  boxY += boxDy;

  if (boxX <= 0 || boxX + BOX_WIDTH >= width) boxDx = -boxDx;
  if (boxY <= 0 || boxY + BOX_HEIGHT >= height) boxDy = -boxDy;

  boxX = Math.max(0, Math.min(width - BOX_WIDTH, boxX));
  boxY = Math.max(0, Math.min(height - BOX_HEIGHT, boxY));

  // Draw semi-transparent yellow box.
  for (let y = boxY; y < boxY + BOX_HEIGHT && y < height; y++) {
    for (let x = boxX; x < boxX + BOX_WIDTH && x < width; x++) {
      const idx = (y * width + x) * 4;
      // Yellow with 50% alpha blend.
      rgbaData[idx] = Math.min(255, rgbaData[idx] + 127); // R
      rgbaData[idx + 1] = Math.min(255, rgbaData[idx + 1] + 127); // G
      // B unchanged
    }
  }

  // Draw timestamp indicator (progress bar at bottom of box).
  const lineY = boxY + BOX_HEIGHT - 5;
  const lineWidth = Math.min(BOX_WIDTH, (timestamp / 1000000) % 100);
  for (let x = boxX; x < boxX + lineWidth && x < width; x++) {
    const idx = (lineY * width + x) * 4;
    rgbaData[idx] = 255; // R
    rgbaData[idx + 1] = 0; // G
    rgbaData[idx + 2] = 0; // B
  }
}

/** Stored chunk data for muxing. */
interface StoredChunk {
  type: 'key' | 'delta';
  timestamp: number;
  duration: number;
  data: Uint8Array;
}

async function generateTestVideo(outputPath: string): Promise<void> {
  const width = 640;
  const height = 480;
  const frameRate = 30;
  const duration = 5;

  // Generate video frames using native TestVideoGenerator
  const generator = new TestVideoGenerator();
  generator.configure({width, height, frameRate, duration, pattern: 'testsrc'});

  const videoChunks: StoredChunk[] = [];
  let codecDescription: AllowSharedBufferSource | undefined;
  let videoEncoderError: Error | null = null;

  // Helper to check and throw video encoder errors
  const checkVideoEncoderError = (): void => {
    if (videoEncoderError) throw videoEncoderError;
  };

  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata?: EncodedVideoChunkMetadata) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      videoChunks.push({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration ?? 33333,
        data,
      });
      if (metadata?.decoderConfig?.description && !codecDescription) {
        codecDescription = metadata.decoderConfig.description;
      }
    },
    error: (err) => {
      videoEncoderError = err instanceof Error ? err : new Error(String(err));
      console.error('Video encoder error:', err);
    },
  });

  videoEncoder.configure({
    codec: 'avc1.42001e',
    width,
    height,
    bitrate: 1_000_000,
    framerate: frameRate,
    latencyMode: 'realtime', // Disable B-frames for correct MP4 muxing
    avc: {format: 'avc'},
  });

  // Collect frames first (generator callback is sync, can't await inside)
  const generatedFrames: VideoFrame[] = [];
  await generator.generate((frame) => {
    generatedFrames.push(frame);
  });

  // Encode with backpressure
  for (let i = 0; i < generatedFrames.length; i++) {
    checkVideoEncoderError();
    const frame = generatedFrames[i];
    await videoEncoder.ready;
    videoEncoder.encode(frame, {keyFrame: i === 0});
    frame.close();
  }

  await videoEncoder.flush();
  videoEncoder.close();
  generator.close();

  checkVideoEncoderError();

  // Generate audio (440Hz sine wave)
  const sampleRate = 48000;
  const numChannels = 2;
  const audioChunks: StoredChunk[] = [];
  let audioEncoderError: Error | null = null;

  // Helper to check and throw audio encoder errors
  const checkAudioEncoderError = (): void => {
    if (audioEncoderError) throw audioEncoderError;
  };

  const audioEncoder = new AudioEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      audioChunks.push({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration ?? 0,
        data,
      });
    },
    error: (err) => {
      audioEncoderError = err instanceof Error ? err : new Error(String(err));
      console.error('Audio encoder error:', err);
    },
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
    checkAudioEncoderError();

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

    await audioEncoder.ready; // Wait for capacity
    audioEncoder.encode(frame);
    frame.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();

  checkAudioEncoderError();

  // Mux to MP4
  const muxer = new Muxer({filename: outputPath});
  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width,
    height,
    // biome-ignore lint/suspicious/noExplicitAny: Muxer types don't match AllowSharedBufferSource
    description: codecDescription as any,
  });
  muxer.addAudioTrack({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels: numChannels,
  });

  // Sort chunks by timestamp and write (in-place sort, arrays not reused)
  videoChunks.sort((a, b) => a.timestamp - b.timestamp);
  audioChunks.sort((a, b) => a.timestamp - b.timestamp);

  for (const chunk of videoChunks) {
    // biome-ignore lint/suspicious/noExplicitAny: StoredChunk type compatible with Muxer
    muxer.writeVideoChunk(chunk as any);
  }
  for (const chunk of audioChunks) {
    // biome-ignore lint/suspicious/noExplicitAny: StoredChunk type compatible with Muxer
    muxer.writeAudioChunk(chunk as any);
  }

  muxer.finalize();
  muxer.close();
}

async function processVideo(
  inputPath: string,
  outputPath: string
): Promise<{framesProcessed: number}> {
  info(`Input: ${c('dim', inputPath)}`);
  info(`Output: ${c('dim', outputPath)}`);
  print();

  // Collect encoded chunks for sorting before muxing (to handle B-frame reordering)
  const encodedChunks: StoredChunk[] = [];
  // Collect demuxed chunks for decoding with backpressure
  const collectedChunks: StoredChunk[] = [];
  let codecDescription: AllowSharedBufferSource | undefined;
  let videoTrack: TrackInfo | null = null;
  let framesProcessed = 0;
  let totalChunks = 0;
  let encoder: VideoEncoder | null = null;

  // Error tracking for async callbacks
  let decoderError: Error | null = null;
  let encoderError: Error | null = null;
  let demuxerError: Error | null = null;

  // Helper functions to check and throw errors
  const checkDecoderError = (): void => {
    if (decoderError) throw decoderError;
  };
  const checkEncoderError = (): void => {
    if (encoderError) throw encoderError;
  };
  const checkDemuxerError = (): void => {
    if (demuxerError) throw demuxerError;
  };

  const decoder = new VideoDecoder({
    output: (frame) => {
      try {
        const size = frame.allocationSize({format: 'RGBA'});
        const rgbaData = new Uint8Array(size);
        frame.copyTo(rgbaData.buffer, {format: 'RGBA'});

        drawWatermark(
          rgbaData,
          frame.codedWidth,
          frame.codedHeight,
          frame.timestamp
        );

        const modifiedFrame = new VideoFrame(Buffer.from(rgbaData), {
          format: 'RGBA',
          codedWidth: frame.codedWidth,
          codedHeight: frame.codedHeight,
          timestamp: frame.timestamp,
        });

        if (encoder) {
          encoder.encode(modifiedFrame, {keyFrame: framesProcessed % 30 === 0});
        }
        modifiedFrame.close();
        frame.close();

        framesProcessed++;
      } catch (e) {
        decoderError = e instanceof Error ? e : new Error(String(e));
        frame.close();
      }
    },
    error: (e) => {
      decoderError = e instanceof Error ? e : new Error(String(e));
      error(`Decoder error: ${e}`);
    },
  });

  const demuxer = new Demuxer({
    onTrack: (track: TrackInfo) => {
      success(`Found track: ${c('cyan', track.type)} (${track.codec})`);
      if (track.type === 'video') {
        videoTrack = track;
        print(`  ${c('dim', 'Resolution:')} ${track.width}x${track.height}`);

        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: track.width ?? 0,
          codedHeight: track.height ?? 0,
          description: track.extradata,
        });

        encoder = new VideoEncoder({
          output: (chunk, metadata?: EncodedVideoChunkMetadata) => {
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
              duration: chunk.duration ?? 33333,
              data,
            });
          },
          error: (e) => {
            encoderError = e instanceof Error ? e : new Error(String(e));
            error(`Encoder error: ${e}`);
          },
        });

        // Use avc format to get proper extradata for MP4 container
        encoder.configure({
          codec: 'avc1.42001e',
          width: track.width ?? 0,
          height: track.height ?? 0,
          bitrate: 2_000_000,
          framerate: 30,
          latencyMode: 'realtime', // Disable B-frames for correct MP4 muxing
          avc: {format: 'avc'},
        });
      }
    },
    onChunk: (chunk, trackIndex) => {
      if (videoTrack && trackIndex === videoTrack.index) {
        totalChunks++;
        // Collect chunk data instead of decoding immediately (backpressure handling)
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        collectedChunks.push({
          type: chunk.type,
          timestamp: chunk.timestamp,
          duration: chunk.duration ?? 0,
          data,
        });
      }
    },
    onError: (e) => {
      demuxerError = e instanceof Error ? e : new Error(String(e));
      error(`Demuxer error: ${e}`);
    },
  });

  const openSpinner = createSpinner('Opening video file...');
  await demuxer.open(inputPath);
  openSpinner.succeed('Video file opened');

  checkDemuxerError();

  if (!videoTrack) {
    throw new Error('No video track found in file');
  }
  // Keep a reference with explicit type to avoid narrowing issues with closures
  const validTrack: TrackInfo = videoTrack;

  const processSpinner = createSpinner('Processing frames...');
  await demuxer.demux();
  processSpinner.succeed(`Demuxed ${totalChunks} chunks`);

  checkDemuxerError();

  // Verify encoder was initialized
  if (!encoder) {
    throw new Error('Encoder not initialized - no video track was configured');
  }
  // Keep a reference with explicit type to avoid narrowing issues with closures
  const validEncoder: VideoEncoder = encoder;

  // Decode with backpressure handling (wait for both decoder AND encoder capacity)
  const decodeSpinner = createSpinner('Decoding frames...');
  for (const chunkData of collectedChunks) {
    // Check for errors before processing more chunks
    checkDecoderError();
    checkEncoderError();

    const chunk = new EncodedVideoChunk({
      type: chunkData.type,
      timestamp: chunkData.timestamp,
      duration: chunkData.duration,
      data: chunkData.data,
    });
    await decoder.ready; // Wait for decoder capacity
    await validEncoder.ready; // Wait for encoder capacity (prevent output callback overflow)
    decoder.decode(chunk);
  }
  decodeSpinner.succeed(`Decoded ${collectedChunks.length} chunks`);

  const flushSpinner = createSpinner('Flushing codecs...');
  await decoder.flush();
  await validEncoder.flush();
  flushSpinner.succeed('Codecs flushed');

  demuxer.close();
  decoder.close();
  validEncoder.close();

  // Final error check after flush
  checkDecoderError();
  checkEncoderError();

  success(`Processed ${c('bold', String(framesProcessed))} frames`);

  // Sort chunks by timestamp to handle B-frame reordering (in-place, array not reused)
  encodedChunks.sort((a, b) => a.timestamp - b.timestamp);

  // Create MP4 using Muxer
  const muxSpinner = createSpinner('Writing MP4 container...');
  const muxer = new Muxer({filename: outputPath});

  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width: validTrack.width ?? 0,
    height: validTrack.height ?? 0,
    bitrate: 2_000_000,
    framerate: 30,
    // biome-ignore lint/suspicious/noExplicitAny: Muxer types don't match AllowSharedBufferSource
    description: codecDescription as any,
  });

  for (const chunk of encodedChunks) {
    // biome-ignore lint/suspicious/noExplicitAny: StoredChunk type compatible with Muxer
    muxer.writeVideoChunk(chunk as any);
  }

  muxer.finalize();
  muxer.close();
  muxSpinner.succeed('MP4 container written');

  const stats = fs.statSync(outputPath);
  success(`Output file: ${c('cyan', (stats.size / 1024).toFixed(1))} KB`);

  return {framesProcessed};
}

async function main(): Promise<void> {
  printHeader('node-webcodecs Interactive Demo');

  print('Welcome! This demo will walk you through the video');
  print('processing capabilities of node-webcodecs.');
  print();
  print(c('dim', '  What you will see:'));
  print(`  ${c('cyan', '1.')} Create a test video using native bindings`);
  print(`  ${c('cyan', '2.')} Demux the MP4 container`);
  print(`  ${c('cyan', '3.')} Decode H.264 frames`);
  print(`  ${c('cyan', '4.')} Add a bouncing watermark overlay`);
  print(`  ${c('cyan', '5.')} Re-encode to H.264 and mux to MP4`);
  print(`  ${c('cyan', '6.')} View the result`);
  print();

  await ask('Press Enter to start...');

  // Check dependencies
  printStep(1, 'Checking Dependencies');

  // ffplay is optional for playback
  const hasFFplay = checkDependency('ffplay -version');

  if (hasFFplay) {
    success('FFplay available for video playback');
  } else {
    warn('FFplay not found (playback will be skipped)');
  }

  // The npm package is already installed - no need to check parent build
  success('Using @pproenca/node-webcodecs npm package');

  await ask('Press Enter to continue...');

  // Create demo directory
  printStep(2, 'Creating Test Video');

  if (!fs.existsSync(DEMO_DIR)) {
    fs.mkdirSync(DEMO_DIR, {recursive: true});
  }

  info('Test pattern + 440Hz sine wave at 640x480, 30fps');
  print();

  const genSpinner = createSpinner('Generating 5-second test video...');
  try {
    await generateTestVideo(TEST_VIDEO);
    const stats = fs.statSync(TEST_VIDEO);
    genSpinner.succeed(
      `Test video created (${(stats.size / 1024).toFixed(1)} KB)`
    );
  } catch (err) {
    genSpinner.fail('Failed to create test video');
    error((err as Error).message);
    rl.close();
    process.exit(1);
  }

  print(`  ${c('dim', 'File:')} ${c('cyan', TEST_VIDEO)}`);

  await ask('Press Enter to run the watermarker...');

  // Run watermarker
  printStep(3, 'Running Video Watermarker');

  print(c('dim', '  Pipeline:'));
  print(`  ${c('cyan', '→')} Open the MP4 and detect tracks`);
  print(`  ${c('cyan', '→')} Decode each video frame to RGBA pixels`);
  print(`  ${c('cyan', '→')} Draw a bouncing yellow box on each frame`);
  print(`  ${c('cyan', '→')} Re-encode frames to H.264 and mux directly to MP4`);
  print();

  // Reset watermark position for fresh run
  boxX = 50;
  boxY = 50;
  boxDx = 3;
  boxDy = 2;

  const result = await processVideo(TEST_VIDEO, OUTPUT_MP4);

  if (!fs.existsSync(OUTPUT_MP4)) {
    error('Watermarker failed to produce output');
    rl.close();
    process.exit(1);
  }

  // Play result
  if (hasFFplay) {
    printStep(4, 'Viewing Result');

    info('Video player will open in a new window');
    print();

    const playChoice = await ask('Play the video? [Y/n]');

    if (playChoice.toLowerCase() !== 'n') {
      const playSpinner = createSpinner('Opening FFplay...');
      await new Promise<void>((resolve) => {
        const player: ChildProcess = spawn('ffplay', ['-autoexit', OUTPUT_MP4], {
          stdio: 'inherit',
        });
        player.on('error', (e) => {
          playSpinner.fail(`FFplay failed to start: ${e.message}`);
          resolve();
        });
        player.on('close', (code) => {
          if (code === 0) {
            playSpinner.succeed('Video playback complete');
          } else if (code !== null) {
            playSpinner.fail(`FFplay exited with code ${code}`);
          } else {
            playSpinner.succeed('Video playback complete');
          }
          resolve();
        });
      });
    }
  }

  // Summary box
  const outputStats = fs.statSync(OUTPUT_MP4);
  const outputSize = (outputStats.size / 1024).toFixed(1);

  print();
  print(
    c('cyan', '┌─────────────────────────────────────────────────────────┐')
  );
  print(
    `${c('cyan', '│')}                    ${c('bold', 'Demo Complete!')}                      ${c('cyan', '│')}`
  );
  print(
    c('cyan', '├─────────────────────────────────────────────────────────┤')
  );
  print(
    `${c('cyan', '│')}  ${c('green', '✓')} Test video generated       640x480 @ 30fps           ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('green', '✓')} Watermark applied          ${String(result.framesProcessed).padStart(3)} frames processed      ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('green', '✓')} Output saved               ${outputSize.padStart(6)} KB                  ${c('cyan', '│')}`
  );
  print(
    c('cyan', '├─────────────────────────────────────────────────────────┤')
  );
  print(
    c('cyan', '│') +
      c('dim', '  What happened:                                          ') +
      c('cyan', '│')
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '1.')} TestVideoGenerator + AudioEncoder created input     ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '2.')} Demuxer parsed the MP4 container (libavformat)      ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '3.')} VideoDecoder decoded H.264 to RGBA frames           ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '4.')} JavaScript modified pixels (bouncing yellow box)    ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '5.')} VideoEncoder re-encoded to H.264                    ${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  ${c('cyan', '6.')} Muxer wrapped the H.264 in an MP4 container         ${c('cyan', '│')}`
  );
  print(
    c('cyan', '├─────────────────────────────────────────────────────────┤')
  );
  print(
    c('cyan', '│') +
      c('dim', '  Files:                                                  ') +
      c('cyan', '│')
  );
  print(
    `${c('cyan', '│')}  Input:  ${c('cyan', '.demo-assets/test-input.mp4').padEnd(47)}${c('cyan', '│')}`
  );
  print(
    `${c('cyan', '│')}  Output: ${c('cyan', '.demo-assets/watermarked.mp4').padEnd(47)}${c('cyan', '│')}`
  );
  print(
    c('cyan', '└─────────────────────────────────────────────────────────┘')
  );
  print();

  // Web UI option
  const startWeb = await ask('Start web dashboard to view results? [Y/n]');
  if (startWeb.toLowerCase() !== 'n') {
    print();
    info('Starting web dashboard...');
    print(`  ${c('cyan', '→')} Open ${c('bold', 'http://localhost:3000')} in your browser`);
    print(`  ${c('cyan', '→')} Press ${c('bold', 'Ctrl+C')} to exit`);
    print();
    // Dynamic import for web-ui server
    await import('./web-ui/server.ts');
    // Keep process running - server handles its own lifecycle
    return;
  }

  const cleanup = await ask('Delete demo files? [y/N]');
  if (cleanup.toLowerCase() === 'y') {
    fs.rmSync(DEMO_DIR, {recursive: true, force: true});
    success('Cleaned up demo files');
  }

  print();
  print(c('cyan', '━'.repeat(60)));
  print(`  ${c('bold', 'Thanks for trying node-webcodecs!')} ${c('dim', '✨')}`);
  print(c('cyan', '━'.repeat(60)));
  print();
  rl.close();
}

main().catch((e: unknown) => {
  const err = e instanceof Error ? e : new Error(String(e));
  console.error(`\n${c('red', '✗')} Demo error: ${err.message}`);
  rl.close();
  process.exit(1);
});
