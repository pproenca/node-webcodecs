#!/usr/bin/env node
/**
 * generate-video.mjs - Create an MP4 video using @pproenca/node-webcodecs
 *
 * This script generates a 5-second video with animated bouncing shapes,
 * entirely without calling FFmpeg CLI - just using the library APIs.
 *
 * Usage:
 *   npm install @pproenca/node-webcodecs
 *   node generate-video.mjs
 *
 * Output: output.mp4 (640x480, 30fps, H.264)
 */

// Use local build if available, otherwise published package
let lib;
try {
  lib = await import('../dist/index.js');
} catch {
  lib = await import('@pproenca/node-webcodecs');
}
const { VideoEncoder, VideoFrame, Muxer } = lib;

// Video settings
const WIDTH = 640;
const HEIGHT = 480;
const FPS = 30;
const DURATION_SECS = 5;
const TOTAL_FRAMES = FPS * DURATION_SECS;
const OUTPUT_FILE = 'output.mp4';

// Bouncing ball state
let ballX = 100;
let ballY = 100;
let ballDX = 5;
let ballDY = 3;
const BALL_RADIUS = 30;

// Colors
const BG_COLOR = { r: 30, g: 30, b: 50 };
const BALL_COLORS = [
  { r: 255, g: 100, b: 100 },  // Red
  { r: 100, g: 255, b: 100 },  // Green
  { r: 100, g: 100, b: 255 },  // Blue
  { r: 255, g: 255, b: 100 },  // Yellow
];

function drawFrame(frameIndex) {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

  // Fill background with gradient
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = (y * WIDTH + x) * 4;
      const gradientFactor = y / HEIGHT;
      pixels[idx] = Math.floor(BG_COLOR.r * (1 - gradientFactor * 0.5));
      pixels[idx + 1] = Math.floor(BG_COLOR.g * (1 - gradientFactor * 0.3));
      pixels[idx + 2] = Math.floor(BG_COLOR.b + (50 * gradientFactor));
      pixels[idx + 3] = 255;
    }
  }

  // Update ball position
  ballX += ballDX;
  ballY += ballDY;

  if (ballX - BALL_RADIUS <= 0 || ballX + BALL_RADIUS >= WIDTH) {
    ballDX = -ballDX;
    ballX = Math.max(BALL_RADIUS, Math.min(WIDTH - BALL_RADIUS, ballX));
  }
  if (ballY - BALL_RADIUS <= 0 || ballY + BALL_RADIUS >= HEIGHT) {
    ballDY = -ballDY;
    ballY = Math.max(BALL_RADIUS, Math.min(HEIGHT - BALL_RADIUS, ballY));
  }

  // Draw bouncing ball with color cycling
  const colorIdx = Math.floor(frameIndex / 15) % BALL_COLORS.length;
  const color = BALL_COLORS[colorIdx];

  for (let dy = -BALL_RADIUS; dy <= BALL_RADIUS; dy++) {
    for (let dx = -BALL_RADIUS; dx <= BALL_RADIUS; dx++) {
      if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
        const px = Math.floor(ballX + dx);
        const py = Math.floor(ballY + dy);
        if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
          const idx = (py * WIDTH + px) * 4;
          // Add a slight 3D effect
          const shade = 1 - (dx + dy) / (BALL_RADIUS * 3);
          pixels[idx] = Math.min(255, Math.floor(color.r * shade));
          pixels[idx + 1] = Math.min(255, Math.floor(color.g * shade));
          pixels[idx + 2] = Math.min(255, Math.floor(color.b * shade));
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  // Draw frame counter in top-left
  const text = `Frame ${frameIndex + 1}/${TOTAL_FRAMES}`;
  const charWidth = 8;
  const charHeight = 12;
  for (let i = 0; i < text.length; i++) {
    // Simple block characters
    for (let cy = 0; cy < charHeight; cy++) {
      for (let cx = 0; cx < charWidth; cx++) {
        const px = 10 + i * charWidth + cx;
        const py = 10 + cy;
        if (px < WIDTH && py < HEIGHT) {
          const idx = (py * WIDTH + px) * 4;
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
          pixels[idx + 3] = 200;
        }
      }
    }
  }

  // Draw progress bar at bottom
  const barHeight = 10;
  const barY = HEIGHT - barHeight - 10;
  const progress = frameIndex / TOTAL_FRAMES;
  for (let x = 10; x < WIDTH - 10; x++) {
    for (let y = barY; y < barY + barHeight; y++) {
      const idx = (y * WIDTH + x) * 4;
      const filled = (x - 10) / (WIDTH - 20) <= progress;
      pixels[idx] = filled ? 100 : 50;
      pixels[idx + 1] = filled ? 200 : 50;
      pixels[idx + 2] = filled ? 100 : 50;
      pixels[idx + 3] = 255;
    }
  }

  return pixels;
}

async function main() {
  console.log('🎬 Generating video using @pproenca/node-webcodecs');
  console.log(`   Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps`);
  console.log(`   Duration: ${DURATION_SECS} seconds (${TOTAL_FRAMES} frames)`);
  console.log(`   Output: ${OUTPUT_FILE}\n`);

  const chunks = [];
  let codecDescription = null;

  // Create encoder
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      // Capture codec extradata for MP4 container
      if (metadata?.decoderConfig?.description && !codecDescription) {
        codecDescription = metadata.decoderConfig.description;
      }
      // Store chunk for later muxing
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        type: chunk.type,
        timestamp: chunk.timestamp,
        duration: chunk.duration || Math.floor(1_000_000 / FPS),
        data,
      });
    },
    error: (e) => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001e',  // H.264 Baseline
    width: WIDTH,
    height: HEIGHT,
    bitrate: 2_000_000,
    framerate: FPS,
    avc: { format: 'avc' },  // AVCC format for MP4 container
  });

  // Generate and encode frames
  console.log('Encoding frames...');
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const pixels = drawFrame(i);

    const frame = new VideoFrame(Buffer.from(pixels), {
      format: 'RGBA',
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: Math.floor(i * (1_000_000 / FPS)),
    });

    encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();

    if ((i + 1) % 30 === 0) {
      process.stdout.write(`\r  ${i + 1}/${TOTAL_FRAMES} frames encoded`);
    }
  }

  await encoder.flush();
  encoder.close();
  console.log(`\r  ${TOTAL_FRAMES}/${TOTAL_FRAMES} frames encoded ✓\n`);

  // Sort chunks by timestamp (handle B-frame reordering)
  chunks.sort((a, b) => a.timestamp - b.timestamp);

  // Mux to MP4
  console.log('Muxing to MP4...');
  const muxer = new Muxer({ filename: OUTPUT_FILE });

  muxer.addVideoTrack({
    codec: 'avc1.42001e',
    width: WIDTH,
    height: HEIGHT,
    description: codecDescription,
  });

  for (const chunk of chunks) {
    muxer.writeVideoChunk(chunk);
  }

  muxer.finalize();
  muxer.close();

  console.log(`✅ Video saved to ${OUTPUT_FILE}`);
  console.log('\nPlay with: ffplay output.mp4');
  console.log('Or: open output.mp4  (macOS)');
}

main().catch(console.error);
