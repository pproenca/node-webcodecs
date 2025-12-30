/**
 * Benchmarks for node-webcodecs
 *
 * Run with: npx tsx bench/index.ts
 * Or: npm run bench
 *
 * These benchmarks measure:
 * - Encoder throughput (frames per second)
 * - Decoder throughput (frames per second)
 * - Frame creation overhead
 * - Memory bandwidth utilization
 */

import {
  VideoEncoder,
  VideoFrame,
  EncodedVideoChunk,
  AudioEncoder,
  AudioData,
} from '../dist/index.js';

interface BenchmarkResult {
  name: string;
  ops: number;
  opsPerSec: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  memoryMB: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  // Warmup
  for (let i = 0; i < Math.min(10, iterations / 10); i++) {
    await fn();
  }

  // Force GC if available
  if (global.gc) global.gc();
  const memBefore = process.memoryUsage().heapUsed;

  const times: number[] = [];
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    await fn();
    times.push(performance.now() - iterStart);
  }

  const totalMs = performance.now() - start;

  if (global.gc) global.gc();
  const memAfter = process.memoryUsage().heapUsed;

  return {
    name,
    ops: iterations,
    opsPerSec: (iterations / totalMs) * 1000,
    avgMs: totalMs / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    memoryMB: (memAfter - memBefore) / (1024 * 1024),
  };
}

function formatResult(result: BenchmarkResult): string {
  return [
    `${result.name}:`,
    `  ${result.opsPerSec.toFixed(2)} ops/sec`,
    `  avg: ${result.avgMs.toFixed(3)}ms`,
    `  min: ${result.minMs.toFixed(3)}ms`,
    `  max: ${result.maxMs.toFixed(3)}ms`,
    `  memory delta: ${result.memoryMB.toFixed(2)}MB`,
  ].join('\n');
}

async function runVideoEncoderBenchmarks(): Promise<void> {
  console.log('\n=== VideoEncoder Benchmarks ===\n');

  // 720p encoding benchmark
  const result720p = await benchmark(
    'VideoEncoder 720p H.264',
    async () => {
      const chunks: EncodedVideoChunk[] = [];
      const encoder = new VideoEncoder({
        output: chunk => chunks.push(chunk),
        error: err => console.error(err),
      });

      encoder.configure({
        codec: 'avc1.42001f',
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30,
      });

      // Encode 10 frames
      for (let i = 0; i < 10; i++) {
        const frameData = new Uint8Array(1280 * 720 * 4);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 1280,
          codedHeight: 720,
          timestamp: i * 33333,
        });
        encoder.encode(frame, {keyFrame: i === 0});
        frame.close();
      }

      await encoder.flush();
      encoder.close();
    },
    50,
  );
  console.log(formatResult(result720p));

  // 1080p encoding benchmark
  const result1080p = await benchmark(
    'VideoEncoder 1080p H.264',
    async () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: err => console.error(err),
      });

      encoder.configure({
        codec: 'avc1.42001f',
        width: 1920,
        height: 1080,
        bitrate: 4_000_000,
        framerate: 30,
      });

      // Encode 5 frames
      for (let i = 0; i < 5; i++) {
        const frameData = new Uint8Array(1920 * 1080 * 4);
        const frame = new VideoFrame(frameData, {
          format: 'RGBA',
          codedWidth: 1920,
          codedHeight: 1080,
          timestamp: i * 33333,
        });
        encoder.encode(frame, {keyFrame: i === 0});
        frame.close();
      }

      await encoder.flush();
      encoder.close();
    },
    20,
  );
  console.log(formatResult(result1080p));
}

async function runVideoFrameBenchmarks(): Promise<void> {
  console.log('\n=== VideoFrame Benchmarks ===\n');

  // Frame creation benchmark
  const createResult = await benchmark(
    'VideoFrame creation (1080p RGBA)',
    () => {
      const frameData = new Uint8Array(1920 * 1080 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: 0,
      });
      frame.close();
    },
    500,
  );
  console.log(formatResult(createResult));

  // Frame clone benchmark
  const cloneResult = await benchmark(
    'VideoFrame clone (1080p RGBA)',
    () => {
      const frameData = new Uint8Array(1920 * 1080 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1920,
        codedHeight: 1080,
        timestamp: 0,
      });
      const clone = frame.clone();
      frame.close();
      clone.close();
    },
    200,
  );
  console.log(formatResult(cloneResult));

  // copyTo benchmark
  const copyToResult = await benchmark(
    'VideoFrame copyTo (720p RGBA)',
    async () => {
      const frameData = new Uint8Array(1280 * 720 * 4);
      const frame = new VideoFrame(frameData, {
        format: 'RGBA',
        codedWidth: 1280,
        codedHeight: 720,
        timestamp: 0,
      });
      const dest = new Uint8Array(1280 * 720 * 4);
      await frame.copyTo(dest);
      frame.close();
    },
    200,
  );
  console.log(formatResult(copyToResult));
}

async function runAudioEncoderBenchmarks(): Promise<void> {
  console.log('\n=== AudioEncoder Benchmarks ===\n');

  const result = await benchmark(
    'AudioEncoder Opus (1024 samples)',
    async () => {
      const encoder = new AudioEncoder({
        output: () => {},
        error: err => console.error(err),
      });

      encoder.configure({
        codec: 'opus',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      });

      // Encode 10 audio frames
      for (let i = 0; i < 10; i++) {
        const audioData = new AudioData({
          format: 'f32',
          sampleRate: 48000,
          numberOfFrames: 1024,
          numberOfChannels: 2,
          timestamp: i * 21333,
          data: new Float32Array(1024 * 2),
        });
        encoder.encode(audioData);
        audioData.close();
      }

      await encoder.flush();
      encoder.close();
    },
    50,
  );
  console.log(formatResult(result));
}

async function runConfigurationBenchmarks(): Promise<void> {
  console.log('\n=== Configuration Benchmarks ===\n');

  const result = await benchmark(
    'VideoEncoder create/configure/close',
    () => {
      const encoder = new VideoEncoder({
        output: () => {},
        error: () => {},
      });
      encoder.configure({
        codec: 'avc1.42001f',
        width: 1920,
        height: 1080,
        bitrate: 4_000_000,
      });
      encoder.close();
    },
    200,
  );
  console.log(formatResult(result));
}

async function main(): Promise<void> {
  console.log('node-webcodecs Benchmarks');
  console.log('=========================');
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log(`Date: ${new Date().toISOString()}`);

  try {
    await runConfigurationBenchmarks();
    await runVideoFrameBenchmarks();
    await runVideoEncoderBenchmarks();
    await runAudioEncoderBenchmarks();
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }

  console.log('\nBenchmarks completed successfully.');
}

void main();
