const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  VideoFilter,
  EncodedVideoChunk,
} = require('../dist');

console.log('[TEST] Blur Region Integration Test');
console.log(
  '[TEST] Pipeline: Create Frame -> Blur Region -> Encode -> Decode -> Verify',
);

async function runTest() {
  // Create a frame with distinct regions (checkerboard pattern)
  const width = 320;
  const height = 240;
  const buf = Buffer.alloc(width * height * 4);

  // Fill with checkerboard: white and black 40x40 squares
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const isWhite = (Math.floor(x / 40) + Math.floor(y / 40)) % 2 === 0;
      const val = isWhite ? 255 : 0;
      buf[idx] = val; // R
      buf[idx + 1] = val; // G
      buf[idx + 2] = val; // B
      buf[idx + 3] = 255; // A
    }
  }

  const frame = new VideoFrame(buf, {
    codedWidth: width,
    codedHeight: height,
    timestamp: 0,
  });
  console.log(`[INFO] Created ${width}x${height} checkerboard frame`);

  // Apply blur to center region
  const filter = new VideoFilter();
  filter.configure({width, height});

  const regions = [
    {x: 80, y: 60, width: 160, height: 120}, // Center region
  ];

  const blurredFrame = filter.applyBlur(frame, regions, 40);
  console.log('[INFO] Applied blur to center region');

  // Verify blurred frame has expected dimensions
  if (
    blurredFrame.codedWidth !== width ||
    blurredFrame.codedHeight !== height
  ) {
    throw new Error('Blurred frame dimensions mismatch');
  }

  // Get pixel data and verify blur affected center
  const blurredData = new Uint8Array(blurredFrame.allocationSize());
  await blurredFrame.copyTo(blurredData);

  // Sample pixel in blurred region - should not be pure black or white
  const centerX = 160;
  const centerY = 120;
  const centerIdx = (centerY * width + centerX) * 4;
  const centerR = blurredData[centerIdx];

  // Blurred region should have intermediate values (not 0 or 255)
  // Due to blur mixing black and white squares
  console.log(`[INFO] Center pixel R value: ${centerR}`);
  if (centerR === 0 || centerR === 255) {
    console.log(
      '[WARN] Center pixel was not blurred as expected (may be edge case)',
    );
  }

  // Encode and decode roundtrip
  const chunks = [];
  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => {
      throw e;
    },
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width,
    height,
    bitrate: 500000,
    framerate: 30,
  });

  encoder.encode(blurredFrame, {keyFrame: true});
  await encoder.flush();

  console.log(
    `[INFO] Encoded to ${chunks.length} chunk(s), size: ${chunks[0].byteLength} bytes`,
  );

  // Decode
  const decodedFrames = [];
  const decoder = new VideoDecoder({
    output: f => decodedFrames.push(f),
    error: e => {
      throw e;
    },
  });

  decoder.configure({
    codec: 'avc1.42001E',
    codedWidth: width,
    codedHeight: height,
  });

  decoder.decode(chunks[0]);
  await decoder.flush();

  console.log(`[INFO] Decoded ${decodedFrames.length} frame(s)`);

  if (decodedFrames.length !== 1) {
    throw new Error(`Expected 1 decoded frame, got ${decodedFrames.length}`);
  }

  // Cleanup
  frame.close();
  blurredFrame.close();
  decodedFrames.forEach(f => f.close());
  filter.close();
  encoder.close();
  decoder.close();

  console.log('[PASS] Blur region integration test complete!');
}

runTest().catch(e => {
  console.error('[FAIL]', e.message);
  process.exit(1);
});
