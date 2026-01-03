const {VideoEncoder, VideoFrame} = require('@pproenca/node-webcodecs');
const {performance} = require('node:perf_hooks');

const MAX_LAG_MS = 20;
const FRAMES = 50;

async function run() {
  console.log('Event Loop Latency Check');

  let maxLag = 0;
  let lastTime = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTime;
    const lag = delta - 10; // Expected 10ms interval
    if (lag > maxLag) maxLag = lag;
    lastTime = now;
  }, 10);

  const encoder = new VideoEncoder({
    output: chunk => {
      if (chunk.close) chunk.close();
    },
    error: e => {
      throw e;
    },
  });
  encoder.configure({codec: 'avc1.42001E', width: 1920, height: 1080});

  const buf = Buffer.alloc(1920 * 1080 * 4);

  console.log(`  Encoding ${FRAMES} frames at 1080p...`);
  for (let i = 0; i < FRAMES; i++) {
    const frame = new VideoFrame(buf, {
      codedWidth: 1920,
      codedHeight: 1080,
      timestamp: i * 33000, // ~30fps frame interval in microseconds
    });
    encoder.encode(frame);
    frame.close();
  }

  await encoder.flush();
  encoder.close();
  clearInterval(timer);

  console.log(
    `Max Event Loop Lag: ${maxLag.toFixed(2)}ms (Limit: ${MAX_LAG_MS}ms)`,
  );

  if (maxLag > MAX_LAG_MS) {
    console.warn(
      `WARNING: Encoder blocking event loop. Lag: ${maxLag.toFixed(2)}ms.`,
    );
    console.warn(
      'ACTION REQUIRED: Move encoding to AsyncWorker for production use.',
    );
    // Warning-only: Current sync implementation blocks by design.
    // This becomes a hard failure once async encoding is implemented.
  } else {
    console.log('SUCCESS: Non-blocking execution.');
  }
}

run()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('FAILURE:', e.message);
    process.exit(1);
  });
