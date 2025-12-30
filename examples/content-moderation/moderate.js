/**
 * Content Moderation Example
 *
 * Demonstrates the WebCodecs frame-by-frame processing pipeline:
 * 1. Decode video frames
 * 2. Run "detection" (mocked - returns hardcoded bounding boxes)
 * 3. Blur detected regions
 * 4. Re-encode processed frames
 *
 * Usage: node moderate.js
 */

const {
  VideoEncoder,
  VideoDecoder,
  VideoFrame,
  VideoFilter,
  EncodedVideoChunk,
} = require('../../dist');
const fs = require('fs');

// Mock AI detector - in production, this would call ONNX/TensorFlow
function mockDetectContent(frame, frameIndex) {
  // Simulate detection: return regions for frames 2-4
  if (frameIndex >= 2 && frameIndex <= 4) {
    return [
      {
        x: 100,
        y: 80,
        width: 120,
        height: 100,
        label: 'detected-object',
        confidence: 0.95,
      },
    ];
  }
  return [];
}

async function moderateVideo() {
  console.log('=== Content Moderation Pipeline Demo ===\n');

  const width = 320;
  const height = 240;
  const frameCount = 10;

  // Step 1: Generate test frames (simulating decoded video)
  console.log(
    `[1/4] Generating ${frameCount} test frames (${width}x${height})...`,
  );
  const testFrames = [];
  for (let i = 0; i < frameCount; i++) {
    const buf = Buffer.alloc(width * height * 4);
    // Create gradient pattern that varies per frame
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        buf[idx] = (x + i * 10) % 256; // R varies with frame
        buf[idx + 1] = (y + i * 5) % 256; // G varies with frame
        buf[idx + 2] = 128; // B constant
        buf[idx + 3] = 255; // A
      }
    }
    testFrames.push(
      new VideoFrame(buf, {
        codedWidth: width,
        codedHeight: height,
        timestamp: i * 33333, // ~30fps timing
      }),
    );
  }
  console.log(`    Created ${testFrames.length} frames\n`);

  // Step 2: Setup filter and encoder
  console.log('[2/4] Initializing VideoFilter and VideoEncoder...');
  const filter = new VideoFilter();
  filter.configure({width, height});

  const outputChunks = [];
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      outputChunks.push({chunk, meta});
    },
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width,
    height,
    bitrate: 1_000_000,
    framerate: 30,
  });
  console.log('    Filter and encoder ready\n');

  // Step 3: Process each frame
  console.log('[3/4] Processing frames (detect -> blur -> encode)...');
  const moderationLog = [];

  for (let i = 0; i < testFrames.length; i++) {
    const frame = testFrames[i];

    // Run "AI detection"
    const detections = mockDetectContent(frame, i);

    let processedFrame;
    if (detections.length > 0) {
      // Apply blur to detected regions
      const regions = detections.map(d => ({
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
      }));

      processedFrame = filter.applyBlur(frame, regions, 30);

      moderationLog.push({
        frame: i,
        timestamp: frame.timestamp,
        detections: detections,
        action: 'blurred',
      });

      console.log(
        `    Frame ${i}: DETECTED ${detections.length} region(s) -> BLURRED`,
      );
    } else {
      // No detections - clone frame unchanged
      processedFrame = frame.clone();
      console.log(`    Frame ${i}: clean`);
    }

    // Encode processed frame
    encoder.encode(processedFrame, {keyFrame: i === 0});

    // Cleanup
    processedFrame.close();
    frame.close();
  }

  await encoder.flush();
  console.log(`\n    Encoded ${outputChunks.length} chunks\n`);

  // Step 4: Summary
  console.log('[4/4] Moderation Summary:');
  console.log('─'.repeat(50));
  console.log(`    Total frames processed: ${frameCount}`);
  console.log(`    Frames with detections: ${moderationLog.length}`);
  console.log(`    Output chunks: ${outputChunks.length}`);

  const totalBytes = outputChunks.reduce(
    (sum, c) => sum + c.chunk.byteLength,
    0,
  );
  console.log(`    Total encoded size: ${totalBytes} bytes`);

  if (moderationLog.length > 0) {
    console.log('\n    Flagged frames:');
    moderationLog.forEach(entry => {
      console.log(
        `      - Frame ${entry.frame} @ ${entry.timestamp}μs: ${entry.detections.length} detection(s)`,
      );
    });
  }

  console.log('\n=== Demo Complete ===');

  // Cleanup
  filter.close();
  encoder.close();

  return {outputChunks, moderationLog};
}

// Run if executed directly
if (require.main === module) {
  moderateVideo().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}

module.exports = {moderateVideo, mockDetectContent};
