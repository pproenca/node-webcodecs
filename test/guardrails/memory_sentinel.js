const {VideoEncoder, VideoFrame} = require('../../dist');

const LIMIT_MB = 50;
const FRAMES = 10000;
const FLUSH_INTERVAL = 100; // Flush every 100 frames to prevent unbounded queue growth

async function run() {
  console.log(`Memory Leak Check (${FRAMES} frames)`);

  // Baseline
  if (global.gc) global.gc();
  const startRSS = process.memoryUsage().rss;

  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: e => {
      throw e;
    },
  });
  encoder.configure({codec: 'avc1.42001E', width: 640, height: 480});

  const buf = Buffer.alloc(640 * 480 * 4);

  for (let i = 0; i < FRAMES; i++) {
    const frame = new VideoFrame(buf, {
      codedWidth: 640,
      codedHeight: 480,
      timestamp: i * 33000,
    });

    encoder.encode(frame);
    frame.close();

    // Prevent unbounded queue growth by flushing periodically
    // Without this, the async worker queue grows to FRAMES size, causing huge memory usage
    // that looks like a leak but is just buffered data.
    if (i % FLUSH_INTERVAL === 0) {
      await encoder.flush();
    }

    // Periodic GC to isolate C++ leaks from JS wrappers
    if (i % 1000 === 0 && global.gc) {
      global.gc();
      const currentMB = (process.memoryUsage().rss - startRSS) / 1024 / 1024;
      console.log(`  Frame ${i}: +${currentMB.toFixed(2)} MB`);
    }
  }

  await encoder.flush();
  encoder.close();

  if (global.gc) global.gc();

  const endRSS = process.memoryUsage().rss;
  const growthMB = (endRSS - startRSS) / 1024 / 1024;

  console.log(
    `Total Growth: ${growthMB.toFixed(2)} MB (Limit: ${LIMIT_MB} MB)`,
  );

  if (growthMB > LIMIT_MB) {
    console.error(
      `FAILURE: Memory grew by ${growthMB.toFixed(2)}MB. Likely leaking AVFrames.`,
    );
    process.exit(1);
  }
  console.log('SUCCESS: Memory stable.');
}

run().catch(e => {
  console.error('FAILURE:', e.message);
  process.exit(1);
});
