/**
 * Demo 03: Content Moderation Pipeline
 *
 * Demonstrates the VideoFilter capability for content moderation:
 * 1. Generate test frames with "detected" regions
 * 2. Run mock detection (simulating AI inference)
 * 3. Apply blur to detected regions using VideoFilter.applyBlur()
 * 4. Re-encode with blurred regions
 * 5. Output moderation log and processed video
 */

const fs = require('node:fs');
const path = require('node:path');
const {VideoEncoder, VideoFrame, VideoFilter} = require('@pproenca/node-webcodecs');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_H264 = path.join(OUTPUT_DIR, 'moderated.h264');

const WIDTH = 320;
const HEIGHT = 240;
const FRAME_COUNT = 30;

// Mock AI detector - in production, call ONNX/TensorFlow
function mockDetectContent(frameIndex) {
  // Simulate detection: return regions for frames 5-15
  if (frameIndex >= 5 && frameIndex <= 15) {
    return [
      {
        x: 100,
        y: 80,
        width: 120,
        height: 80,
        label: 'detected-region',
        confidence: 0.95,
      },
    ];
  }
  return [];
}

async function main() {
  console.log('=== Demo 03: Content Moderation Pipeline ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  }

  const moderationLog = [];
  const outputChunks = [];

  // Step 1: Initialize filter and encoder
  console.log('[1/4] Initializing VideoFilter and VideoEncoder...');
  const filter = new VideoFilter();
  filter.configure({width: WIDTH, height: HEIGHT});

  const encoder = new VideoEncoder({
    output: chunk => outputChunks.push(chunk),
    error: e => console.error('Encoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.42001E',
    width: WIDTH,
    height: HEIGHT,
    bitrate: 1_000_000,
    framerate: 30,
    latencyMode: 'realtime',  // Disable B-frames for correct output
  });
  console.log(`    Filter and encoder ready (${WIDTH}x${HEIGHT})\n`);

  // Step 2: Generate and process frames
  console.log(`[2/4] Processing ${FRAME_COUNT} frames (detect -> blur -> encode)...`);
  const startTime = performance.now();

  for (let i = 0; i < FRAME_COUNT; i++) {
    // Generate test frame with gradient
    const buf = Buffer.alloc(WIDTH * HEIGHT * 4);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const idx = (y * WIDTH + x) * 4;
        buf[idx] = (x + i * 10) % 256;
        buf[idx + 1] = (y + i * 5) % 256;
        buf[idx + 2] = 128;
        buf[idx + 3] = 255;
      }
    }

    const frame = new VideoFrame(buf, {
      codedWidth: WIDTH,
      codedHeight: HEIGHT,
      timestamp: i * 33333,
    });

    // Run detection
    const detections = mockDetectContent(i);

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
        detections,
        action: 'blurred',
      });

      console.log(`    Frame ${i}: DETECTED ${detections.length} region(s) -> BLURRED`);
    } else {
      processedFrame = frame.clone();
      if (i % 10 === 0) {
        console.log(`    Frame ${i}: clean`);
      }
    }

    encoder.encode(processedFrame, {keyFrame: i === 0});
    processedFrame.close();
    frame.close();
  }

  await encoder.flush();
  const endTime = performance.now();
  console.log('');

  // Step 3: Write output
  console.log('[3/4] Writing output file...');
  const outputData = Buffer.concat(
    outputChunks.map(chunk => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      return Buffer.from(buf);
    })
  );
  fs.writeFileSync(OUTPUT_H264, outputData);
  console.log(`    Output: ${OUTPUT_H264} (${(outputData.length / 1024).toFixed(2)} KB)\n`);

  // Step 4: Summary
  console.log('[4/4] Moderation Summary:');
  console.log('─'.repeat(50));
  console.log(`    Total frames: ${FRAME_COUNT}`);
  console.log(`    Frames with detections: ${moderationLog.length}`);
  console.log(`    Processing time: ${(endTime - startTime).toFixed(1)}ms`);
  console.log(`    Output size: ${(outputData.length / 1024).toFixed(2)} KB`);

  if (moderationLog.length > 0) {
    console.log('\n    Flagged frames:');
    moderationLog.forEach(entry => {
      console.log(`      - Frame ${entry.frame} @ ${entry.timestamp}μs`);
    });
  }

  // Cleanup
  filter.close();
  encoder.close();

  console.log('\n=== Demo 03 Complete ===');

  return {
    totalFrames: FRAME_COUNT,
    flaggedFrames: moderationLog.length,
    outputBytes: outputData.length,
    processingTimeMs: endTime - startTime,
    outputPath: OUTPUT_H264,
    moderationLog,
  };
}

module.exports = {main, mockDetectContent};

if (require.main === module) {
  main().catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
}
