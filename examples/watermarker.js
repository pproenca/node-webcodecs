// Copyright 2024 The node-webcodecs Authors
// SPDX-License-Identifier: MIT
//
// Real-Time Video Watermarker Demo
//
// Demonstrates:
// - Demuxing MP4 file
// - Decoding frames
// - Modifying pixels in JavaScript (bouncing box + timestamp)
// - Re-encoding frames
// - Writing output file

const fs = require('fs');
const path = require('path');
const {
  Demuxer,
  VideoDecoder,
  VideoEncoder,
  VideoFrame,
  EncodedVideoChunk
} = require('../dist/index.js');

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'output.h264';

if (!inputPath) {
  console.error('Usage: node watermarker.js <input.mp4> [output.h264]');
  console.error('');
  console.error('This demo reads a video file, adds a bouncing yellow box');
  console.error('watermark to each frame, and outputs an H.264 stream.');
  process.exit(1);
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
      rgbaData[idx] = Math.min(255, rgbaData[idx] + 127);       // R
      rgbaData[idx + 1] = Math.min(255, rgbaData[idx + 1] + 127); // G
      rgbaData[idx + 2] = rgbaData[idx + 2];                      // B unchanged
    }
  }

  // Draw timestamp indicator (progress bar at bottom of box).
  const lineY = boxY + boxHeight - 5;
  const lineWidth = Math.min(boxWidth, (timestamp / 1000000) % 100);
  for (let x = boxX; x < boxX + lineWidth && x < width; x++) {
    const idx = (lineY * width + x) * 4;
    rgbaData[idx] = 255;     // R
    rgbaData[idx + 1] = 0;   // G
    rgbaData[idx + 2] = 0;   // B
  }
}

async function main() {
  console.log(`Processing: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log('');

  const encodedChunks = [];
  let videoTrack = null;
  let framesProcessed = 0;
  let totalChunks = 0;

  // Create encoder first so we can configure it when we know video dimensions.
  let encoder = null;

  // Create decoder.
  const decoder = new VideoDecoder({
    output: (frame) => {
      // Get RGBA data.
      const size = frame.allocationSize({ format: 'RGBA' });
      const rgbaData = new Uint8Array(size);
      frame.copyTo(rgbaData.buffer, { format: 'RGBA' });

      // Apply watermark.
      drawWatermark(rgbaData, frame.codedWidth, frame.codedHeight, frame.timestamp);

      // Create new frame with modified pixels.
      const modifiedFrame = new VideoFrame(Buffer.from(rgbaData), {
        format: 'RGBA',
        codedWidth: frame.codedWidth,
        codedHeight: frame.codedHeight,
        timestamp: frame.timestamp
      });

      // Encode (keyframe every 30 frames).
      encoder.encode(modifiedFrame, { keyFrame: framesProcessed % 30 === 0 });
      modifiedFrame.close();
      frame.close();

      framesProcessed++;
      if (framesProcessed % 10 === 0) {
        process.stdout.write(`\rProcessed ${framesProcessed} frames...`);
      }
    },
    error: (e) => console.error('Decoder error:', e)
  });

  // Create demuxer.
  const demuxer = new Demuxer({
    onTrack: (track) => {
      console.log(`Found track: ${track.type} (${track.codec})`);
      if (track.type === 'video') {
        videoTrack = track;
        console.log(`  Resolution: ${track.width}x${track.height}`);

        // Configure decoder.
        decoder.configure({
          codec: 'avc1.42001e',
          codedWidth: track.width,
          codedHeight: track.height,
          description: track.extradata
        });

        // Create and configure encoder.
        encoder = new VideoEncoder({
          output: (chunk) => {
            encodedChunks.push(chunk);
          },
          error: (e) => console.error('Encoder error:', e)
        });

        encoder.configure({
          codec: 'avc1.42001e',
          width: track.width,
          height: track.height,
          bitrate: 2_000_000,
          framerate: 30
        });
      }
    },
    onChunk: (chunk, trackIndex) => {
      if (videoTrack && trackIndex === videoTrack.index) {
        totalChunks++;
        decoder.decode(chunk);
      }
    },
    onError: (e) => console.error('Demuxer error:', e)
  });

  // Open and process file.
  console.log('Opening file...');
  await demuxer.open(inputPath);

  if (!videoTrack) {
    console.error('No video track found in file');
    process.exit(1);
  }

  console.log('Demuxing and processing frames...');
  await demuxer.demux();

  console.log('\nFlushing decoder...');
  await decoder.flush();

  console.log('Flushing encoder...');
  await encoder.flush();

  // Cleanup.
  demuxer.close();
  decoder.close();
  encoder.close();

  console.log(`\nProcessed ${framesProcessed} frames from ${totalChunks} chunks`);

  // Write output.
  const outputData = Buffer.concat(
    encodedChunks.map(chunk => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      return Buffer.from(buf);
    })
  );

  fs.writeFileSync(outputPath, outputData);
  console.log(`\nWritten: ${outputPath} (${(outputData.length / 1024).toFixed(2)} KB)`);
  console.log('');
  console.log('To play the output, wrap it in a container:');
  console.log(`  ffmpeg -i ${outputPath} -c copy output.mp4`);
  console.log('  ffplay output.mp4');
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
