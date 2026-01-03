#!/usr/bin/env tsx
/**
 * decode-gif.ts - Decode an animated GIF using @pproenca/node-webcodecs
 *
 * This script demonstrates GIF decoding capabilities:
 * - Decode animated GIFs to individual VideoFrames
 * - Access frame timing, loop count, and metadata
 *
 * Usage:
 *   npm install
 *   npm run decode-gif
 *   # Or with a custom GIF:
 *   npx tsx decode-gif.ts path/to/image.gif
 */

import * as fs from 'node:fs';
import {ImageDecoder} from '@pproenca/node-webcodecs';

/** Creates a simple 2-frame animated GIF for demo purposes. */
function createDemoGif(): Buffer {
  // GIF89a header + minimal 2-frame animation (4x4 pixels)
  return Buffer.from([
    // Header
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
    // Logical Screen Descriptor
    0x04, 0x00, // Width: 4
    0x04, 0x00, // Height: 4
    0xf0, // Global Color Table Flag, 2 colors
    0x00, // Background color index
    0x00, // Pixel aspect ratio
    // Global Color Table (2 colors: red and blue)
    0xff, 0x00, 0x00, // Color 0: Red
    0x00, 0x00, 0xff, // Color 1: Blue
    // NETSCAPE2.0 extension for looping
    0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32,
    0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00,
    // Frame 1: Red
    0x21, 0xf9, 0x04, 0x00, 0x32, 0x00, 0x00, 0x00, // GCE: 500ms delay
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00,
    0x00, // Image descriptor
    0x02, 0x02, 0x44, 0x01, 0x00, // LZW compressed: all red
    // Frame 2: Blue
    0x21, 0xf9, 0x04, 0x00, 0x32, 0x00, 0x01, 0x00, // GCE: 500ms delay
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x04, 0x00, 0x00, 0x02, 0x02,
    0x54, 0x01, 0x00, // LZW compressed: all blue
    // Trailer
    0x3b,
  ]);
}

async function main(): Promise<void> {
  const gifPath = process.argv[2];
  let gifData: Buffer;

  if (gifPath) {
    gifData = fs.readFileSync(gifPath);
    console.log(`Loading GIF from: ${gifPath}`);
  } else {
    gifData = createDemoGif();
    console.log('Using built-in demo GIF (2-frame animation)');
  }

  console.log(`   Size: ${gifData.length} bytes\n`);

  // Create decoder
  const decoder = new ImageDecoder({
    type: 'image/gif',
    data: gifData,
  });

  // Wait for metadata to be parsed
  await decoder.completed;

  // Get track info
  if (!decoder.tracks.length) {
    throw new Error('No image tracks found in file');
  }
  const track = decoder.tracks[0];
  console.log('GIF Info:');
  const trackInfo = track as {track?: {width?: number; height?: number}};
  console.log(
    `   Dimensions: ${trackInfo.track?.width ?? 'N/A'}x${trackInfo.track?.height ?? 'N/A'}`
  );
  console.log(`   Frame count: ${track.frameCount}`);
  console.log(`   Animated: ${track.animated}`);
  console.log(
    `   Loop count: ${track.repetitionCount === Infinity ? 'infinite' : track.repetitionCount}`
  );
  console.log('');

  // Decode each frame with proper resource cleanup
  console.log('Decoding frames:');
  try {
    for (let i = 0; i < track.frameCount; i++) {
      const result = await decoder.decode({frameIndex: i});
      const frame = result.image;

      try {
        console.log(`   Frame ${i + 1}/${track.frameCount}:`);
        console.log(`     Size: ${frame.codedWidth}x${frame.codedHeight}`);
        console.log(`     Format: ${frame.format}`);
        console.log(`     Timestamp: ${frame.timestamp}us`);
        if (frame.duration) {
          console.log(`     Duration: ${frame.duration}us`);
        }
      } finally {
        frame.close();
      }
    }
  } finally {
    decoder.close();
  }

  console.log('\nGIF decoded successfully!');
  console.log('\nNote: GIF *encoding* is not yet supported.');
  console.log(
    'The library can decode animated GIFs to VideoFrames for processing.'
  );
}

main().catch((e: unknown) => {
  const err = e instanceof Error ? e : new Error(String(e));
  const nodeErr = e as NodeJS.ErrnoException;

  if (nodeErr.code === 'ENOENT') {
    console.error(`Error: File not found - ${process.argv[2]}`);
  } else if (nodeErr.code === 'EACCES') {
    console.error(`Error: Permission denied - ${process.argv[2]}`);
  } else if (err.name === 'EncodingError' || err.name === 'NotSupportedError') {
    console.error(`Error: Invalid or unsupported GIF file - ${err.message}`);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});
